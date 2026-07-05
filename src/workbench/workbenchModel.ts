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
      status: "starter_preview_routes_payload_required",
      nextStep: "Choose a module form and preview through App action refs, not domain CLI"
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
      summary: "Refs-only package shell for deliverable refs, receipt refs, and source refs; preview route requires App payload.",
      previewActionId: "task_export_bundle_preview",
      deliverableRefs: ["opl://delivery/package", "opl://delivery/owner-brief"],
      receiptRefs: ["opl://receipt/dry-run"],
      sourceRefs: ["opl app state --profile fast --json"],
      runtimeStatus: "candidate_surface_only",
      authorityBoundary: "No artifact body, owner receipt, domain truth, or release authority."
    }
  ],
  actionReceipts: [
    {
      id: "receipt-task-export-bundle-preview",
      title: "Export bundle preview receipt",
      actionId: "task_export_bundle_preview",
      route: "opl app action execute --action task_export_bundle_preview --dry-run --json",
      status: "payload_required",
      mutates: "none_read_only",
      receiptRef: "opl://receipt/dry-run",
      summary: "App action preview route only; task_id and export_bundle_ref payload are required."
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
      dryRunAction: "starter.mas.dry_run",
      available: false,
      status: "fallback_unavailable_fake_action_id",
      sourceRef: "fallback:no live App state action ref"
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
      dryRunAction: "starter.mag.dry_run",
      available: false,
      status: "fallback_unavailable_fake_action_id",
      sourceRef: "fallback:no live App state action ref"
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
      dryRunAction: "starter.rca.dry_run",
      available: false,
      status: "fallback_unavailable_fake_action_id",
      sourceRef: "fallback:no live App state action ref"
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
      dryRunAction: "starter.bookforge.dry_run",
      available: false,
      status: "fallback_unavailable_fake_action_id",
      sourceRef: "fallback:no live App state action ref"
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
      dryRunAction: "task_export_bundle_preview"
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
      dryRunAction: "task_action_receipt_preview"
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
      id: "task_action_receipt_preview",
      label: "Preview task action receipt",
      route: "opl app action execute --action task_action_receipt_preview",
      payloadFields: ["task_id", "action_ref"],
      mutates: "none_read_only",
      dryRunSupported: true,
      owner: "opl_framework",
      delegatedSurface: "opl task action receipt preview",
      canSubmitToSafeActionShell: false,
      routeRequiresPayload: true
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

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
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

function previewKindFromText(value: string): WorkbenchPreviewKind {
  const text = value.toLowerCase();
  if (/pdf/.test(text)) return "pdf";
  if (/mermaid|diagram|flow/.test(text)) return "mermaid";
  if (/math|latex|katex|equation/.test(text)) return "math";
  if (/json|receipt|preview|diff|patch|code/.test(text)) return "code";
  if (/markdown|brief|review|result|handoff|summary|workflow|artifact|export/.test(text)) return "markdown";
  return "json";
}

function previewKindFromRef(ref: string, summary = ""): WorkbenchPreviewKind {
  return previewKindFromText(`${ref} ${summary}`);
}

function isDeliveryAction(action: WorkbenchActionRef): boolean {
  return /deliver|export|bundle|result|review|handoff|package/.test(actionText(action));
}

function isReceiptAction(action: WorkbenchActionRef): boolean {
  return /receipt|preview|dry.?run|export|bundle/.test(actionText(action));
}

function inferPreviewKind(action: WorkbenchActionRef): WorkbenchPreviewKind {
  return previewKindFromText(actionText(action));
}

function actionStatus(action: WorkbenchActionRef): ActionReceiptSummary["status"] {
  if (!action.dryRunSupported) return "unavailable";
  return action.payloadFields.length ? "payload_required" : "preview_ready";
}

const starterPreviewRouteIds: Record<WorkbenchStarter["id"], string[]> = {
  mas: ["task_action_receipt_preview", "task_export_bundle_preview", "settings_sync_capabilities"],
  mag: ["task_export_bundle_preview", "task_action_receipt_preview", "settings_sync_capabilities"],
  rca: ["task_export_bundle_preview", "task_action_receipt_preview", "settings_sync_capabilities"],
  bookforge: ["workspace_ensure", "task_export_bundle_preview", "settings_sync_capabilities"]
};

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
  const dedicated = actions.find((action) => action.dryRunSupported && exactIds.some((id) => action.id.includes(id)));
  if (dedicated) return dedicated;
  const routeIds = starterPreviewRouteIds[starter.id];
  return routeIds.map((id) => actions.find((action) => action.id === id && action.dryRunSupported)).find(Boolean);
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

function compactText(value: unknown, fallback: string, max = 160): string {
  const text = asString(value)?.replace(/\s+/g, " ").trim() ?? fallback;
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function artifactStatus(value: unknown): WorkbenchArtifactRef["status"] {
  const text = (asString(value) ?? "").toLowerCase();
  if (/ready|completed|complete|healthy|available/.test(text)) return "ready";
  if (/blocked|dirty|error|attention/.test(text)) return "blocked";
  return "needs_review";
}

function fieldLabel(name: string): string {
  const labels: Record<string, string> = {
    task_id: "Task ID",
    action_ref: "Action ref",
    export_bundle_ref: "Export bundle ref",
    agent_id: "Agent ID",
    workspace_root_optional: "Workspace root",
    workspace_id: "Workspace ID",
    project_id: "Project ID",
    mode: "Mode",
    title: "Title"
  };
  return labels[name] ?? name.replace(/_/g, " ");
}

function fieldInput(name: string): WorkbenchStarterField["input"] {
  if (name === "mode") return "select";
  if (/ref|path|prompt|question|summary|note|description|title/.test(name)) return "textarea";
  return "text";
}

function fieldOptions(name: string): string[] | undefined {
  if (name === "mode") return ["existing", "create"];
  return undefined;
}

function ensureDryRunJsonRoute(route: string): string {
  const withDryRun = route.includes("--dry-run") ? route : `${route} --dry-run`;
  return withDryRun.includes("--json") ? withDryRun : `${withDryRun} --json`;
}

function extractActionId(ref: unknown): string | null {
  const value = asString(ref);
  if (!value) return null;
  const match = value.match(/#([A-Za-z0-9_.-]+)$/);
  return match?.[1] ?? null;
}

function pickTaskKey(task: Record<string, unknown>): WorkbenchStarter["id"] | null {
  return moduleKey(
    `${asString(task.domain_id) ?? ""} ${asString(task.domain_label) ?? ""} ${asString(task.title) ?? ""}`
  );
}

function starterFieldValue(
  fieldName: string,
  task: Record<string, unknown> | null,
  moduleItem: Record<string, unknown> | null
): string {
  const actionReceipt = asRecord(task?.action_receipt);
  const artifact = asRecord(task?.artifact_or_blocker);
  const exportBundleRefs = asStringArray(artifact?.export_bundle_refs);
  if (fieldName === "task_id") return asString(task?.task_id) ?? asString(task?.domain_id) ?? "";
  if (fieldName === "action_ref") return asString(actionReceipt?.preview_ref) ?? "";
  if (fieldName === "export_bundle_ref") return exportBundleRefs[0] ?? asString(artifact?.export_ref) ?? "";
  if (fieldName === "agent_id") return asString(task?.domain_id) ?? asString(moduleItem?.module_id) ?? "";
  if (fieldName === "workspace_root_optional" || fieldName === "workspace_path") {
    return asString(task?.workspace_path) ?? asString(moduleItem?.checkout_path) ?? "";
  }
  if (fieldName === "workspace_id") return asString(task?.task_id) ?? asString(moduleItem?.module_id) ?? "";
  if (fieldName === "project_id") return asString(task?.task_id) ?? asString(moduleItem?.module_id) ?? "";
  if (fieldName === "mode") return "existing";
  if (fieldName === "title") return asString(task?.title) ?? asString(moduleItem?.label) ?? "";
  return asString(task?.title) ?? asString(moduleItem?.label) ?? "";
}

function buildStarterFields(
  starter: WorkbenchStarter,
  action: WorkbenchActionRef | undefined,
  task: Record<string, unknown> | null,
  moduleItem: Record<string, unknown> | null
): WorkbenchStarterField[] {
  if (!action?.payloadFields.length) return starter.fields;
  return action.payloadFields.map((name) => ({
    name,
    label: fieldLabel(name),
    input: fieldInput(name),
    value: starterFieldValue(name, task, moduleItem),
    options: fieldOptions(name)
  }));
}

function buildTaskSourceRefs(taskDrilldowns: Record<string, unknown>[]): WorkbenchSourceRef[] {
  return taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id) ?? "task";
    const title = asString(task.title) ?? taskId;
    const artifact = asRecord(task.artifact_or_blocker);
    const workflowRefs = asRecord(task.workflow_refs);
    const reviewReceipt = asRecord(task.review_receipt);
    const actionReceipt = asRecord(task.action_receipt);
    return [
      sourceRef(
        `task-${taskId}`,
        `${title} task`,
        artifact?.current_ref ?? workflowRefs?.current_workflow_ref ?? asString(task.workspace_path),
        compactText(task.next_visible_step, "Task status ref.")
      ),
      sourceRef(
        `workflow-${taskId}`,
        `${title} workflow`,
        workflowRefs?.current_workflow_ref ?? workflowRefs?.stage_workflow_ref,
        compactText(workflowRefs?.content_policy, "Refs-only workflow ref.")
      ),
      sourceRef(
        `review-${taskId}`,
        `${title} review receipt`,
        reviewReceipt?.receipt_ref,
        compactText(reviewReceipt?.authority_policy, "Reviewer receipt ref only.")
      ),
      sourceRef(
        `preview-${taskId}`,
        `${title} action preview`,
        actionReceipt?.preview_ref,
        compactText(actionReceipt?.content_policy, "Dry-run action preview ref.")
      )
    ].filter((item): item is WorkbenchSourceRef => Boolean(item));
  });
}

function buildResultsFromTasks(taskDrilldowns: Record<string, unknown>[]): WorkbenchArtifactRef[] {
  const items = taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id);
    const title = asString(task.title);
    const artifact = asRecord(task.artifact_or_blocker);
    const reviewReceipt = asRecord(task.review_receipt);
    const actionReceipt = asRecord(task.action_receipt);
    if (!taskId || !title) return [];
    return [
      {
        id: `result-${taskId}`,
        title: `${title} delta`,
        kind: "result" as const,
        status: artifactStatus(task.status ?? task.state),
        previewKind: previewKindFromRef(
          asString(artifact?.current_ref) ?? asString(artifact?.canonical_ref) ?? title,
          asString(task.next_visible_step) ?? title
        ),
        ref: asString(artifact?.current_ref) ?? asString(artifact?.canonical_ref) ?? `opl://task/${taskId}`,
        summary: compactText(task.next_visible_step, `${title} task status ref.`),
        provenance: [
          asString(task.workspace_path),
          asString(task.runtime_readback_source),
          asString(reviewReceipt?.receipt_ref)
        ].filter((item): item is string => Boolean(item)),
        actions: [
          asString(actionReceipt?.action_id) ? "Preview task receipt" : null,
          asString(reviewReceipt?.receipt_ref) ? "Open review receipt ref" : null
        ].filter((item): item is string => Boolean(item))
      }
    ];
  });
  return items.length ? items.slice(0, 6) : initialWorkbenchModel.results;
}

export function deriveWorkbenchModelFromState(state: unknown, fallback: WorkbenchModel = initialWorkbenchModel): WorkbenchModel {
  const appState = pickAppState(state);
  if (!appState) return fallback;

  const runtimeSource = asRecord(appState.runtime_source);
  const operator = asRecord(appState.operator);
  const workbench = asRecord(operator?.workbench);
  const modules = asRecord(appState.modules);
  const settingsControlCenter = asRecord(appState.settings_control_center);
  const moduleItems = asRecordArray(modules?.items);
  const actions = asRecordArray(appState.actions);
  const taskDrilldowns = asRecordArray(workbench?.task_drilldowns);
  const settingsTaskEntries = asRecordArray(settingsControlCenter?.task_entries);
  const settingsSections = asRecordArray(settingsControlCenter?.action_sections);
  const safeActionRoutes = asRecordArray(workbench?.safe_action_routes);
  const currentOwnerDelta = asRecord(workbench?.current_owner_delta);
  const currentOwnerDeltaNextAction = asRecord(workbench?.current_owner_delta_next_action);
  const meta = asRecord(appState.meta);

  const runtimeSources = [
    sourceRef("state-fast", "Fast state", runtimeSource?.normal_gui_state_surface, "Normal GUI state read."),
    sourceRef("state-full", "Full state", runtimeSource?.full_gui_state_surface, "Explicit detailed state read."),
    sourceRef("action-boundary", "Action boundary", runtimeSource?.action_boundary_surface, "App action execution surface."),
    sourceRef("full-drilldown", "Full drilldown", runtimeSource?.full_drilldown_exception_surface, "Runtime drilldown exception.")
  ].filter((item): item is WorkbenchSourceRef => Boolean(item));

  const workbenchSources = buildTaskSourceRefs(taskDrilldowns);

  const settingsSources = settingsSections.map((item, index) => sourceRef(
    `settings-section-${asString(item.section_id) ?? index}`,
    asString(item.label) ?? `Settings section ${index + 1}`,
    item.source_ref,
    compactText(item.description, "Settings control center section.")
  )).filter((item): item is WorkbenchSourceRef => Boolean(item));

  const moduleSources = moduleItems.slice(0, 5).map((item, index) => sourceRef(
    `module-${asString(item?.module_id) ?? index}`,
    asString(item?.label) ?? asString(item?.module_id) ?? "Module",
    asString(item?.checkout_path) ?? asString(item?.repo_url),
    compactText(item?.description, asString(item?.health_status) ? `Module health: ${item?.health_status}` : "Managed OPL module ref.")
  )).filter((item): item is WorkbenchSourceRef => Boolean(item));

  const contextSources = uniqueByRef([...runtimeSources, ...settingsSources, ...moduleSources, ...workbenchSources]);

  const baseActions = actions.map((item): WorkbenchActionRef | null => {
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

  const actionOverrides = new Map<string, Partial<WorkbenchActionRef>>();
  for (const entry of settingsTaskEntries) {
    const id = asString(entry.action_id) ?? asString(entry.task_id);
    if (!id) continue;
    actionOverrides.set(id, {
      label: asString(entry.label) ?? id,
      route: asString(entry.route) ?? `opl app action execute --action ${id}`,
      payloadFields: asStringArray(entry.payload_fields),
      mutates: asString(entry.mutates) ?? "unknown",
      dryRunSupported: asBoolean(entry.dry_run_supported),
      delegatedSurface: asString(entry.delegated_surface) ?? asString(entry.dry_run_route) ?? undefined,
      routeRequiresPayload: asBoolean(entry.payload_required)
    });
  }
  for (const route of safeActionRoutes) {
    const id = asString(route.action_id);
    if (!id) continue;
    const existing = actionOverrides.get(id) ?? {};
    actionOverrides.set(id, {
      ...existing,
      label: asString(route.label) ?? existing.label ?? id,
      route: asString(route.route) ?? existing.route ?? `opl app action execute --action ${id}`,
      owner: asString(route.owner) ?? existing.owner,
      dryRunSupported: true
    });
  }

  const actionMap = new Map<string, WorkbenchActionRef>();
  for (const action of baseActions) {
    const override = actionOverrides.get(action.id);
    actionMap.set(action.id, {
      ...action,
      ...(override ?? {})
    });
  }
  for (const [id, override] of actionOverrides.entries()) {
    if (actionMap.has(id)) continue;
    actionMap.set(id, {
      id,
      label: override.label ?? id,
      route: override.route ?? `opl app action execute --action ${id}`,
      payloadFields: override.payloadFields ?? [],
      mutates: override.mutates ?? "unknown",
      dryRunSupported: override.dryRunSupported ?? true,
      owner: override.owner,
      delegatedSurface: override.delegatedSurface,
      canSubmitToSafeActionShell: override.canSubmitToSafeActionShell,
      routeRequiresPayload: override.routeRequiresPayload
    });
  }

  const priorityActionIds = uniqueByRef(taskDrilldowns.flatMap((task) => {
    const actionReceipt = asRecord(task.action_receipt);
    const taskActionId = asString(actionReceipt?.action_id);
    const exportActionId = asString(actionReceipt?.export_bundle_action_id)
      ?? extractActionId(asRecord(task.artifact_or_blocker)?.export_bundle_action_ref);
    return [taskActionId, exportActionId].filter((item): item is string => Boolean(item)).map((id) => ({
      id,
      ref: id
    }));
  }).concat(
    settingsTaskEntries
      .filter((entry) => ["workspace", "capabilities", "packages", "model_access"].includes(asString(entry.section_id) ?? ""))
      .map((entry) => ({ id: asString(entry.action_id) ?? asString(entry.task_id) ?? "", ref: asString(entry.action_id) ?? asString(entry.task_id) ?? "" })),
    [
      { id: "workspace_ensure", ref: "workspace_ensure" },
      { id: "settings_sync_capabilities", ref: "settings_sync_capabilities" },
      { id: "task_action_receipt_preview", ref: "task_action_receipt_preview" },
      { id: "task_export_bundle_preview", ref: "task_export_bundle_preview" }
    ]
  )).map((item) => item.id);

  const contextActions = uniqueByRef([
    ...priorityActionIds.map((id) => actionMap.get(id)).filter((item): item is WorkbenchActionRef => Boolean(item)),
    ...Array.from(actionMap.values())
      .filter((action) => action.dryRunSupported && (isDeliveryAction(action) || isReceiptAction(action)))
      .slice(0, 8)
  ]);

  const taskDeliverables = taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id);
    const title = asString(task.title);
    const artifact = asRecord(task.artifact_or_blocker);
    const workflowRefs = asRecord(task.workflow_refs);
    if (!taskId || !title || !artifact) return [];
    const refs = [
      {
        id: `deliverable-${taskId}-canonical`,
        title: `${title} canonical ref`,
        ref: asString(artifact.canonical_ref),
        summary: compactText(artifact.content_policy, "Refs-only canonical artifact ref."),
        previewKind: previewKindFromRef(asString(artifact.canonical_ref) ?? title, asString(artifact.content_policy) ?? title)
      },
      {
        id: `deliverable-${taskId}-export`,
        title: `${title} export ref`,
        ref: asString(artifact.export_ref),
        summary: compactText(task.next_visible_step, "Export ref derived from operator workbench."),
        previewKind: previewKindFromRef(asString(artifact.export_ref) ?? title, asString(task.next_visible_step) ?? title)
      },
      {
        id: `deliverable-${taskId}-workflow`,
        title: `${title} workflow ref`,
        ref: asString(workflowRefs?.current_workflow_ref),
        summary: compactText(workflowRefs?.content_policy, "Workflow ref only."),
        previewKind: previewKindFromRef(asString(workflowRefs?.current_workflow_ref) ?? title, asString(workflowRefs?.content_policy) ?? title)
      }
    ];
    return refs
      .filter((item) => item.ref)
      .map((item): WorkbenchArtifactRef => ({
        id: item.id,
        title: item.title,
        kind: "deliverable",
        status: artifactStatus(task.status ?? task.state),
        previewKind: item.previewKind,
        ref: item.ref!,
        summary: item.summary,
        provenance: [
          asString(task.workspace_path),
          asString(artifact.lineage_ref),
          asString(artifact.conformance_ref)
        ].filter((value): value is string => Boolean(value)),
        actions: ["Preview ref", "Attach receipt ref"]
      }));
  });
  const deliverables = taskDeliverables.length ? uniqueByRef(taskDeliverables).slice(0, 6) : fallback.deliverables;

  const taskReceipts = taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id);
    const title = asString(task.title);
    const actionReceipt = asRecord(task.action_receipt);
    const reviewReceipt = asRecord(task.review_receipt);
    const artifact = asRecord(task.artifact_or_blocker);
    if (!taskId || !title) return [];
    const items = [
      {
        id: `receipt-${taskId}-action`,
        title: `${title} action preview`,
        ref: asString(actionReceipt?.preview_ref),
        summary: compactText(actionReceipt?.content_policy, "Dry-run action receipt ref."),
        status: actionReceipt?.preview_ref ? "needs_review" : "blocked"
      },
      {
        id: `receipt-${taskId}-review`,
        title: `${title} review receipt`,
        ref: asString(reviewReceipt?.receipt_ref),
        summary: compactText(reviewReceipt?.authority_policy, "Review receipt summary ref."),
        status: artifactStatus(reviewReceipt?.status ?? task.status ?? task.state)
      },
      {
        id: `receipt-${taskId}-artifact`,
        title: `${title} artifact receipt`,
        ref: asString(artifact?.receipt_ref),
        summary: compactText(artifact?.content_policy, "Artifact receipt ref only."),
        status: artifactStatus(task.status ?? task.state)
      }
    ];
    return items
      .filter((item) => item.ref)
      .map((item): WorkbenchArtifactRef => ({
        id: item.id,
        title: item.title,
        kind: "receipt",
        status: item.status as WorkbenchArtifactRef["status"],
        previewKind: "code",
        ref: item.ref!,
        summary: item.summary,
        provenance: [
          asString(task.runtime_readback_source),
          asString(task.workspace_path),
          asString(reviewReceipt?.check_ref)
        ].filter((value): value is string => Boolean(value)),
        actions: ["Preview receipt", "Compare refs"]
      }));
  });
  const receipts = taskReceipts.length ? uniqueByRef(taskReceipts).slice(0, 6) : fallback.receipts;

  const previewCandidates = uniqueByRef([
    ...deliverables.map((item) => ({ id: item.id, ref: item.ref, label: item.title, summary: item.summary, previewKind: item.previewKind })),
    ...receipts.map((item) => ({ id: item.id, ref: item.ref, label: item.title, summary: item.summary, previewKind: item.previewKind })),
    ...contextActions
      .filter((action) => action.dryRunSupported)
      .map((action) => ({
        id: `preview-action-${action.id}`,
        ref: action.route,
        label: action.label,
        summary: `Refs-only preview from ${action.owner ?? "OPL action"}; mutates: ${action.mutates}.`,
        previewKind: inferPreviewKind(action)
      }))
  ]).slice(0, 6);
  const artifactPreviews = previewCandidates.length ? previewCandidates.map((item): ArtifactPreview => ({
    id: item.id,
    label: item.label,
    previewKind: item.previewKind,
    rendererModuleId: rendererModuleIdForPreviewKind(item.previewKind),
    title: item.label,
    ref: item.ref,
    summary: item.summary
  })) : fallback.artifactPreviews;

  const taskReceiptSummaries = taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id);
    const title = asString(task.title);
    const actionReceipt = asRecord(task.action_receipt);
    const artifact = asRecord(task.artifact_or_blocker);
    if (!taskId || !title || !actionReceipt) return [];
    const exportRoute = asString(actionReceipt.export_bundle_route);
    const exportBundleRef = asStringArray(artifact?.export_bundle_refs)[0];
    return [
      {
        id: `action-receipt-${taskId}`,
        title: `${title} receipt preview`,
        actionId: asString(actionReceipt.action_id) ?? "task_action_receipt_preview",
        route: ensureDryRunJsonRoute(asString(actionReceipt.route) ?? "opl app action execute --action task_action_receipt_preview"),
        status: "payload_required" as const,
        mutates: "none_read_only",
        receiptRef: asString(actionReceipt.preview_ref) ?? `receipt://${taskId}/preview`,
        summary: compactText(task.next_visible_step, "Task preview receipt derived from operator workbench.")
      },
      ...(exportRoute && exportBundleRef ? [{
        id: `action-export-${taskId}`,
        title: `${title} export bundle preview`,
        actionId: asString(actionReceipt.export_bundle_action_id) ?? "task_export_bundle_preview",
        route: ensureDryRunJsonRoute(exportRoute),
        status: "payload_required" as const,
        mutates: "none_read_only",
        receiptRef: exportBundleRef,
        summary: compactText(artifact?.content_policy, "Export bundle preview uses refs only.")
      }] : [])
    ];
  });
  const genericReceiptSummaries = contextActions
    .filter((action) => action.dryRunSupported)
    .map((action): ActionReceiptSummary => ({
      id: `action-generic-${action.id}`,
      title: `${action.label} receipt preview`,
      actionId: action.id,
      route: ensureDryRunJsonRoute(action.route),
      status: actionStatus(action),
      mutates: action.mutates,
      receiptRef: `receipt://${action.id}/dry-run`,
      summary: action.payloadFields.length
        ? `Dry-run route exists; payload required: ${action.payloadFields.join(", ")}.`
        : "Dry-run route can preview a refs-only receipt without a domain artifact body."
    }));
  const actionReceipts = uniqueByRef([...taskReceiptSummaries, ...genericReceiptSummaries]).slice(0, 8);

  const moduleAvailability = new Map<WorkbenchStarter["id"], { status: string; sourceRef: string }>();
  const moduleRecords = new Map<WorkbenchStarter["id"], Record<string, unknown>>();
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
    moduleRecords.set(key, item);
  }

  const starterTasks = new Map<WorkbenchStarter["id"], Record<string, unknown>>();
  for (const task of taskDrilldowns) {
    const key = pickTaskKey(task);
    if (!key) continue;
    const current = starterTasks.get(key);
    const taskId = asString(task.task_id);
    const domainId = asString(task.domain_id);
    if (!current || (taskId && domainId && taskId === domainId)) {
      starterTasks.set(key, task);
    }
  }

  const starters = fallback.starters.map((starter): WorkbenchStarter => {
    const availability = moduleAvailability.get(starter.id);
    const moduleRecord = moduleRecords.get(starter.id) ?? null;
    const task = starterTasks.get(starter.id) ?? null;
    const taskAction = actionMap.get(asString(asRecord(task?.action_receipt)?.action_id) ?? "");
    const exportAction = actionMap.get(
      asString(asRecord(task?.action_receipt)?.export_bundle_action_id)
      ?? extractActionId(asRecord(task?.artifact_or_blocker)?.export_bundle_action_ref)
      ?? ""
    );
    const starterAction = taskAction ?? exportAction ?? starterPreviewAction(starter, contextActions);
    const routeStatus = starterAction
      ? `${actionStatus(starterAction)}_preview_route_not_domain_execution`
      : "unavailable_no_live_app_action_ref";
    const taskArtifact = asRecord(task?.artifact_or_blocker);
    const taskActionReceipt = asRecord(task?.action_receipt);
    const starterTitle = asString(task?.title)
      ? `${starter.title.split("/")[0]?.trim() ?? starter.title} / ${asString(task?.title)}`
      : starter.title;
    return {
      ...starter,
      title: starterTitle,
      module: asString(moduleRecord?.label) ?? starter.module,
      intent: compactText(task?.next_visible_step, asString(moduleRecord?.description) ?? starter.intent),
      fields: buildStarterFields(starter, starterAction, task, moduleRecord),
      available: Boolean(starterAction?.dryRunSupported),
      status: `${asString(task?.status) ?? asString(task?.state) ?? availability?.status ?? "module_unknown"}:${routeStatus}`,
      sourceRef: asString(taskActionReceipt?.preview_ref)
        ?? asString(taskArtifact?.current_ref)
        ?? starterAction?.route
        ?? availability?.sourceRef
        ?? starter.sourceRef,
      previewActionId: starterAction?.id,
      dryRunAction: starterAction?.id ?? starter.dryRunAction
    };
  });

  const runtimeStatus = asString(asRecord(operator?.summary)?.runtime_status)
    ?? asString(asRecord(operator?.summary)?.provider_status)
    ?? asString(currentOwnerDeltaNextAction?.action_kind)
    ?? asString(asRecord(appState.provider)?.status)
    ?? "unknown";

  const effectiveContextSources = contextSources.length ? contextSources : fallback.contextSources;
  const sourceRefs = effectiveContextSources.map((source) => source.ref);
  const previewAction = firstPreviewAction(contextActions);
  const deliveryPackages: DeliveryPackage[] = (deliverables.length || receipts.length || contextActions.length) ? [
    {
      id: "delivery-package",
      title: "Delivery package",
      status: deliverables.length || receipts.length ? "needs_review" : "blocked",
      summary: "Derived from live App action refs, operator task drilldowns, receipt refs, and runtime status; artifact bodies stay source-owned.",
      previewActionId: previewAction?.id ?? fallback.deliveryPackages[0]?.previewActionId ?? "task_export_bundle_preview",
      deliverableRefs: deliverables.map((item) => item.ref),
      receiptRefs: receipts.map((item) => item.ref),
      sourceRefs,
      runtimeStatus,
      authorityBoundary: "Refs-only delivery context; no artifact body, owner receipt, domain truth, or release authority."
    }
  ] : fallback.deliveryPackages;

  const leadTask = taskDrilldowns[0];
  const leadTaskTitle = asString(leadTask?.title) ?? "current task";
  const leadTaskNextStep = compactText(leadTask?.next_visible_step, "Review current App refs before execution.");
  const confirmations = fallback.confirmations.map((card, index): ConfirmationCard => index === 0 && previewAction ? {
    ...card,
    title: `Preview ${leadTaskTitle} package`,
    question: `Preview ${previewAction.label} for ${leadTaskTitle} as a refs-only delivery package?`,
    risks: [`Runtime status: ${runtimeStatus}`, leadTaskNextStep, "Preview receipt is not owner acceptance"],
    willChange: [`Create dry-run request for ${previewAction.id}`, "Attach current App state refs"],
    receipt: ensureDryRunJsonRoute(previewAction.route),
    dryRunAction: previewAction.id
  } : card);

  const questions = [
    {
      id: "question-owner-shape",
      question: compactText(currentOwnerDelta?.desired_delta_description, leadTaskNextStep),
      whyItMatters: compactText(currentOwnerDeltaNextAction?.action_kind, "Current owner delta defines the next legal answer shape."),
      answerType: asStringArray(currentOwnerDelta?.accepted_answer_shape).join(", ") || "typed owner answer"
    },
    {
      id: "question-review-receipt",
      question: `Which receipt ref should stay attached to ${leadTaskTitle}?`,
      whyItMatters: "Review receipts stay refs-only and do not transfer domain authority.",
      answerType: "receipt ref"
    },
    {
      id: "question-package-export",
      question: "Which export bundle ref should be previewed next?",
      whyItMatters: "Export bundle previews remain App-owned dry-run refs, not artifact bodies.",
      answerType: "export bundle ref"
    }
  ];

  const contextTrace = [
    { id: "profile", label: "Profile", value: asString(meta?.profile) ?? "" },
    { id: "generated", label: "Generated", value: asString(meta?.generated_at) ?? "" },
    { id: "owner", label: "Owner", value: asString(runtimeSource?.owner) ?? "" },
    { id: "app-owner", label: "App truth owner", value: asString(runtimeSource?.app_repo_truth_owner) ?? "" },
    { id: "provider", label: "Provider status", value: asString(asRecord(operator?.summary)?.provider_status) ?? "" },
    { id: "runtime", label: "Runtime status", value: asString(asRecord(operator?.summary)?.runtime_status) ?? "" },
    { id: "current-owner", label: "Current owner", value: asString(currentOwnerDelta?.owner) ?? asString(workbench?.operator_next_action_owner) ?? "" },
    { id: "next-action", label: "Next action kind", value: asString(currentOwnerDeltaNextAction?.action_kind) ?? asString(workbench?.operator_next_action_kind) ?? "" },
    { id: "hard-gate", label: "Hard gate", value: asString(asRecord(currentOwnerDelta?.hard_gate)?.state) ?? "" }
  ].filter((item) => item.value);

  const sessions = taskDrilldowns.length
    ? taskDrilldowns.slice(0, 3).map((task): WorkspaceSession => ({
        id: asString(task.task_id) ?? `session-${Math.random()}`,
        workspace: asString(task.workspace_path) ?? asString(task.domain_label) ?? "Current project",
        session: asString(task.title) ?? asString(task.task_id) ?? "Delivery review",
        status: asString(task.status) ?? asString(task.state) ?? "candidate_surface_only",
        nextStep: compactText(task.next_visible_step, "Review current refs")
      }))
    : fallback.sessions;

  const derivedActiveProjectLines = taskDrilldowns.length ? taskDrilldowns.slice(0, 6).map((task): ActiveProjectLine => ({
    status: asString(task.status) ?? asString(task.state) ?? "unknown",
    activeRunId: asString(task.active_run_id),
    nextVisibleStep: compactText(task.next_visible_step, "Review current refs"),
    progressDeltaClassification: asString(task.priority_bucket) ?? asString(asRecord(task.progress)?.status) ?? "platform_or_observability_delta",
    deliverableProgressDelta: asString(asRecord(task.artifact_or_blocker)?.content_policy) ?? "refs_only_no_artifact_body",
    platformRepairDelta: asString(task.runtime_attempt_status) ?? "none",
    nextForcedDelta: asString(asRecord(task.review_receipt)?.next_action) ?? asString(currentOwnerDeltaNextAction?.action_kind) ?? "owner adoption gate"
  })) : pickActiveProjectLines(appState.active_project_lines, fallback.activeProjectLines);

  return {
    ...fallback,
    sessions,
    results: buildResultsFromTasks(taskDrilldowns),
    deliverables,
    receipts,
    artifactPreviews,
    deliveryPackages,
    actionReceipts,
    starters,
    confirmations,
    questions,
    activeProjectLines: derivedActiveProjectLines,
    contextSources: effectiveContextSources,
    contextActions: contextActions.length ? contextActions : fallback.contextActions,
    contextTrace: contextTrace.length ? contextTrace : fallback.contextTrace,
    stateGeneratedAt: asString(meta?.generated_at) ?? fallback.stateGeneratedAt
  };
}
