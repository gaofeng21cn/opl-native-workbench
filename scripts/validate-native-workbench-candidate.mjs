import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "src/bridge/oplBridge.ts",
  "src/bridge/webTransport.ts",
  "src/bridge/electronPreload.ts",
  "src/workbench/App.tsx",
  "src/workbench/workbenchModel.ts",
  "src/candidateContractEvidence.json",
  "scripts/validate-state-model.mjs",
  "scripts/smoke-webui.mjs",
  "scripts/package-native-workbench.mjs"
];

const requiredScripts = [
  "dev",
  "build",
  "webui",
  "build:webui",
  "package",
  "validate:candidate",
  "validate:state-model",
  "smoke:webui",
  "test"
];

const requiredTestIds = [
  "opl-workspace-rail",
  "opl-session-list",
  "opl-context-tabs",
  "opl-files-panel",
  "opl-skills-panel",
  "opl-routing-panel",
  "opl-memory-panel",
  "opl-always-on-panel",
  "opl-web-transport",
  "opl-locale-toggle"
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `missing ${file}`);
}

const pkg = JSON.parse(read("package.json"));
for (const script of requiredScripts) {
  assert(pkg.scripts?.[script], `missing package script ${script}`);
}

const app = read("src/workbench/App.tsx");
for (const testId of requiredTestIds) {
  assert(app.includes(`data-testid="${testId}"`), `missing renderer test id ${testId}`);
}

const bridge = read("src/bridge/oplBridge.ts");
for (const command of [
  "opl app state --profile fast --json",
  "opl app state --profile full --json",
  "opl runtime app-operator-drilldown --detail full --json",
  "opl app action execute --action"
]) {
  assert(bridge.includes(command), `missing bridge command ${command}`);
}

const evidence = JSON.parse(read("src/candidateContractEvidence.json"));
assert(evidence.owner === "one-person-lab-app", "evidence owner must be one-person-lab-app");
assert(evidence.shell === "opl-native-workbench", "evidence shell must match");
for (const capability of [
  "native_react_workbench_renderer",
  "results_and_delivery_first_presentation",
  "opl_app_state_bridge",
  "opl_app_action_bridge",
  "webui_renderer_parity",
  "candidate_app_bundle_package"
]) {
  assert(evidence.capabilities.includes(capability), `missing evidence capability ${capability}`);
}
assert(evidence.reuse_policy.copied_source === false, "external source must remain reference-only");
assert(evidence.reuse_policy.runtime_authority_transfer === false, "runtime authority must not transfer");
assert(evidence.user_visible_protocol_copy.agui === false, "AGUI must not be ordinary UI copy");
assert(evidence.user_visible_protocol_copy.copilotkit_surface === false, "CopilotKit must not be ordinary native UI copy");

console.log(JSON.stringify({
  status: "opl_native_workbench_candidate_valid",
  shell: "opl-native-workbench",
  active_shell_adopted: false,
  release_ready: false
}, null, 2));
