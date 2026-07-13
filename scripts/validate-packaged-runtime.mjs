import fs from "node:fs";
import path from "node:path";
import { assert, readJson, root } from "./native-workbench-gates.mjs";
import { readCodexModelPolicy } from "./build-renderer.mjs";

const appName = "One Person Lab Native Workbench Candidate";
const appRoot = path.join(root, "out", `${appName}.app`);
const resourcesDir = path.join(appRoot, "Contents", "Resources");
const executablePath = path.join(appRoot, "Contents", "MacOS", appName);
const workbenchPath = path.join(resourcesDir, "workbench.html");
const rendererPath = path.join(resourcesDir, "renderer.js");
const manifestPath = path.join(resourcesDir, "package-manifest.json");
const nativeSourcePath = path.join(root, "scripts", "native-workbench-app.swift");
const appModelPolicy = readCodexModelPolicy();

function assertOrderedValues(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array`);
  assert(actual.length === expected.length, `${label} length must match the App product profile`);
  for (const [index, value] of expected.entries()) {
    assert(actual[index] === value, `${label}[${index}] must match the App product profile`);
  }
}

assert(fs.existsSync(appRoot), "missing packaged .app");
assert(fs.existsSync(executablePath), "missing packaged executable");
assert(fs.existsSync(workbenchPath), "missing packaged native workbench HTML");
assert(fs.existsSync(rendererPath), "missing packaged shared renderer script");
assert(!fs.existsSync(path.join(resourcesDir, "preview.html")), "preview-only browser page must not be packaged");

const executable = fs.readFileSync(executablePath);
const magic = executable.subarray(0, 4).toString("hex");
assert(executable.subarray(0, 2).toString() !== "#!", "packaged executable must not be a shell script");
assert(["cffaedfe", "feedfacf", "cafebabe", "cafebabf"].includes(magic), `packaged executable is not Mach-O: ${magic}`);

const workbench = fs.readFileSync(workbenchPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");
const nativeSource = fs.readFileSync(nativeSourcePath, "utf8");
const settingsModel = fs.readFileSync(path.join(root, "src", "workbench", "settingsModel.ts"), "utf8");
const evidence = readJson("src/candidateContractEvidence.json");
assert(evidence.capabilities.includes("local_candidate_live_smoke"), "candidate evidence must include local candidate live smoke capability");
assert(evidence.functional_mvp_closeout?.local_candidate_live_smoke?.command === "npm run smoke:native-live", "candidate evidence must document native live smoke command");
assert(evidence.functional_mvp_closeout?.local_candidate_live_smoke?.artifact === "out/native-live-smoke.json", "candidate evidence must document native live smoke artifact");
assert(evidence.functional_mvp_closeout?.local_candidate_live_smoke?.boundaries?.active_shell_adopted === false, "native live smoke must not claim active shell adoption");
assert(evidence.functional_mvp_closeout?.local_candidate_live_smoke?.boundaries?.release_ready === false, "native live smoke must not claim release readiness");
assert(evidence.functional_mvp_closeout?.local_candidate_live_smoke?.boundaries?.clean_vm_ready === false, "native live smoke must not claim clean-VM readiness");
for (const marker of [
  '<div id="root"></div>',
  './renderer.js',
  'branding/opl-app-logo.png',
  '__OPL_CODEX_MODEL_POLICY__'
]) {
  assert(workbench.includes(marker), `missing packaged workbench marker ${marker}`);
}
const serializedModelPolicy = JSON.stringify(appModelPolicy).replaceAll("<", "\\u003c");
assert(
  workbench.includes(`globalThis.__OPL_CODEX_MODEL_POLICY__=${serializedModelPolicy};`),
  "packaged workbench model policy injection must match the current App product profile"
);
for (const marker of [
  'opl-native-workbench-root',
  'opl-workspace-rail',
  'opl-project-inputs',
  'opl-project-attachments',
  'opl-project-chats',
  'opl-topbar-model-config',
  'opl-assistant-artifact-card',
  'opl-selected-artifact-preview',
  'opl-artifact-preview-tabs',
  'opl-provenance-drawer',
  'opl-confirmation-card',
  'opl-renderer-module-registry',
  'codex-sidebar-chat',
  'messageHandlers?.oplNativeWorkbench',
  'native://oplNativeWorkbench',
  'codex app-server',
  'initialize',
  '/api/opl-events',
  'branding/opl-app-logo.png'
]) {
  assert(renderer.includes(marker), `missing packaged renderer marker ${marker}`);
}
for (const marker of [
  "WKScriptMessageHandler",
  "codex\",",
  "app-server",
  "initialize",
  "model/list",
  "thread/start",
  "thread/resume",
  "turn/start",
  "turn/completed",
  "item/agentMessage/delta",
  "item/completed",
  "sandboxPolicy",
  'turnParams["model"] = model',
  'turnParams["effort"] = effort',
  "\"type\": \"readOnly\"",
  "approvalPolicy\": \"never\"",
  "process.terminationHandler",
  "turn timed out after",
  "opl\", \"app\", \"state",
  "--dry-run"
]) {
  assert(nativeSource.includes(marker), `missing native bridge marker ${marker}`);
}
for (const marker of ["runtimeWorkspaceRoots", "excludeTurns"]) {
  assert(!nativeSource.includes(marker), `native bridge must not send unsupported app-server param ${marker}`);
}
for (const marker of [
  "readState",
  "readFullDrilldown",
  "readCodexModels",
  "executeAction",
  'opl-runtime-action-dry-run',
  'opl-runtime-action-receipt',
  'opl-settings-panel',
  'opl-model-access-entry',
  'opl-locale-toggle',
  'reasoningEffort'
]) {
  assert(renderer.includes(marker), `missing packaged functional MVP marker ${marker}`);
}
assert(renderer.includes("context-inspector"), "environment detail surface must exist");
assert(renderer.includes("useState(false)"), "environment details must stay closed until explicitly requested");

for (const asset of [
  "app.icns",
  "branding/opl-app-logo.png",
  "branding/opl-banner.png",
  "package-manifest.json",
  "renderer-build.json"
]) {
  assert(fs.existsSync(path.join(resourcesDir, asset)), `missing packaged asset ${asset}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert(manifest.status === "candidate_app_bundle_built", "package status must describe a built candidate, not readiness");
assert(manifest.native_runtime === "AppKit/WKWebView", "native runtime must be AppKit/WKWebView");
assert(manifest.opens_default_browser === false, "candidate app must not open the default browser");
assert(manifest.app_bundle_workbench === "Contents/Resources/workbench.html", "manifest must point at workbench.html");
assert(manifest.primary_visual_reference?.product === "ChatGPT Codex macOS", "manifest must record ChatGPT Codex as the primary visual reference");
assert(manifest.primary_visual_reference?.version === "26.707.41301", "manifest must record the current Codex reference version");
assert(manifest.primary_visual_reference?.source_usage === "visual_and_interaction_reference_only_no_code_or_brand_copy", "manifest must keep Codex reference use visual-only");
assert(manifest.default_home_layout?.project_rail_visible === true, "manifest must keep the project rail visible by default");
assert(manifest.default_home_layout?.environment_details_default_open === false, "manifest must keep environment details closed by default");
assert(manifest.default_home_layout?.environment_details_presentation === "floating", "manifest must keep environment details floating");
assert(manifest.codex_model_policy?.source === appModelPolicy.source, "manifest must bind model policy to the App product profile");
assert(manifest.codex_model_policy?.default_model === appModelPolicy.defaultModel, "manifest default model must match the App product profile");
assert(manifest.codex_model_policy?.default_reasoning_effort === appModelPolicy.defaultReasoningEffort, "manifest default reasoning effort must match the App product profile");
assertOrderedValues(
  manifest.codex_model_policy?.visible_models,
  appModelPolicy.visibleModels.map((option) => option.id),
  "manifest visible models"
);
assertOrderedValues(manifest.codex_model_policy?.reasoning_efforts, appModelPolicy.reasoningEfforts, "manifest reasoning efforts");
assert(manifest.external_layout_reference?.repo === "https://github.com/K-Dense-AI/k-dense-byok", "manifest must record the K-Dense layout reference");
assert(manifest.external_layout_reference?.companion_repo === "https://github.com/ai4s-research/open-science", "manifest must record the Open Science visual reference");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("persistent project and conversation rail with compact project context links"), "manifest must record the Codex project rail adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("single conversation canvas with centered max-width thread and bottom composer"), "manifest must record the Codex-style conversation adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("model and reasoning controls stay in the composer bottom row"), "manifest must record composer model configuration");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("attachments, outputs, preview, provenance, workflows, packages, and runtime live in floating user-requested environment details"), "manifest must record floating environment details");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("environment details are closed by default and do not resize the chat canvas"), "manifest must record closed-by-default environment details");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("K-Dense and Open Science remain feature references rather than the visual shell baseline"), "manifest must demote external workbenches to feature references");
assert(manifest.functional_mvp?.codex_app_server_thread_turn === true, "manifest must record Codex app-server thread/turn MVP");
assert(manifest.functional_mvp?.codex_protocol?.includes("model/list"), "manifest must record app-server model availability reads");
assert(manifest.functional_mvp?.default_sandbox === "read-only", "manifest must record read-only Codex sandbox");
for (const field of evidence.functional_mvp_closeout?.not_ready ?? []) {
  assert(manifest[field] !== true, `candidate package must not claim ${field}`);
}
assert(manifest.release_ready === false, "candidate package must not claim release readiness");
assert(manifest.live_evidence === false, "candidate package must not claim live evidence");
for (const marker of [
  "SETTINGS_STORAGE_KEY",
  "opl.nativeWorkbench.settings.v1",
  "localStorage",
  "readSettings",
  "writeSettings",
  "confirmBeforeExecute",
  "artifactPreviewMode",
  "professionalStarterDefaults"
]) {
  assert(settingsModel.includes(marker), `missing settings persistence marker ${marker}`);
}
assert(evidence.false_ready_boundary.settings_system_write_permission === false, "settings system write permission must stay false");
assert(evidence.false_ready_boundary.artifact_authority === false, "artifact authority must stay false");
assert(evidence.false_ready_boundary.starter_execution_authority === false, "starter execution authority must stay false");

const rootManifest = readJson("out/opl-native-workbench-candidate-manifest.json");
assert(rootManifest.status === "candidate_app_bundle_built", "root manifest must not use a readiness status for a built candidate");
assert(rootManifest.opens_default_browser === false, "root manifest must preserve browser boundary");

console.log(JSON.stringify({
  status: "packaged_native_runtime_valid",
  native_runtime: manifest.native_runtime,
  opens_default_browser: manifest.opens_default_browser,
  app_bundle_path: manifest.app_bundle_path
}, null, 2));
