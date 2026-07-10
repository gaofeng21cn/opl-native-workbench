import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  assert,
  assertFallbackBoundaryDowngrades,
  assertRendererTestIds,
  deliverySurfaceTestIds,
  read,
  readJson,
  readRendererSource,
  root,
  validateNonLiveDeliveryEvidence
} from "./native-workbench-gates.mjs";
import { readCodexModelPolicy } from "./build-renderer.mjs";
import { resolveAppRepoRoot } from "./resolve-app-repo-root.mjs";

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "src/bridge/oplBridge.ts",
  "src/bridge/webTransport.ts",
  "src/bridge/electronPreload.ts",
  "src/main.tsx",
  "src/renderer-shell.html",
  "src/workbench/App.tsx",
  "src/workbench/codexWorkbenchStyles.ts",
  "src/workbench/modelPolicy.ts",
  "src/workbench/workbenchModel.ts",
  "src/workbench/settingsModel.ts",
  "src/candidateContractEvidence.json",
  "scripts/build-renderer.mjs",
  "scripts/model-policy-regression.ts",
  "scripts/validate-state-model.mjs",
  "scripts/validate-packaged-runtime.mjs",
  "scripts/smoke-webui.mjs",
  "scripts/smoke-visual.mjs",
  "scripts/package-native-workbench.mjs",
  "scripts/resolve-app-repo-root.mjs",
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
  "opl-project-inputs",
  "opl-project-attachments",
  "opl-project-chats",
  "opl-topbar-model-config",
  "opl-assistant-artifact-card",
  "opl-selected-artifact-preview",
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

function assertCodexJuly2026Alignment(evidence, app, readme) {
  const alignment = evidence.default_home_layout?.primary_visual_reference;
  const normalizedReadme = readme.replace(/\s+/g, " ");
  assert(alignment, "missing ChatGPT Codex July 2026 alignment evidence");
  assert(alignment.reference_product === "ChatGPT Codex macOS", "Codex reference product must be recorded");
  assert(alignment.reference_version === "26.707.31123", "Codex reference version must be recorded");
  assert(alignment.reference_date === "2026-07-10", "Codex reference date must be recorded");
  assert(alignment.left_side === "persistent project and conversation rail", "Codex project rail placement must be recorded");
  assert(alignment.center === "single dominant conversation timeline with bottom composer", "Codex conversation placement must be recorded");
  assert(alignment.model_controls === "composer_bottom_row", "model controls must stay in the composer");
  assert(alignment.right_side === "floating user-requested environment details", "environment details must be floating and user-requested");
  assert(evidence.default_home_layout?.workspace_rail_default_open === true, "project rail must be visible by default");
  assert(evidence.default_home_layout?.environment_details_default_open === false, "environment details must be closed by default");
  assert(evidence.webui_parity?.desktop_and_webui_default_home === "chat_first_default_collapsed", "desktop and WebUI must share the chat-first default-collapsed home");
  assert(normalizedReadme.includes("ChatGPT Codex macOS") && normalizedReadme.includes("26.707.31123"), "README must record the Codex reference build");
  assert(normalizedReadme.includes("model and reasoning controls in the composer"), "README must record composer model control placement");
  assert(normalizedReadme.includes("The rail is visible by default"), "README must record the default-visible project rail");
  assert(normalizedReadme.includes("environment details are closed by default and open as a floating"), "README must record the default-closed floating environment details");
  const legacyClaims = `${readme}\n${JSON.stringify(evidence)}`.toLowerCase();
  for (const claim of ["imagegen", "image-generated", "three-column", "chat_first_with_preview_inspector", "preview inspector default-open"]) {
    assert(!legacyClaims.includes(claim), `legacy visual baseline claim must be removed: ${claim}`);
  }
  for (const markers of Object.values(alignment.implementation_markers ?? {})) {
    for (const marker of markers) {
      assert(app.includes(marker), `missing Codex alignment implementation marker ${marker}`);
    }
  }
}

function assertCodexModelControls(evidence, app) {
  const settings = read("src/workbench/settingsModel.ts");
  const policySource = read("src/workbench/modelPolicy.ts");
  const rendererBuilder = read("scripts/build-renderer.mjs");
  const appRepoResolver = read("scripts/resolve-app-repo-root.mjs");
  const bridge = read("src/bridge/oplBridge.ts");
  const nativeApp = read("scripts/native-workbench-app.swift");
  const appRepoRoot = resolveAppRepoRoot(root);
  const appProductProfilePath = path.join(appRepoRoot, "contracts", "app-product-profile.json");
  const appProductProfile = JSON.parse(fs.readFileSync(appProductProfilePath, "utf8"));
  const profileModels = appProductProfile.gui.home.codex_model_display_options.visible_models;
  const profileReasoning = appProductProfile.gui.home.codex_model_display_options.user_reasoning_effort_options;
  const injectedPolicy = readCodexModelPolicy(appProductProfilePath);
  assert(evidence.functional_mvp?.codex_model_reasoning_controls?.includes("turn/start") && evidence.functional_mvp.codex_model_reasoning_controls.includes("model and effort overrides"), "functional MVP must record app-server model and effort overrides");
  assert(evidence.functional_mvp.codex_model_reasoning_controls.includes("App default route") && evidence.functional_mvp.codex_model_reasoning_controls.includes("fixed alternatives"), "functional MVP must record the App-default catalog exception and fixed-model filtering");
  assert(injectedPolicy.defaultModel === appProductProfile.default_session_profile.model, "injected default model must match the App product profile");
  assert(injectedPolicy.defaultReasoningEffort === appProductProfile.default_session_profile.reasoning_effort, "injected default reasoning effort must match the App product profile");
  assert(injectedPolicy.visibleModels.length === profileModels.length, "injected model list length must match the App product profile");
  for (const [index, expected] of profileModels.entries()) {
    const actual = injectedPolicy.visibleModels[index];
    for (const field of ["id", "label_zh", "label_en"]) {
      assert(actual?.[field] === expected[field], `injected model ${index} ${field} must match the App product profile`);
    }
  }
  assert(injectedPolicy.reasoningEfforts.length === profileReasoning.length, "injected reasoning list length must match the App product profile");
  for (const [index, effort] of profileReasoning.entries()) {
    assert(injectedPolicy.reasoningEfforts[index] === effort, `injected reasoning effort ${index} must match the App product profile`);
  }
  const regression = spawnSync("bun", ["run", path.join(root, "scripts", "model-policy-regression.ts")], {
    cwd: root,
    encoding: "utf8"
  });
  assert(
    regression.status === 0,
    `dynamic model policy regression failed\n${regression.stdout ?? ""}\n${regression.stderr ?? ""}`
  );
  assert(evidence.model_policy_regression?.fixture === "scripts/model-policy-regression.ts", "candidate evidence must record the dynamic model policy regression fixture");
  assert(evidence.model_policy_regression?.validation_command === "npm run validate:candidate", "candidate evidence must record the model policy regression command");
  assert(settings.includes('modelAccess: "__auto"'), "settings must default to App-owned Auto model resolution");
  assert(settings.includes("codexModelPolicy.defaultReasoningEffort"), "settings default reasoning must consume the App-derived policy");
  assert(policySource.includes("codexModelPolicy.modelOptions.map") && app.includes("modelOptions.map"), "composer and Settings must render the App-derived model list");
  assert(app.includes("codexModelPolicy.reasoningOptions.map"), "composer and Settings must render the App-derived reasoning list");
  assert(app.includes("bridge.readCodexModels()"), "renderer must read app-server model availability");
  assert(app.includes("resolveCodexModelOptions(codexCatalog)"), "renderer must filter fixed alternatives through the app-server catalog");
  assert(app.includes("setCodexCatalog(catalog.models)") && app.includes("setCodexCatalog([])"), "renderer must retain the App default route when model catalog discovery is empty or unavailable");
  assert(policySource.includes("available: isAppDefault"), "model/list must not veto the App default route");
  assert(app.includes("const unavailableFixedModel") && app.includes("const canSendCodexTurn = Boolean(resolvedModel)"), "only an unavailable fixed selection may block sending");
  assert(app.includes('if (!text || sendState === "running" || !resolvedModel) return;'), "composer must block unavailable fixed selections before turn/start");
  assert(app.includes("conversationModelLabel(") && app.includes("resolvedConversationModelLabel"), "composer model control must use the tested resolved-label policy");
  assert(app.includes('<option value="__auto">{resolvedConversationModelLabel}</option>'), "composer Auto must display the resolved model without an Auto prefix");
  assert(app.includes('value="__auto"'), "Settings must expose Auto model restoration");
  assert(app.includes("model: resolvedModel.id"), "composer must send the App-resolved model");
  assert(app.includes("reasoningEffort: resolvedReasoning"), "composer must send a supported reasoning effort");
  assert(bridge.includes("model?: string"), "bridge request must carry the App-selected model override");
  assert(bridge.includes("reasoningEffort?: string"), "bridge request must carry the App-selected reasoning override");
  assert(bridge.includes("readCodexModels()"), "bridge must expose the app-server model catalog");
  assert(nativeApp.includes('method: "model/list"'), "native app must read app-server model/list");
  assert(nativeApp.includes('turnParams["model"] = model'), "native app must pass model to app-server turn/start");
  assert(nativeApp.includes('turnParams["effort"] = effort'), "native app must pass effort to app-server turn/start");
  assert(rendererBuilder.includes("__OPL_CODEX_MODEL_POLICY__"), "renderer build must inject the App-owned model policy");
  assert(rendererBuilder.includes("resolveAppRepoRoot"), "renderer build must resolve the App repo through the shared helper");
  assert(appRepoResolver.includes('"contracts", "app-product-profile.json"'), "App repo resolver must require the App product profile");
  const alignment = evidence.default_home_layout?.codex_2026_07_10_alignment ?? {};
  assert(!("default_model" in alignment) && !("default_reasoning_effort" in alignment), "candidate evidence must not copy App model defaults");

  assert(app.includes('effectiveSelection === "__auto" && reasoningLevel !== codexModelPolicy.defaultReasoningEffort') && app.includes("writeSettings({ modelAccess, reasoningLevel })"), "changing Auto reasoning must pin the resolved model before applying the override");
}

validateNonLiveDeliveryEvidence(evidence);
assertFallbackBoundaryDowngrades({
  "src/workbench/App.tsx": app,
  "src/bridge/oplBridge.ts": read("src/bridge/oplBridge.ts"),
  "src/workbench/workbenchModel.ts": read("src/workbench/workbenchModel.ts")
});
assertFunctionalMvpCloseout(evidence);
assertSourceMarkerRequirements(evidence);
assertCodexJuly2026Alignment(evidence, app, read("README.md"));
assertCodexModelControls(evidence, app);
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
  "dynamic_app_product_profile_model_policy",
  "codex_app_server_thread_turn_backend",
  "native_wkwebview_command_bridge",
  "results_and_delivery_first_presentation",
  "opl_app_state_bridge",
  "opl_app_action_bridge",
  "default_context_collapsed_chat_first_home",
  "chatgpt_codex_2026_07_10_visual_alignment",
  "codex_floating_environment_details",
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
  "agent_package_lifecycle_display",
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
