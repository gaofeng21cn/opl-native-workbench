import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, readJson, root } from "./opl-studio-gates.mjs";
import { readCodexModelPolicy } from "./build-renderer.mjs";

const appName = "One Person Lab Studio Preview";
const appRoot = path.join(root, "out", `${appName}.app`);
const resourcesDir = path.join(appRoot, "Contents", "Resources");
const executablePath = path.join(appRoot, "Contents", "MacOS", appName);
const workbenchPath = path.join(resourcesDir, "workbench.html");
const rendererPath = path.join(resourcesDir, "renderer.js");
const stylesheetPath = path.join(resourcesDir, "renderer.css");
const noticesPath = path.join(resourcesDir, "THIRD_PARTY_NOTICES.md");
const manifestPath = path.join(resourcesDir, "package-manifest.json");
const nativeSourcePath = path.join(root, "scripts", "opl-studio-app.swift");
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
assert(fs.existsSync(workbenchPath), "missing packaged OPL Studio HTML");
assert(fs.existsSync(rendererPath), "missing packaged shared renderer script");
assert(fs.existsSync(stylesheetPath), "missing packaged DeepSeek Harness stylesheet closure");
assert(fs.existsSync(noticesPath), "missing packaged third-party notices");
assert(!fs.existsSync(path.join(resourcesDir, "preview.html")), "preview-only browser page must not be packaged");

const signatureCheck = spawnSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appRoot], {
  cwd: root,
  encoding: "utf8"
});
assert(
  signatureCheck.status === 0,
  `packaged app bundle signature is invalid\n${signatureCheck.stdout}\n${signatureCheck.stderr}`
);

const executable = fs.readFileSync(executablePath);
const magic = executable.subarray(0, 4).toString("hex");
assert(executable.subarray(0, 2).toString() !== "#!", "packaged executable must not be a shell script");
assert(["cffaedfe", "feedfacf", "cafebabe", "cafebabf"].includes(magic), `packaged executable is not Mach-O: ${magic}`);

const policySmoke = spawnSync(executablePath, [], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    OPL_STUDIO_POLICY_SMOKE: "1",
    OPL_STUDIO_READ_ONLY: "1"
  }
});
assert(policySmoke.status === 0, `Candidate action policy smoke failed\n${policySmoke.stdout}\n${policySmoke.stderr}`);
const policySmokePayload = JSON.parse(policySmoke.stdout);
assert(policySmokePayload.mutationBlocked === true, "Candidate read-only policy must block non-dry-run mutation");
assert(policySmokePayload.dryRunAllowed === true, "Candidate read-only policy must preserve dry-run actions");

const workbench = fs.readFileSync(workbenchPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");
const stylesheet = fs.readFileSync(stylesheetPath, "utf8");
const notices = fs.readFileSync(noticesPath, "utf8");
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
  '<link rel="stylesheet" href="./renderer.css" />',
  './renderer.js',
  '__OPL_CODEX_MODEL_POLICY__'
]) {
  assert(workbench.includes(marker), `missing packaged workbench marker ${marker}`);
}
for (const marker of [
  "SlotCore",
  "createSlotRenderer",
  "AppFrame",
  "SidebarRoot",
  "ConversationRoot",
  "InputBar",
  "SettingsRoot",
  "opl-studio-overlay"
]) {
  assert(renderer.includes(marker), `missing packaged DeepSeek Harness composition marker ${marker}`);
}
for (const stylesheetRoot of [
  "AppFrame.module.css",
  "SidebarRoot.module.css",
  "ConversationRoot.module.css",
  "InputBar.module.css",
  "SettingsRoot.module.css",
  "Button.module.css",
  "Pill.module.css",
  "Tooltip.module.css"
]) {
  assert(stylesheet.includes(stylesheetRoot), `packaged stylesheet must contain ${stylesheetRoot}`);
}
assert(notices.includes("DeepSeek Harness") && notices.includes("MIT License") && notices.includes("47f943859bef60e4160492346772ded9b24f765a"), "packaged notices must preserve the DeepSeek Harness MIT provenance");
const serializedModelPolicy = JSON.stringify(appModelPolicy).replaceAll("<", "\\u003c");
assert(
  workbench.includes(`globalThis.__OPL_CODEX_MODEL_POLICY__=${serializedModelPolicy};`),
  "packaged workbench model policy injection must match the current App product profile"
);
for (const marker of [
  'opl-studio-root',
  'opl-workspace-rail',
  'opl-project-chats',
  'opl-real-thread-directory',
  'opl-thread-scope-filter',
  'opl-thread-detail-popover',
  'opl-thread-lifecycle-confirmation',
  'opl-topbar-model-config',
  'opl-runtime-status-panel',
  'opl-agent-run-status',
  'opl-runtime-contributions',
  'opl-files-results-panel',
  'opl-artifact-preview-tabs',
  'opl-agents-capabilities-panel',
  'opl-current-agent-capabilities',
  'opl-codex-capability-catalog',
  'codex-sidebar-chat',
  'messageHandlers?.oplStudio',
  'native://oplStudio',
  'codex app-server',
  'initialize',
  '/api/opl-events'
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
  "thread/list",
  "thread/read",
  "thread/resume",
  "thread/fork",
  "thread/archive",
  "thread/unarchive",
  "turn/start",
  "turn/completed",
  "item/agentMessage/delta",
  "item/completed",
  "permissionProfile/list",
  'turnParams["model"] = model',
  'turnParams["effort"] = effort',
  '"permissions": resolvedPermissions',
  "approvalPolicy\": \"never\"",
  "process.terminationHandler",
  "turn timed out after",
  "opl\", \"app\", \"state",
  "--dry-run",
  "OPL_CODEX_BIN",
  "OPL_APP_OPL_BIN",
  "OPL_APP_RUNTIME_IDENTITY_JSON",
  "readRuntimeIdentity",
  "OPL_STUDIO_READ_ONLY",
  "blocked_read_only"
]) {
  assert(nativeSource.includes(marker), `missing native bridge marker ${marker}`);
}
for (const marker of [
  "final class CodexThreadAdapter",
  'projected["parentThreadId"]',
  'projected["agentRole"]',
  'projected["agentNickname"]',
  'projected["sourceKind"]'
]) {
  assert(nativeSource.includes(marker), `missing native thread projection marker ${marker}`);
}
for (const retired of [
  "prepareCoordination",
  "dispatchCoordination",
  "waitCoordination",
  "host_queue",
  "item/tool/call",
  "dynamicTools",
  "CoordinationLedger",
  "ThreadCoordinationHost"
]) {
  assert(!nativeSource.includes(retired), `retired private thread marker must not be packaged: ${retired}`);
}
for (const marker of ["runtimeWorkspaceRoots", "excludeTurns"]) {
  assert(!nativeSource.includes(marker), `native bridge must not send unsupported app-server param ${marker}`);
}
for (const marker of [
  "readState",
  "readFullDrilldown",
  "readCodexModels",
  "executeAction",
  'opl-runtime-status-panel',
  'opl-runtime-contributions',
  'opl-runtime-action-receipt',
  'opl-settings-panel',
  'opl-model-access-entry',
  'opl-locale-toggle',
  'reasoningEffort'
]) {
  assert(renderer.includes(marker), `missing packaged functional MVP marker ${marker}`);
}
assert(renderer.includes("opl-dsh-context-panel"), "on-demand details surface must exist");
assert(renderer.includes("opl-mobile-details-overlay"), "narrow viewports must keep details accessible");
assert(!renderer.includes("branding/opl-app-logo.png"), "renderer must keep product identity text-only");

for (const asset of [
  "app.icns",
  "package-manifest.json",
  "renderer-build.json"
]) {
  assert(fs.existsSync(path.join(resourcesDir, asset)), `missing packaged asset ${asset}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert(manifest.status === "candidate_app_bundle_built", "package status must describe a built candidate, not readiness");
assert(manifest.bundle_identity?.display_name === appName, "manifest must preserve the formal Native test name");
assert(manifest.bundle_identity?.bundle_id === "cn.gflab.opl.studio.preview", "manifest must preserve the isolated candidate bundle id");
assert(manifest.bundle_identity?.installed_app_path === "/Applications/One Person Lab Studio Preview.app", "manifest must record the formal Native install path");
assert(manifest.bundle_identity?.isolated_from_active_mainline_bundle_id === "cn.onepersonlab.opl", "manifest must record the active mainline bundle isolation boundary");
assert(manifest.launcher_runtime_resolution?.identity_schema === "app_runtime_executable_identity.v1", "manifest must record launcher Runtime identity readback");
assert(manifest.launcher_runtime_resolution?.direct_launch_fallback === "host_path_without_runtime_parity_claim", "direct Candidate launch must not claim Runtime parity");
assert(manifest.candidate_mutation_policy?.launcher_default === "dry_run_only", "Candidate launcher must default actions to dry-run only");
assert(manifest.candidate_mutation_policy?.blocked_receipt_kind === "blocked_read_only", "Candidate package must record the typed read-only blocker");
assert(manifest.native_runtime === "AppKit/WKWebView", "native runtime must be AppKit/WKWebView");
assert(JSON.stringify(manifest.carrier_policy?.enabled) === JSON.stringify(["codex_app_server_stdio"]), "package must enable only the Codex stdio carrier");
assert(JSON.stringify(manifest.carrier_policy?.reserved_disabled) === JSON.stringify(["pi", "hermes"]), "package must reserve Pi/Hermes as disabled carriers only");
assert(manifest.carrier_policy?.aioncore_required === false, "package must not require AionCore");
assert(manifest.carrier_policy?.disabled_carriers_add_runtime_dependencies === false, "disabled carriers must add no package dependency");
assert(manifest.carrier_policy?.thread_overview?.includes("useStateDbOnly=true"), "package must record the canonical Codex state DB overview");
assert(manifest.opens_default_browser === false, "candidate app must not open the default browser");
assert(manifest.app_bundle_workbench === "Contents/Resources/workbench.html", "manifest must point at workbench.html");
assert(manifest.app_bundle_stylesheet === "Contents/Resources/renderer.css", "manifest must point at the packaged stylesheet");
assert(manifest.app_bundle_third_party_notices === "Contents/Resources/THIRD_PARTY_NOTICES.md", "manifest must point at third-party notices");
assert(manifest.primary_visual_reference?.product === "DeepSeek Harness", "manifest must record DeepSeek Harness as the primary GUI reference");
assert(manifest.primary_visual_reference?.version === "47f943859bef60e4160492346772ded9b24f765a", "manifest must record the pinned DeepSeek Harness source ref");
assert(manifest.primary_visual_reference?.reference_date === "2026-08-14", "manifest must record the DeepSeek Harness inspection date");
assert(manifest.primary_visual_reference?.source_usage === "direct_mit_gui_source_reuse", "manifest must record direct MIT GUI reuse");
assert(manifest.deepseek_harness_source_reuse?.ui_package_version === "0.1.0-rc.6", "manifest must record the verified DeepSeek Harness UI package version");
assert(manifest.deepseek_harness_source_reuse?.source_package_version === "0.1.0-rc.5", "manifest must record the pinned DeepSeek Harness source package version");
assert(manifest.deepseek_harness_source_reuse?.adopted_scope?.includes("SlotCore"), "manifest must record the reused DeepSeek Harness slot core");
assert(manifest.deepseek_harness_source_reuse?.adopted_scope?.includes("ui_primitives"), "manifest must record direct DeepSeek Harness UI primitive reuse");
assert(manifest.deepseek_harness_source_reuse?.source_manifest === "src/composition/deepseekHarnessSourceManifest.json", "manifest must point to the vendored DeepSeek Harness source manifest");
assert(manifest.deepseek_harness_source_reuse?.vendor_root === "src/vendor/deepseek-harness", "manifest must record the vendored DeepSeek Harness root");
assert(manifest.deepseek_harness_source_reuse?.file_count === 207, "manifest must inventory 207 vendored DeepSeek Harness files");
assert(manifest.deepseek_harness_source_reuse?.byte_identical === true, "manifest must record byte-identical DeepSeek Harness source");
assert(manifest.deepseek_harness_source_reuse?.byte_identical_to_pinned_ref === true, "manifest must bind byte identity to the pinned DeepSeek Harness ref");
assert(
  JSON.stringify(manifest.deepseek_harness_source_reuse?.package_roots) === JSON.stringify([
    "packages/client/ui-layout/src",
    "packages/client/ui-sidebar/src",
    "packages/client/ui-conversation/src",
    "packages/client/ui-settings-general/src",
    "packages/client/ui-theme/src",
    "packages/client/ui-primitives/src"
  ]),
  "manifest must record all six DeepSeek Harness GUI package roots"
);
for (const rootName of ["AppFrame", "SidebarRoot", "ConversationRoot", "InputBar", "SettingsRoot"]) {
  assert(manifest.deepseek_harness_source_reuse?.active_gui_roots?.some((entry) => entry.includes(rootName)), `manifest must record active GUI root ${rootName}`);
}
assert(manifest.deepseek_harness_source_reuse?.excluded_authority?.includes("plugin_manager"), "manifest must keep the DeepSeek Harness plugin manager outside OPL authority");
assert(manifest.default_home_layout?.project_rail_visible === true, "manifest must keep the project rail visible by default");
assert(manifest.default_home_layout?.details_default_open === false, "manifest must keep details closed by default");
assert(manifest.default_home_layout?.details_presentation === "dsh_resizable_column_with_mobile_overlay", "manifest must keep details available on desktop and mobile");
assert(manifest.ui_identity === "text_only_opl_studio_no_logo", "manifest must record the text-only product identity");
assert(manifest.codex_model_policy?.source === appModelPolicy.source, "manifest must bind model policy to the App product profile");
assert(manifest.codex_model_policy?.default_model === appModelPolicy.defaultModel, "manifest default model must match the App product profile");
assert(manifest.codex_model_policy?.default_reasoning_effort === appModelPolicy.defaultReasoningEffort, "manifest default reasoning effort must match the App product profile");
assertOrderedValues(
  manifest.codex_model_policy?.visible_models,
  appModelPolicy.visibleModels.map((option) => option.id),
  "manifest visible models"
);
assertOrderedValues(manifest.codex_model_policy?.reasoning_efforts, appModelPolicy.reasoningEfforts, "manifest reasoning efforts");
assert(!("external_layout_reference" in manifest), "manifest must use the pinned DSH source reuse record as its only visual baseline");
assert(manifest.functional_mvp?.codex_app_server_thread_turn === true, "manifest must record Codex app-server thread/turn MVP");
assert(manifest.functional_mvp?.codex_protocol?.includes("model/list"), "manifest must record app-server model availability reads");
assert(manifest.functional_mvp?.thread_lifecycle?.includes("archive"), "manifest must record standard thread lifecycle");
assert(manifest.functional_mvp?.codex_subagent_projection?.includes("collabAgentToolCall"), "manifest must record Codex subagent projection");
assert(manifest.functional_mvp?.private_coordination_layer === false, "manifest must reject a private coordination layer");
assert(manifest.functional_mvp?.default_agent_permissions_profile === ":danger-full-access", "manifest must record full-access Codex permission profile as the candidate default");
assert(manifest.functional_mvp?.agent_permissions_controls?.includes("thread/start") && manifest.functional_mvp.agent_permissions_controls.includes("turn/start"), "manifest must record the Agent permission profile transport");
for (const field of evidence.functional_mvp_closeout?.not_ready ?? []) {
  assert(manifest[field] !== true, `candidate package must not claim ${field}`);
}
assert(manifest.release_ready === false, "candidate package must not claim release readiness");
assert(manifest.live_evidence === false, "candidate package must not claim live evidence");
for (const marker of [
  "SETTINGS_STORAGE_KEY",
  "opl.studio.settings.v1",
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

const rootManifest = readJson("out/opl-studio-candidate-manifest.json");
assert(rootManifest.status === "candidate_app_bundle_built", "root manifest must not use a readiness status for a built candidate");
assert(rootManifest.opens_default_browser === false, "root manifest must preserve browser boundary");

console.log(JSON.stringify({
  status: "packaged_native_runtime_valid",
  native_runtime: manifest.native_runtime,
  opens_default_browser: manifest.opens_default_browser,
  app_bundle_path: manifest.app_bundle_path
}, null, 2));
