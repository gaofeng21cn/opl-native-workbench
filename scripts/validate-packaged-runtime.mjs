import fs from "node:fs";
import path from "node:path";
import { assert, readJson, root } from "./native-workbench-gates.mjs";

const appName = "One Person Lab Native Workbench Candidate";
const appRoot = path.join(root, "out", `${appName}.app`);
const resourcesDir = path.join(appRoot, "Contents", "Resources");
const executablePath = path.join(appRoot, "Contents", "MacOS", appName);
const workbenchPath = path.join(resourcesDir, "workbench.html");
const rendererPath = path.join(resourcesDir, "renderer.js");
const manifestPath = path.join(resourcesDir, "package-manifest.json");
const nativeSourcePath = path.join(root, "scripts", "native-workbench-app.swift");

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
  'branding/opl-app-logo.png'
]) {
  assert(workbench.includes(marker), `missing packaged workbench marker ${marker}`);
}
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
  'Codex app-server',
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
  "thread/start",
  "thread/resume",
  "turn/start",
  "turn/completed",
  "item/agentMessage/delta",
  "item/completed",
  "sandboxPolicy",
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
  "executeAction",
  'opl-runtime-action-dry-run',
  'opl-runtime-action-receipt',
  'opl-settings-panel',
  'opl-model-access-entry',
  'opl-locale-toggle'
]) {
  assert(renderer.includes(marker), `missing packaged functional MVP marker ${marker}`);
}
assert(renderer.includes("context-inspector"), "workspace detail surface must use a right inspector");
assert(renderer.includes("useState(true)"), "workspace inspector must default open against the accepted visual reference");

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
assert(manifest.native_runtime === "AppKit/WKWebView", "native runtime must be AppKit/WKWebView");
assert(manifest.opens_default_browser === false, "candidate app must not open the default browser");
assert(manifest.app_bundle_workbench === "Contents/Resources/workbench.html", "manifest must point at workbench.html");
assert(manifest.external_layout_reference?.repo === "https://github.com/K-Dense-AI/k-dense-byok", "manifest must record the K-Dense layout reference");
assert(manifest.external_layout_reference?.companion_repo === "https://github.com/ai4s-research/open-science", "manifest must record the Open Science visual reference");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("project-first persistent left sidebar for Current project, context inputs, attachments/outputs, and recent chats per project"), "manifest must record the project-first sidebar adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("single conversation canvas with centered max-width thread and bottom composer"), "manifest must record the Codex-style conversation adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("top model/access configuration stays in the center topbar"), "manifest must record the top model configuration adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("attachments, outputs, preview, provenance, workflows, and export live in a right inspector with Preview open by default and collapsible"), "manifest must record the right preview inspector adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("chat tab strip and bottom composer as primary interaction"), "manifest must record the chat-first K-Dense adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("right Preview inspector is default-open and collapsible"), "manifest must record the default-open collapsible inspector adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("Open Science paper-light surface, thin borders, compact message blocks, and rounded composer"), "manifest must record the Open Science visual adaptation");
assert(manifest.functional_mvp?.codex_app_server_thread_turn === true, "manifest must record Codex app-server thread/turn MVP");
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
assert(rootManifest.opens_default_browser === false, "root manifest must preserve browser boundary");

console.log(JSON.stringify({
  status: "packaged_native_runtime_valid",
  native_runtime: manifest.native_runtime,
  opens_default_browser: manifest.opens_default_browser,
  app_bundle_path: manifest.app_bundle_path
}, null, 2));
