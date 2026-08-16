import assert from "node:assert/strict";
import test from "node:test";

Object.assign(globalThis, {
  __OPL_CODEX_MODEL_POLICY__: {
    source: "test App policy",
    defaultModel: "test-model",
    defaultReasoningEffort: "high",
    visibleModels: [{ id: "test-model" }],
    reasoningEfforts: ["high"],
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
  assert.notEqual(presentation.formatStatus("preview_legacy_modules_fallback", "zh"), "preview_legacy_modules_fallback");
  assert.notEqual(presentation.packageRoleLabel("standard_agent", "zh"), "standard_agent");
  assert.notEqual(presentation.formatUpdateChannel("private_canary", "zh"), "private_canary");
});
