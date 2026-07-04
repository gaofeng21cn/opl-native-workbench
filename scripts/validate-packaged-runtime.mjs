import fs from "node:fs";
import path from "node:path";
import { assert, readJson, root } from "./native-workbench-gates.mjs";

const appName = "One Person Lab Native Workbench Candidate";
const appRoot = path.join(root, "out", `${appName}.app`);
const resourcesDir = path.join(appRoot, "Contents", "Resources");
const executablePath = path.join(appRoot, "Contents", "MacOS", appName);
const workbenchPath = path.join(resourcesDir, "workbench.html");
const manifestPath = path.join(resourcesDir, "package-manifest.json");
const nativeSourcePath = path.join(root, "scripts", "native-workbench-app.swift");

assert(fs.existsSync(appRoot), "missing packaged .app");
assert(fs.existsSync(executablePath), "missing packaged executable");
assert(fs.existsSync(workbenchPath), "missing packaged native workbench HTML");
assert(!fs.existsSync(path.join(resourcesDir, "preview.html")), "preview-only browser page must not be packaged");

const executable = fs.readFileSync(executablePath);
const magic = executable.subarray(0, 4).toString("hex");
assert(executable.subarray(0, 2).toString() !== "#!", "packaged executable must not be a shell script");
assert(["cffaedfe", "feedfacf", "cafebabe", "cafebabf"].includes(magic), `packaged executable is not Mach-O: ${magic}`);

const workbench = fs.readFileSync(workbenchPath, "utf8");
const nativeSource = fs.readFileSync(nativeSourcePath, "utf8");
const evidence = readJson("src/candidateContractEvidence.json");
for (const marker of [
  'data-testid="opl-native-workbench-root"',
  'data-testid="opl-workspace-rail"',
  'data-testid="opl-artifact-preview-tabs"',
  'data-testid="opl-provenance-drawer"',
  'data-testid="opl-confirmation-card"',
  'data-testid="opl-renderer-module-registry"',
  'data-layout="codex-sidebar-chat"',
  'class="sidebar"',
  "Persistent Codex-style left sidebar",
  "Single conversation canvas",
  "On-demand context panel",
  "window.webkit.messageHandlers.oplNativeWorkbench",
  "sendCodexMessage",
  "Codex app-server",
  "initialize",
  "branding/opl-app-logo.png",
  "branding/opl-banner.png"
]) {
  assert(workbench.includes(marker), `missing packaged workbench marker ${marker}`);
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
  'data-testid="opl-runtime-action-dry-run"',
  'data-testid="opl-runtime-action-receipt"',
  "showView('settings')",
  "settingsView",
  'data-testid="opl-settings-panel"',
  'data-testid="opl-model-access-entry"',
  'data-testid="opl-locale-toggle"'
]) {
  assert(workbench.includes(marker), `missing packaged functional MVP marker ${marker}`);
}
for (const marker of ["delivery-grid", "starter-grid", "delivery-card", 'class="outputs"', 'class="rail"']) {
  assert(!workbench.includes(marker), `packaged workbench must not put ${marker} on the main surface`);
}
assert(workbench.includes('class="inspector"'), "workspace detail surface must default to an on-demand inspector");
assert(workbench.includes('aria-hidden="true"'), "workspace inspector must default closed");
assert(workbench.includes("toggleInspector"), "packaged workbench must expose inspector toggle");

for (const asset of [
  "app.icns",
  "branding/opl-app-logo.png",
  "branding/opl-banner.png",
  "package-manifest.json"
]) {
  assert(fs.existsSync(path.join(resourcesDir, asset)), `missing packaged asset ${asset}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert(manifest.native_runtime === "AppKit/WKWebView", "native runtime must be AppKit/WKWebView");
assert(manifest.opens_default_browser === false, "candidate app must not open the default browser");
assert(manifest.app_bundle_workbench === "Contents/Resources/workbench.html", "manifest must point at workbench.html");
assert(manifest.external_layout_reference?.repo === "https://github.com/K-Dense-AI/k-dense-byok", "manifest must record the K-Dense layout reference");
assert(manifest.external_layout_reference?.companion_repo === "https://github.com/ai4s-research/open-science", "manifest must record the Open Science visual reference");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("persistent Codex-style left sidebar for navigation and chat history"), "manifest must record the Codex-style sidebar adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("single conversation canvas with centered max-width thread and bottom composer"), "manifest must record the Codex-style conversation adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("secondary files, preview, provenance, workflows, and export live in on-demand inspector surfaces"), "manifest must record the on-demand inspector adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("chat tab strip and bottom composer as primary interaction"), "manifest must record the chat-first K-Dense adaptation");
assert(manifest.external_layout_reference?.adapted_patterns?.includes("Open Science paper-light surface, thin borders, compact message blocks, and rounded composer"), "manifest must record the Open Science visual adaptation");
assert(manifest.functional_mvp?.codex_app_server_thread_turn === true, "manifest must record Codex app-server thread/turn MVP");
assert(manifest.functional_mvp?.default_sandbox === "read-only", "manifest must record read-only Codex sandbox");
for (const field of evidence.functional_mvp_closeout?.not_ready ?? []) {
  assert(manifest[field] !== true, `candidate package must not claim ${field}`);
}
assert(manifest.release_ready === false, "candidate package must not claim release readiness");
assert(manifest.live_evidence === false, "candidate package must not claim live evidence");

const rootManifest = readJson("out/opl-native-workbench-candidate-manifest.json");
assert(rootManifest.opens_default_browser === false, "root manifest must preserve browser boundary");

console.log(JSON.stringify({
  status: "packaged_native_runtime_valid",
  native_runtime: manifest.native_runtime,
  opens_default_browser: manifest.opens_default_browser,
  app_bundle_path: manifest.app_bundle_path
}, null, 2));
