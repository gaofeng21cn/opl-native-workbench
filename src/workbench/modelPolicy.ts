export type CodexModelId = string;
export type CodexModelSelection = "__auto" | CodexModelId;
export const fallbackReasoningOptions = ["low", "medium", "high", "xhigh", "ultra"] as const;
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

export const fallbackModelOptions: readonly ModelOption[] = [
  { id: "gpt-5.6-sol", label_zh: "5.6 Sol", label_en: "5.6 Sol" }
];

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
  return typeof value === "string" && value.trim().length > 0;
}

function isReasoningEffort(value: unknown): value is CodexReasoningEffort {
  return fallbackReasoningOptions.includes(value as CodexReasoningEffort);
}

function injectedPolicy(): InjectedModelPolicy | undefined {
  return globalThis.__OPL_CODEX_MODEL_POLICY__;
}

function normalizedModelOptions(policy = injectedPolicy()): ModelOption[] {
  if (!policy?.visibleModels?.length || !policy.visibleModels.every((option) => isModelId(option?.id))) {
    return [...fallbackModelOptions];
  }
  return policy.visibleModels.map((option) => ({
    id: option.id as CodexModelId,
    label_zh: typeof option.label_zh === "string" && option.label_zh.trim() ? option.label_zh : option.id as string,
    label_en: typeof option.label_en === "string" && option.label_en.trim() ? option.label_en : option.id as string
  }));
}

function normalizedReasoningOptions(policy = injectedPolicy()): CodexReasoningEffort[] {
  if (!policy?.reasoningEfforts?.length || !policy.reasoningEfforts.every(isReasoningEffort)) {
    return [...fallbackReasoningOptions];
  }
  return [...policy.reasoningEfforts] as CodexReasoningEffort[];
}

const policy = injectedPolicy();
const modelOptions = normalizedModelOptions(policy);
const reasoningOptions = normalizedReasoningOptions(policy);
const injectedDefaultModel = policy?.defaultModel;
const injectedDefaultReasoningEffort = policy?.defaultReasoningEffort;

export const codexModelPolicy = {
  source: typeof policy?.source === "string" && policy.source.trim() ? policy.source : "candidate_offline_fallback",
  defaultModel: isModelId(injectedDefaultModel) && modelOptions.some((option) => option.id === injectedDefaultModel)
    ? injectedDefaultModel
    : modelOptions[0].id,
  defaultReasoningEffort: isReasoningEffort(injectedDefaultReasoningEffort) && reasoningOptions.includes(injectedDefaultReasoningEffort)
    ? injectedDefaultReasoningEffort
    : reasoningOptions.includes("ultra") ? "ultra" : reasoningOptions[0],
  modelOptions,
  reasoningOptions
};

export function resolveCodexModelOptions(catalog: CodexCatalogCapability[]): ResolvedCodexModelOption[] {
  return codexModelPolicy.modelOptions.map((option) => {
    const runtime = catalog.find((item) => item.id === option.id || item.model === option.id);
    const supportedReasoningEfforts = runtime?.supportedReasoningEfforts
      .filter(isReasoningEffort) ?? [];
    return {
      ...option,
      available: Boolean(runtime) && supportedReasoningEfforts.length > 0,
      defaultReasoningEffort: isReasoningEffort(runtime?.defaultReasoningEffort)
        && supportedReasoningEfforts.includes(runtime.defaultReasoningEffort)
        ? runtime.defaultReasoningEffort
        : supportedReasoningEfforts.at(-1) ?? codexModelPolicy.defaultReasoningEffort,
      supportedReasoningEfforts: supportedReasoningEfforts.length
        ? supportedReasoningEfforts
        : [codexModelPolicy.defaultReasoningEffort]
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
    ?? selectableModels[0];
  if (!model) {
    return {
      model: undefined,
      reasoningEffort: codexModelPolicy.defaultReasoningEffort,
      reasoningOptions: [codexModelPolicy.defaultReasoningEffort],
      effectiveSelection
    };
  }
  const reasoningOptions = model.supportedReasoningEfforts;
  const requestedEffort = effectiveSelection === "__auto"
    ? codexModelPolicy.defaultReasoningEffort
    : requestedReasoning;
  const reasoningEffort = reasoningOptions.includes(requestedEffort)
    ? requestedEffort
    : model.defaultReasoningEffort;
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
