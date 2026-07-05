import fs from "node:fs";
import path from "node:path";
import {
  assert,
  assertRendererTestIds,
  deliverySurfaceTestIds,
  read,
  readJson,
  readRendererSource,
  root,
  validateNonLiveDeliveryEvidence
} from "./native-workbench-gates.mjs";

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "src/bridge/oplBridge.ts",
  "src/bridge/webTransport.ts",
  "src/bridge/electronPreload.ts",
  "src/workbench/App.tsx",
  "src/workbench/workbenchModel.ts",
  "src/workbench/settingsModel.ts",
  "src/candidateContractEvidence.json",
  "scripts/validate-state-model.mjs",
  "scripts/validate-packaged-runtime.mjs",
  "scripts/smoke-webui.mjs",
  "scripts/smoke-visual.mjs",
  "scripts/package-native-workbench.mjs",
  "scripts/native-workbench-app.swift"
];

const requiredScripts = [
  "dev",
  "build",
  "webui",
  "build:webui",
  "package",
  "validate:candidate",
  "validate:state-model",
  "validate:package",
  "smoke:webui",
  "smoke:visual",
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

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `missing ${file}`);
}

const pkg = JSON.parse(read("package.json"));
for (const script of requiredScripts) {
  assert(pkg.scripts?.[script], `missing package script ${script}`);
}

const app = read("src/workbench/App.tsx");
const rendererSource = readRendererSource();
const evidence = readJson("src/candidateContractEvidence.json");

function assertFunctionalMvpCloseout(evidence) {
  const closeout = evidence.functional_mvp_closeout;
  assert(closeout, "missing functional_mvp_closeout");
  for (const key of ["implemented", "partial", "not_ready"]) {
    assert(Array.isArray(closeout[key]) && closeout[key].length > 0, `missing functional MVP ${key} inventory`);
  }
  for (const field of evidence.false_ready_boundary.forbidden_true_fields) {
    assert(closeout.not_ready.includes(field), `functional MVP closeout must mark ${field} not-ready`);
  }
}

function assertSourceMarkerRequirements(evidence) {
  const requirements = evidence.source_marker_requirements;
  assert(requirements, "missing source_marker_requirements");
  for (const group of Object.keys(requirements)) {
    assert(Array.isArray(requirements[group]) && requirements[group].length > 0, `missing marker group ${group}`);
    for (const requirement of requirements[group]) {
      const source = read(requirement.file);
      for (const marker of requirement.contains) {
        assert(source.includes(marker), `missing ${group} marker ${marker} in ${requirement.file}`);
      }
    }
  }
}

validateNonLiveDeliveryEvidence(evidence);
assertFunctionalMvpCloseout(evidence);
assertSourceMarkerRequirements(evidence);
assertRendererTestIds(app, requiredTestIds);
assertRendererTestIds(rendererSource, deliverySurfaceTestIds(evidence));

const bridge = read("src/bridge/oplBridge.ts");
for (const command of [
  "opl app state --profile fast --json",
  "opl app state --profile full --json",
  "opl runtime app-operator-drilldown --detail full --json",
  "opl app action execute --action"
]) {
  assert(bridge.includes(command), `missing bridge command ${command}`);
}

assert(evidence.owner === "one-person-lab-app", "evidence owner must be one-person-lab-app");
assert(evidence.shell === "opl-native-workbench", "evidence shell must match");
for (const capability of [
  "native_react_workbench_renderer",
  "codex_app_server_thread_turn_backend",
  "native_wkwebview_command_bridge",
  "results_and_delivery_first_presentation",
  "opl_app_state_bridge",
  "opl_app_action_bridge",
  "webui_renderer_parity",
  "candidate_app_bundle_package",
  "settings_persistence",
  "execute_confirmation",
  "artifact_preview_mvp",
  "professional_starters_mvp",
  "source_visual_smoke",
  "artifact_preview_tabs",
  "provenance_drawer",
  "starter_forms",
  "confirmation_interview_cards",
  "renderer_module_registry",
  "delivery_mode_selection",
  "export_action"
]) {
  assert(evidence.capabilities.includes(capability), `missing evidence capability ${capability}`);
}
assert(evidence.reuse_policy.copied_source === false, "external source must remain reference-only");
assert(evidence.reuse_policy.runtime_authority_transfer === false, "runtime authority must not transfer");
assert(evidence.user_visible_protocol_copy.agui === false, "AGUI must not be ordinary UI copy");
assert(evidence.user_visible_protocol_copy.copilotkit_surface === false, "CopilotKit must not be ordinary native UI copy");
assert(evidence.settings_information_architecture?.persistence_model?.storage_key === "opl.nativeWorkbench.settings.v1", "settings persistence storage key must be recorded");
assert(evidence.settings_information_architecture?.persistence_model?.system_write_permission === false, "settings persistence must not request system write permission");
assert(evidence.false_ready_boundary.settings_system_write_permission === false, "settings system write permission must stay false");
assert(evidence.false_ready_boundary.artifact_authority === false, "artifact authority must stay false");
assert(evidence.false_ready_boundary.starter_execution_authority === false, "starter execution authority must stay false");

console.log(JSON.stringify({
  status: "opl_native_workbench_candidate_valid",
  shell: "opl-native-workbench",
  non_live_delivery_surface_testids: deliverySurfaceTestIds(evidence).length,
  settings_persistence: "localStorage_candidate_only",
  active_shell_adopted: false,
  release_ready: false,
  live_evidence: false
}, null, 2));
