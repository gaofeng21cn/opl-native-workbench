import assert from "node:assert/strict";
import { createCodexModelPolicy } from "./build-renderer.mjs";

const syntheticProfile = {
  default_session_profile: {
    model: "codex-future-primary",
    reasoning_effort: "xhigh"
  },
  gui: {
    home: {
      codex_model_display_options: {
        visible_models: [
          { id: "codex-future-primary", label_zh: "Future primary zh", label_en: "Future primary" },
          { id: "codex-future-secondary", label_zh: "Future secondary zh", label_en: "Future secondary" }
        ],
        user_reasoning_effort_options: ["low", "high", "xhigh", "ultra"]
      }
    }
  }
};

const injectedPolicy = createCodexModelPolicy(syntheticProfile);
(globalThis as typeof globalThis & { __OPL_CODEX_MODEL_POLICY__?: typeof injectedPolicy })
  .__OPL_CODEX_MODEL_POLICY__ = injectedPolicy;

const {
  codexModelPolicy,
  conversationModelLabel,
  resolveCodexModelOptions,
  resolveCodexSelection
} = await import("../src/workbench/modelPolicy.ts");

assert.deepEqual(
  codexModelPolicy.modelOptions.map((option) => option.id),
  syntheticProfile.gui.home.codex_model_display_options.visible_models.map((option) => option.id)
);
assert.equal(codexModelPolicy.defaultModel, syntheticProfile.default_session_profile.model);
assert.deepEqual(
  codexModelPolicy.reasoningOptions,
  syntheticProfile.gui.home.codex_model_display_options.user_reasoning_effort_options
);
assert.equal(codexModelPolicy.defaultReasoningEffort, syntheticProfile.default_session_profile.reasoning_effort);

const runtimeOptions = resolveCodexModelOptions([{
  id: "codex-future-secondary",
  defaultReasoningEffort: "high",
  supportedReasoningEfforts: ["low", "high"]
}]);
assert.deepEqual(runtimeOptions.map((option) => option.id), ["codex-future-primary", "codex-future-secondary"]);
assert.equal(runtimeOptions.find((option) => option.id === "codex-future-primary")?.available, true);
assert.equal(runtimeOptions.find((option) => option.id === "codex-future-secondary")?.available, true);
const runtimeAuto = resolveCodexSelection(runtimeOptions, "__auto", "low");
assert.equal(runtimeAuto.model.id, "codex-future-primary");
assert.equal(runtimeAuto.reasoningEffort, "xhigh");
assert.equal(runtimeAuto.effectiveSelection, "__auto");
assert.equal(conversationModelLabel("__auto", runtimeAuto.model?.id, "en"), "Future primary");
assert.equal(conversationModelLabel("__auto", undefined, "en"), "Auto (recommended)");
const pinnedSecondary = resolveCodexSelection(runtimeOptions, "codex-future-secondary", "low");
assert.equal(pinnedSecondary.model.id, "codex-future-secondary");
assert.equal(pinnedSecondary.reasoningEffort, "low");
assert.equal(conversationModelLabel("codex-future-secondary", pinnedSecondary.model?.id, "zh"), "Future secondary zh");
const pinnedPrimary = resolveCodexSelection(runtimeOptions, "codex-future-primary", "low");
assert.equal(pinnedPrimary.model?.id, "codex-future-primary");
assert.equal(pinnedPrimary.reasoningEffort, "low");
assert.equal(pinnedPrimary.effectiveSelection, "codex-future-primary");
const emptyOptions = resolveCodexModelOptions([]);
assert.equal(emptyOptions.find((option) => option.id === "codex-future-primary")?.available, true);
assert.equal(emptyOptions.find((option) => option.id === "codex-future-secondary")?.available, false);
const emptyCatalogAuto = resolveCodexSelection(emptyOptions, "__auto", "low");
assert.equal(emptyCatalogAuto.model?.id, "codex-future-primary");
assert.equal(emptyCatalogAuto.reasoningEffort, "xhigh");
const unavailableSecondary = resolveCodexSelection(emptyOptions, "codex-future-secondary", "high");
assert.equal(unavailableSecondary.effectiveSelection, "codex-future-secondary");
assert.equal(unavailableSecondary.model, undefined);
assert.equal(unavailableSecondary.reasoningEffort, "xhigh");

const cloneProfile = () => structuredClone(syntheticProfile);

const missingDisplay = cloneProfile();
delete (missingDisplay.gui.home as { codex_model_display_options?: unknown }).codex_model_display_options;
assert.throws(() => createCodexModelPolicy(missingDisplay), /gui\.home\.codex_model_display_options/);

const emptyModels = cloneProfile();
emptyModels.gui.home.codex_model_display_options.visible_models = [];
assert.throws(() => createCodexModelPolicy(emptyModels), /visible_models must be a non-empty array/);

const duplicateModels = cloneProfile();
duplicateModels.gui.home.codex_model_display_options.visible_models[1].id = "codex-future-primary";
assert.throws(() => createCodexModelPolicy(duplicateModels), /model ids must be unique/);

const missingDefault = cloneProfile();
missingDefault.default_session_profile.model = "codex-future-unlisted";
assert.throws(() => createCodexModelPolicy(missingDefault), /default model must be included in visible_models/);

const illegalEffort = cloneProfile();
illegalEffort.gui.home.codex_model_display_options.user_reasoning_effort_options = ["low", "impossible"];
assert.throws(() => createCodexModelPolicy(illegalEffort), /unsupported reasoning effort/);

const ultraEffort = cloneProfile();
ultraEffort.default_session_profile.reasoning_effort = "ultra";
ultraEffort.gui.home.codex_model_display_options.user_reasoning_effort_options = ["low", "ultra"];
assert.equal(createCodexModelPolicy(ultraEffort).defaultReasoningEffort, "ultra");

const missingDefaultEffort = cloneProfile();
missingDefaultEffort.gui.home.codex_model_display_options.user_reasoning_effort_options = ["low"];
assert.throws(() => createCodexModelPolicy(missingDefaultEffort), /default reasoning effort must be included/);

console.log(JSON.stringify({ status: "dynamic_app_model_policy_regression_passed" }));
