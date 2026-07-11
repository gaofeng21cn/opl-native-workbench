export type CodexModelId = string;
export type CodexModelSelection = "__auto" | CodexModelId;
export const fallbackReasoningOptions = ["low", "medium", "high", "xhigh", "max", "ultra"] as const;
export type CodexReasoningEffort = string;
export type WorkbenchLocale = "zh" | "en";

type ModelOption = {
  id: CodexModelId;
  label_zh: string;
  label_en: string;
};

type CodexCatalogCapability = {
  id: string;
  model?: string;
  displayName?: string;
  isDefault?: boolean;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts: string[];
};

export type ResolvedCodexModelOption = ModelOption & {
  available: boolean;
  known: boolean;
  isCatalogDefault: boolean;
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
  knownModelReasoningEffortOverrides?: Record<string, string>;
  acceptUnknownCatalogDefault?: boolean;
  useHighestSupportedReasoningForUnknown?: boolean;
};

declare global {
  var __OPL_CODEX_MODEL_POLICY__: InjectedModelPolicy | undefined;
}

function isModelId(value: unknown): value is CodexModelId {
  return typeof value === "string" && value.trim().length > 0;
}

function isReasoningEffort(value: unknown): value is CodexReasoningEffort {
  return typeof value === "string" && value.trim().length > 0;
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
const knownModelReasoningEffortOverrides = Object.fromEntries(
  Object.entries(policy?.knownModelReasoningEffortOverrides ?? {})
    .filter(([model, effort]) => isModelId(model) && isReasoningEffort(effort))
);

export const codexModelPolicy = {
  source: typeof policy?.source === "string" && policy.source.trim() ? policy.source : "candidate_offline_fallback",
  defaultModel: isModelId(injectedDefaultModel) && modelOptions.some((option) => option.id === injectedDefaultModel)
    ? injectedDefaultModel
    : modelOptions[0].id,
  defaultReasoningEffort: isReasoningEffort(injectedDefaultReasoningEffort) && reasoningOptions.includes(injectedDefaultReasoningEffort)
    ? injectedDefaultReasoningEffort
    : reasoningOptions.includes("max") ? "max" : reasoningOptions.at(-1)!,
  knownModelReasoningEffortOverrides,
  acceptUnknownCatalogDefault: policy?.acceptUnknownCatalogDefault !== false,
  useHighestSupportedReasoningForUnknown: policy?.useHighestSupportedReasoningForUnknown !== false,
  modelOptions,
  reasoningOptions
};

export function resolveCodexModelOptions(catalog: CodexCatalogCapability[]): ResolvedCodexModelOption[] {
  const knownOptions = codexModelPolicy.modelOptions.map((option) => {
    const runtime = catalog.find((item) => item.id === option.id || item.model === option.id);
    const supportedReasoningEfforts = runtime?.supportedReasoningEfforts
      .filter(isReasoningEffort) ?? [];
    const isAppDefault = option.id === codexModelPolicy.defaultModel;
    const configuredReasoningEffort = codexModelPolicy.knownModelReasoningEffortOverrides[option.id]
      ?? (isAppDefault ? codexModelPolicy.defaultReasoningEffort : undefined);
    return {
      ...option,
      available: isAppDefault || supportedReasoningEfforts.length > 0,
      known: true,
      isCatalogDefault: runtime?.isDefault === true,
      defaultReasoningEffort: configuredReasoningEffort
        ? configuredReasoningEffort
        : isReasoningEffort(runtime?.defaultReasoningEffort)
        && supportedReasoningEfforts.includes(runtime.defaultReasoningEffort)
          ? runtime.defaultReasoningEffort
          : supportedReasoningEfforts.at(-1) ?? codexModelPolicy.defaultReasoningEffort,
      supportedReasoningEfforts: isAppDefault
        ? [...codexModelPolicy.reasoningOptions]
        : supportedReasoningEfforts.length
          ? supportedReasoningEfforts
          : [codexModelPolicy.defaultReasoningEffort]
    };
  });

  const unknownCatalogDefault = catalog.find((item) =>
    item.isDefault === true
    && !knownOptions.some((option) => option.id === item.id || option.id === item.model)
  );
  if (!unknownCatalogDefault || !codexModelPolicy.acceptUnknownCatalogDefault) return knownOptions;

  const supportedReasoningEfforts = unknownCatalogDefault.supportedReasoningEfforts.filter(isReasoningEffort);
  const defaultReasoningEffort = codexModelPolicy.useHighestSupportedReasoningForUnknown
    ? supportedReasoningEfforts.at(-1)
    : undefined;
  const label = unknownCatalogDefault.displayName?.trim() || unknownCatalogDefault.id;
  return [...knownOptions, {
    id: unknownCatalogDefault.id,
    label_zh: label,
    label_en: label,
    available: true,
    known: false,
    isCatalogDefault: true,
    defaultReasoningEffort:
      defaultReasoningEffort
      ?? (isReasoningEffort(unknownCatalogDefault.defaultReasoningEffort)
        ? unknownCatalogDefault.defaultReasoningEffort
        : codexModelPolicy.defaultReasoningEffort),
    supportedReasoningEfforts: supportedReasoningEfforts.length
      ? supportedReasoningEfforts
      : [codexModelPolicy.defaultReasoningEffort]
  }];
}

export function resolveCodexSelection(
  options: ResolvedCodexModelOption[],
  selection: CodexModelSelection,
  requestedReasoning: CodexReasoningEffort
) {
  const unknownCatalogDefault = options.find((option) => option.isCatalogDefault && !option.known && option.available);
  const defaultModel = unknownCatalogDefault
    ?? options.find((option) => option.id === codexModelPolicy.defaultModel)
    ?? options.find((option) => option.available)
    ?? options[0]!;
  const requestedModel = options.find((option) => option.id === selection);
  const effectiveSelection = selection;
  const model = selection === "__auto"
    ? defaultModel
    : requestedModel?.available ? requestedModel : undefined;
  if (!model) {
    return {
      model: undefined,
      reasoningEffort: codexModelPolicy.defaultReasoningEffort,
      reasoningOptions: [codexModelPolicy.defaultReasoningEffort],
      effectiveSelection
    };
  }
  const reasoningOptions = selection === "__auto"
    ? model.known ? [...codexModelPolicy.reasoningOptions] : model.supportedReasoningEfforts
    : model.supportedReasoningEfforts;
  const reasoningEffort = selection === "__auto"
    ? model.known
      ? codexModelPolicy.knownModelReasoningEffortOverrides[model.id] ?? codexModelPolicy.defaultReasoningEffort
      : model.defaultReasoningEffort
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

export function conversationModelLabel(
  selection: CodexModelSelection,
  resolvedModel: CodexModelId | undefined,
  locale: WorkbenchLocale
): string {
  return selection === "__auto"
    ? resolvedModel ? modelLabel(resolvedModel, locale) : autoModelLabel(locale)
    : modelLabel(selection, locale);
}

export function reasoningLabel(effort: CodexReasoningEffort, locale: WorkbenchLocale, compact = false): string {
  const labels = {
    zh: {
      low: compact ? "低" : "推理低",
      medium: compact ? "中" : "推理中",
      high: compact ? "高" : "推理高",
      xhigh: compact ? "超高" : "推理超高",
      max: compact ? "最大" : "推理最大",
      ultra: compact ? "极高" : "推理极高"
    },
    en: {
      low: compact ? "Low" : "Low reasoning",
      medium: compact ? "Medium" : "Medium reasoning",
      high: compact ? "High" : "High reasoning",
      xhigh: compact ? "Extra high" : "Extra high reasoning",
      max: compact ? "Max" : "Maximum reasoning",
      ultra: compact ? "Ultra" : "Ultra reasoning"
    }
  } as const;
  return labels[locale][effort as keyof (typeof labels)[typeof locale]] ?? effort;
}
