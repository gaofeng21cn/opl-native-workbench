export const fallbackModelOptions = [
  { id: "gpt-5.6-sol", label_zh: "5.6 Sol", label_en: "5.6 Sol" },
  { id: "gpt-5.6-terra", label_zh: "5.6 Terra", label_en: "5.6 Terra" },
  { id: "gpt-5.6-luna", label_zh: "5.6 Luna", label_en: "5.6 Luna" },
  { id: "gpt-5.5", label_zh: "5.5", label_en: "5.5" },
  { id: "gpt-5.4", label_zh: "5.4", label_en: "5.4" },
  { id: "gpt-5.4-mini", label_zh: "5.4 Mini", label_en: "5.4 Mini" },
  { id: "gpt-5.2", label_zh: "5.2", label_en: "5.2" }
] as const;

export const fallbackReasoningOptions = ["low", "medium", "high", "xhigh", "ultra"] as const;

export type CodexModelId = (typeof fallbackModelOptions)[number]["id"];
export type CodexModelSelection = "__auto" | CodexModelId;
export type CodexReasoningEffort = (typeof fallbackReasoningOptions)[number];
export type WorkbenchLocale = "zh" | "en";

type ModelOption = {
  id: CodexModelId;
  label_zh: string;
  label_en: string;
};

type CodexCatalogCapability = {
  id: string;
  model?: string;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts: string[];
};

export type ResolvedCodexModelOption = ModelOption & {
  available: boolean;
  defaultReasoningEffort: CodexReasoningEffort;
  supportedReasoningEfforts: CodexReasoningEffort[];
};

type InjectedModelPolicy = {
  source?: string;
  defaultModel?: string;
  defaultReasoningEffort?: string;
  visibleModels?: Array<{ id?: string; label_zh?: string; label_en?: string }>;
  reasoningEfforts?: string[];
};

declare global {
  var __OPL_CODEX_MODEL_POLICY__: InjectedModelPolicy | undefined;
}

function isModelId(value: unknown): value is CodexModelId {
  return fallbackModelOptions.some((option) => option.id === value);
}

function isReasoningEffort(value: unknown): value is CodexReasoningEffort {
  return fallbackReasoningOptions.includes(value as CodexReasoningEffort);
}

function injectedPolicy(): InjectedModelPolicy | undefined {
  return globalThis.__OPL_CODEX_MODEL_POLICY__;
}

function normalizedModelOptions(policy = injectedPolicy()): ModelOption[] {
  const options = policy?.visibleModels
    ?.filter((option): option is { id: CodexModelId; label_zh?: string; label_en?: string } => isModelId(option.id))
    .map((option) => ({
      id: option.id,
      label_zh: option.label_zh || fallbackModelOptions.find((item) => item.id === option.id)!.label_zh,
      label_en: option.label_en || fallbackModelOptions.find((item) => item.id === option.id)!.label_en
    }));
  return options?.length === fallbackModelOptions.length ? options : [...fallbackModelOptions];
}

function normalizedReasoningOptions(policy = injectedPolicy()): CodexReasoningEffort[] {
  const options = policy?.reasoningEfforts?.filter(isReasoningEffort);
  return options?.length === fallbackReasoningOptions.length ? options : [...fallbackReasoningOptions];
}

export const codexModelPolicy = {
  source: injectedPolicy()?.source ?? "candidate_fallback_validated_against_app_product_profile",
  defaultModel: isModelId(injectedPolicy()?.defaultModel) ? injectedPolicy()!.defaultModel as CodexModelId : "gpt-5.6-sol",
  defaultReasoningEffort: isReasoningEffort(injectedPolicy()?.defaultReasoningEffort)
    ? injectedPolicy()!.defaultReasoningEffort as CodexReasoningEffort
    : "ultra",
  modelOptions: normalizedModelOptions(),
  reasoningOptions: normalizedReasoningOptions()
};

export function resolveCodexModelOptions(catalog: CodexCatalogCapability[]): ResolvedCodexModelOption[] {
  return codexModelPolicy.modelOptions.map((option) => {
    const runtime = catalog.find((item) => item.id === option.id || item.model === option.id);
    const supportedReasoningEfforts = runtime?.supportedReasoningEfforts
      .filter(isReasoningEffort) ?? [];
    return {
      ...option,
      available: !catalog.length || option.id === codexModelPolicy.defaultModel || Boolean(runtime),
      defaultReasoningEffort: isReasoningEffort(runtime?.defaultReasoningEffort)
        ? runtime.defaultReasoningEffort
        : codexModelPolicy.defaultReasoningEffort,
      supportedReasoningEfforts: supportedReasoningEfforts.length
        ? supportedReasoningEfforts
        : [...codexModelPolicy.reasoningOptions]
    };
  });
}

export function resolveCodexSelection(
  options: ResolvedCodexModelOption[],
  selection: CodexModelSelection,
  requestedReasoning: CodexReasoningEffort
) {
  const selectableModels = options.filter((option) => option.available);
  const requestedModel = options.find((option) => option.id === selection);
  const effectiveSelection = selection === "__auto" || !requestedModel?.available ? "__auto" : selection;
  const selectedModelId = effectiveSelection === "__auto" ? codexModelPolicy.defaultModel : effectiveSelection;
  const model = selectableModels.find((option) => option.id === selectedModelId)
    ?? selectableModels.find((option) => option.id === codexModelPolicy.defaultModel)
    ?? selectableModels[0]
    ?? options[0];
  const reasoningOptions = effectiveSelection === "__auto"
    ? [...codexModelPolicy.reasoningOptions]
    : model.supportedReasoningEfforts;
  const reasoningEffort = effectiveSelection === "__auto"
    ? codexModelPolicy.defaultReasoningEffort
    : reasoningOptions.includes(requestedReasoning)
      ? requestedReasoning
      : reasoningOptions.at(-1) ?? model.defaultReasoningEffort;
  return { model, reasoningEffort, reasoningOptions, effectiveSelection };
}

export function modelLabel(model: CodexModelId, locale: WorkbenchLocale): string {
  const option = codexModelPolicy.modelOptions.find((item) => item.id === model);
  return locale === "zh" ? option?.label_zh ?? model : option?.label_en ?? model;
}

export function autoModelLabel(locale: WorkbenchLocale): string {
  return locale === "zh" ? "自动（推荐）" : "Auto (recommended)";
}

export function reasoningLabel(effort: CodexReasoningEffort, locale: WorkbenchLocale, compact = false): string {
  const labels = {
    zh: {
      low: compact ? "低" : "推理低",
      medium: compact ? "中" : "推理中",
      high: compact ? "高" : "推理高",
      xhigh: compact ? "超高" : "推理超高",
      ultra: compact ? "极高" : "推理极高"
    },
    en: {
      low: compact ? "Low" : "Low reasoning",
      medium: compact ? "Medium" : "Medium reasoning",
      high: compact ? "High" : "High reasoning",
      xhigh: compact ? "Extra high" : "Extra high reasoning",
      ultra: compact ? "Ultra" : "Ultra reasoning"
    }
  } as const;
  return labels[locale][effort];
}
