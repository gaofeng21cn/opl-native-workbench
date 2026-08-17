import assert from "node:assert/strict";
import test from "node:test";

Object.assign(globalThis, {
  __OPL_CODEX_MODEL_POLICY__: {
    source: "test App policy",
    defaultModel: "test-model",
    defaultReasoningEffort: "high",
    visibleModels: [{ id: "test-model" }],
    reasoningEfforts: ["high"],
    autoLabel: { zh: "自动（推荐）", en: "Auto (recommended)" },
    knownModelReasoningEffortOverrides: {},
    acceptUnknownCatalogDefault: true,
    useHighestSupportedReasoningForUnknown: true
  }
});

const presentation = await import("../../src/workbench/SettingsPanel.tsx");

test("settings navigation exposes primary categories with related destinations grouped inside", () => {
  assert.deepEqual(
    presentation.settingsDestinations("zh").map((destination) => destination.id),
    ["overview", "account", "resources", "workspace", "agents", "services", "preferences", "about"]
  );
  assert.deepEqual(
    presentation.settingsSubDestinations("account", "zh").map((destination) => destination.id),
    ["account", "models"]
  );
  assert.deepEqual(
    presentation.settingsSubDestinations("agents", "zh").map((destination) => destination.id),
    ["agents", "capabilities", "instructions"]
  );
  assert.deepEqual(
    presentation.settingsSubDestinations("services", "zh").map((destination) => destination.id),
    ["services", "updates", "diagnostics"]
  );
});

test("package descriptions prefer the active locale and allow an English fallback", () => {
  const localized = {
    description: "Raw English description.",
    descriptionI18n: {
      zh: "中文描述。",
      en: "Localized English description."
    },
    packageRole: "standard_agent"
  };
  assert.equal(presentation.localizedPackageDescription(localized, "zh"), localized.descriptionI18n.zh);
  assert.equal(presentation.localizedPackageDescription(localized, "en"), localized.descriptionI18n.en);

  const englishOnly = {
    ...localized,
    descriptionI18n: { en: "English fallback description." }
  };
  assert.equal(presentation.localizedPackageDescription(englishOnly, "zh"), englishOnly.descriptionI18n.en);

  const rawEnglishOnly = {
    ...localized,
    descriptionI18n: {}
  };
  assert.equal(presentation.localizedPackageDescription(rawEnglishOnly, "zh"), rawEnglishOnly.description);

  const roleOnly = { description: "", descriptionI18n: {}, packageRole: "standard_agent" };
  assert.notEqual(presentation.localizedPackageDescription(roleOnly, "zh"), "");
  assert.notEqual(presentation.localizedPackageDescription(roleOnly, "en"), "");
});

test("internal status and package role identifiers are projected as user-facing values", () => {
  assert.equal(presentation.statusTone("not_available"), "attention");
  assert.equal(presentation.statusTone("app_state_projection"), "neutral");
  assert.equal(presentation.statusTone("25/25"), "ready");
  assert.equal(presentation.statusTone("4/5"), "attention");
  assert.equal(presentation.formatStatus("25/25", "zh"), "25 / 25 可用");
  assert.equal(presentation.formatStatus("4/5", "en"), "4 / 5 available");
  assert.notEqual(presentation.formatStatus("preview_legacy_modules_fallback", "zh"), "preview_legacy_modules_fallback");
  assert.notEqual(presentation.packageRoleLabel("standard_agent", "zh"), "standard_agent");
  assert.notEqual(presentation.formatUpdateChannel("private_canary", "zh"), "private_canary");
});

test("standard Agent summary is derived from the same installed, enabled, callable, and launchable axes shown in the row", () => {
  const agent = (overrides: Record<string, unknown> = {}) => ({
    installed: true,
    activated: true,
    readiness: { callable: true, launchAllowed: true },
    ...overrides
  }) as never;

  assert.equal(presentation.agentPackagePresentationStatus(agent()), "ready");
  assert.equal(presentation.agentPackagePresentationStatus(agent({ installed: false })), "not_installed");
  assert.equal(presentation.agentPackagePresentationStatus(agent({ activated: false })), "disabled");
  assert.equal(presentation.agentPackagePresentationStatus(agent({ readiness: { callable: false, launchAllowed: true } })), "unavailable");
  assert.equal(presentation.agentPackagePresentationStatus(agent({ readiness: { callable: true, launchAllowed: null } })), "checking");
});

test("agent catalog keeps agent and workflow packages together while excluding capability packages", () => {
  assert.equal(presentation.isAgentCatalogPackage({ packageRole: "standard_agent" }), true);
  assert.equal(presentation.isAgentCatalogPackage({ packageRole: "workflow_profile" }), true);
  assert.equal(presentation.isAgentCatalogPackage({ packageRole: "capability_package" }), false);
  assert.equal(presentation.isAgentCatalogPackage({ packageRole: "framework_capability_package" }), false);
});

test("storage absence is neutral and does not turn missing measurements into user action", () => {
  assert.equal(presentation.storagePresentationStatus({
    status: "attention_required",
    reasonCode: "inventory_cache_stale",
    observedAt: "2026-08-17T06:08:53.852Z"
  } as never), "usage_not_measured");
  assert.equal(presentation.storagePresentationStatus({
    status: "not_configured",
    reasonCode: "webui_data_root_not_configured"
  } as never), "not_configured");
  assert.equal(presentation.statusTone("usage_not_measured"), "neutral");
  assert.equal(presentation.formatStatus("usage_not_measured", "zh"), "未统计");
});

test("Gateway model access action is needed only when a different source is known", () => {
  const projection = (providerName?: string, modelAccessSource?: string) => ({
    codex: { providerName, modelAccessSource }
  }) as never;

  assert.equal(presentation.gatewayModelAccessState(projection("OPL Gateway", "codex_login")), "current");
  assert.equal(presentation.gatewayModelAccessState(projection(undefined, "gateway_account")), "current");
  assert.equal(presentation.gatewayModelAccessState(projection("Other provider", "api_key")), "different");
  assert.equal(presentation.gatewayModelAccessState(projection()), "unknown");
});
