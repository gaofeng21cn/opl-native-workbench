import {
  rendererModuleIdForPreviewKind,
  type RendererPreviewKind
} from "../renderers/moduleRegistry";

export type WorkbenchPurpose = "research" | "grant" | "presentation" | "review";
export type WorkbenchPreviewKind = RendererPreviewKind;

export type WorkbenchArtifactRef = {
  id: string;
  title: string;
  kind: "result" | "file" | "receipt" | "deliverable";
  status: "ready" | "needs_review" | "blocked";
  previewKind: WorkbenchPreviewKind;
  ref: string;
  summary: string;
  provenance: string[];
  actions: string[];
};

export type WorkspaceSession = {
  id: string;
  workspace: string;
  session: string;
  status: string;
  nextStep: string;
};

export type ArtifactPreview = {
  id: string;
  label: string;
  previewKind: WorkbenchPreviewKind;
  rendererModuleId: string;
  title: string;
  ref: string;
  summary: string;
};

export type WorkbenchSourceRef = {
  id: string;
  label: string;
  ref: string;
  summary: string;
};

export type WorkbenchActionRef = {
  id: string;
  label: string;
  route: string;
  payloadFields: string[];
  mutates: string;
  dryRunSupported: boolean;
  owner?: string;
  delegatedSurface?: string;
  canSubmitToSafeActionShell?: boolean;
  routeRequiresPayload?: boolean;
};

export type WorkbenchTraceRef = {
  id: string;
  label: string;
  value: string;
};

export type WorkbenchStarterField = {
  name: string;
  label: string;
  input: "text" | "textarea" | "select";
  value: string;
  options?: string[];
};

export type WorkbenchStarter = {
  id: "mas" | "mag" | "rca" | "bookforge";
  purpose: "research" | "grant" | "presentation" | "book";
  title: string;
  requiredSkill: string;
  module: string;
  intent: string;
  fields: WorkbenchStarterField[];
  dryRunAction: string;
  available?: boolean;
  status?: string;
  sourceRef?: string;
  previewActionId?: string;
};

export type ConfirmationCard = {
  id: string;
  title: string;
  question: string;
  risks: string[];
  willChange: string[];
  willNotChange: string[];
  receipt: string;
  rollback: string;
  dryRunAction: string;
};

export type InterviewQuestion = {
  id: string;
  question: string;
  whyItMatters: string;
  answerType: string;
};

export type ActiveProjectLine = {
  status: string;
  activeRunId: string | null;
  nextVisibleStep: string;
  progressDeltaClassification: string;
  deliverableProgressDelta: string;
  platformRepairDelta: string;
  nextForcedDelta: string;
};

export type DeliveryPackage = {
  id: string;
  title: string;
  status: "ready" | "needs_review" | "blocked";
  summary: string;
  previewActionId: string;
  deliverableRefs: string[];
  receiptRefs: string[];
  sourceRefs: string[];
  runtimeStatus: string;
  authorityBoundary: string;
};

export type ActionReceiptSummary = {
  id: string;
  title: string;
  actionId: string;
  route: string;
  status: "preview_ready" | "payload_required" | "unavailable";
  mutates: string;
  receiptRef: string;
  summary: string;
};

export type WorkbenchModel = {
  purposes: WorkbenchPurpose[];
  sessions: WorkspaceSession[];
  results: WorkbenchArtifactRef[];
  deliverables: WorkbenchArtifactRef[];
  receipts: WorkbenchArtifactRef[];
  artifactPreviews: ArtifactPreview[];
  deliveryPackages: DeliveryPackage[];
  actionReceipts: ActionReceiptSummary[];
  starters: WorkbenchStarter[];
  confirmations: ConfirmationCard[];
  questions: InterviewQuestion[];
  activeProjectLines: ActiveProjectLine[];
  contextSources: WorkbenchSourceRef[];
  contextActions: WorkbenchActionRef[];
  contextTrace: WorkbenchTraceRef[];
  stateGeneratedAt?: string;
};

export const initialWorkbenchModel: WorkbenchModel = {
  purposes: ["research", "grant", "presentation", "review"],
  sessions: [
    {
      id: "workspace-current",
      workspace: "Current project",
      session: "Delivery review",
      status: "candidate_surface_only",
      nextStep: "Draft from project refs, then preview the action"
    },
    {
      id: "workspace-review",
      workspace: "Result package",
      session: "Export draft",
      status: "needs_human_confirmation",
      nextStep: "Inspect trace and preview the export receipt"
    },
    {
      id: "workspace-starters",
      workspace: "Workflow setup",
      session: "Research, grant, presentation",
      status: "starter_ready",
      nextStep: "Choose a module form without executing domain CLI"
    }
  ],
  results: [
    {
      id: "result-summary",
      title: "Result summary",
      kind: "result",
      status: "needs_review",
      previewKind: "markdown",
      ref: "opl://result/summary",
      summary: "Chat answer distilled into a refs-only product result.",
      provenance: ["App fast state", "conversation event refs", "candidate plan"],
      actions: ["Open preview", "Ask follow-up", "Preview export"]
    },
    {
      id: "gap-map",
      title: "Gap map",
      kind: "result",
      status: "blocked",
      previewKind: "mermaid",
      ref: "opl://result/non-live-gap-map",
      summary: "Non-Live gaps that still need visual, packaged, owner, or release evidence.",
      provenance: ["false-ready boundary", "candidate evidence"],
      actions: ["Route to owner question", "Keep as residual risk"]
    }
  ],
  deliverables: [
    {
      id: "delivery-package",
      title: "Delivery package",
      kind: "deliverable",
      status: "needs_review",
      previewKind: "code",
      ref: "opl://delivery/package",
      summary: "Exportable packet shell for result refs, receipt refs, and reviewer notes.",
      provenance: ["delivery workbench model", "artifact preview tabs"],
      actions: ["Preview export", "Attach receipt ref", "Rollback request"]
    },
    {
      id: "owner-brief",
      title: "Review brief",
      kind: "deliverable",
      status: "ready",
      previewKind: "markdown",
      ref: "opl://delivery/owner-brief",
      summary: "Compact handoff brief that stays below owner-receipt authority.",
      provenance: ["confirmation card", "question card"],
      actions: ["Review risks", "Ask owner question"]
    }
  ],
  receipts: [
    {
      id: "dry-run-receipt",
      title: "Action preview receipt",
      kind: "receipt",
      status: "ready",
      previewKind: "code",
      ref: "opl://receipt/dry-run",
      summary: "Bridge preview receipt; no domain execution is implied.",
      provenance: ["opl app action execute --dry-run", "browser bridge"],
      actions: ["Copy command ref", "Compare payload"]
    }
  ],
  artifactPreviews: [
    {
      id: "preview-markdown",
      label: "Markdown",
      previewKind: "markdown",
      rendererModuleId: "streamdown",
      title: "Result narrative",
      ref: "artifact://candidate/result-summary.md",
      summary: "Streaming markdown preview for result prose and reviewer notes."
    },
    {
      id: "preview-math",
      label: "Math",
      previewKind: "math",
      rendererModuleId: "katex",
      title: "Methods note",
      ref: "artifact://candidate/methods-equation.tex",
      summary: "KaTeX-backed formula preview for scientific workbench notes."
    },
    {
      id: "preview-diagram",
      label: "Mermaid",
      previewKind: "mermaid",
      rendererModuleId: "mermaid",
      title: "Delivery flow",
      ref: "artifact://candidate/delivery-flow.mmd",
      summary: "Mermaid preview slot for routing, confirmation, and receipt flow."
    },
    {
      id: "preview-code",
      label: "Code",
      previewKind: "code",
      rendererModuleId: "@codemirror/view",
      title: "Patch excerpt",
      ref: "artifact://candidate/patch-ref.ts",
      summary: "CodeMirror preview slot for diff and code references."
    },
    {
      id: "preview-pdf",
      label: "PDF",
      previewKind: "pdf",
      rendererModuleId: "pdfjs-dist",
      title: "Export proof",
      ref: "artifact://candidate/export-preview.pdf",
      summary: "PDF.js preview slot for local export artifacts."
    }
  ],
  deliveryPackages: [
    {
      id: "delivery-package",
      title: "Delivery package",
      status: "needs_review",
      summary: "Refs-only package shell for deliverable refs, receipt refs, and source refs.",
      previewActionId: "candidate.delivery.export",
      deliverableRefs: ["opl://delivery/package", "opl://delivery/owner-brief"],
      receiptRefs: ["opl://receipt/dry-run"],
      sourceRefs: ["opl app state --profile fast --json"],
      runtimeStatus: "candidate_surface_only",
      authorityBoundary: "No artifact body, owner receipt, domain truth, or release authority."
    }
  ],
  actionReceipts: [
    {
      id: "receipt-candidate-delivery-export",
      title: "Delivery export preview receipt",
      actionId: "candidate.delivery.export",
      route: "opl app action execute --action candidate.delivery.export --dry-run --json",
      status: "preview_ready",
      mutates: "none_read_only",
      receiptRef: "opl://receipt/dry-run",
      summary: "Preview receipt ref only; no action execution is implied."
    }
  ],
  starters: [
    {
      id: "mas",
      purpose: "research",
      title: "Research / MAS",
      requiredSkill: "mas",
      module: "MedAutoScience",
      intent: "Prepare a paper-mission preview request from local fields.",
      fields: [
        { name: "study", label: "Study", input: "text", value: "DM-CVD candidate" },
        { name: "question", label: "Scientific question", input: "textarea", value: "What evidence package should be reviewed next?" },
        { name: "output", label: "Output", input: "select", value: "decision_packet", options: ["decision_packet", "figure_refs", "review_response"] }
      ],
      dryRunAction: "starter.mas.dry_run"
    },
    {
      id: "mag",
      purpose: "grant",
      title: "Grant / MAG",
      requiredSkill: "mag",
      module: "MedAutoGrant",
      intent: "Shape a grant-authoring preview request without grant authority.",
      fields: [
        { name: "mechanism", label: "Mechanism", input: "text", value: "R01-style concept" },
        { name: "aim", label: "Aim", input: "textarea", value: "Draft specific aims from approved refs only." },
        { name: "stage", label: "Stage", input: "select", value: "outline", options: ["outline", "significance", "approach"] }
      ],
      dryRunAction: "starter.mag.dry_run"
    },
    {
      id: "rca",
      purpose: "presentation",
      title: "Presentation / RCA",
      requiredSkill: "rca",
      module: "RedCube AI",
      intent: "Prepare a visual-deliverable preview request from refs.",
      fields: [
        { name: "scene", label: "Scene", input: "text", value: "Mechanism overview" },
        { name: "assets", label: "Assets", input: "textarea", value: "Use approved local refs; no generated authority claim." },
        { name: "format", label: "Format", input: "select", value: "slide_panel", options: ["slide_panel", "poster_panel", "figure_panel"] }
      ],
      dryRunAction: "starter.rca.dry_run"
    },
    {
      id: "bookforge",
      purpose: "book",
      title: "Book / BookForge",
      requiredSkill: "opl-bookforge",
      module: "OPL BookForge",
      intent: "Start a manuscript-structure preview request.",
      fields: [
        { name: "book", label: "Book", input: "text", value: "One Person Lab methods" },
        { name: "chapter", label: "Chapter brief", input: "textarea", value: "Turn confirmed results into a chapter outline." },
        { name: "mode", label: "Mode", input: "select", value: "outline", options: ["outline", "section_draft", "revision_map"] }
      ],
      dryRunAction: "starter.bookforge.dry_run"
    }
  ],
  confirmations: [
    {
      id: "confirm-export",
      title: "Prepare delivery export",
      question: "Preview the current result refs and receipt refs as a delivery package?",
      risks: ["Refs may be stale until App state is refreshed", "Packet is not owner acceptance"],
      willChange: ["Create an App action preview request", "Record the proposed export payload"],
      willNotChange: ["No domain artifact body is written", "No owner receipt or release claim is created"],
      receipt: "Preview receipt from opl app action execute --dry-run",
      rollback: "Discard the candidate packet request before explicit execution",
      dryRunAction: "candidate.delivery.export"
    },
    {
      id: "confirm-owner-question",
      title: "Ask owner question",
      question: "Route the unresolved decision as an owner-facing question?",
      risks: ["Owner may reject the proposed route", "Question may require newer runtime readback"],
      willChange: ["Prepare a typed question payload", "Attach refs and rollback path"],
      willNotChange: ["No active-shell adoption", "No runtime/domain truth transfer"],
      receipt: "Question dry-run receipt with source refs",
      rollback: "Remove the question card from the draft packet",
      dryRunAction: "candidate.owner.question"
    }
  ],
  questions: [
    {
      id: "question-authority",
      question: "Which App state ref is authoritative for this delivery?",
      whyItMatters: "The shell can present refs, but the App/domain owner decides truth.",
      answerType: "single source ref"
    },
    {
      id: "question-acceptance",
      question: "What evidence would promote this from candidate UI to visual acceptance?",
      whyItMatters: "Source smoke is not packaged GUI, clean VM, or owner acceptance.",
      answerType: "evidence checklist"
    },
    {
      id: "question-rollback",
      question: "What should be discarded if the dry-run route is rejected?",
      whyItMatters: "Rollback must be explicit before an export or owner question.",
      answerType: "rollback note"
    }
  ],
  activeProjectLines: [
    {
      status: "candidate_surface_only",
      activeRunId: null,
      nextVisibleStep: "Consume opl app state/action refs",
      progressDeltaClassification: "platform_or_observability_delta",
      deliverableProgressDelta: "result refs visible",
      platformRepairDelta: "native workbench non-live delivery surface",
      nextForcedDelta: "owner adoption gate"
    }
  ],
  contextSources: [
    {
      id: "fallback-fast-state",
      label: "Fast state",
      ref: "opl app state --profile fast --json",
      summary: "Default GUI state read surface."
    },
    {
      id: "fallback-action",
      label: "Action bridge",
      ref: "opl app action execute --action <action_id> --dry-run --json",
      summary: "Preview receipts before execution."
    }
  ],
  contextActions: [
    {
      id: "candidate.inspect",
      label: "Preview context inspect",
      route: "opl app action execute --action candidate.inspect --dry-run --json",
      payloadFields: [],
      mutates: "none_read_only",
      dryRunSupported: true
    }
  ],
  contextTrace: [
    { id: "fallback-owner", label: "Owner", value: "one-person-lab-app GUI refs" },
    { id: "fallback-boundary", label: "Boundary", value: "refs-only, no domain artifact body ownership" }
  ]
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString).filter((item): item is string => Boolean(item)) : [];
}

function asBoolean(value: unknown): boolean {
  return value === true || asString(value) === "true";
}

function uniqueByRef<T extends { ref?: string; route?: string; id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.ref ?? item.route ?? item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceRef(id: string, label: string, ref: unknown, summary: string): WorkbenchSourceRef | null {
  const value = asString(ref);
  return value ? { id, label, ref: value, summary } : null;
}

function actionText(action: WorkbenchActionRef): string {
  return `${action.id} ${action.label} ${action.route} ${action.delegatedSurface ?? ""}`.toLowerCase();
}

function isDeliveryAction(action: WorkbenchActionRef): boolean {
  return /deliver|export|bundle|result|review|handoff|package/.test(actionText(action));
}

function isReceiptAction(action: WorkbenchActionRef): boolean {
  return /receipt|preview|dry.?run|export|bundle/.test(actionText(action));
}

function inferPreviewKind(action: WorkbenchActionRef): WorkbenchPreviewKind {
  const text = actionText(action);
  if (/pdf/.test(text)) return "pdf";
  if (/mermaid|diagram|flow/.test(text)) return "mermaid";
  if (/math|latex|katex|equation/.test(text)) return "math";
  if (/markdown|brief|review|result|handoff|summary/.test(text)) return "markdown";
  if (/code|diff|patch/.test(text)) return "code";
  return "json";
}

function actionStatus(action: WorkbenchActionRef): ActionReceiptSummary["status"] {
  if (!action.dryRunSupported) return "unavailable";
  return action.payloadFields.length ? "payload_required" : "preview_ready";
}

function firstPreviewAction(actions: WorkbenchActionRef[]): WorkbenchActionRef | undefined {
  return actions.find((action) => action.dryRunSupported && isDeliveryAction(action))
    ?? actions.find((action) => action.dryRunSupported && action.payloadFields.length === 0)
    ?? actions.find((action) => action.dryRunSupported);
}

function moduleKey(value: string): WorkbenchStarter["id"] | null {
  const key = value.toLowerCase();
  if (key.includes("medautoscience") || key.includes("med auto science")) return "mas";
  if (key.includes("medautogrant") || key.includes("med auto grant")) return "mag";
  if (key.includes("redcube") || key.includes("redcube ai")) return "rca";
  if (key.includes("oplbookforge") || key.includes("opl book forge") || key.includes("bookforge")) return "bookforge";
  return null;
}

function starterPreviewAction(starter: WorkbenchStarter, actions: WorkbenchActionRef[]): WorkbenchActionRef | undefined {
  const exactIds = [`starter.${starter.id}`, `starter_${starter.id}`, `${starter.id}_starter`];
  return actions.find((action) => action.dryRunSupported && exactIds.some((id) => action.id.includes(id)));
}

function pickActiveProjectLines(value: unknown, fallback: ActiveProjectLine[]): ActiveProjectLine[] {
  const rawLines = Array.isArray(value) ? value : Array.isArray(asRecord(value)?.items) ? asRecord(value)?.items : [];
  const lines = rawLines.map(asRecord).filter(Boolean).map((line): ActiveProjectLine => ({
    status: asString(line?.status) ?? "unknown",
    activeRunId: asString(line?.active_run_id) ?? asString(line?.activeRunId),
    nextVisibleStep: asString(line?.next_visible_step) ?? asString(line?.nextVisibleStep) ?? "Review current refs",
    progressDeltaClassification: asString(line?.progress_delta_classification) ?? asString(line?.progressDeltaClassification) ?? "platform_or_observability_delta",
    deliverableProgressDelta: asString(line?.deliverable_progress_delta) ?? asString(line?.deliverableProgressDelta) ?? "refs visible",
    platformRepairDelta: asString(line?.platform_repair_delta) ?? asString(line?.platformRepairDelta) ?? "none",
    nextForcedDelta: asString(line?.next_forced_delta) ?? asString(line?.nextForcedDelta) ?? "owner adoption gate"
  }));
  return lines.length ? lines : fallback;
}

function pickAppState(state: unknown): Record<string, unknown> | null {
  const root = asRecord(state);
  return asRecord(root?.app_state) ?? root;
}

export function deriveWorkbenchModelFromState(state: unknown, fallback: WorkbenchModel = initialWorkbenchModel): WorkbenchModel {
  const appState = pickAppState(state);
  if (!appState) return fallback;

  const runtimeSource = asRecord(appState.runtime_source);
  const operator = asRecord(appState.operator);
  const modules = asRecord(appState.modules);
  const moduleItems = Array.isArray(modules?.items) ? modules.items.map(asRecord).filter(Boolean) : [];
  const actions = Array.isArray(appState.actions) ? appState.actions.map(asRecord).filter(Boolean) : [];
  const meta = asRecord(appState.meta);

  const runtimeSources = [
    sourceRef("state-fast", "Fast state", runtimeSource?.normal_gui_state_surface, "Normal GUI state read."),
    sourceRef("state-full", "Full state", runtimeSource?.full_gui_state_surface, "Explicit detailed state read."),
    sourceRef("action-boundary", "Action boundary", runtimeSource?.action_boundary_surface, "App action execution surface."),
    sourceRef("full-drilldown", "Full drilldown", runtimeSource?.full_drilldown_exception_surface, "Runtime drilldown exception.")
  ].filter((item): item is WorkbenchSourceRef => Boolean(item));

  const operatorSources = Array.isArray(operator?.refs)
    ? operator.refs.map((item, index) => {
        const ref = asRecord(item);
        return sourceRef(`operator-ref-${index}`, asString(ref?.label) ?? "Operator ref", ref?.ref, asString(ref?.node_kind) ?? "OPL operator ref.");
      }).filter((item): item is WorkbenchSourceRef => Boolean(item))
    : [];

  const moduleSources = moduleItems.slice(0, 5).map((item, index) => sourceRef(
    `module-${asString(item?.module_id) ?? index}`,
    asString(item?.label) ?? asString(item?.module_id) ?? "Module",
    asString(item?.checkout_path) ?? asString(item?.repo_url),
    asString(item?.health_status) ? `Module health: ${item?.health_status}` : "Managed OPL module ref."
  )).filter((item): item is WorkbenchSourceRef => Boolean(item));

  const contextSources = uniqueByRef([...runtimeSources, ...operatorSources, ...moduleSources]);

  const contextActions = actions.map((item): WorkbenchActionRef | null => {
    const id = asString(item?.action_id);
    if (!id) return null;
    return {
      id,
      label: asString(item?.label) ?? id,
      route: asString(item?.route) ?? `opl app action execute --action ${id}`,
      payloadFields: asStringArray(item?.payload_fields),
      mutates: asString(item?.mutates) ?? "unknown",
      dryRunSupported: asBoolean(item?.dry_run_supported),
      owner: asString(item?.owner) ?? undefined,
      delegatedSurface: asString(item?.delegated_surface) ?? undefined,
      canSubmitToSafeActionShell: asBoolean(item?.can_submit_to_safe_action_shell),
      routeRequiresPayload: asBoolean(item?.route_requires_domain_or_app_payload)
    };
  }).filter((item): item is WorkbenchActionRef => Boolean(item));

  const deliveryActions = contextActions.filter(isDeliveryAction);
  const receiptActions = contextActions.filter((action) => action.dryRunSupported && isReceiptAction(action));
  const previewAction = firstPreviewAction(contextActions);
  const previewActions = uniqueByRef([
    ...(previewAction ? [previewAction] : []),
    ...receiptActions,
    ...contextActions.filter((action) => action.dryRunSupported)
  ]).slice(0, 5);
  const artifactPreviews = previewActions.length ? previewActions.map((action): ArtifactPreview => ({
    id: `preview-${action.id}`,
    label: action.label,
    previewKind: inferPreviewKind(action),
    rendererModuleId: rendererModuleIdForPreviewKind(inferPreviewKind(action)),
    title: action.label,
    ref: action.route,
    summary: `Refs-only preview from ${action.owner ?? "OPL action"}; mutates: ${action.mutates}.`
  })) : fallback.artifactPreviews;

  const deliverables = deliveryActions.length ? deliveryActions.slice(0, 6).map((action): WorkbenchArtifactRef => ({
    id: `deliverable-${action.id}`,
    title: action.label,
    kind: "deliverable",
    status: action.dryRunSupported ? "needs_review" : "blocked",
    previewKind: inferPreviewKind(action),
    ref: action.route,
    summary: `${action.delegatedSurface ?? action.route} as a refs-only deliverable/action ref.`,
    provenance: [runtimeSource?.normal_gui_state_surface, action.owner, action.delegatedSurface].map(asString).filter((item): item is string => Boolean(item)),
    actions: action.dryRunSupported ? ["Preview action receipt", "Attach source refs"] : ["Requires App action payload"]
  })) : fallback.deliverables;

  const receipts = receiptActions.length ? receiptActions.slice(0, 6).map((action): WorkbenchArtifactRef => ({
    id: `receipt-${action.id}`,
    title: `${action.label} receipt`,
    kind: "receipt",
    status: action.payloadFields.length ? "needs_review" : "ready",
    previewKind: "json",
    ref: `receipt://${action.id}/dry-run`,
    summary: `Dry-run receipt ref for ${action.route}; no execution receipt is claimed.`,
    provenance: [runtimeSource?.action_boundary_surface, action.owner, action.delegatedSurface].map(asString).filter((item): item is string => Boolean(item)),
    actions: ["Preview receipt", "Compare payload"]
  })) : fallback.receipts;

  const actionReceipts = receiptActions.length ? receiptActions.slice(0, 8).map((action): ActionReceiptSummary => ({
    id: `action-receipt-${action.id}`,
    title: `${action.label} receipt preview`,
    actionId: action.id,
    route: `${action.route} --dry-run --json`,
    status: actionStatus(action),
    mutates: action.mutates,
    receiptRef: `receipt://${action.id}/dry-run`,
    summary: action.payloadFields.length
      ? `Dry-run route exists; payload required: ${action.payloadFields.join(", ")}.`
      : "Dry-run route can preview a refs-only receipt without a domain artifact body."
  })) : fallback.actionReceipts;

  const moduleAvailability = new Map<WorkbenchStarter["id"], { status: string; sourceRef: string }>();
  for (const item of moduleItems) {
    const moduleId = asString(item?.module_id) ?? "";
    const label = asString(item?.label) ?? "";
    const key = moduleKey(`${moduleId} ${label}`);
    if (!key) continue;
    const installed = asBoolean(item?.installed);
    const health = asString(item?.health_status) ?? "unknown";
    moduleAvailability.set(key, {
      status: installed ? health : "not_installed",
      sourceRef: asString(item?.checkout_path) ?? asString(item?.repo_url) ?? moduleId
    });
  }

  const starters = fallback.starters.map((starter): WorkbenchStarter => {
    const availability = moduleAvailability.get(starter.id);
    const starterAction = starterPreviewAction(starter, contextActions);
    return {
      ...starter,
      available: Boolean(availability),
      status: availability?.status ?? "fallback",
      sourceRef: availability?.sourceRef ?? starter.sourceRef,
      previewActionId: starterAction?.id ?? starter.previewActionId ?? starter.dryRunAction,
      dryRunAction: starterAction?.id ?? starter.dryRunAction
    };
  });

  const runtimeStatus = asString(asRecord(operator?.summary)?.runtime_status)
    ?? asString(asRecord(operator?.summary)?.provider_status)
    ?? asString(asRecord(appState.provider)?.status)
    ?? "unknown";

  const effectiveContextSources = contextSources.length ? contextSources : fallback.contextSources;
  const sourceRefs = effectiveContextSources.map((source) => source.ref);
  const deliveryPackages: DeliveryPackage[] = contextActions.length || contextSources.length ? [
    {
      id: "delivery-package",
      title: "Delivery package",
      status: deliverables.length || receipts.length ? "needs_review" : "blocked",
      summary: "Derived from App state action refs, deliverable refs, receipt refs, and runtime status; artifact bodies stay source-owned.",
      previewActionId: previewAction?.id ?? fallback.deliveryPackages[0]?.previewActionId ?? "artifact.export.prepare",
      deliverableRefs: deliverables.map((item) => item.ref),
      receiptRefs: receipts.map((item) => item.ref),
      sourceRefs,
      runtimeStatus,
      authorityBoundary: "Refs-only delivery context; no artifact body, owner receipt, domain truth, or release authority."
    }
  ] : fallback.deliveryPackages;

  const confirmations = fallback.confirmations.map((card, index): ConfirmationCard => index === 0 && previewAction ? {
    ...card,
    question: `Preview ${previewAction.label} as a refs-only delivery package?`,
    risks: [`Runtime status: ${runtimeStatus}`, "Preview receipt is not owner acceptance"],
    willChange: [`Create dry-run request for ${previewAction.id}`, "Attach current App state refs"],
    receipt: `${previewAction.route} --dry-run --json`,
    dryRunAction: previewAction.id
  } : card);

  const contextTrace = [
    { id: "profile", label: "Profile", value: asString(meta?.profile) ?? "" },
    { id: "generated", label: "Generated", value: asString(meta?.generated_at) ?? "" },
    { id: "owner", label: "Owner", value: asString(runtimeSource?.owner) ?? "" },
    { id: "app-owner", label: "App truth owner", value: asString(runtimeSource?.app_repo_truth_owner) ?? "" },
    { id: "provider", label: "Provider status", value: asString(asRecord(operator?.summary)?.provider_status) ?? "" },
    { id: "runtime", label: "Runtime status", value: asString(asRecord(operator?.summary)?.runtime_status) ?? "" }
  ].filter((item) => item.value);

  return {
    ...fallback,
    deliverables,
    receipts,
    artifactPreviews,
    deliveryPackages,
    actionReceipts,
    starters,
    confirmations,
    activeProjectLines: pickActiveProjectLines(appState.active_project_lines, fallback.activeProjectLines),
    contextSources: effectiveContextSources,
    contextActions: contextActions.length ? contextActions : fallback.contextActions,
    contextTrace: contextTrace.length ? contextTrace : fallback.contextTrace,
    stateGeneratedAt: asString(meta?.generated_at) ?? fallback.stateGeneratedAt
  };
}
