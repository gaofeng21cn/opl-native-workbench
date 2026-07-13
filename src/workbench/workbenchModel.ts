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

export type WorkbenchThreadMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  coordination?: {
    direction: "source" | "target";
    state: string;
    summary: string;
    result?: string;
  };
};

export type WorkbenchThreadItem = {
  id: string;
  sessionId?: string;
  projectKey?: string;
  hostId?: string;
  title: string;
  projectId?: string;
  projectLabel?: string;
  workspace?: string;
  currentWorkspace: boolean;
  goal?: string;
  parentThreadId?: string;
  ancestorThreadIds: string[];
  activeTurnId?: string;
  writeSet: string[];
  status: string;
  preview: string;
  updatedAt?: string;
  archived: boolean;
};

export type WorkbenchProjectGroup = {
  id: string;
  label: string;
  workspace?: string;
  projectless: boolean;
  threads: WorkbenchThreadItem[];
};

export type WorkbenchCoordinationPhase = "proposal" | "confirmation" | "queued" | "conflict" | "result";

export type WorkbenchCoordinationEvent = {
  id: string;
  phase: WorkbenchCoordinationPhase;
  direction: "source" | "target" | "system";
  label: string;
  detail: string;
  sourceThreadId?: string;
  targetThreadId?: string;
  occurredAt?: string;
};

export type WorkbenchCoordinationOperation = {
  id?: string;
  phase: WorkbenchCoordinationPhase;
  sourceThreadId?: string;
  targetThreadId?: string;
  summary: string;
  requiresConfirmation: boolean;
  plannedDispatch?: "started" | "steered" | "queued";
  safetyState?: string;
  guardCode?: string;
  queuePosition?: number;
  conflict?: string;
  result?: string;
};

export type ArtifactPreview = {
  id: string;
  label: string;
  previewKind: WorkbenchPreviewKind;
  rendererModuleId: string;
  title: string;
  ref: string;
  summary: string;
  content?: string;
  fields?: { label: string; value: string }[];
  bullets?: string[];
  sourceRefs?: string[];
  traceSteps?: string[];
  authorityBoundary?: string;
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
  dryRunAction?: string;
  available?: boolean;
  status?: "preview" | "payload_required" | "unavailable";
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
  dryRunAction?: string;
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
  previewActionId?: string;
  deliverableRefs: string[];
  receiptRefs: string[];
  sourceRefs: string[];
  runtimeStatus: string;
  authorityBoundary: string;
};

export type ActionReceiptSummary = {
  id: string;
  title: string;
  actionId?: string;
  route?: string;
  status: "preview" | "payload_required" | "unavailable";
  mutates: string;
  receiptRef: string;
  summary: string;
  payloadFields: string[];
  owner?: string;
  authorityBoundary: string;
  sourceRefs: string[];
  checks: string[];
};

export type PackageLifecycleActionKind = "discover" | "install" | "update" | "repair" | "uninstall" | "exposure";

export type PackageLifecycleActionRef = {
  kind: PackageLifecycleActionKind;
  label: string;
  status: "available" | "unavailable";
  actionId?: string;
  route?: string;
  payloadFields: string[];
  dryRunSupported: boolean;
  owner?: string;
  delegatedSurface?: string;
  sourceRef: string;
  reason: string;
};

export type PackageLifecycleDisplayRef = {
  label: string;
  ref: string;
  summary: string;
};

export type PackageLifecycleStatusAxis = {
  label: string;
  value: string;
  source: "canonical_agent_packages" | "legacy_modules_fallback" | "missing_bridge";
};

export type PackageLifecycleSearchMetadata = {
  query: string;
  tags: string[];
  filters: PackageLifecycleDisplayRef[];
};

export type PackageLifecycleDetailRef = {
  label: string;
  value: string;
  source: PackageLifecycleStatusAxis["source"];
  ref?: string;
  summary: string;
};

export type AgentPackageLifecycleRef = {
  id: string;
  packageId: string;
  label: string;
  status: string;
  summary: string;
  sourceRef: string;
  sourceExplanation: string;
  searchMetadata: PackageLifecycleSearchMetadata;
  refs: PackageLifecycleDisplayRef[];
  details: PackageLifecycleDetailRef[];
  statusAxes: PackageLifecycleStatusAxis[];
  actions: PackageLifecycleActionRef[];
  authorityBoundary: string;
};

export type WorkbenchGatewayAccount = {
  displayName: string;
  status: string;
  sourceRef: string;
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
  packageLifecycle: AgentPackageLifecycleRef[];
  starters: WorkbenchStarter[];
  confirmations: ConfirmationCard[];
  questions: InterviewQuestion[];
  activeProjectLines: ActiveProjectLine[];
  contextSources: WorkbenchSourceRef[];
  contextActions: WorkbenchActionRef[];
  contextTrace: WorkbenchTraceRef[];
  gatewayAccount?: WorkbenchGatewayAccount;
  stateGeneratedAt?: string;
};

export const workbenchBridgeUnavailableDiagnostic = {
  status: "candidate_surface_only",
  nextStep: "Consume opl app state/action refs"
} as const;

export const initialWorkbenchModel: WorkbenchModel = {
  purposes: ["research", "grant", "presentation", "review"],
  sessions: [],
  results: [],
  deliverables: [],
  receipts: [],
  artifactPreviews: [],
  deliveryPackages: [],
  actionReceipts: [],
  packageLifecycle: [
    {
      id: "package-lifecycle-missing-bridge",
      packageId: "missing_bridge",
      label: "Agent package lifecycle",
      status: "missing_bridge",
      summary: "No canonical App package lifecycle projection is available; fallback stays preview-only and unavailable.",
      sourceRef: "opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index",
      sourceExplanation: "missing App/root package bridge; no package lifecycle truth or executable action is inferred.",
      searchMetadata: {
        query: "missing_bridge agent package lifecycle missing_codex_surface required_skill:not_reported",
        tags: ["missing_bridge", "missing_codex_surface", "required_skill:not_reported"],
        filters: [
          { label: "Source", ref: "missing_bridge", summary: "No canonical agent_packages projection is available." },
          { label: "Codex surface", ref: "missing_codex_surface", summary: "No Codex/App exposure surface ref is available." },
          { label: "Required skill", ref: "required_skill:not_reported", summary: "No required skill ref is available." }
        ]
      },
      refs: [
        {
          label: "Canonical projection",
          ref: "opl app state --profile fast --json#app_state.agent_packages",
          summary: "Preferred App/root package lifecycle source."
        }
      ],
      details: [
        { label: "Status", value: "missing_bridge", source: "missing_bridge", summary: "No canonical package projection is available." },
        { label: "Conditions", value: "missing App/root bridge", source: "missing_bridge", summary: "Fallback mode cannot infer package truth." },
        { label: "Recommended action", value: "open App state/action refs", source: "missing_bridge", summary: "Bind canonical app_state.agent_packages before showing executable lifecycle actions." },
        { label: "Physical surface", value: "not_reported", source: "missing_bridge", summary: "No physical surface ref is available." },
        { label: "Required skill", value: "not_reported", source: "missing_bridge", summary: "No required skill ref is available." },
        { label: "Codex surface", value: "missing_codex_surface", source: "missing_bridge", summary: "No Codex/App exposure surface ref is available." }
      ],
      statusAxes: [
        { label: "Install", value: "missing_bridge", source: "missing_bridge" },
        { label: "Update", value: "missing_bridge", source: "missing_bridge" },
        { label: "Source", value: "missing_bridge", source: "missing_bridge" },
        { label: "Trust", value: "missing_bridge", source: "missing_bridge" },
        { label: "Codex surface", value: "missing_bridge", source: "missing_bridge" }
      ],
      actions: [
        { kind: "discover", label: "Discover", status: "unavailable", payloadFields: [], dryRunSupported: false, sourceRef: "missing_bridge", reason: "Missing App action bridge." },
        { kind: "install", label: "Install", status: "unavailable", payloadFields: [], dryRunSupported: false, sourceRef: "missing_bridge", reason: "Missing App action bridge." },
        { kind: "update", label: "Update", status: "unavailable", payloadFields: [], dryRunSupported: false, sourceRef: "missing_bridge", reason: "Missing App action bridge." },
        { kind: "repair", label: "Repair", status: "unavailable", payloadFields: [], dryRunSupported: false, sourceRef: "missing_bridge", reason: "Missing App action bridge." },
        { kind: "uninstall", label: "Uninstall", status: "unavailable", payloadFields: [], dryRunSupported: false, sourceRef: "missing_bridge", reason: "Missing App action bridge." },
        { kind: "exposure", label: "Exposure", status: "unavailable", payloadFields: [], dryRunSupported: false, sourceRef: "missing_bridge", reason: "Missing App action bridge." }
      ],
      authorityBoundary: "Native Workbench displays App/root package refs only; it cannot infer installed, ready, synced, or release state."
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
        { name: "study", label: "Study", input: "text", value: "" },
        { name: "question", label: "Scientific question", input: "textarea", value: "" },
        { name: "output", label: "Output", input: "select", value: "decision_packet", options: ["decision_packet", "figure_refs", "review_response"] }
      ],
      available: false,
      status: "unavailable",
      sourceRef: "unavailable:no live App state action ref"
    },
    {
      id: "mag",
      purpose: "grant",
      title: "Grant / MAG",
      requiredSkill: "mag",
      module: "MedAutoGrant",
      intent: "Shape a grant-authoring preview request without grant authority.",
      fields: [
        { name: "mechanism", label: "Mechanism", input: "text", value: "" },
        { name: "aim", label: "Aim", input: "textarea", value: "" },
        { name: "stage", label: "Stage", input: "select", value: "outline", options: ["outline", "significance", "approach"] }
      ],
      available: false,
      status: "unavailable",
      sourceRef: "unavailable:no live App state action ref"
    },
    {
      id: "rca",
      purpose: "presentation",
      title: "Presentation / RCA",
      requiredSkill: "rca",
      module: "RedCube AI",
      intent: "Prepare a visual-deliverable preview request from refs.",
      fields: [
        { name: "scene", label: "Scene", input: "text", value: "" },
        { name: "assets", label: "Assets", input: "textarea", value: "" },
        { name: "format", label: "Format", input: "select", value: "slide_panel", options: ["slide_panel", "poster_panel", "figure_panel"] }
      ],
      available: false,
      status: "unavailable",
      sourceRef: "unavailable:no live App state action ref"
    },
    {
      id: "bookforge",
      purpose: "book",
      title: "Book / BookForge",
      requiredSkill: "opl-bookforge",
      module: "OPL BookForge",
      intent: "Start a manuscript-structure preview request.",
      fields: [
        { name: "book", label: "Book", input: "text", value: "" },
        { name: "chapter", label: "Chapter brief", input: "textarea", value: "" },
        { name: "mode", label: "Mode", input: "select", value: "outline", options: ["outline", "section_draft", "revision_map"] }
      ],
      available: false,
      status: "unavailable",
      sourceRef: "unavailable:no live App state action ref"
    }
  ],
  confirmations: [],
  questions: [],
  activeProjectLines: [],
  contextSources: [],
  contextActions: [],
  contextTrace: []
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

function firstString(record: Record<string, unknown> | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record?.[key]);
    if (value) return value;
  }
  return null;
}

function firstBoolean(record: Record<string, unknown> | null, keys: string[]): boolean {
  return keys.some((key) => asBoolean(record?.[key]));
}

function nestedRecord(record: Record<string, unknown> | null, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = asRecord(record?.[key]);
    if (value) return value;
  }
  return null;
}

function payloadRecord(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  return nestedRecord(record, ["result", "data", "payload", "response"]) ?? record;
}

function listRecords(value: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(value)) return asRecordArray(value);
  const payload = payloadRecord(value);
  for (const key of keys) {
    const items = asRecordArray(payload?.[key]);
    if (items.length || Array.isArray(payload?.[key])) return items;
  }
  return [];
}

function timestampString(value: unknown): string | undefined {
  const text = asString(value);
  if (text) return text;
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }
  return undefined;
}

function pathLabel(value: string): string {
  const normalized = value.replace(/\/$/, "");
  return normalized.split("/").filter(Boolean).at(-1) ?? value;
}

function threadFromRecord(
  record: Record<string, unknown>,
  inheritedProject?: Record<string, unknown>
): WorkbenchThreadItem | null {
  const id = firstString(record, ["id", "threadId", "thread_id", "threadID"]);
  if (!id) return null;
  const project = nestedRecord(record, ["project", "projectRef", "project_ref"]) ?? inheritedProject ?? null;
  const projectId = firstString(record, ["projectId", "project_id"])
    ?? firstString(project, ["id", "projectId", "project_id"])
    ?? undefined;
  const projectLabel = firstString(record, ["projectLabel", "project_label", "projectName", "project_name"])
    ?? firstString(project, ["label", "name", "title"])
    ?? undefined;
  const workspace = firstString(record, ["workspace", "workspaceRoot", "workspace_root", "cwd", "path"])
    ?? firstString(project, ["workspace", "workspaceRoot", "workspace_root", "cwd", "path"])
    ?? undefined;
  return {
    id,
    sessionId: firstString(record, ["sessionId", "session_id"]) ?? undefined,
    projectKey: firstString(record, ["projectKey", "project_key"]) ?? undefined,
    hostId: firstString(record, ["hostId", "host_id"]) ?? undefined,
    title: firstString(record, ["title", "name", "displayName", "display_name", "summary", "preview", "subject"])
      ?? `Thread ${id.slice(0, 8)}`,
    projectId,
    projectLabel,
    workspace,
    currentWorkspace: firstBoolean(record, ["currentWorkspace", "current_workspace"]),
    goal: firstString(record, ["goal", "objective", "summary"]) ?? undefined,
    parentThreadId: firstString(record, ["parentThreadId", "parent_thread_id", "parentId", "parent_id"]) ?? undefined,
    ancestorThreadIds: asStringArray(record.ancestorThreadIds ?? record.ancestor_thread_ids ?? record.ancestors),
    activeTurnId: firstString(record, ["activeTurnId", "active_turn_id"])
      ?? firstString(nestedRecord(record, ["activeTurn", "active_turn"]), ["id", "turnId", "turn_id"])
      ?? undefined,
    writeSet: asStringArray(record.writeSet ?? record.write_set ?? record.expectedWriteSet ?? record.expected_write_set),
    status: firstString(record, ["status", "state", "phase"]) ?? "unknown",
    preview: firstString(record, ["preview", "summary", "lastMessage", "last_message", "snippet"]) ?? "",
    updatedAt: timestampString(record.updatedAt ?? record.updated_at ?? record.modifiedAt ?? record.modified_at),
    archived: firstBoolean(record, ["archived", "isArchived", "is_archived"])
  };
}

export function deriveThreadDirectory(value: unknown): WorkbenchProjectGroup[] {
  const payload = payloadRecord(value);
  const projectRows = asRecordArray(payload?.projects ?? payload?.workspaces);
  const inheritedThreads = projectRows.flatMap((project) => {
    const rows = asRecordArray(project.threads ?? project.items);
    return rows.map((thread) => threadFromRecord(thread, project));
  });
  const directThreads = listRecords(value, ["data", "threads", "items", "entries"])
    .map((thread) => threadFromRecord(thread));
  const threads = [...inheritedThreads, ...directThreads]
    .filter((thread): thread is WorkbenchThreadItem => Boolean(thread));
  const uniqueThreads = Array.from(new Map(threads.map((thread) => [thread.id, thread])).values());
  const groups = new Map<string, WorkbenchProjectGroup>();

  for (const thread of uniqueThreads) {
    const hasProject = Boolean(thread.projectKey || thread.projectId || thread.projectLabel);
    const projectKey = thread.projectKey
      ? `project:${thread.projectKey}`
      : thread.projectId
      ? `project:${thread.projectId}`
      : thread.projectLabel
        ? `project-label:${thread.projectLabel}`
        : `projectless:${thread.workspace ?? "none"}`;
    const projectless = !hasProject;
    const group = groups.get(projectKey) ?? {
      id: projectKey,
      label: projectless
        ? thread.workspace ? `No project / ${pathLabel(thread.workspace)}` : "No project"
        : thread.projectLabel ?? thread.projectKey ?? (thread.workspace ? pathLabel(thread.workspace) : thread.projectId ?? "Project"),
      workspace: thread.workspace,
      projectless,
      threads: []
    };
    group.threads.push(thread);
    groups.set(projectKey, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      threads: group.threads.sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
    }))
    .sort((left, right) => Number(left.projectless) - Number(right.projectless) || left.label.localeCompare(right.label));
}

function textFromContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textFromContent).filter(Boolean).join("\n");
  const record = asRecord(value);
  if (!record) return "";
  return firstString(record, ["text", "content", "message", "delta", "output_text"])
    ?? textFromContent(record.parts ?? record.items ?? record.content)
    ?? "";
}

function messageFromRecord(record: Record<string, unknown>, index: number): WorkbenchThreadMessage | null {
  const type = firstString(record, ["type", "kind", "event"])?.toLowerCase() ?? "";
  const explicitRole = firstString(record, ["role", "author"]);
  const role = explicitRole === "user" || /user.?message|input.?message/.test(type)
    ? "user"
    : explicitRole === "assistant" || /agent.?message|assistant.?message|output.?message/.test(type)
      ? "assistant"
      : explicitRole === "system"
        ? "system"
        : null;
  if (!role) return null;
  const text = firstString(record, ["text", "message", "output_text"])
    ?? textFromContent(record.content ?? record.parts ?? record.items);
  if (!text.trim()) return null;
  return {
    id: firstString(record, ["id", "itemId", "item_id", "messageId", "message_id"]) ?? `thread-message-${index}`,
    role,
    text
  };
}

function coordinationMessageFromRecord(record: Record<string, unknown>, index: number): WorkbenchThreadMessage | null {
  const direction = firstString(record, ["direction"]);
  if (direction !== "source" && direction !== "target") return null;
  const state = firstString(record, ["state", "status"]) ?? "unknown";
  const summary = firstString(record, ["summary", "messageSummary", "message_summary"]) ?? "Coordination receipt";
  const result = firstString(record, ["resultSummaryOrRef", "result_summary_or_ref", "result"]);
  return {
    id: firstString(record, ["id", "coordinationId", "coordination_id"]) ?? `coordination-message-${index}`,
    role: "system",
    text: summary,
    coordination: { direction, state, summary, ...(result ? { result } : {}) }
  };
}

export function deriveThreadMessages(value: unknown): WorkbenchThreadMessage[] {
  const payload = payloadRecord(value);
  const thread = nestedRecord(payload, ["thread"]);
  const direct = [payload, thread]
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .flatMap((record) => asRecordArray(record.messages ?? record.items));
  const turns = [payload, thread]
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .flatMap((record) => asRecordArray(record.turns));
  const turnItems = turns.flatMap((turn) => asRecordArray(turn.items ?? turn.messages));
  const coordinationItems = [payload, thread]
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .flatMap((record) => asRecordArray(record.coordinationEvents ?? record.coordination_events));
  return [...direct, ...turnItems]
    .map(messageFromRecord)
    .filter((message): message is WorkbenchThreadMessage => Boolean(message))
    .concat(coordinationItems.map(coordinationMessageFromRecord).filter((message): message is WorkbenchThreadMessage => Boolean(message)));
}

function coordinationPhase(record: Record<string, unknown> | null): WorkbenchCoordinationPhase {
  const state = firstString(record, ["phase", "status", "state", "type", "kind"])?.toLowerCase() ?? "";
  if (firstString(record, ["conflict", "conflictReason", "conflict_reason"]) || /conflict|blocked|rejected/.test(state)) return "conflict";
  if (record?.result !== undefined || record?.output !== undefined || /result|complete|completed|succeeded|failed|cancelled/.test(state)) return "result";
  if (record?.queuePosition !== undefined || record?.queue_position !== undefined || /queue|pending|waiting|running|started|steered/.test(state)) return "queued";
  if (firstBoolean(record, ["requiresConfirmation", "requires_confirmation", "confirmationRequired", "confirmation_required"]) || /confirm|approval/.test(state)) return "confirmation";
  return "proposal";
}

export function deriveCoordinationOperation(
  value: unknown,
  fallback: Partial<WorkbenchCoordinationOperation> = {}
): WorkbenchCoordinationOperation {
  const record = payloadRecord(value);
  const queueValue = record?.queuePosition ?? record?.queue_position;
  const queueText = asString(queueValue);
  const queuePosition = typeof queueValue === "number" ? queueValue : queueText === null ? Number.NaN : Number(queueText);
  const conflict = firstString(record, ["conflict", "conflictReason", "conflict_reason", "error"])
    ?? firstString(nestedRecord(record, ["guard", "safety"]), ["message", "reason", "summary"])
    ?? firstString(nestedRecord(record, ["conflict_detail", "conflictDetail"]), ["summary", "message", "reason"])
    ?? fallback.conflict;
  const result = firstString(record, ["result", "output", "resultSummary", "result_summary", "resultSummaryOrRef"])
    ?? firstString(nestedRecord(record, ["result", "output"]), ["summary", "message", "text"])
    ?? fallback.result;
  return {
    id: firstString(record, ["coordinationId", "coordination_id", "previewToken", "preview_token", "proposalId", "proposal_id", "id"]) ?? fallback.id,
    phase: coordinationPhase(record) ?? fallback.phase ?? "proposal",
    sourceThreadId: firstString(record, ["sourceThreadId", "source_thread_id", "sourceId", "source_id"]) ?? fallback.sourceThreadId,
    targetThreadId: firstString(record, ["targetThreadId", "target_thread_id", "targetId", "target_id"]) ?? fallback.targetThreadId,
    summary: firstString(record, ["summary", "message", "description", "prompt", "intent"])
      ?? fallback.summary
      ?? "Coordination proposal prepared.",
    requiresConfirmation: firstBoolean(record, ["requiresConfirmation", "requires_confirmation", "confirmationRequired", "confirmation_required"])
      || coordinationPhase(record) === "confirmation",
    plannedDispatch: (() => {
      const dispatch = firstString(record, ["plannedDispatch", "planned_dispatch", "dispatchKind", "dispatch_kind", "state"]);
      return dispatch === "started" || dispatch === "steered" || dispatch === "queued" ? dispatch : fallback.plannedDispatch;
    })(),
    safetyState: firstString(record, ["safetyState", "safety_state", "state"]) ?? fallback.safetyState,
    guardCode: firstString(nestedRecord(record, ["guard", "safety"]), ["code", "state", "type"])
      ?? firstString(record, ["guardCode", "guard_code"])
      ?? fallback.guardCode,
    queuePosition: Number.isFinite(queuePosition) ? queuePosition : fallback.queuePosition,
    conflict,
    result
  };
}

export function deriveCoordinationEvents(value: unknown): WorkbenchCoordinationEvent[] {
  return listRecords(value, ["events", "items", "entries"]).map((record, index) => {
    const projected = { ...record, ...(asRecord(record.raw) ?? {}) };
    const sourceThreadId = firstString(projected, ["sourceThreadId", "source_thread_id", "sourceId", "source_id"]) ?? undefined;
    const targetThreadId = firstString(projected, ["targetThreadId", "target_thread_id", "targetId", "target_id"]) ?? undefined;
    const directionValue = firstString(projected, ["direction", "side", "role"])?.toLowerCase() ?? "";
    const direction = /source|sender|origin/.test(directionValue)
      ? "source"
      : /target|receiver|destination/.test(directionValue)
        ? "target"
        : "system";
    const coordinationId = firstString(projected, ["coordinationId", "coordination_id", "previewToken", "preview_token"]);
    const method = firstString(record, ["method", "type", "kind"]);
    const state = firstString(projected, ["state", "status", "phase"]);
    const derivedId = [coordinationId, method, state, direction].filter(Boolean).join(":");
    return {
      id: firstString(projected, ["id", "eventId", "event_id"])
        ?? (derivedId || `coordination-event-${index}`),
      phase: coordinationPhase(projected),
      direction,
      label: firstString(projected, ["label", "title", "type", "kind", "status", "state"]) ?? method ?? "Coordination event",
      detail: firstString(projected, ["detail", "summary", "message", "description", "result", "error"]) ?? "",
      sourceThreadId,
      targetThreadId,
      occurredAt: timestampString(projected.occurredAt ?? projected.occurred_at ?? projected.createdAt ?? projected.created_at)
    } satisfies WorkbenchCoordinationEvent;
  });
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
  return action.payloadFields.length ? "payload_required" : "preview";
}

const starterPreviewRouteIds: Record<WorkbenchStarter["id"], string[]> = {
  // Source-marker contract: live starter actions are preview_route_not_domain_execution.
  mas: ["task_action_receipt_preview", "task_export_bundle_preview", "settings_sync_capabilities"],
  mag: ["task_export_bundle_preview", "task_action_receipt_preview", "settings_sync_capabilities"],
  rca: ["task_export_bundle_preview", "task_action_receipt_preview", "settings_sync_capabilities"],
  bookforge: ["workspace_ensure", "task_export_bundle_preview", "settings_sync_capabilities"]
};

const packageLifecycleActionIds: Record<PackageLifecycleActionKind, string[]> = {
  discover: ["refresh_registry"],
  install: ["install_from_manifest_url"],
  update: ["agent_package_update"],
  repair: ["agent_package_repair"],
  uninstall: ["agent_package_uninstall"],
  exposure: ["agent_package_preferences_set"]
};

const packageLifecycleActionAliases: Record<PackageLifecycleActionKind, string[]> = {
  discover: ["discover", "refresh", "registry"],
  install: ["install"],
  update: ["update", "apply"],
  repair: ["repair", "reinstall"],
  uninstall: ["uninstall", "remove"],
  exposure: ["exposure", "home_shortcut", "preferences", "hide", "unhide", "enable", "disable"]
};

const packageLifecycleActionLabels: Record<PackageLifecycleActionKind, string> = {
  discover: "Discover",
  install: "Install",
  update: "Update",
  repair: "Repair",
  uninstall: "Uninstall",
  exposure: "Exposure"
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
  const valueRecord = asRecord(value);
  const rawLines: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(valueRecord?.items)
      ? valueRecord.items
      : [];
  const lines = rawLines.map(asRecord).filter(Boolean).map((line): ActiveProjectLine => ({
    status: asString(line?.status) ?? "unknown",
    activeRunId: asString(line?.active_run_id) ?? asString(line?.activeRunId) ?? "",
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

function compactRef(value: string, max = 56): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function previewField(label: string, value: unknown): { label: string; value: string } | null {
  const text = asString(value);
  return text ? { label, value: text } : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function formatTimestamp(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  return text.replace("T", " ").replace(".000Z", "Z");
}

function usageSummary(usage: Record<string, unknown> | null): string | null {
  if (!usage) return null;
  const telemetry = asString(usage.telemetry_status) ?? "unknown";
  const calls = usage.api_call_count_observed ?? usage.observed_attempt_count;
  const duration = usage.duration_ms_observed;
  const sourceRefs = usage.source_ref_count;
  const parts = [
    `telemetry ${telemetry}`,
    typeof calls === "number" ? `${calls} calls` : null,
    typeof duration === "number" && duration > 0 ? `${duration} ms` : null,
    typeof sourceRefs === "number" ? `${sourceRefs} refs` : null
  ];
  return uniqueStrings(parts).join(" | ");
}

function taskAcceptedShapes(task: Record<string, unknown>, currentOwnerDelta: Record<string, unknown> | null): string[] {
  const stageRun = asRecord(task.stage_run_cockpit_summary) ?? asRecord(task.stage_run_current_owner_delta) ?? asRecord(task.stage_run_cockpit);
  return uniqueStrings([
    ...asStringArray(currentOwnerDelta?.accepted_answer_shape),
    ...asStringArray(stageRun?.accepted_return_shapes),
    ...asStringArray(stageRun?.required_return_shapes)
  ]);
}

function previewAuthorityBoundary(previewKind: WorkbenchPreviewKind, fallback = "Refs-only preview; body remains source-owned."): string {
  if (previewKind === "json") return "Structured receipt envelope only; no receipt body authority.";
  if (previewKind === "code") return "Manifest and patch-style projection only; no executable artifact body authority.";
  if (previewKind === "mermaid") return "Trace projection only; no workflow truth transfer.";
  if (previewKind === "pdf") return "Local export shell only; final file authority remains outside the workbench.";
  return fallback;
}

function artifactPreviewFromItem(item: WorkbenchArtifactRef): ArtifactPreview {
  return {
    id: item.id,
    label: item.kind === "receipt" ? "Receipt" : item.kind === "deliverable" ? "Deliverable" : item.title,
    previewKind: item.previewKind,
    rendererModuleId: rendererModuleIdForPreviewKind(item.previewKind),
    title: item.title,
    ref: item.ref,
    summary: item.summary,
    fields: [
      { label: "Kind", value: item.kind },
      { label: "Status", value: item.status.replaceAll("_", " ") },
      { label: "Primary ref", value: compactRef(item.ref) }
    ],
    bullets: item.actions,
    sourceRefs: uniqueStrings([item.ref, ...item.provenance]),
    authorityBoundary: previewAuthorityBoundary(item.previewKind)
  };
}

function actionPreviewFromAction(action: WorkbenchActionRef): ArtifactPreview {
  const route = ensureDryRunJsonRoute(action.route);
  return {
    id: `preview-action-${action.id}`,
    label: "Action",
    previewKind: inferPreviewKind(action),
    rendererModuleId: rendererModuleIdForPreviewKind(inferPreviewKind(action)),
    title: action.label,
    ref: route,
    summary: `Dry-run route derived from ${action.owner ?? "OPL App"}; mutates ${action.mutates}.`,
    content: JSON.stringify({
      action_id: action.id,
      label: action.label,
      route,
      payload_fields: action.payloadFields,
      mutates: action.mutates,
      delegated_surface: action.delegatedSurface,
      owner: action.owner,
      route_requires_payload: action.routeRequiresPayload ?? false,
      dry_run_supported: action.dryRunSupported
    }, null, 2),
    fields: [
      { label: "Action", value: action.id },
      { label: "Owner", value: action.owner ?? "opl_app" },
      { label: "Mutation", value: action.mutates },
      { label: "Payload", value: action.payloadFields.length ? action.payloadFields.join(", ") : "none" }
    ],
    bullets: [
      action.dryRunSupported
        ? "Dry-run route can be inspected before any confirmed execute."
        : "This route is not safe-action dry-run capable.",
      action.delegatedSurface ? `Delegated surface: ${action.delegatedSurface}` : "No delegated surface readback."
    ],
    sourceRefs: uniqueStrings([route, action.delegatedSurface, action.owner]),
    authorityBoundary: "Action preview only; no domain authority is expanded in the renderer."
  };
}

type ArtifactStatusSource = "derived" | "app_canonical";

const nonReadyBoundaryStatusPattern = /candidate|fallback|placeholder|simulat|preview|dry.?run|refs.?only|non.?live|no.?live|local.?draft/i;
const blockedStatusPattern = /blocked|dirty|error|attention|unavailable|failed|failure|timed.?out|missing/i;
const explicitReadyStatusPattern = /^(ready|succeeded|success|completed|complete)$/i;

function artifactStatus(value: unknown, source: ArtifactStatusSource = "derived"): WorkbenchArtifactRef["status"] {
  const text = (asString(value) ?? "").toLowerCase();
  if (blockedStatusPattern.test(text)) return "blocked";
  if (nonReadyBoundaryStatusPattern.test(text)) return "needs_review";
  if (source === "app_canonical" && explicitReadyStatusPattern.test(text)) return "ready";
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

function firstStringField(record: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = asString(record[field]);
    if (value) return value;
    const values = asStringArray(record[field]);
    if (values[0]) return values[0];
  }
  return null;
}

function packageIdentity(record: Record<string, unknown>, index: number): string {
  return firstStringField(record, ["package_id", "packageId", "agent_id", "module_id", "id"])
    ?? `package-${index}`;
}

function packageLabel(record: Record<string, unknown>): string {
  return firstStringField(record, ["display_name", "displayName", "package_short_name", "label", "name", "module_id"])
    ?? "Agent package";
}

function packageDisplayRef(label: string, ref: string | null, summary: string): PackageLifecycleDisplayRef | null {
  return ref ? { label, ref, summary } : null;
}

function recordValues(value: unknown): Record<string, unknown>[] {
  const record = asRecord(value);
  return record ? Object.values(record).map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
}

function packageFileRef(record: Record<string, unknown>, key: string): string | null {
  return asString(asRecord(record.files)?.[key]);
}

function packageLifecycleReceipts(record: Record<string, unknown>): Record<string, unknown>[] {
  return [
    ...asRecordArray(record.lifecycle_receipts),
    ...asRecordArray(asRecord(record.directory)?.lifecycle_receipts)
  ];
}

function canonicalSummaryRow(agentPackages: Record<string, unknown>): Record<string, unknown> {
  const directory = asRecord(agentPackages.directory);
  const statusIndex = asRecord(agentPackages.status_index);
  const receipts = [
    ...asRecordArray(directory?.lifecycle_receipts),
    ...asRecordArray(agentPackages.lifecycle_receipts)
  ];
  const firstReceipt = receipts[0] ?? {};
  const files = {
    ...(asRecord(directory?.files) ?? {}),
    ...(asRecord(statusIndex?.files) ?? {}),
    ...(asRecord(agentPackages.files) ?? {})
  };
  const installedCount = directory?.installed_package_count ?? statusIndex?.installed_package_count ?? 0;
  return {
    surface_kind: asString(agentPackages.surface_kind) ?? "opl_app_agent_packages_projection",
    package_id: "agent_packages_directory",
    display_name: "Agent package directory",
    lifecycle_status: installedCount ? "canonical_projection_available" : "canonical_projection_available_no_installed_packages",
    install_state: installedCount ? "canonical_rows_available" : "no_installed_package_rows",
    update_state: firstStringField(firstReceipt, ["action_status", "receipt_status"]) ?? "no_package_update_status",
    source_state: "canonical_agent_packages_projection",
    trust_state: firstStringField(firstReceipt, ["trust_tier"]) ?? "not_reported",
    codex_surface_state: installedCount ? "from_agent_packages_projection" : "no_codex_package_surface_rows",
    conditions: [
      `installed_package_count=${installedCount}`,
      `lifecycle_receipt_count=${directory?.lifecycle_receipt_count ?? receipts.length}`,
      "modules.items fallback suppressed because canonical agent_packages projection is present"
    ],
    recommended_action: installedCount ? "inspect package refs from app_state.agent_packages" : "install_from_manifest_url or refresh_registry through App action refs",
    manifest_url: firstStringField(firstReceipt, ["manifest_url"]),
    source_kind: firstStringField(firstReceipt, ["source_kind"]) ?? "canonical_agent_packages",
    package_lock_ref: firstStringField(firstReceipt, ["package_lock_ref"]),
    receipt_ref: firstStringField(firstReceipt, ["receipt_ref"]),
    rollback_ref: firstStringField(firstReceipt, ["rollback_ref"]),
    source_surface: firstStringField(firstReceipt, ["source_surface"]) ?? asString(asRecord(agentPackages.source)?.list_surface),
    files,
    physical_surface: {
      status: installedCount ? "package_rows_reported" : "no_installed_package_physical_surface",
      registry_cache_file: asString(files.registry_cache_file),
      package_lock_file: asString(files.package_lock_file),
      lifecycle_ledger_file: asString(files.lifecycle_ledger_file),
      home_shortcut_preferences_file: asString(files.home_shortcut_preferences_file)
    }
  };
}

function packageRowsFromCanonicalProjection(agentPackages: Record<string, unknown> | null, appState: Record<string, unknown>): Record<string, unknown>[] {
  if (!agentPackages) return [];
  const directory = asRecord(agentPackages.directory);
  const statusIndex = asRecord(agentPackages.status_index);
  const directoryRows = [
    ...asRecordArray(directory?.installed_packages),
    ...asRecordArray(directory?.packages),
    ...asRecordArray(agentPackages.installed_packages),
    ...asRecordArray(agentPackages.packages)
  ];
  const statusRows = [
    ...asRecordArray(statusIndex?.packages),
    ...recordValues(statusIndex?.packages),
    ...asRecordArray(agentPackages.status_packages),
    ...recordValues(agentPackages.status_packages)
  ];
  const homeRows = [
    ...asRecordArray(statusIndex?.home_shortcut_preferences),
    ...asRecordArray(agentPackages.home_shortcut_preferences),
    ...asRecordArray(appState.home_agent_shortcuts)
  ];
  const byId = new Map<string, Record<string, unknown>>();
  const mergeRow = (row: Record<string, unknown>) => {
    const id = packageIdentity(row, byId.size);
    byId.set(id, { ...(byId.get(id) ?? {}), ...row, package_id: id });
  };
  for (const row of directoryRows) mergeRow(row);
  for (const row of statusRows) mergeRow(row);
  for (const row of homeRows) mergeRow(row);
  return Array.from(byId.values());
}

function packageStatusAxes(
  record: Record<string, unknown>,
  source: PackageLifecycleStatusAxis["source"]
): PackageLifecycleStatusAxis[] {
  const sourcePolicy = asRecord(record.source_policy);
  const git = asRecord(record.git);
  return [
    { label: "Install", value: firstStringField(record, ["install_state", "install_status", "lifecycle_status", "status"]) ?? "unknown", source },
    { label: "Update", value: firstStringField(record, ["update_state", "update_status", "recommended_action"]) ?? asString(git?.sync_status) ?? "unknown", source },
    { label: "Source", value: firstStringField(record, ["source_state", "source_kind"]) ?? asString(sourcePolicy?.effective_install_update_source) ?? "unknown", source },
    { label: "Trust", value: firstStringField(record, ["trust_state", "trust_tier", "health_status"]) ?? "unknown", source },
    { label: "Codex surface", value: firstStringField(record, ["codex_surface_state", "codex_visible_entry", "shortcut_id"]) ?? "unknown", source }
  ];
}

function packageConditionText(record: Record<string, unknown>): string {
  return uniqueStrings([
    ...asStringArray(record.conditions),
    ...asStringArray(record.failure_conditions),
    ...asStringArray(record.blocked_conditions),
    ...asStringArray(record.issues),
    ...asStringArray(record.diagnostics),
    asString(record.status_reason),
    asString(record.failure_reason),
    asString(record.reason)
  ]).join(" | ") || "none_reported";
}

function packageRecommendedAction(record: Record<string, unknown>): string {
  const recommendation = asRecord(record.action_recommendation) ?? asRecord(record.recommendation);
  return firstStringField(record, ["recommended_action", "recommendedAction", "next_action", "repair_action"])
    ?? firstStringField(recommendation ?? {}, ["action_id", "summary", "label"])
    ?? "none_reported";
}

function packageSourceKind(record: Record<string, unknown>): string {
  const sourcePolicy = asRecord(record.source_policy);
  const distributionPayload = asRecord(record.distribution_payload);
  return firstStringField(record, ["source_kind", "install_origin", "source_state"])
    ?? asString(sourcePolicy?.effective_install_update_source)
    ?? asString(distributionPayload?.source_kind)
    ?? "unknown";
}

function packageManifestUrl(record: Record<string, unknown>): string | null {
  return firstStringField(record, ["manifest_url", "manifestUrl", "manifest_ref", "package_ref"]);
}

function packageSourceRefValue(record: Record<string, unknown>): string | null {
  const distributionPayload = asRecord(record.distribution_payload);
  const physicalSurface = asRecord(record.physical_surface) ?? asRecord(distributionPayload?.physical_surface);
  return firstStringField(record, [
    "repo_url",
    "registry_url",
    "checkout_path",
    "managed_checkout_path",
    "ghcr_ref",
    "oci_ref",
    "container_ref",
    "image_ref"
  ])
    ?? asString(distributionPayload?.ref)
    ?? asString(physicalSurface?.ref)
    ?? asString(physicalSurface?.path);
}

function packageRequiredSkill(record: Record<string, unknown>): string {
  return firstStringField(record, ["required_skill", "requiredSkill", "skill_id", "skill_ref"])
    ?? asStringArray(record.required_skills)[0]
    ?? "not_reported";
}

function packageCodexSurface(record: Record<string, unknown>): string {
  return firstStringField(record, ["codex_surface_state", "codex_visible_entry", "shortcut_id", "codex_surface_ref"])
    ?? asString(asRecord(record.codex_surface)?.status)
    ?? "missing_codex_surface";
}

function packagePhysicalSurface(record: Record<string, unknown>): { status: string; ref?: string } {
  const distributionPayload = asRecord(record.distribution_payload);
  const physicalSurface = asRecord(record.physical_surface) ?? asRecord(distributionPayload?.physical_surface);
  return {
    status: firstStringField(record, ["physical_surface_status"])
      ?? asString(physicalSurface?.status)
      ?? asString(physicalSurface?.state)
      ?? "not_reported",
    ref: asString(physicalSurface?.ref)
      ?? asString(physicalSurface?.path)
      ?? asString(physicalSurface?.root)
      ?? firstStringField(record, ["managed_checkout_path", "checkout_path"])
      ?? packageFileRef(record, "package_lock_file")
      ?? undefined
  };
}

function packageSourceExplanation(
  record: Record<string, unknown>,
  source: PackageLifecycleStatusAxis["source"]
): string {
  if (source === "legacy_modules_fallback") {
    return "legacy modules.items preview fallback; fallback rows are preview-only and all package actions stay unavailable.";
  }
  if (source === "missing_bridge") {
    return "missing App/root package bridge; no package lifecycle truth or executable action is inferred.";
  }
  const sourceKind = packageSourceKind(record).toLowerCase();
  const manifestUrl = packageManifestUrl(record);
  const sourceRefValue = packageSourceRefValue(record)?.toLowerCase() ?? "";
  if (/ghcr|oci|container|image/.test(`${sourceKind} ${sourceRefValue}`)) {
    return "ghcr_source: canonical App/root package projection points at an OCI/GHCR package source.";
  }
  if (manifestUrl) {
    return "manifest_url_source: canonical App/root package projection supplies a manifest URL/ref for install or update preview.";
  }
  if (/git|checkout|local|developer/.test(`${sourceKind} ${sourceRefValue}`)) {
    return "git_local_developer_source: canonical App/root package projection points at a git/local developer source.";
  }
  if (/managed|root|registry/.test(`${sourceKind} ${sourceRefValue}`)) {
    return "managed_source: canonical App/root managed package projection.";
  }
  return "canonical App/root agent_packages projection; Workbench renders refs and action availability only.";
}

function packageSearchMetadata(
  record: Record<string, unknown>,
  source: PackageLifecycleStatusAxis["source"]
): PackageLifecycleSearchMetadata {
  const sourceKind = packageSourceKind(record);
  const manifestUrl = packageManifestUrl(record);
  const sourceRefValue = packageSourceRefValue(record);
  const requiredSkill = packageRequiredSkill(record);
  const codexSurface = packageCodexSurface(record);
  const physicalSurface = packagePhysicalSurface(record);
  const query = uniqueStrings([
    packageIdentity(record, 0),
    packageLabel(record),
    source,
    sourceKind,
    manifestUrl,
    sourceRefValue,
    requiredSkill,
    codexSurface,
    physicalSurface.status,
    packageRecommendedAction(record),
    packageConditionText(record)
  ]).join(" ").toLowerCase();
  const tagText = `${sourceKind} ${sourceRefValue ?? ""} ${manifestUrl ?? ""}`.toLowerCase();
  const tags = uniqueStrings([
    source,
    sourceKind,
    /managed|root|registry/.test(tagText) ? "managed_source" : null,
    /ghcr|oci|container|image/.test(tagText) ? "ghcr_source" : null,
    manifestUrl ? "manifest_url_source" : null,
    /git|checkout|local|developer/.test(tagText) ? "git_local_developer_source" : null,
    codexSurface === "missing_codex_surface" || /missing/.test(codexSurface) ? "missing_codex_surface" : null,
    requiredSkill !== "not_reported" ? `required_skill:${requiredSkill}` : "required_skill:not_reported",
    physicalSurface.status
  ]);
  const filters = [
    packageDisplayRef("Source", source, "Projection source used for package lifecycle rendering."),
    packageDisplayRef("Source kind", sourceKind, "Search/filter source kind from App/root projection."),
    packageDisplayRef("Codex surface", codexSurface, "Codex/App exposure surface state from refs."),
    packageDisplayRef("Required skill", requiredSkill, "Required skill ref if App/root reports one."),
    packageDisplayRef("Physical surface", physicalSurface.status, "Physical surface status from App/root detail fields.")
  ].filter((item): item is PackageLifecycleDisplayRef => Boolean(item));
  return { query, tags, filters };
}

function packageLifecycleDetails(
  record: Record<string, unknown>,
  source: PackageLifecycleStatusAxis["source"]
): PackageLifecycleDetailRef[] {
  const physicalSurface = packagePhysicalSurface(record);
  const detail = (label: string, value: string | null, summary: string, ref?: string): PackageLifecycleDetailRef => ({
    label,
    value: value ?? "not_reported",
    source,
    ref,
    summary
  });
  return [
    detail("Status", firstStringField(record, ["lifecycle_status", "status", "install_state", "health_status"]), "Lifecycle status supplied by App/root projection."),
    detail("Conditions", packageConditionText(record), "Failure/blocking/diagnostic conditions from App/root projection."),
    detail("Recommended action", packageRecommendedAction(record), "Recommended action text or action id from App/root projection."),
    detail("Physical surface", physicalSurface.status, "Physical surface status is a detail ref, not package truth.", physicalSurface.ref),
    detail("Required skill", packageRequiredSkill(record), "Required skill surfaced for search/filter only."),
    detail("Codex surface", packageCodexSurface(record), "Codex/App exposure surface state from refs."),
    detail("Manifest URL", packageManifestUrl(record), "Manifest URL/ref is input metadata, not installed-ready proof."),
    detail("Source kind", packageSourceKind(record), "managed_source / ghcr_source / manifest_url_source / git_local_developer_source classification.")
  ];
}

function actionForPackageKind(
  kind: PackageLifecycleActionKind,
  actionMap: Map<string, WorkbenchActionRef>
): WorkbenchActionRef | undefined {
  return packageLifecycleActionIds[kind].map((id) => actionMap.get(id)).find(Boolean);
}

function packageAllowsAction(kind: PackageLifecycleActionKind, record: Record<string, unknown>): boolean {
  const availableActions = asStringArray(record.available_actions).map((item) => item.toLowerCase());
  if (!availableActions.length) return true;
  return packageLifecycleActionAliases[kind].some((alias) => availableActions.some((item) => item.includes(alias)));
}

function packageLifecycleActions(
  record: Record<string, unknown>,
  actionMap: Map<string, WorkbenchActionRef>,
  source: PackageLifecycleStatusAxis["source"]
): PackageLifecycleActionRef[] {
  return (Object.keys(packageLifecycleActionLabels) as PackageLifecycleActionKind[]).map((kind) => {
    const action = actionForPackageKind(kind, actionMap);
    const allowedByPackage = packageAllowsAction(kind, record);
    const status = source === "canonical_agent_packages" && action?.dryRunSupported && allowedByPackage ? "available" : "unavailable";
    return {
      kind,
      label: packageLifecycleActionLabels[kind],
      status,
      actionId: action?.id,
      route: action?.route,
      payloadFields: action?.payloadFields ?? [],
      dryRunSupported: action?.dryRunSupported ?? false,
      owner: action?.owner,
      delegatedSurface: action?.delegatedSurface,
      sourceRef: action?.route ?? (source === "missing_bridge" ? "missing_bridge" : "opl app state --profile fast --json#app_state.actions"),
      reason: source !== "canonical_agent_packages"
        ? "Preview fallback row: package lifecycle actions are unavailable without canonical app_state.agent_packages."
        : !action
        ? "Missing App/root action ref."
        : !action.dryRunSupported
          ? "App/root action ref exists, but dry-run preview is unavailable."
          : !allowedByPackage
            ? "Package row does not expose this lifecycle action."
            : "Available through App/root action contract."
    };
  });
}

function packageLifecycleItem(
  record: Record<string, unknown>,
  actionMap: Map<string, WorkbenchActionRef>,
  source: PackageLifecycleStatusAxis["source"]
): AgentPackageLifecycleRef {
  const packageId = packageIdentity(record, 0);
  const sourceRef = source === "canonical_agent_packages"
    ? "opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index"
    : source === "legacy_modules_fallback"
      ? "opl app state --profile fast --json#app_state.modules.items[]"
      : "missing_bridge";
  const refs = [
    packageDisplayRef("Manifest", packageManifestUrl(record) ?? firstStringField(record, ["source", "repo_url"]), "Package manifest or source ref from App/root projection."),
    packageDisplayRef("Source", packageSourceRefValue(record), "Managed, GHCR, git, local developer, or registry source ref from App/root projection."),
    packageDisplayRef("Package lock", firstStringField(record, ["package_lock_ref", "lock_ref"]), "Package lock ref from App/root projection."),
    packageDisplayRef("Action receipt", firstStringField(record, ["action_receipt_ref", "receipt_ref", "action_receipt_id", "receipt_refs"]), "Lifecycle receipt ref supplied by App/root."),
    packageDisplayRef("Rollback", firstStringField(record, ["rollback_ref"]), "Rollback ref supplied by App/root package lifecycle."),
    packageDisplayRef("Exposure", firstStringField(record, ["home_shortcut_ref", "shortcut_id", "codex_visible_entry", "display_policy"]), "Codex/App exposure ref supplied by App/root."),
    packageDisplayRef("Registry cache", packageFileRef(record, "registry_cache_file"), "Physical registry cache file surfaced as a ref only."),
    packageDisplayRef("Lifecycle ledger", packageFileRef(record, "lifecycle_ledger_file"), "Physical lifecycle ledger file surfaced as a ref only."),
    packageDisplayRef("Shortcut preferences", packageFileRef(record, "home_shortcut_preferences_file"), "Physical exposure preferences file surfaced as a ref only.")
  ].filter((item): item is PackageLifecycleDisplayRef => Boolean(item));
  const receiptRefs = packageLifecycleReceipts(record)
    .slice(0, 3)
    .map((receipt) => packageDisplayRef(
      `Receipt ${asString(receipt.action) ?? asString(receipt.action_status) ?? "lifecycle"}`,
      firstStringField(receipt, ["receipt_ref", "package_lock_ref", "rollback_ref", "manifest_url"]),
      "Lifecycle receipt/detail ref supplied by App/root; not package truth."
    ))
    .filter((item): item is PackageLifecycleDisplayRef => Boolean(item));
  return {
    id: `package-lifecycle-${packageId}`,
    packageId,
    label: packageLabel(record),
    status: source === "legacy_modules_fallback"
      ? "preview_legacy_modules_fallback"
      : firstStringField(record, ["lifecycle_status", "status", "install_state", "health_status"]) ?? "app_state_projection",
    summary: source === "canonical_agent_packages"
      ? "Canonical package lifecycle projection from App/root; Workbench only renders refs and action availability."
      : source === "legacy_modules_fallback"
        ? "Legacy modules.items fallback while canonical agent_packages projection is missing; no package installed/ready/synced claim is inferred."
        : "Package lifecycle bridge missing.",
    sourceRef,
    sourceExplanation: packageSourceExplanation(record, source),
    searchMetadata: packageSearchMetadata(record, source),
    refs: [...refs, ...receiptRefs],
    details: packageLifecycleDetails(record, source),
    statusAxes: packageStatusAxes(record, source),
    actions: packageLifecycleActions(record, actionMap, source),
    authorityBoundary: "Native Workbench consumes App/root package lifecycle refs and actions only; no executor, package truth, readiness, or release authority is created here."
  };
}

function legacyPackageRowsFromModules(moduleItems: Record<string, unknown>[]): Record<string, unknown>[] {
  return moduleItems.map((item) => ({
    ...item,
    package_id: firstStringField(item, ["module_id", "id"]),
    display_name: firstStringField(item, ["label", "module_id"]),
    install_state: "legacy_modules_fallback",
    update_state: firstStringField(item, ["recommended_action"]) ?? asString(asRecord(item.git)?.sync_status) ?? "unknown",
    source_state: asString(asRecord(item.source_policy)?.effective_install_update_source) ?? "legacy_modules_fallback",
    trust_state: firstStringField(item, ["health_status"]) ?? "unknown",
    codex_surface_state: "missing_agent_packages_projection"
  }));
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
        status: artifactStatus(
          artifact?.status ?? artifact?.canonical_status ?? artifact?.export_status,
          "app_canonical"
        ),
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
  const appSettingsReadModel = asRecord(settingsControlCenter?.app_settings_read_model);
  const gatewayAccountProjection = asRecord(appSettingsReadModel?.opl_gateway_account);
  const gatewayAccountRecord = asRecord(gatewayAccountProjection?.account);
  const gatewayAccountStatus = asString(gatewayAccountProjection?.status);
  const gatewayAccountDisplayName = asString(gatewayAccountRecord?.display_name);
  const gatewayAccount = gatewayAccountProjection?.surface_kind === "opl_gateway_account_read_model.v1"
    && gatewayAccountProjection.connection_mode === "account"
    && asBoolean(gatewayAccountProjection.account_card_visible)
    && gatewayAccountStatus !== null
    && ["connected", "setup_required", "reauth_required", "attention_needed", "disconnect_pending"].includes(gatewayAccountStatus)
    && gatewayAccountDisplayName !== null
    ? {
        displayName: gatewayAccountDisplayName,
        status: gatewayAccountStatus,
        sourceRef: "app_state.settings_control_center.app_settings_read_model.opl_gateway_account.account.display_name"
      }
    : undefined;
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

  const canonicalPackageProjection = asRecord(appState.agent_packages);
  const canonicalPackageRows = packageRowsFromCanonicalProjection(canonicalPackageProjection, appState);
  const canonicalPackageItems = canonicalPackageRows.length
    ? canonicalPackageRows
    : canonicalPackageProjection
      ? [canonicalSummaryRow(canonicalPackageProjection)]
      : [];
  const packageLifecycle = canonicalPackageItems.length
    ? canonicalPackageItems.slice(0, 8).map((item) => packageLifecycleItem(item, actionMap, "canonical_agent_packages"))
    : moduleItems.length
      ? legacyPackageRowsFromModules(moduleItems).slice(0, 8).map((item) => packageLifecycleItem(item, actionMap, "legacy_modules_fallback"))
      : fallback.packageLifecycle;

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
        status: artifactStatus(
          artifact.status ?? artifact.canonical_status ?? artifact.export_status,
          "app_canonical"
        ),
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
        status: artifactStatus(
          artifact?.status ?? artifact?.receipt_status ?? artifact?.canonical_status,
          "app_canonical"
        )
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

  const leadTask = taskDrilldowns[0] ?? null;
  const leadTaskTitle = asString(leadTask?.title) ?? "Current task";
  const leadArtifact = asRecord(leadTask?.artifact_or_blocker);
  const leadActionReceipt = asRecord(leadTask?.action_receipt);
  const leadActionId = asString(leadActionReceipt?.action_id);
  const leadActionRoute = asString(leadActionReceipt?.route);
  const leadExportActionId = asString(leadActionReceipt?.export_bundle_action_id);
  const leadExportRoute = asString(leadActionReceipt?.export_bundle_route);
  const leadStageRun = asRecord(leadTask?.stage_run_cockpit_summary)
    ?? asRecord(leadTask?.stage_run_current_owner_delta)
    ?? asRecord(leadTask?.stage_run_cockpit);
  const leadAcceptedShapes = taskAcceptedShapes(leadTask ?? {}, currentOwnerDelta);
  const leadUsageSummary = usageSummary(asRecord(leadTask?.current_stage_usage));
  const leadTaskTotalUsage = usageSummary(asRecord(leadTask?.task_total_usage));
  const leadTraceSteps = uniqueStrings([
    leadTaskTitle,
    asString(leadTask?.active_stage_label) ?? asString(leadTask?.active_stage_id),
    asString(leadTask?.status_label) ?? asString(leadTask?.status),
    asString(currentOwnerDelta?.owner) ?? asString(leadStageRun?.current_owner),
    compactText(leadTask?.next_visible_step, "Review current refs before execution.", 88),
    leadAcceptedShapes.length ? `Return ${leadAcceptedShapes.join(" | ")}` : null
  ]);

  const leadPreviewCandidates: ArtifactPreview[] = leadTask ? [
    {
      id: `preview-summary-${asString(leadTask.task_id) ?? "current"}`,
      label: "Summary",
      previewKind: "markdown",
      rendererModuleId: rendererModuleIdForPreviewKind("markdown"),
      title: `${leadTaskTitle} workbench summary`,
      ref: asString(leadArtifact?.current_ref) ?? `opl://task/${asString(leadTask.task_id) ?? "current"}`,
      summary: compactText(leadTask.next_visible_step, "Task-derived summary preview."),
      content: [
        `### ${leadTaskTitle}`,
        "",
        compactText(leadTask.next_visible_step, "Review current refs before execution."),
        "",
        "#### Workbench reading",
        `- Status: ${(asString(leadTask.status_label) ?? asString(leadTask.status) ?? "unknown").replaceAll("_", " ")}`,
        `- Owner: ${asString(currentOwnerDelta?.owner) ?? asString(leadStageRun?.current_owner) ?? "unknown"}`,
        `- Stage: ${asString(leadTask.active_stage_label) ?? asString(leadTask.active_stage_id) ?? "unknown"}`,
        `- Runtime source: ${asString(leadTask.runtime_readback_source) ?? "unknown"}`,
        ...(leadAcceptedShapes.length ? [`- Required return: ${leadAcceptedShapes.join(", ")}`] : []),
        ...(leadUsageSummary ? [`- Stage usage: ${leadUsageSummary}`] : []),
        ...(leadTaskTotalUsage ? [`- Task usage: ${leadTaskTotalUsage}`] : [])
      ].join("\n"),
      fields: [
        previewField("Task", asString(leadTask.task_id)),
        previewField("Primary state", asString(leadTask.primary_state_label) ?? asString(leadTask.primary_state)),
        previewField("Automation", asString(leadTask.automation_state_label) ?? asString(leadTask.automation_state)),
        previewField("Last heartbeat", formatTimestamp(leadTask.last_heartbeat_at)),
        previewField("Last progress", formatTimestamp(leadTask.last_progress_at))
      ].filter((item): item is { label: string; value: string } => Boolean(item)),
      bullets: uniqueStrings([
        asString(leadTask.typed_blocker_summary),
        asString(leadTask.resolution_route),
        asString(leadStageRun?.running_proof_summary)
      ]),
      sourceRefs: uniqueStrings([
        asString(leadArtifact?.current_ref),
        asString(leadTask.workspace_path),
        asString(leadTask.gateway_status_ref),
        asString(leadStageRun?.typed_blocker_resolution_ref)
      ]),
      authorityBoundary: "Summary projection only; task truth, receipts, and artifact bodies remain source-owned."
    },
    {
      id: `preview-receipt-${asString(leadTask.task_id) ?? "current"}`,
      label: "Receipt",
      previewKind: "json",
      rendererModuleId: rendererModuleIdForPreviewKind("json"),
      title: `${leadTaskTitle} action receipt envelope`,
      ref: asString(leadActionReceipt?.preview_ref) ?? (leadActionRoute ? ensureDryRunJsonRoute(leadActionRoute) : `opl://task/${asString(leadTask.task_id) ?? "current"}/receipt-preview-unavailable`),
      summary: compactText(leadActionReceipt?.content_policy, "Structured preview receipt metadata."),
      content: JSON.stringify({
        task_id: asString(leadTask.task_id),
        action_id: leadActionId,
        preview_ref: asString(leadActionReceipt?.preview_ref),
        dry_run_route: leadActionRoute ? ensureDryRunJsonRoute(leadActionRoute) : null,
        export_bundle_action_id: leadExportActionId,
        export_bundle_route: leadExportRoute ? ensureDryRunJsonRoute(leadExportRoute) : null,
        export_bundle_ref: asStringArray(leadArtifact?.export_bundle_refs)[0] ?? asString(leadArtifact?.export_ref),
        content_policy: asString(leadActionReceipt?.content_policy) ?? "refs_only_no_action_receipt_body",
        required_return_shapes: leadAcceptedShapes
      }, null, 2),
      fields: [
        previewField("Action", leadActionId),
        previewField("Export action", leadExportActionId),
        previewField("Payload", "task_id, action_ref"),
        previewField("Boundary", asString(leadActionReceipt?.content_policy) ?? "refs_only_no_action_receipt_body")
      ].filter((item): item is { label: string; value: string } => Boolean(item)),
      bullets: [
        "Dry-run preview route only; no action receipt body is transferred into the renderer.",
        "Use the preview ref and export bundle ref together when preparing a confirmable action."
      ],
      sourceRefs: uniqueStrings([
        asString(leadActionReceipt?.preview_ref),
        asString(leadArtifact?.export_bundle_action_ref),
        asStringArray(leadArtifact?.export_bundle_refs)[0],
        asString(leadArtifact?.receipt_ref)
      ]),
      authorityBoundary: "Receipt envelope only; execute, owner receipt, and rollback truth remain outside the shell."
    },
    {
      id: `preview-trace-${asString(leadTask.task_id) ?? "current"}`,
      label: "Trace",
      previewKind: "mermaid",
      rendererModuleId: rendererModuleIdForPreviewKind("mermaid"),
      title: `${leadTaskTitle} owner-route trace`,
      ref: asString(leadStageRun?.source_ref) ?? asString(leadArtifact?.current_ref) ?? `opl://task/${asString(leadTask.task_id) ?? "current"}/trace`,
      summary: compactText(asString(currentOwnerDelta?.desired_delta_description) ?? asString(leadTask?.resolution_route), "Owner-route trace derived from App state."),
      fields: [
        previewField("Current owner", asString(currentOwnerDelta?.owner) ?? asString(leadStageRun?.current_owner)),
        previewField("Hard gate", asString(asRecord(currentOwnerDelta?.hard_gate)?.state)),
        previewField("Next safe action", asString(leadStageRun?.next_safe_action_ref)),
        previewField("Runtime", asString(leadTask?.runtime_attempt_status))
      ].filter((item): item is { label: string; value: string } => Boolean(item)),
      bullets: uniqueStrings([
        asString(currentOwnerDelta?.desired_delta_description),
        asString(leadStageRun?.resolution_route),
        asString(leadTask?.typed_blocker_summary)
      ]),
      sourceRefs: uniqueStrings([
        asString(leadStageRun?.source_ref),
        asString(leadStageRun?.typed_blocker_resolution_ref),
        asString(leadTask?.gateway_status_ref)
      ]),
      traceSteps: leadTraceSteps,
      authorityBoundary: "Trace projection only; stage transition still requires owner receipt or typed blocker."
    },
    {
      id: `preview-manifest-${asString(leadTask.task_id) ?? "current"}`,
      label: "Manifest",
      previewKind: "code",
      rendererModuleId: rendererModuleIdForPreviewKind("code"),
      title: `${leadTaskTitle} deliverable manifest`,
      ref: asStringArray(leadArtifact?.export_bundle_refs)[0] ?? asString(leadArtifact?.export_ref) ?? asString(leadArtifact?.canonical_ref) ?? `opl://task/${asString(leadTask.task_id) ?? "current"}/deliverable`,
      summary: compactText(leadArtifact?.content_policy, "Manifest-style delivery projection from refs."),
      content: [
        "export const workbenchDeliveryProjection = {",
        `  taskId: ${JSON.stringify(asString(leadTask.task_id) ?? null)},`,
        `  title: ${JSON.stringify(leadTaskTitle)},`,
        `  currentRef: ${JSON.stringify(asString(leadArtifact?.current_ref) ?? null)},`,
        `  canonicalRef: ${JSON.stringify(asString(leadArtifact?.canonical_ref) ?? null)},`,
        `  exportRef: ${JSON.stringify(asString(leadArtifact?.export_ref) ?? null)},`,
        `  exportBundleRef: ${JSON.stringify(asStringArray(leadArtifact?.export_bundle_refs)[0] ?? null)},`,
        `  receiptRef: ${JSON.stringify(asString(leadArtifact?.receipt_ref) ?? null)},`,
        `  lineageRef: ${JSON.stringify(asString(leadArtifact?.lineage_ref) ?? null)},`,
        `  conformanceRef: ${JSON.stringify(asString(leadArtifact?.conformance_ref) ?? null)},`,
        `  sourceRefCount: ${JSON.stringify(leadTask.source_ref_count ?? null)},`,
        `  safeActionRefCount: ${JSON.stringify(leadTask.safe_action_ref_count ?? null)},`,
        '  authorityBoundary: "refs_only_no_artifact_body"',
        "};"
      ].join("\n"),
      fields: [
        previewField("Current ref", compactRef(asString(leadArtifact?.current_ref) ?? "")),
        previewField("Export bundle", compactRef(asStringArray(leadArtifact?.export_bundle_refs)[0] ?? asString(leadArtifact?.export_ref) ?? "")),
        previewField("Lineage", compactRef(asString(leadArtifact?.lineage_ref) ?? "")),
        previewField("Conformance", compactRef(asString(leadArtifact?.conformance_ref) ?? ""))
      ].filter((item): item is { label: string; value: string } => Boolean(item)),
      bullets: [
        "This is a manifest-style projection for export/readback, not an owned artifact body.",
        "Conformance and lineage stay as refs so the workbench can show delivery context without copying truth."
      ],
      sourceRefs: uniqueStrings([
        asString(leadArtifact?.current_ref),
        asString(leadArtifact?.canonical_ref),
        asStringArray(leadArtifact?.export_bundle_refs)[0],
        asString(leadArtifact?.lineage_ref),
        asString(leadArtifact?.conformance_ref)
      ]),
      authorityBoundary: "Manifest projection only; artifact bytes and release authority remain external."
    }
  ] : [];

  const genericArtifactPreviews = uniqueByRef([
    ...deliverables.map(artifactPreviewFromItem),
    ...receipts.map(artifactPreviewFromItem),
    ...contextActions
      .filter((action) => action.dryRunSupported)
      .map(actionPreviewFromAction)
  ]);
  const artifactPreviews = uniqueByRef([...leadPreviewCandidates, ...genericArtifactPreviews]).slice(0, 6);

  const taskReceiptSummaries = taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id);
    const title = asString(task.title);
    const actionReceipt = asRecord(task.action_receipt);
    const artifact = asRecord(task.artifact_or_blocker);
    const acceptedShapes = taskAcceptedShapes(task, currentOwnerDelta);
    if (!taskId || !title || !actionReceipt) return [];
    const actionId = asString(actionReceipt.action_id);
    const actionRoute = asString(actionReceipt.route);
    const exportActionId = asString(actionReceipt.export_bundle_action_id);
    const exportRoute = asString(actionReceipt.export_bundle_route);
    const exportBundleRef = asStringArray(artifact?.export_bundle_refs)[0];
    return [
      ...(actionId && actionRoute ? [{
        id: `action-receipt-${taskId}`,
        title: `${title} receipt preview`,
        actionId,
        route: ensureDryRunJsonRoute(actionRoute),
        status: "payload_required" as const,
        mutates: "none_read_only",
        receiptRef: asString(actionReceipt.preview_ref) ?? `receipt://${taskId}/preview`,
        summary: compactText(task.next_visible_step, "Task preview receipt derived from operator workbench."),
        payloadFields: ["task_id", "action_ref"],
        owner: asString(task.typed_blocker_owner) ?? asString(currentOwnerDelta?.owner) ?? asString(task.domain_id) ?? undefined,
        authorityBoundary: "Task receipt preview only; no domain execution or owner receipt is implied.",
        sourceRefs: uniqueStrings([
          asString(actionReceipt.preview_ref),
          asString(artifact?.current_ref),
          asString(task.workspace_path)
        ]),
        checks: uniqueStrings([
          "Bind task_id and action_ref before previewing the receipt.",
          acceptedShapes.length ? `Accepted return shapes: ${acceptedShapes.join(", ")}` : null
        ])
      }] : []),
      ...(exportActionId && exportRoute && exportBundleRef ? [{
        id: `action-export-${taskId}`,
        title: `${title} export bundle preview`,
        actionId: exportActionId,
        route: ensureDryRunJsonRoute(exportRoute),
        status: "payload_required" as const,
        mutates: "none_read_only",
        receiptRef: exportBundleRef,
        summary: compactText(artifact?.content_policy, "Export bundle preview uses refs only."),
        payloadFields: ["task_id", "export_bundle_ref"],
        owner: asString(task.domain_id) ?? undefined,
        authorityBoundary: "Export preview only; bundle contents remain source-owned.",
        sourceRefs: uniqueStrings([
          exportBundleRef,
          asString(artifact?.export_ref),
          asString(artifact?.conformance_ref)
        ]),
        checks: [
          "Confirm the export bundle ref is current before any execute step.",
          "Dry-run does not imply package-ready or owner acceptance."
        ]
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
      ,
      payloadFields: action.payloadFields,
      owner: action.owner,
      authorityBoundary: "Generic action receipt preview only; submit/execute stays outside the renderer.",
      sourceRefs: uniqueStrings([ensureDryRunJsonRoute(action.route), action.delegatedSurface]),
      checks: uniqueStrings([
        action.payloadFields.length ? `Required payload: ${action.payloadFields.join(", ")}` : "No payload required for a preview receipt.",
        action.canSubmitToSafeActionShell ? "Safe-action shell can submit this preview lane." : "Safe-action shell submission is not declared for this route."
      ])
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
    const starterAction = [taskAction, exportAction, starterPreviewAction(starter, contextActions)]
      .find((action): action is WorkbenchActionRef => Boolean(action?.dryRunSupported));
    const routeStatus = starterAction ? actionStatus(starterAction) : "unavailable";
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
      status: routeStatus,
      sourceRef: asString(taskActionReceipt?.preview_ref)
        ?? asString(taskArtifact?.current_ref)
        ?? starterAction?.route
        ?? availability?.sourceRef
        ?? starter.sourceRef,
      previewActionId: starterAction?.id,
      dryRunAction: starterAction?.id
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
      previewActionId: previewAction?.id,
      deliverableRefs: deliverables.map((item) => item.ref),
      receiptRefs: receipts.map((item) => item.ref),
      sourceRefs,
      runtimeStatus,
      authorityBoundary: "Refs-only delivery context; no artifact body, owner receipt, domain truth, or release authority."
    }
  ] : fallback.deliveryPackages;

  const leadTaskNextStep = compactText(leadTask?.next_visible_step, "Review current App refs before execution.");
  const confirmations: ConfirmationCard[] = previewAction ? [{
    id: `confirm-${previewAction.id}`,
    title: `Preview ${leadTaskTitle} package`,
    question: `Preview ${previewAction.label} for ${leadTaskTitle} as a refs-only delivery package?`,
    risks: [`Runtime status: ${runtimeStatus}`, leadTaskNextStep, "needs_human_confirmation"],
    willChange: [`Create dry-run request for ${previewAction.id}`, "Attach current App state refs"],
    willNotChange: ["No domain artifact body is written", "No owner receipt or release claim is created"],
    receipt: "Preview receipt from opl app action execute --dry-run",
    rollback: "Discard the candidate packet request before explicit execution",
    dryRunAction: previewAction.id
  }] : [];

  const questions = leadTask ? [
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
  ] : [];

  const contextTrace = [
    { id: "profile", label: "Profile", value: `${asString(meta?.profile) ?? "fast"} | ${formatTimestamp(meta?.generated_at) ?? "no timestamp"}` },
    { id: "owner", label: "Owner route", value: `${asString(currentOwnerDelta?.owner) ?? asString(workbench?.operator_next_action_owner) ?? "unknown"} -> ${asString(currentOwnerDeltaNextAction?.action_kind) ?? asString(workbench?.operator_next_action_kind) ?? "unknown next action"}` },
    { id: "runtime", label: "Runtime", value: `${asString(asRecord(operator?.summary)?.runtime_status) ?? "unknown"} | provider ${asString(asRecord(operator?.summary)?.provider_status) ?? "unknown"}` },
    { id: "boundary", label: "Boundary", value: `${asString(runtimeSource?.owner) ?? "opl_framework"} via ${asString(runtimeSource?.app_repo_truth_owner) ?? "one-person-lab-app"} | refs only` },
    { id: "hard-gate", label: "Hard gate", value: `${asString(asRecord(currentOwnerDelta?.hard_gate)?.state) ?? "unknown"}${leadAcceptedShapes.length ? ` | return ${leadAcceptedShapes.join(", ")}` : ""}` },
    { id: "task", label: "Lead task", value: `${leadTaskTitle} | ${compactText(leadTask?.next_visible_step, "Review current refs", 72)}` }
  ].filter((item) => item.value);

  const sessions = taskDrilldowns.length
    ? taskDrilldowns.slice(0, 3).map((task): WorkspaceSession => ({
        id: asString(task.task_id) ?? `session-${Math.random()}`,
        workspace: `${asString(task.domain_label) ?? "OPL"}${asString(task.workspace_label) ? ` / ${asString(task.workspace_label)}` : ""}`,
        session: `${asString(task.title) ?? asString(task.task_id) ?? "Delivery review"}${asString(task.active_stage_label) ? ` · ${asString(task.active_stage_label)}` : ""}`,
        status: `${asString(task.status) ?? asString(task.state) ?? "candidate_surface_only"}${asString(task.priority_bucket) ? ` · ${asString(task.priority_bucket)}` : ""}`,
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
    packageLifecycle,
    starters,
    confirmations,
    questions,
    activeProjectLines: derivedActiveProjectLines,
    contextSources: effectiveContextSources,
    contextActions: contextActions.length ? contextActions : fallback.contextActions,
    contextTrace: contextTrace.length ? contextTrace : fallback.contextTrace,
    gatewayAccount,
    stateGeneratedAt: asString(meta?.generated_at) ?? fallback.stateGeneratedAt
  };
}
