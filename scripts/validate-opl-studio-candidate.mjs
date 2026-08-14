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
} from "./opl-studio-gates.mjs";
import { readCodexModelPolicy } from "./build-renderer.mjs";
import { resolveAppRepoRoot } from "./resolve-app-repo-root.mjs";

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "docs/README.md",
  "docs/architecture.md",
  "docs/active/current-state-vs-ideal-gap.md",
  "docs/verification.md",
  "docs/history/README.md",
  "docs/history/2026-07-candidate-baseline.md",
  "contracts/opl-studio-profile.json",
  "THIRD_PARTY_NOTICES.md",
  "package.json",
  "src/bridge/oplBridge.ts",
  "src/bridge/webTransport.ts",
  "src/main.tsx",
  "src/composition/contributionProjection.ts",
  "src/composition/contributionComponents.tsx",
  "src/composition/deepseekHarnessSourceManifest.json",
  "src/composition/dshSlotHost.tsx",
  "src/integrations/deepseek-harness/oplAdapter.css",
  "src/integrations/deepseek-harness/runtimeShim.ts",
  "src/vendor/deepseek-harness/LICENSE",
  "src/vendor/deepseek-harness/packages/client/ui-layout/src/client/AppFrame.tsx",
  "src/vendor/deepseek-harness/packages/client/ui-sidebar/src/client/SidebarRoot.tsx",
  "src/vendor/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx",
  "src/vendor/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx",
  "src/vendor/deepseek-harness/packages/client/ui-settings-general/src/client/SettingsRoot.tsx",
  "src/vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css",
  "src/vendor/deepseek-harness/packages/client/ui-primitives/src/index.ts",
  "src/renderer-shell.html",
  "src/workbench/App.tsx",
  "src/workbench/codexWorkbenchStyles.ts",
  "src/workbench/modelPolicy.ts",
  "src/workbench/workbenchModel.ts",
  "src/workbench/settingsModel.ts",
  "src/threads/types.ts",
  "src/workbench/threads/ThreadRail.tsx",
  "src/workbench/threads/ThreadDetailPopover.tsx",
  "src/workbench/threads/ThreadLifecycleConfirmationDialog.tsx",
  "src/candidateContractEvidence.json",
  "scripts/build-renderer.mjs",
  "scripts/bun-build-renderer-entry.ts",
  "scripts/deepseek-harness-gui-vendor.mjs",
  "scripts/model-list-pagination-regression.mjs",
  "scripts/model-list-pagination-regression.swift",
  "scripts/thread-list-pagination-regression.mjs",
  "scripts/thread-list-pagination-regression.swift",
  "scripts/model-policy-regression.ts",
  "scripts/validate-state-model.mjs",
  "scripts/validate-packaged-runtime.mjs",
  "scripts/smoke-webui.mjs",
  "scripts/smoke-visual.mjs",
  "scripts/package-opl-studio.mjs",
  "scripts/resolve-app-repo-root.mjs",
  "scripts/opl-studio-app.swift",
  "scripts/webui-host/app-server-transport.mjs",
  "scripts/webui-host/thread-adapter.mjs",
  "scripts/webui-host/thread-adapter.test.mjs",
  "tests/renderer/thread-renderer-source.test.mjs"
];

const requiredScripts = [
  "dev",
  "build",
  "webui",
  "build:webui",
  "verify:dsh-gui",
  "package",
  "test:model-list-pagination",
  "test:thread-list-pagination",
  "test:threads",
  "test:ui-contributions",
  "test:storage-migration",
  "test:webui-host",
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
  "opl-session-list",
  "opl-context-tabs",
  "opl-files-panel",
  "opl-skills-panel",
  "opl-routing-panel",
  "opl-memory-panel",
  "opl-always-on-panel",
  "opl-web-transport",
  "opl-locale-toggle",
  "opl-real-thread-directory",
  "opl-thread-scope-filter",
  "opl-thread-detail-popover",
  "opl-thread-lifecycle-confirmation"
];

const retiredPrivateThreadFiles = [
  "src/coordination/foundation.ts",
  "src/coordination/index.ts",
  "src/coordination/types.ts",
  "src/workbench/coordination/CoordinationDialog.tsx",
  "src/workbench/coordination/CoordinationEvents.tsx",
  "scripts/webui-host/coordination-host.mjs",
  "scripts/webui-host/coordination-ledger.mjs",
  "scripts/smoke-coordination-dynamic-tools-live.mjs",
  "scripts/smoke-coordination-live.mjs"
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `missing ${file}`);
}
for (const file of retiredPrivateThreadFiles) {
  assert(!fs.existsSync(path.join(root, file)), `retired private thread file must stay removed: ${file}`);
}

const pkg = JSON.parse(read("package.json"));
const studioProfile = readJson("contracts/opl-studio-profile.json");
for (const script of requiredScripts) {
  assert(pkg.scripts?.[script], `missing package script ${script}`);
}

assert(
  studioProfile.candidate_status_owner === "docs/active/current-state-vs-ideal-gap.md",
  "candidate profile must identify the single current status owner"
);
assert(
  studioProfile.candidate_operating_policy?.role === "manual_on_demand_non_periodic_technical_evaluation"
    && studioProfile.candidate_operating_policy.automatic_or_scheduled_work_allowed === false
    && studioProfile.candidate_operating_policy.mainline_development_required === false
    && studioProfile.candidate_operating_policy.completion_or_parity_obligation === false
    && studioProfile.candidate_operating_policy.release_blocking === false,
  "candidate profile must keep Native manual, non-periodic, non-blocking, and without a completion obligation"
);
const expectedDeliveryEvaluation = {
  role: "lightweight_opl_gui_architecture_reference",
  product_mainline_owner: false,
  renderer_technology: "react",
  macos_host: "swift_appkit_wkwebview",
  workspace_host: "node_http_sse",
  workspace_product_name: "OPL Workspace",
  shared_renderer_and_bridge_shape_required: true,
  runtime_backend_scope: "codex_cli_only",
  aionui_runtime_dependency_allowed: false,
  aioncore_runtime_dependency_allowed: false,
  cross_platform_wrapper_selection: "deferred_electron_or_tauri",
  windows_linux_support_claim_allowed: false,
  adoption_requires_explicit_app_contract_change: true
};
assert(
  JSON.stringify(studioProfile.delivery_evaluation) === JSON.stringify(expectedDeliveryEvaluation),
  "candidate profile must declare the bounded lightweight native macOS and OPL Workspace evaluation role"
);
assert(
  studioProfile.runtime_dependency_policy?.aioncore_required === false
    && studioProfile.runtime_dependency_policy.aionui_required === false
    && studioProfile.runtime_dependency_policy.codex_app_server_source === "OPL_CODEX_BIN_or_exact_external_codex"
    && studioProfile.runtime_dependency_policy.opl_integration === "framework_app_state_action_contracts_only"
    && studioProfile.runtime_dependency_policy.multi_backend_abstraction_required === false
    && studioProfile.runtime_dependency_policy.thread_store_owner === "codex_core_app_server",
  "candidate profile must keep Native independent from AionUI/AionCore and scoped to Codex App Server"
);
assert(
  JSON.stringify(studioProfile.carrier_policy?.enabled) === JSON.stringify(["codex_app_server_stdio"])
    && JSON.stringify(studioProfile.carrier_policy?.reserved_disabled) === JSON.stringify(["pi", "hermes"])
    && studioProfile.carrier_policy.disabled_carriers_add_runtime_dependencies === false
    && studioProfile.carrier_policy.thread_store_owner === "codex_core_app_server"
    && studioProfile.carrier_policy.thread_overview.includes("useStateDbOnly=true")
    && studioProfile.carrier_policy.thread_history.includes("includeTurns=true"),
  "candidate profile must keep Codex as the only enabled carrier and reserve Pi/Hermes without dependencies"
);
assert(
  !Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((name) =>
    ["aioncore", "aionui", "electron", "tauri"].some((forbidden) => name.toLowerCase().includes(forbidden))
  ),
  "candidate package must not declare AionUI, AionCore, Electron, or Tauri dependencies"
);

const app = read("src/workbench/App.tsx");
const rendererSource = readRendererSource();
const evidence = readJson("src/candidateContractEvidence.json");
assert(
  JSON.stringify(evidence.delivery_evaluation) === JSON.stringify(expectedDeliveryEvaluation),
  "candidate evidence must record the bounded lightweight GUI delivery evaluation"
);
assert(
  JSON.stringify(evidence.carrier_policy?.enabled) === JSON.stringify(["codex_app_server_stdio"])
    && JSON.stringify(evidence.carrier_policy?.reserved_disabled) === JSON.stringify(["pi", "hermes"])
    && evidence.carrier_policy.aioncore_required === false
    && evidence.carrier_policy.disabled_carriers_add_runtime_dependencies === false,
  "candidate evidence must record the single enabled Codex carrier boundary"
);

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

function assertPrivateThreadLayerRemoved(evidence) {
  const runtimeSources = [
    "scripts/opl-studio-app.swift",
    "scripts/webui-host/app-server-transport.mjs",
    "scripts/webui-host/http-host.mjs",
    "scripts/webui-host/thread-adapter.mjs",
    "src/bridge/oplBridge.ts",
    "src/bridge/webTransport.ts",
    "src/main.tsx",
    "src/workbench/App.tsx",
    "src/workbench/workbenchModel.ts",
    "src/workbench/codexWorkbenchStyles.ts"
  ].map(read).join("\n");
  for (const marker of [
    "prepareCoordination",
    "dispatchCoordination",
    "waitCoordination",
    "CoordinationLedger",
    "ThreadCoordinationHost",
    "CoordinationDialog",
    "host_queue",
    "item/tool/call",
    "dynamicTools",
    "/api/coordination/"
  ]) {
    assert(!runtimeSources.includes(marker), `retired private thread marker must stay removed: ${marker}`);
  }
  assert(evidence.functional_mvp?.private_coordination_layer === false, "functional MVP must reject a private coordination layer");
  assert(evidence.webui_transport?.private_coordination_layer === false, "WebUI must reject a private coordination layer");
  assert(
    evidence.webui_transport?.native_host === "scripts/opl-studio-app.swift"
      && evidence.webui_transport.native_transport === "src/main.tsx#installNativeTransport",
    "packaged macOS evidence must use the Swift WKScriptMessageHandler transport"
  );
  assert(evidence.functional_mvp?.codex_subagent_projection?.includes("collabAgentToolCall"), "functional MVP must record Codex subagent item projection");
  assert(evidence.thread_list_pagination_regression?.validation_command === "npm run test:thread-list-pagination", "candidate evidence must record the thread/list regression command");
  assert(evidence.thread_list_pagination_regression?.fixtures?.includes("scripts/webui-host/thread-adapter.test.mjs"), "candidate evidence must record the WebUI thread adapter fixture");
  for (const retired of [
    "typed_cross_top_level_thread_host_bridge",
    "client_executed_dynamic_tools_coordination_bridge",
    "local_cross_thread_p0_p1",
    "turn_start_steer_with_host_queue",
    "cross_thread_safety_gates",
    "bilateral_coordination_receipts",
    "desktop_webui_coordination_parity"
  ]) {
    assert(!evidence.capabilities.includes(retired), `retired capability must stay removed: ${retired}`);
  }
}

function assertDeepSeekHarnessReuse(evidence, rendererSource) {
  const alignment = evidence.default_home_layout?.primary_visual_reference;
  const visualStyle = evidence.default_home_layout?.visual_style_reference;
  const slotHost = read("src/composition/dshSlotHost.tsx");
  const appSource = read("src/workbench/App.tsx");
  const mainSource = read("src/main.tsx");
  const themeSource = read("src/vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css");
  const sourceManifest = readJson("src/composition/deepseekHarnessSourceManifest.json");
  const packageJson = readJson("package.json");
  const tsconfig = readJson("tsconfig.json");
  const typecheckConfig = readJson("tsconfig.typecheck.json");
  const primitiveIndex = read("src/vendor/deepseek-harness/packages/client/ui-primitives/src/index.ts");
  const composerPalette = read("src/workbench/ComposerCapabilityPalette.tsx");
  const contributionComponents = read("src/composition/contributionComponents.tsx");
  const adapterStyles = read("src/integrations/deepseek-harness/oplAdapter.css");
  const notices = read("THIRD_PARTY_NOTICES.md");
  const architecture = read("docs/architecture.md");
  const activePlan = read("docs/active/current-state-vs-ideal-gap.md");
  const publicEntry = read("README.md");
  assert(alignment, "missing DeepSeek Harness GUI source-reuse evidence");
  assert(alignment.reference_product === "DeepSeek Harness", "DeepSeek Harness must be the primary GUI reference");
  assert(alignment.reference_version === "47f943859bef60e4160492346772ded9b24f765a", "pinned DeepSeek Harness source ref must be recorded");
  assert(alignment.reference_date === "2026-08-14", "DeepSeek Harness inspection date must be recorded");
  assert(alignment.source_usage === "direct_mit_gui_source_reuse", "DeepSeek Harness use must be direct GUI source reuse");
  assert(alignment.left_side === "persistent project and conversation rail", "project rail placement must be recorded");
  assert(alignment.center === "single dominant conversation timeline with bottom composer", "conversation placement must be recorded");
  assert(alignment.model_controls === "composer_bottom_row", "model controls must stay in the composer");
  assert(alignment.right_side === "user-requested DSH details column", "environment details must use the DSH details column");
  assert(evidence.default_home_layout?.workspace_rail_default_open === true, "project rail must be visible by default");
  assert(evidence.default_home_layout?.environment_details_default_open === false, "environment details must be closed by default");
  assert(evidence.webui_parity?.desktop_and_webui_default_home === "chat_first_default_collapsed", "desktop and WebUI must share the chat-first default-collapsed home");
  assert(visualStyle?.reference_version === alignment.reference_version, "visual tokens must bind to the same DeepSeek Harness source ref");
  assert(visualStyle?.scope === "six_pinned_gui_package_source_trees_with_vendor_external_opl_adapters", "visual source scope must cover all six pinned DSH GUI package trees");
  assert(visualStyle?.token_source === "src/vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css", "DeepSeek Harness token source must be exact");
  for (const marker of ["--dsw-static-deepseek-450", "--dsw-alias-button-primary-fill", "--dsw-alias-tooltip-bg"]) {
    assert(themeSource.includes(marker), `missing vendored DeepSeek Harness design token ${marker}`);
  }
  for (const marker of ["SlotCore", "createSlotRenderer", "core.register", "core.onEntryError", "active.dispose()"]){
    assert(slotHost.includes(marker), `missing DeepSeek Harness slot lifecycle marker ${marker}`);
  }
  for (const [component, moduleName] of [
    ["AppFrame", "@opl-vendor/dsh-app-frame"],
    ["SidebarRoot", "@opl-vendor/dsh-sidebar-root"],
    ["ConversationRoot", "@opl-vendor/dsh-conversation-root"],
    ["InputBar", "@opl-vendor/dsh-input-bar"],
    ["SettingsRoot", "@opl-vendor/dsh-settings-root"]
  ]) {
    assert(slotHost.includes(`import { ${component} } from "${moduleName}"`), `missing direct ${component} vendor import`);
    assert(slotHost.includes(`<${component}`), `missing live ${component} render`);
  }
  for (const marker of ["return renderShell({", "workspaceRail: studioWorkspaceRail", "conversationBody: studioConversationBody", "settings: studioSettings", "detailsRequestRevision"]) {
    assert(appSource.includes(marker), `missing App-to-DSH surface handoff marker ${marker}`);
  }
  assert(mainSource.includes('import { renderOplStudioRoot } from "./composition/dshSlotHost"'), "main must import the DSH composition host");
  assert(mainSource.includes("createRoot(rootElement).render(renderOplStudioRoot())"), "main must render the DSH composition root");
  assert(sourceManifest.upstream?.ref === alignment.reference_version, "vendor manifest must bind to the pinned DSH ref");
  assert(sourceManifest.upstream?.source_package_version === "0.1.0-rc.5", "vendor manifest must record the pinned source package version");
  assert(sourceManifest.snapshot?.local_root === "src/vendor/deepseek-harness", "vendor manifest root must be canonical");
  assert(sourceManifest.snapshot?.byte_identical === true, "vendor snapshot must remain byte-identical");
  assert(sourceManifest.snapshot?.byte_identical_to_pinned_ref === true, "vendor snapshot byte identity must bind to the pinned DSH ref");
  assert(sourceManifest.snapshot?.file_count === 207 && sourceManifest.files?.length === 207, "vendor manifest must inventory 207 files");
  assert(JSON.stringify(sourceManifest.snapshot?.package_roots) === JSON.stringify(evidence.reused_oss_module_policy.vendored_package_roots), "candidate evidence package roots must match the vendor manifest");
  const vendorCheck = spawnSync(process.execPath, [path.join(root, "scripts/deepseek-harness-gui-vendor.mjs"), "check"], { cwd: root, encoding: "utf8" });
  assert(vendorCheck.status === 0, `vendored DSH GUI byte parity failed: ${vendorCheck.stderr}`);
  assert(packageJson.dependencies?.clsx === "2.1.1", "DeepSeek Harness GUI closure must declare clsx directly");
  const primitiveAlias = ["src/vendor/deepseek-harness/packages/client/ui-primitives/src/index.ts"];
  assert(JSON.stringify(tsconfig.compilerOptions?.paths?.["@deepseek-ai/dsh-client-ui-primitives"]) === JSON.stringify(primitiveAlias), "renderer imports must resolve the DSH primitives specifier to the vendored upstream index");
  assert(JSON.stringify(typecheckConfig.compilerOptions?.paths?.["@deepseek-ai/dsh-client-ui-primitives"]) === JSON.stringify(primitiveAlias), "typecheck imports must resolve the DSH primitives specifier to the vendored upstream index");
  assert(!fs.existsSync(path.join(root, "src/integrations/deepseek-harness/uiPrimitives.tsx")), "the handwritten DSH primitive shim must stay absent");
  for (const [source, names] of [
    [appSource, ["MessageText", "Pill"]],
    [composerPalette, ["Button", "Input"]],
    [contributionComponents, ["Button", "Pill", "StateDot", "Tooltip"]]
  ]) {
    assert(source.includes('from "@deepseek-ai/dsh-client-ui-primitives"'), "OPL primitive consumers must import the upstream DSH package specifier directly");
    for (const name of names) assert(primitiveIndex.includes(`export { ${name} }`), `vendored DSH primitive index must export ${name}`);
  }
  for (const marker of ['svg[viewBox="0 0 182 24"]', 'svg[viewBox="0 0 23.16 17.04"]', "var(--opl-brand-logo)", 'content: "OPL Studio"']) {
    assert(adapterStyles.includes(marker), `vendor-external OPL brand override must preserve ${marker}`);
  }
  assert(mainSource.includes("--opl-brand-logo") && mainSource.includes("branding/opl-app-logo.png"), "renderer must bind the OPL brand override to the packaged OPL asset");
  assert(notices.includes("47f943859bef60e4160492346772ded9b24f765a") && notices.includes("MIT License"), "third-party notices must preserve pinned DSH source and MIT license");
  assert(architecture.includes("Model And Settings Boundary") && architecture.includes("App product profile"), "architecture must route model and settings authority to App");
  assert(architecture.includes("Codex App Server owns canonical thread identity"), "architecture must route thread truth to Codex App Server");
  assert(architecture.includes("AionUI is the current active release shell"), "architecture must preserve the active-shell boundary");
  assert(
    activePlan.includes("Purpose: `single_active_truth_plan`")
      && activePlan.includes("State: `active_technical_evaluation_reference`")
      && activePlan.includes("manual_on_demand_non_periodic_technical_evaluation"),
    "Active Truth must preserve the manual, non-periodic evaluation policy"
  );
  assert(publicEntry.includes("foreground alternative shell candidate") && publicEntry.includes("AionUI remains the active release shell"), "public entry must preserve candidate and adoption roles");
  const legacyClaims = `${publicEntry}\n${architecture}\n${JSON.stringify(evidence)}`.toLowerCase();
  for (const claim of ["imagegen", "image-generated", "three-column", "chat_first_with_preview_inspector", "preview inspector default-open"]) {
    assert(!legacyClaims.includes(claim), `legacy visual baseline claim must be removed: ${claim}`);
  }
  const compositionSource = `${rendererSource}\n${slotHost}`;
  for (const markers of Object.values(alignment.implementation_markers ?? {})) {
    for (const marker of markers) {
      assert(compositionSource.includes(marker), `missing OPL Studio composition implementation marker ${marker}`);
    }
  }
}

function assertCodexModelControls(evidence, app, rendererSource) {
  const settings = read("src/workbench/settingsModel.ts");
  const policySource = read("src/workbench/modelPolicy.ts");
  const rendererBuilder = read("scripts/build-renderer.mjs");
  const appRepoResolver = read("scripts/resolve-app-repo-root.mjs");
  const bridge = read("src/bridge/oplBridge.ts");
  const nativeApp = read("scripts/opl-studio-app.swift");
  const appRepoRoot = resolveAppRepoRoot(root);
  const appProductProfilePath = path.join(appRepoRoot, "contracts", "app-product-profile.json");
  const appProductProfile = JSON.parse(fs.readFileSync(appProductProfilePath, "utf8"));
  const profileModels = appProductProfile.gui.home.codex_model_display_options.visible_models;
  const profileReasoning = appProductProfile.gui.home.codex_model_display_options.user_reasoning_effort_options;
  const injectedPolicy = readCodexModelPolicy(appProductProfilePath);
  assert(evidence.functional_mvp?.codex_model_reasoning_controls?.includes("turn/start") && evidence.functional_mvp.codex_model_reasoning_controls.includes("model and effort overrides"), "functional MVP must record app-server model and effort overrides");
  assert(evidence.functional_mvp.codex_model_reasoning_controls.includes("App default route") && evidence.functional_mvp.codex_model_reasoning_controls.includes("fixed alternatives"), "functional MVP must record the App-default catalog exception and fixed-model filtering");
  assert(evidence.functional_mvp?.default_agent_permissions_profile === ":danger-full-access", "functional MVP must record full access as the default Agent permission profile");
  assert(evidence.functional_mvp?.agent_permissions_controls?.includes("permission profiles") && evidence.functional_mvp.agent_permissions_controls.includes("turn/start"), "functional MVP must record the Agent permission selector and transport");
  assert(settings.includes('agentPermissions: ":danger-full-access"'), "renderer settings must default Agent permissions to full access");
  assert(app.includes("permissions: settings.agentPermissions"), "composer must send the selected Agent permission profile");
  assert(bridge.includes('defaultPermissions: ":danger-full-access"'), "browser bridge must default Agent permissions to full access");
  assert(nativeApp.includes('private static let defaultPermissions = ":danger-full-access"'), "native bridge must default Agent permissions to full access");
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
  const paginationRegression = spawnSync("node", [path.join(root, "scripts", "model-list-pagination-regression.mjs")], {
    cwd: root,
    encoding: "utf8"
  });
  assert(
    paginationRegression.status === 0,
    `model/list pagination regression failed\n${paginationRegression.stdout ?? ""}\n${paginationRegression.stderr ?? ""}`
  );
  assert(evidence.model_policy_regression?.fixture === "scripts/model-policy-regression.ts", "candidate evidence must record the dynamic model policy regression fixture");
  assert(evidence.model_policy_regression?.validation_command === "npm run validate:candidate", "candidate evidence must record the model policy regression command");
  assert(evidence.model_list_pagination_regression?.fixture === "scripts/model-list-pagination-regression.swift", "candidate evidence must record the model/list pagination fixture");
  assert(evidence.model_list_pagination_regression?.validation_command === "npm run test:model-list-pagination", "candidate evidence must record the model/list pagination command");
  assert(settings.includes('modelAccess: "__auto"'), "settings must default to App-owned Auto model resolution");
  assert(settings.includes("codexModelPolicy.defaultReasoningEffort"), "settings default reasoning must consume the App-derived policy");
  assert(policySource.includes("codexModelPolicy.modelOptions.map") && app.includes("modelOptions.map"), "composer and Settings must render the App-derived model list");
  assert(rendererSource.includes("codexModelPolicy.reasoningOptions.map"), "composer and Settings must render the App-derived reasoning list");
  assert(policySource.includes('invalidPolicy("policy is missing")'), "missing App model policy injection must fail explicitly");
  assert(!policySource.includes("fallbackModelOptions") && !policySource.includes("fallbackReasoningOptions"), "source model policy must not keep versioned fallback lists");
  assert(app.includes("bridge.readCodexModels()"), "renderer must read app-server model availability");
  assert(app.includes("resolveCodexModelOptions(codexCatalog)"), "renderer must filter fixed alternatives through the app-server catalog");
  assert(app.includes("setCodexCatalog(catalog.models)") && app.includes("setCodexCatalog([])"), "renderer must retain the App default route when model catalog discovery is empty or unavailable");
  assert(policySource.includes("available: isAppDefault"), "model/list must not veto the App default route");
  assert(app.includes('if ((!text && !pendingSelections.length) || sendState === "running" || !resolvedModel) return;'), "composer must require text or selected inputs and block unavailable fixed selections before turn/start");
  assert(app.includes("conversationModelLabel(") && app.includes("resolvedConversationModelLabel"), "composer model control must use the tested resolved-label policy");
  assert(app.includes('<option value="__auto">{resolvedConversationModelLabel}</option>'), "composer Auto must display the resolved model without an Auto prefix");
  assert(app.includes('value="__auto"'), "Settings must expose Auto model restoration");
  assert(app.includes("model: resolvedModel.id"), "composer must send the App-resolved model");
  assert(app.includes("reasoningEffort: resolvedReasoning"), "composer must send a supported reasoning effort");
  assert(bridge.includes("model?: string"), "bridge request must carry the App-selected model override");
  assert(bridge.includes("reasoningEffort?: string"), "bridge request must carry the App-selected reasoning override");
  assert(bridge.includes("readCodexModels()"), "bridge must expose the app-server model catalog");
  assert(nativeApp.includes('method: "model/list"'), "native app must read app-server model/list");
  assert(nativeApp.includes('params["cursor"] = cursor'), "native app must follow app-server model/list cursors");
  assert(nativeApp.includes("models.append(contentsOf: pageModels)"), "native app must merge model/list pages");
  assert(nativeApp.includes('turnParams["model"] = model'), "native app must pass model to app-server turn/start");
  assert(nativeApp.includes('turnParams["effort"] = effort'), "native app must pass effort to app-server turn/start");
  for (const marker of [
    "OPL_CODEX_BIN",
    "OPL_APP_OPL_BIN",
    "OPL_APP_RUNTIME_IDENTITY_JSON",
    "readRuntimeIdentity",
    "OPL_STUDIO_READ_ONLY",
    "blocked_read_only",
    "candidate_read_only_policy"
  ]) {
    assert(nativeApp.includes(marker), `native app must preserve launcher/runtime safety marker ${marker}`);
  }
  assert(rendererBuilder.includes("__OPL_CODEX_MODEL_POLICY__"), "renderer build must inject the App-owned model policy");
  assert(rendererBuilder.includes("resolveAppRepoRoot"), "renderer build must resolve the App repo through the shared helper");
  assert(appRepoResolver.includes('"contracts", "app-product-profile.json"'), "App repo resolver must require the App product profile");
  const alignment = evidence.default_home_layout?.product_layout_contract;
  assert(alignment && typeof alignment === "object", "candidate evidence must define the App-owned product layout contract");
  assert(alignment.reference_product === "DeepSeek Harness Web client", "product layout contract must bind the DSH GUI baseline");
  assert(
    !("codex_2026_07_11_alignment" in (evidence.default_home_layout ?? {})),
    "candidate evidence must not restore the retired dated Codex authority key"
  );
  assert(
    !("reference_version" in alignment)
      && !("reference_date" in alignment)
      && !("reference_observed_at" in alignment),
    "product layout contract must not duplicate the pinned DSH source-reuse evidence"
  );
  assert(!("default_model" in alignment) && !("default_reasoning_effort" in alignment), "candidate evidence must not copy App model defaults");

  assert(app.includes('effectiveSelection === "__auto" && reasoningLevel !== codexModelPolicy.defaultReasoningEffort') && app.includes("writeSettings({ modelAccess, reasoningLevel })"), "changing Auto reasoning must pin the resolved model before applying the override");
}

validateNonLiveDeliveryEvidence(evidence);
assertFallbackBoundaryDowngrades({
  "src/workbench/App.tsx": app,
  "src/workbench/SettingsPanel.tsx": read("src/workbench/SettingsPanel.tsx"),
  "src/bridge/oplBridge.ts": read("src/bridge/oplBridge.ts"),
  "src/workbench/workbenchModel.ts": read("src/workbench/workbenchModel.ts")
});
assertFunctionalMvpCloseout(evidence);
assertSourceMarkerRequirements(evidence);
assertPrivateThreadLayerRemoved(evidence);
assertDeepSeekHarnessReuse(evidence, rendererSource);
assertCodexModelControls(evidence, app, rendererSource);
assertRendererTestIds(rendererSource, requiredTestIds);
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
assert(evidence.shell === "opl-studio", "evidence shell must match");
for (const capability of [
  "native_react_workbench_renderer",
  "dynamic_app_product_profile_model_policy",
  "codex_app_server_thread_turn_backend",
  "native_wkwebview_command_bridge",
  "results_and_delivery_first_presentation",
  "opl_app_state_bridge",
  "opl_app_action_bridge",
  "default_context_collapsed_chat_first_home",
  "dsh_chat_first_visual_baseline",
  "dsh_slot_core_composition_host",
  "dsh_create_slot_renderer_root",
  "dsh_ui_primitives_direct_reuse",
  "dsh_contribution_entry_error_isolation",
  "framework_ui_contributions_projection",
  "dynamic_contribution_registration_disposal",
  "single_codex_app_server_thread_adapter",
  "thread_list_read_start_resume_fork_archive_unarchive",
  "turn_start_steer",
  "codex_subagent_event_projection",
  "desktop_webui_thread_lifecycle_parity",
  "private_coordination_layer_removed",
  "dsh_resizable_details_column",
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
assert(evidence.reuse_policy.deepseek_harness_source_usage === "direct_mit_gui_source_reuse", "DeepSeek Harness GUI use must be direct and pinned");
assert(evidence.reuse_policy.deepseek_harness_source_ref === "47f943859bef60e4160492346772ded9b24f765a", "DeepSeek Harness source ref must be pinned");
assert(evidence.reuse_policy.deepseek_harness_ui_package_version === "0.1.0-rc.6", "DeepSeek Harness UI packages must use the verified version");
assert(evidence.reuse_policy.deepseek_harness_selected_source_reused === true, "selected DeepSeek Harness source must be declared as reused");
assert(evidence.reused_oss_module_policy.vendored_source_root === "src/vendor/deepseek-harness", "DeepSeek Harness source must have one explicit vendor root");
assert(evidence.reused_oss_module_policy.source_manifest === "src/composition/deepseekHarnessSourceManifest.json", "DeepSeek Harness source manifest must be canonical");
assert(evidence.reused_oss_module_policy.vendored_file_count === 207, "DeepSeek Harness source inventory must contain 207 files");
assert(evidence.reused_oss_module_policy.byte_identical === true, "DeepSeek Harness vendor source must remain byte-identical");
assert(evidence.reused_oss_module_policy.byte_identical_to_pinned_ref === true, "DeepSeek Harness vendor source byte identity must bind to the pinned ref");
assert(evidence.reused_oss_module_policy.vendored_package_roots?.includes("packages/client/ui-primitives/src"), "DeepSeek Harness source reuse must include the complete ui-primitives tree");
assert(evidence.reused_oss_module_policy.ui_primitives_index === "packages/client/ui-primitives/src/index.ts", "DeepSeek Harness primitive reuse must name the upstream index");
for (const primitive of ["Button", "Pill", "Input", "Tooltip", "StateDot", "MessageText", "icons"]) {
  assert(evidence.reused_oss_module_policy.direct_ui_primitives?.includes(primitive), `missing direct DeepSeek Harness primitive evidence ${primitive}`);
}
assert(evidence.reused_oss_module_policy.brand_override === "vendor_external_css_and_packaged_opl_asset", "OPL branding must stay outside vendored DSH source");
for (const rootName of ["AppFrame", "SidebarRoot", "ConversationRoot", "InputBar", "SettingsRoot"]) {
  assert(evidence.reused_oss_module_policy.active_gui_roots.some((entry) => entry.includes(rootName)), `missing active DeepSeek Harness GUI root ${rootName}`);
}
assert(evidence.reuse_policy.other_external_gui_source_copied === false, "other external GUI sources must remain reference-only");
assert(evidence.reuse_policy.runtime_authority_transfer === false, "runtime authority must not transfer");
assert(evidence.user_visible_protocol_copy.agui === false, "AGUI must not be ordinary UI copy");
assert(evidence.user_visible_protocol_copy.copilotkit_surface === false, "CopilotKit must not be ordinary native UI copy");
assert(evidence.settings_information_architecture?.persistence_model?.storage_key === "opl.studio.settings.v1", "settings persistence storage key must be recorded");
assert(evidence.settings_information_architecture?.persistence_model?.system_write_permission === false, "settings persistence must not request system write permission");
assert(evidence.false_ready_boundary.settings_system_write_permission === false, "settings system write permission must stay false");
assert(evidence.false_ready_boundary.artifact_authority === false, "artifact authority must stay false");
assert(evidence.false_ready_boundary.starter_execution_authority === false, "starter execution authority must stay false");

console.log(JSON.stringify({
  status: "opl_studio_candidate_valid",
  shell: "opl-studio",
  non_live_delivery_surface_testids: deliverySurfaceTestIds(evidence).length,
  settings_persistence: "localStorage_candidate_only",
  active_shell_adopted: false,
  release_ready: false,
  live_evidence: false
}, null, 2));
