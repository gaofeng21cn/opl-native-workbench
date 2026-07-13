import { normalizeRuntimeProfile, readRuntimeProfile } from "../workbench/settingsModel";
import { normalizeThreadState, selectDispatchKind } from "../coordination/foundation";
import type {
  CodexThreadRuntimeStatus,
  CodexTurn,
  CoordinationDispatch,
  CoordinationPreparation,
  CoordinationRequest,
  CoordinationThread,
  CoordinationWaitResult,
  DispatchCoordinationRequest,
  SetArchivedRequest,
  ThreadCoordinationBridge,
  ThreadCoordinationEvent,
  ThreadForkRequest,
  ThreadListRequest,
  ThreadListResult,
  ThreadReadRequest,
  ThreadResumeRequest,
  WaitCoordinationRequest
} from "../coordination/types";

export type OplStateProfile = "fast" | "full";

export type OplActionMode = "preview" | "execute" | "rollback";
export type OplActionReceiptKind = OplActionMode | "confirmation_required";
export type OplActionReceiptStatus =
  | "preview_ready"
  | "confirmation_required"
  | "executed"
  | "error"
  | "timed_out";
export type OplEventKind = "tool" | "process" | "diff" | "file" | "receipt" | "user_input" | "permission";

export type OplActionPayload = Record<string, unknown> & {
  confirmed?: boolean;
  confirmationId?: string;
  receiptId?: string;
  rollbackRef?: string;
};

export type OplCommandReadback = {
  command: string;
  commandArgs: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type OplRuntimeSource = Record<string, unknown> & {
  owner?: string;
  app_repo_truth_owner?: string;
  normal_gui_state_surface?: string;
  full_gui_state_surface?: string;
  action_boundary_surface?: string;
  full_drilldown_exception_surface?: string;
};

export type OplOperatorSummary = Record<string, unknown> & {
  runtime_status?: string;
  provider_status?: string;
};

export type OplOperatorRef = Record<string, unknown> & {
  label?: string;
  ref?: string;
  node_kind?: string;
};

export type OplModuleItem = Record<string, unknown> & {
  module_id?: string;
  label?: string;
  installed?: boolean;
  checkout_path?: string;
  repo_url?: string;
  health_status?: string;
};

export type OplActionDescriptor = Record<string, unknown> & {
  action_id: string;
  label: string;
  route: string;
  payload_fields: string[];
  mutates: string;
  dry_run_supported: boolean;
  owner: string;
  delegated_surface: string;
  can_submit_to_safe_action_shell: boolean;
  route_requires_domain_or_app_payload: boolean;
};

export type OplActiveProjectLine = Record<string, unknown> & {
  status: string;
  active_run_id: string;
  next_visible_step: string;
  progress_delta_classification: string;
  deliverable_progress_delta: string;
  platform_repair_delta: string;
  next_forced_delta: string;
};

export type OplAppState = Record<string, unknown> & {
  runtime_source: OplRuntimeSource;
  operator: {
    summary: OplOperatorSummary;
    refs: OplOperatorRef[];
  };
  modules: {
    items: OplModuleItem[];
  };
  actions: OplActionDescriptor[];
  meta: {
    profile: OplStateProfile;
    generated_at: string;
  };
  provider: {
    status: string;
  };
  active_project_lines: OplActiveProjectLine[];
};

export type OplStateReadback = {
  profile: OplStateProfile;
  app_state: OplAppState;
  readback: OplCommandReadback;
  raw_state?: Record<string, unknown>;
};

export type OplFullDrilldownReadback = {
  detail: "full";
  drilldown: Record<string, unknown>;
  readback: OplCommandReadback;
};

export type OplActionRequest = {
  actionId: string;
  mode?: OplActionMode;
  payload?: OplActionPayload;
  dryRun?: boolean;
};

export type OplActionReceipt = {
  actionId: string;
  dryRun: boolean;
  confirmationRequired: boolean;
  canExecute: boolean;
  receiptKind: OplActionReceiptKind;
  authorityBoundary: "app_bridge_no_domain_authority";
  requestedMode: OplActionMode;
  status: OplActionReceiptStatus;
  command: string;
  commandArgs: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  payload?: OplActionPayload;
  stdoutJson?: unknown;
  stderrJson?: unknown;
  confirmationId?: string;
  receiptId?: string;
  rollbackRef?: string;
};

export type CodexMessageRequest = {
  prompt: string;
  threadId?: string;
  model?: string;
  reasoningEffort?: string;
};

export type CodexMessageResponse = {
  executor: "codex_app_server";
  transport: "stdio_json_rpc";
  threadId?: string;
  turnId?: string;
  finalMessage: string;
  eventCount: number;
  completed: Record<string, unknown>;
  cwd?: string;
  simulated?: boolean;
};

export type CodexModelCatalogEntry = {
  id: string;
  model: string;
  displayName: string;
  isDefault: boolean;
  defaultReasoningEffort: string;
  supportedReasoningEfforts: string[];
};

export type CodexModelCatalog = {
  source: "codex_app_server_model_list" | "bridge_unavailable";
  models: CodexModelCatalogEntry[];
  simulated?: boolean;
};

type BaseBridgeEvent = {
  source: string;
  eventKind: OplEventKind;
  summary: string;
  raw: unknown;
};

export type OplBridgeTypeEvent = BaseBridgeEvent & {
  type: string;
};

export type OplBridgeMethodEvent = BaseBridgeEvent & {
  method: string;
  params: Record<string, unknown>;
  turnId?: string;
  delta?: string;
  itemText?: string;
};

export type OplBridgeEvent = OplBridgeTypeEvent | OplBridgeMethodEvent;

export type OplNativeWorkbenchSurface = Pick<
  OplBridge,
  "readState" | "readFullDrilldown" | "executeAction" | "readCodexModels" | "sendMessage" | "subscribeEvents"
> & Partial<ThreadCoordinationBridge> & {
  eventSourceUrl?: string;
  connectEvents?: (onEvent: (event: OplBridgeEvent) => void) => () => void;
};

export const OPL_COMMANDS = {
  fastState: "opl app state --profile fast --json",
  fullState: "opl app state --profile full --json",
  fullDrilldown: "opl runtime app-operator-drilldown --detail full --json",
  actionPrefix: "opl app action execute --action"
} as const;

export const CODEX_APP_SERVER = {
  transport: "codex app-server --stdio",
  initialize: "initialize",
  threadStart: "thread/start",
  turnStart: "turn/start",
  resume: "thread/resume",
  turnStarted: "turn/started",
  streamEvent: "item/agentMessage/delta",
  itemCompleted: "item/completed",
  turnCompleted: "turn/completed",
  defaultSandbox: "read-only",
  approvalPolicy: "never",
  requestTimeoutSeconds: 45,
  turnTimeoutSeconds: 180
} as const;

export type OplBridge = ThreadCoordinationBridge & {
  readState(profile?: OplStateProfile): Promise<OplStateReadback>;
  readFullDrilldown(): Promise<OplFullDrilldownReadback>;
  executeAction(request: OplActionRequest): Promise<OplActionReceipt>;
  readCodexModels(): Promise<CodexModelCatalog>;
  sendMessage(request: CodexMessageRequest): Promise<CodexMessageResponse>;
  subscribeEvents(onEvent: (event: OplBridgeEvent) => void): () => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeThreadStatus(value: unknown): CodexThreadRuntimeStatus {
  const record = asRecord(value);
  const type = asString(record?.type);
  if (type === "idle" || type === "notLoaded" || type === "systemError") return { type };
  if (type === "active") {
    return {
      type,
      activeFlags: Array.isArray(record?.activeFlags) ? record.activeFlags.map(String) : []
    };
  }
  return { type: "systemError" };
}

function normalizeTurn(value: unknown): CodexTurn | undefined {
  const record = asRecord(value);
  const id = asString(record?.id);
  const status = asString(record?.status);
  if (!id || !["completed", "interrupted", "failed", "inProgress"].includes(status ?? "")) return undefined;
  return { ...record, id, status: status as CodexTurn["status"] };
}

export function normalizeCoordinationThread(value: unknown): CoordinationThread {
  const record = asRecord(value);
  const source = asRecord(record?.thread) ?? record ?? {};
  const id = asString(source.id) ?? "";
  const status = normalizeThreadStatus(source.status);
  const turns = Array.isArray(source.turns) ? source.turns.flatMap((turn) => normalizeTurn(turn) ?? []) : [];
  return {
    ...source,
    id,
    sessionId: asString(source.sessionId) ?? id,
    projectKey: asString(source.projectKey) ?? asString(asRecord(source.extra)?.projectKey) ?? null,
    hostId: asString(source.hostId) ?? asString(asRecord(source.extra)?.hostId) ?? "local",
    status,
    state: normalizeThreadState(status),
    summary: asString(source.summary) ?? asString(source.preview) ?? "",
    workspace: asString(source.workspace) ?? asString(source.cwd) ?? "",
    owner: asString(source.owner) ?? asString(source.agentRole) ?? "user",
    goal: asString(source.goal) ?? asString(asRecord(source.extra)?.goal) ?? "",
    archived: asBoolean(source.archived) ?? false,
    parentThreadId: asString(source.parentThreadId) ?? null,
    ancestorThreadIds: Array.isArray(source.ancestorThreadIds) ? source.ancestorThreadIds.map(String) : [],
    writeSet: Array.isArray(source.writeSet) ? source.writeSet.map(String) : [],
    createdAt: asNumber(source.createdAt) ?? 0,
    updatedAt: asNumber(source.updatedAt) ?? 0,
    turns,
    activeTurnId: asString(source.activeTurnId) ?? turns.find((turn) => turn.status === "inProgress")?.id
  };
}

export function normalizeThreadListResult(value: unknown): ThreadListResult {
  const record = asRecord(value);
  const data = Array.isArray(record?.data) ? record.data.map(normalizeCoordinationThread).filter((thread) => thread.id) : [];
  return { data, nextCursor: null };
}

export function normalizeCoordinationPreparation(
  value: unknown,
  request: CoordinationRequest
): CoordinationPreparation {
  const record = asRecord(value);
  const guard = asRecord(record?.guard);
  const state = asString(record?.state);
  const target = record?.target ? normalizeCoordinationThread(record.target) : undefined;
  return {
    state: state === "prepared" || state === "confirmation_required" ? state : "rejected",
    coordinationId: asString(record?.coordinationId),
    previewToken: asString(record?.previewToken),
    request,
    target,
    targetWriteSet: Array.isArray(record?.targetWriteSet)
      ? record.targetWriteSet.map(String)
      : target?.writeSet ?? [],
    plannedDispatch: (asString(record?.plannedDispatch) as CoordinationPreparation["plannedDispatch"] | undefined)
      ?? (target ? selectDispatchKind(target.state, request.priority) : undefined),
    permissionDecision: (asString(record?.permissionDecision) as CoordinationPreparation["permissionDecision"] | undefined)
      ?? "denied",
    guard: guard ? {
      code: String(guard.code) as NonNullable<CoordinationPreparation["guard"]>["code"],
      message: asString(guard.message) ?? "coordination rejected"
    } : undefined,
    preparedAt: asString(record?.preparedAt) ?? new Date().toISOString()
  };
}

export function normalizeCoordinationDispatch(value: unknown): CoordinationDispatch {
  const record = asRecord(value);
  const guard = asRecord(record?.guard);
  const state = asString(record?.state);
  return {
    coordinationId: asString(record?.coordinationId) ?? "",
    state: state === "started" || state === "steered" || state === "queued" ? state : "rejected",
    targetThreadId: asString(record?.targetThreadId) ?? "",
    turnId: asString(record?.turnId),
    protocolMethod: asString(record?.protocolMethod) as CoordinationDispatch["protocolMethod"] | undefined,
    guard: guard ? {
      code: String(guard.code) as NonNullable<CoordinationDispatch["guard"]>["code"],
      message: asString(guard.message) ?? "coordination rejected"
    } : undefined,
    dispatchedAt: asString(record?.dispatchedAt) ?? new Date().toISOString()
  };
}

export function normalizeCoordinationWaitResult(value: unknown): CoordinationWaitResult {
  const record = asRecord(value);
  const state = asString(record?.state);
  const allowed = ["started", "steered", "queued", "completed", "failed", "cancelled", "rejected", "wait_timeout"];
  return {
    coordinationId: asString(record?.coordinationId) ?? "",
    state: (allowed.includes(state ?? "") ? state : "failed") as CoordinationWaitResult["state"],
    targetThreadId: asString(record?.targetThreadId) ?? "",
    turnId: asString(record?.turnId),
    resultSummaryOrRef: asString(record?.resultSummaryOrRef),
    updatedAt: asString(record?.updatedAt) ?? new Date().toISOString()
  };
}

export function normalizeThreadCoordinationEvent(value: unknown): ThreadCoordinationEvent {
  const record = asRecord(value);
  const params = asRecord(record?.params);
  return {
    method: asString(record?.method) ?? asString(record?.type) ?? "coordination/event",
    threadId: asString(record?.threadId) ?? asString(params?.threadId),
    coordinationId: asString(record?.coordinationId) ?? asString(params?.coordinationId),
    state: asString(record?.state) as ThreadCoordinationEvent["state"] | undefined,
    raw: value
  };
}

export function normalizeCodexModelCatalog(value: unknown): CodexModelCatalog {
  const record = asRecord(value);
  const data = Array.isArray(record?.data) ? record.data : Array.isArray(record?.models) ? record.models : [];
  const models = data.flatMap((item) => {
    const model = asRecord(item);
    const id = asString(model?.id) ?? asString(model?.model);
    if (!id) return [];
    const reasoning = Array.isArray(model?.supportedReasoningEfforts)
      ? model.supportedReasoningEfforts.flatMap((option) => {
        if (typeof option === "string") return option ? [option] : [];
        const effort = asString(asRecord(option)?.reasoningEffort);
        return effort ? [effort] : [];
      })
      : [];
    return [{
      id,
      model: asString(model?.model) ?? id,
      displayName: asString(model?.displayName) ?? id,
      isDefault: asBoolean(model?.isDefault) ?? false,
      defaultReasoningEffort: asString(model?.defaultReasoningEffort) ?? reasoning.at(-1) ?? "medium",
      supportedReasoningEfforts: reasoning
    }];
  });
  return {
    source: models.length ? "codex_app_server_model_list" : "bridge_unavailable",
    models,
    simulated: models.length ? undefined : true
  };
}

function parseJsonValue(value: string): unknown {
  const text = value.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function normalizeProfile(profile: unknown): OplStateProfile {
  return normalizeRuntimeProfile(profile);
}

function stateCommand(profile: OplStateProfile): string {
  return profile === "full" ? OPL_COMMANDS.fullState : OPL_COMMANDS.fastState;
}

function createCommandReadback(
  command: string,
  commandArgs: string[],
  exitCode = 0,
  stdout = "",
  stderr = "",
  timedOut = false
): OplCommandReadback {
  return { command, commandArgs, exitCode, stdout, stderr, timedOut };
}

function defaultStateActions(): OplActionDescriptor[] {
  return [
    {
      action_id: "task_action_receipt_preview",
      label: "Preview task action receipt",
      route: "opl app action execute --action task_action_receipt_preview",
      payload_fields: [],
      mutates: "none",
      dry_run_supported: true,
      owner: "opl_app",
      delegated_surface: "opl task action receipt preview",
      can_submit_to_safe_action_shell: true,
      route_requires_domain_or_app_payload: false
    },
    {
      action_id: "task_export_bundle_preview",
      label: "Preview export bundle",
      route: "opl app action execute --action task_export_bundle_preview",
      payload_fields: ["refs"],
      mutates: "candidate_preview_only",
      dry_run_supported: true,
      owner: "opl_app",
      delegated_surface: "opl export bundle preview",
      can_submit_to_safe_action_shell: true,
      route_requires_domain_or_app_payload: true
    },
    {
      action_id: "workspace_ensure",
      label: "Ensure workspace",
      route: "opl app action execute --action workspace_ensure",
      payload_fields: ["workspace"],
      mutates: "workspace_context",
      dry_run_supported: true,
      owner: "opl_app",
      delegated_surface: "opl workspace ensure",
      can_submit_to_safe_action_shell: true,
      route_requires_domain_or_app_payload: true
    },
    {
      action_id: "settings_sync_capabilities",
      label: "Sync settings capabilities",
      route: "opl app action execute --action settings_sync_capabilities",
      payload_fields: [],
      mutates: "settings_capabilities_projection",
      dry_run_supported: true,
      owner: "opl_app",
      delegated_surface: "opl settings capability sync",
      can_submit_to_safe_action_shell: true,
      route_requires_domain_or_app_payload: false
    },
    {
      action_id: "provider_scheduler_status",
      label: "Provider scheduler status",
      route: "opl app action execute --action provider_scheduler_status",
      payload_fields: [],
      mutates: "none",
      dry_run_supported: true,
      owner: "opl_runtime",
      delegated_surface: "opl provider scheduler status",
      can_submit_to_safe_action_shell: true,
      route_requires_domain_or_app_payload: false
    }
  ];
}

function defaultStateReadback(profile: OplStateProfile): OplStateReadback {
  const generatedAt = new Date().toISOString();
  return {
    profile,
    app_state: {
      runtime_source: {
        owner: "opl_framework",
        app_repo_truth_owner: "one-person-lab-app",
        normal_gui_state_surface: OPL_COMMANDS.fastState,
        full_gui_state_surface: OPL_COMMANDS.fullState,
        action_boundary_surface: "opl app action execute --action <action_id> [--payload json] [--dry-run] --json",
        full_drilldown_exception_surface: OPL_COMMANDS.fullDrilldown
      },
      operator: {
        summary: {
          runtime_status: profile === "full" ? "full_profile_placeholder" : "fast_profile_placeholder",
          provider_status: "candidate_preview_only"
        },
        refs: [{
          label: "App state profile",
          ref: `opl://state/${profile}`,
          node_kind: "runtime_profile"
        }]
      },
      modules: { items: [] },
      actions: defaultStateActions(),
      meta: {
        profile,
        generated_at: generatedAt
      },
      provider: {
        status: "candidate_preview_only"
      },
      active_project_lines: [{
        status: "candidate_preview_only",
        active_run_id: `placeholder-${profile}`,
        next_visible_step: "Read runtime refs before execution",
        progress_delta_classification: "platform_or_observability_delta",
        deliverable_progress_delta: "runtime refs available",
        platform_repair_delta: "none",
        next_forced_delta: "human_confirmation_gate"
      }]
    },
    readback: createCommandReadback(
      stateCommand(profile),
      ["opl", "app", "state", "--profile", profile, "--json"]
    )
  };
}

function defaultFullDrilldown(): OplFullDrilldownReadback {
  return {
    detail: "full",
    drilldown: {
      runtime_status: "full_drilldown_placeholder",
      authorityBoundary: "app_bridge_no_domain_authority"
    },
    readback: createCommandReadback(
      OPL_COMMANDS.fullDrilldown,
      ["opl", "runtime", "app-operator-drilldown", "--detail", "full", "--json"]
    )
  };
}

export function buildActionCommandArgs(request: OplActionRequest): string[] {
  const args = ["opl", "app", "action", "execute", "--action", request.actionId];
  if (request.payload) {
    args.push("--payload", JSON.stringify(request.payload));
  }
  if (request.dryRun !== false) {
    args.push("--dry-run");
  }
  args.push("--json");
  return args;
}

export function buildActionCommand(request: OplActionRequest): string {
  const payload = request.payload ? ` --payload '${JSON.stringify(request.payload)}'` : "";
  const dryRun = request.dryRun === false ? "" : " --dry-run";
  return `${OPL_COMMANDS.actionPrefix} ${request.actionId}${payload}${dryRun} --json`;
}

function actionMode(request: OplActionRequest): OplActionMode {
  if (request.mode) return request.mode;
  if (request.payload?.rollbackRef) return "rollback";
  return request.dryRun === false ? "execute" : "preview";
}

function actionReceiptKind(request: OplActionRequest): OplActionReceiptKind {
  if (request.dryRun === false && request.payload?.confirmed !== true) return "confirmation_required";
  return actionMode(request);
}

function actionReceiptStatus(
  receiptKind: OplActionReceiptKind,
  dryRun: boolean,
  exitCode: number,
  timedOut: boolean
): OplActionReceiptStatus {
  if (timedOut) return "timed_out";
  if (receiptKind === "confirmation_required") return "confirmation_required";
  if (exitCode !== 0) return "error";
  return dryRun ? "preview_ready" : "executed";
}

function createPlaceholderActionReceipt(request: OplActionRequest): OplActionReceipt {
  const command = buildActionCommand(request);
  const commandArgs = buildActionCommandArgs(request);
  const receiptKind = actionReceiptKind(request);
  const dryRun = request.dryRun !== false;
  const exitCode = -1;
  const stderr = receiptKind === "confirmation_required"
    ? "confirmation_required"
    : JSON.stringify({
        error: "bridge_unavailable_placeholder",
        boundary: "preview_only_no_native_action_record"
      });
  return {
    actionId: request.actionId,
    dryRun,
    confirmationRequired: receiptKind === "confirmation_required",
    canExecute: false,
    receiptKind,
    authorityBoundary: "app_bridge_no_domain_authority",
    requestedMode: actionMode(request),
    status: actionReceiptStatus(receiptKind, dryRun, exitCode, false),
    command,
    commandArgs,
    exitCode,
    stdout: "",
    stderr,
    timedOut: false,
    payload: request.payload,
    stdoutJson: undefined,
    stderrJson: parseJsonValue(stderr),
    confirmationId: request.payload?.confirmationId,
    receiptId: request.payload?.receiptId,
    rollbackRef: request.payload?.rollbackRef
  };
}

function hasActionReceiptRecord(record: Record<string, unknown>): boolean {
  return Boolean(
    asString(record.actionId)
      || asString(record.command)
      || typeof record.exitCode === "number"
      || typeof record.stdout === "string"
      || typeof record.stderr === "string"
      || asString(record.receiptKind)
  );
}

function normalizeCommandReadback(
  value: unknown,
  fallbackCommand: string,
  fallbackArgs: string[]
): OplCommandReadback {
  const record = asRecord(value);
  return createCommandReadback(
    asString(record?.command) ?? fallbackCommand,
    fallbackArgs,
    asNumber(record?.exitCode) ?? 0,
    typeof record?.stdout === "string" ? record.stdout : "",
    typeof record?.stderr === "string" ? record.stderr : "",
    asBoolean(record?.timedOut) ?? false
  );
}

function normalizeStateObject(value: unknown, fallback: OplStateReadback): OplAppState {
  const root = asRecord(value);
  const appState = asRecord(root?.app_state) ?? root;
  if (!appState) return fallback.app_state;
  return {
    ...fallback.app_state,
    ...appState,
    runtime_source: {
      ...fallback.app_state.runtime_source,
      ...asRecord(appState.runtime_source)
    },
    operator: {
      summary: {
        ...fallback.app_state.operator.summary,
        ...asRecord(asRecord(appState.operator)?.summary)
      },
      refs: Array.isArray(asRecord(appState.operator)?.refs)
        ? (asRecord(appState.operator)?.refs as unknown[]).map((item) => asRecord(item) ?? {})
        : fallback.app_state.operator.refs
    },
    modules: {
      items: Array.isArray(asRecord(appState.modules)?.items)
        ? (asRecord(appState.modules)?.items as unknown[]).map((item) => asRecord(item) ?? {})
        : fallback.app_state.modules.items
    },
    actions: Array.isArray(appState.actions)
      ? appState.actions.map((item) => {
          const action = asRecord(item);
          const id = asString(action?.action_id) ?? "";
          return {
            action_id: id,
            label: asString(action?.label) ?? id,
            route: asString(action?.route) ?? `opl app action execute --action ${id}`,
            payload_fields: Array.isArray(action?.payload_fields)
              ? action.payload_fields.map((field) => String(field))
              : [],
            mutates: asString(action?.mutates) ?? "unknown",
            dry_run_supported: asBoolean(action?.dry_run_supported) ?? false,
            owner: asString(action?.owner) ?? "",
            delegated_surface: asString(action?.delegated_surface) ?? "",
            can_submit_to_safe_action_shell: asBoolean(action?.can_submit_to_safe_action_shell) ?? false,
            route_requires_domain_or_app_payload: asBoolean(action?.route_requires_domain_or_app_payload) ?? false
          };
        }).filter((action) => Boolean(action.action_id))
      : fallback.app_state.actions,
    meta: {
      profile: normalizeProfile(asRecord(appState.meta)?.profile ?? fallback.profile),
      generated_at: asString(asRecord(appState.meta)?.generated_at) ?? fallback.app_state.meta.generated_at
    },
    provider: {
      status: asString(asRecord(appState.provider)?.status) ?? fallback.app_state.provider.status
    },
    active_project_lines: Array.isArray(appState.active_project_lines)
      ? appState.active_project_lines.map((item) => {
          const line = asRecord(item);
          return {
            status: asString(line?.status) ?? "unknown",
            active_run_id: asString(line?.active_run_id) ?? "",
            next_visible_step: asString(line?.next_visible_step) ?? "Review current refs",
            progress_delta_classification: asString(line?.progress_delta_classification) ?? "platform_or_observability_delta",
            deliverable_progress_delta: asString(line?.deliverable_progress_delta) ?? "runtime refs available",
            platform_repair_delta: asString(line?.platform_repair_delta) ?? "none",
            next_forced_delta: asString(line?.next_forced_delta) ?? "human_confirmation_gate"
          };
        })
      : fallback.app_state.active_project_lines
  };
}

export function normalizeStateReadback(value: unknown, profile = readRuntimeProfile()): OplStateReadback {
  const normalizedProfile = normalizeProfile(profile);
  const fallback = defaultStateReadback(normalizedProfile);
  const commandReadback = normalizeCommandReadback(
    value,
    stateCommand(normalizedProfile),
    ["opl", "app", "state", "--profile", normalizedProfile, "--json"]
  );
  const record = asRecord(value);
  const parsedState = parseJsonValue(commandReadback.stdout);
  const rawState = asRecord(parsedState) ?? asRecord(record?.raw_state) ?? undefined;
  const stateSource = rawState ?? record;
  return {
    profile: normalizedProfile,
    app_state: normalizeStateObject(stateSource, fallback),
    readback: record?.readback
      ? normalizeCommandReadback(record.readback, commandReadback.command, commandReadback.commandArgs)
      : commandReadback,
    raw_state: rawState
  };
}

export function normalizeFullDrilldownReadback(value: unknown): OplFullDrilldownReadback {
  const fallback = defaultFullDrilldown();
  const commandReadback = normalizeCommandReadback(
    value,
    OPL_COMMANDS.fullDrilldown,
    ["opl", "runtime", "app-operator-drilldown", "--detail", "full", "--json"]
  );
  const record = asRecord(value);
  const parsed = asRecord(parseJsonValue(commandReadback.stdout));
  return {
    detail: "full",
    drilldown: parsed ?? asRecord(record?.drilldown) ?? fallback.drilldown,
    readback: record?.readback
      ? normalizeCommandReadback(record.readback, commandReadback.command, commandReadback.commandArgs)
      : commandReadback
  };
}

export function normalizeActionReceipt(value: unknown, request: OplActionRequest): OplActionReceipt {
  const fallback = createPlaceholderActionReceipt(request);
  const record = asRecord(value);
  if (!record || !hasActionReceiptRecord(record)) return fallback;
  const readback = normalizeCommandReadback(record, fallback.command, fallback.commandArgs);
  const receiptKind = (asString(record.receiptKind) as OplActionReceiptKind | undefined) ?? fallback.receiptKind;
  return {
    ...fallback,
    actionId: asString(record.actionId) ?? fallback.actionId,
    dryRun: asBoolean(record.dryRun) ?? fallback.dryRun,
    confirmationRequired: asBoolean(record.confirmationRequired) ?? fallback.confirmationRequired,
    canExecute: asBoolean(record.canExecute) ?? fallback.canExecute,
    receiptKind,
    requestedMode: fallback.requestedMode,
    status: actionReceiptStatus(
      receiptKind,
      asBoolean(record.dryRun) ?? fallback.dryRun,
      readback.exitCode,
      readback.timedOut
    ),
    authorityBoundary: (asString(record.authorityBoundary) as "app_bridge_no_domain_authority" | undefined) ?? fallback.authorityBoundary,
    command: readback.command,
    commandArgs: readback.commandArgs,
    exitCode: readback.exitCode,
    stdout: readback.stdout,
    stderr: readback.stderr,
    timedOut: readback.timedOut,
    payload: request.payload,
    stdoutJson: parseJsonValue(readback.stdout),
    stderrJson: parseJsonValue(readback.stderr),
    confirmationId: asString(record.confirmationId) ?? fallback.confirmationId,
    receiptId: asString(record.receiptId) ?? fallback.receiptId,
    rollbackRef: asString(record.rollbackRef) ?? fallback.rollbackRef
  };
}

export function normalizeSendMessageResponse(value: unknown, request: CodexMessageRequest): CodexMessageResponse {
  const record = asRecord(value);
  const threadId = asString(record?.threadId) ?? request.threadId;
  const turnId = asString(record?.turnId) ?? (threadId ? `${threadId}:simulated-turn` : "simulated-turn");
  const completed = asRecord(record?.completed) ?? {
    turn: {
      id: turnId,
      status: "preview_only"
    }
  };
  return {
    executor: "codex_app_server",
    transport: "stdio_json_rpc",
    threadId,
    turnId,
    finalMessage: asString(record?.finalMessage) ?? "Preview-only browser placeholder reply. Native bridge unavailable.",
    eventCount: asNumber(record?.eventCount) ?? 0,
    completed,
    cwd: asString(record?.cwd),
    simulated: asBoolean(record?.simulated) ?? !record
  };
}

function classifyEventKind(methodOrType: string, payload: Record<string, unknown> | null): OplEventKind {
  const text = methodOrType.toLowerCase();
  const item = asRecord(payload?.item);
  const itemType = asString(item?.type)?.toLowerCase() ?? "";
  if (text.includes("permission")) return "permission";
  if (text.includes("user_input") || text.includes("input")) return "user_input";
  if (text.includes("receipt")) return "receipt";
  if (text.includes("tool") || itemType.includes("tool")) return "tool";
  if (text.includes("diff")) return "diff";
  if (text.includes("file")) return "file";
  return "process";
}

export function normalizeBridgeEvent(value: unknown, source = "bridge"): OplBridgeEvent {
  const record = asRecord(value);
  const method = asString(record?.method);
  if (method) {
    const params = asRecord(record?.params) ?? {};
    const item = asRecord(params.item);
    return {
      method,
      params,
      source,
      eventKind: classifyEventKind(method, params),
      summary: method,
      turnId: asString(params.turnId) ?? asString(asRecord(params.turn)?.id),
      delta: asString(params.delta),
      itemText: asString(item?.text),
      raw: value
    };
  }
  const type = asString(record?.type) ?? "bridge.event";
  return {
    type,
    source,
    eventKind: classifyEventKind(type, record),
    summary: type,
    raw: value
  };
}

export function parseEventSourceMessage(data: string, source = "web_transport_sse"): OplBridgeEvent {
  return normalizeBridgeEvent(parseJsonValue(data) ?? { type: "bridge.event", data }, source);
}

export function createBrowserBridge(): OplBridge {
  const candidate = ((globalThis as Record<string, unknown>).window as { oplNativeWorkbench?: OplNativeWorkbenchSurface } | undefined)
    ?.oplNativeWorkbench;
  return {
    readState(profile = readRuntimeProfile()) {
      const normalizedProfile = normalizeProfile(profile);
      const promise = candidate?.readState?.(normalizedProfile) ?? Promise.resolve(defaultStateReadback(normalizedProfile));
      return Promise.resolve(promise).then((value) => normalizeStateReadback(value, normalizedProfile));
    },
    readFullDrilldown() {
      const promise = candidate?.readFullDrilldown?.() ?? Promise.resolve(defaultFullDrilldown());
      return Promise.resolve(promise).then(normalizeFullDrilldownReadback);
    },
    executeAction(request) {
      const promise = candidate?.executeAction?.(request) ?? Promise.resolve(createPlaceholderActionReceipt(request));
      return Promise.resolve(promise).then((value) => normalizeActionReceipt(value, request));
    },
    readCodexModels() {
      const promise = candidate?.readCodexModels?.() ?? Promise.resolve({ models: [], simulated: true });
      return Promise.resolve(promise).then(normalizeCodexModelCatalog);
    },
    sendMessage(request) {
      const promise = candidate?.sendMessage?.(request) ?? Promise.resolve({
        command: CODEX_APP_SERVER.transport,
        initialize: CODEX_APP_SERVER.initialize,
        threadStart: CODEX_APP_SERVER.threadStart,
        turnStart: CODEX_APP_SERVER.turnStart,
        resume: CODEX_APP_SERVER.resume,
        turnStarted: CODEX_APP_SERVER.turnStarted,
        streamEvent: CODEX_APP_SERVER.streamEvent,
        itemCompleted: CODEX_APP_SERVER.itemCompleted,
        turnCompleted: CODEX_APP_SERVER.turnCompleted,
        threadId: request.threadId ?? "simulated-thread",
        turnId: "simulated-turn",
        finalMessage: "Preview-only browser placeholder reply. Native bridge unavailable.",
        eventCount: 4,
        completed: {
          turn: {
            id: "simulated-turn",
            status: "preview_only"
          }
        },
        defaultSandbox: CODEX_APP_SERVER.defaultSandbox,
        approvalPolicy: CODEX_APP_SERVER.approvalPolicy,
        prompt: request.prompt,
        executor: "codex_app_server",
        simulated: true
      });
      return Promise.resolve(promise).then((value) => normalizeSendMessageResponse(value, request));
    },
    listThreads(request: ThreadListRequest = {}) {
      const promise = candidate?.listThreads?.(request) ?? Promise.resolve({ data: [], nextCursor: null });
      return Promise.resolve(promise).then(normalizeThreadListResult);
    },
    readThread(request: ThreadReadRequest) {
      const promise = candidate?.readThread?.(request) ?? Promise.resolve({
        id: request.threadId,
        status: { type: "notLoaded" },
        sessionId: request.threadId,
        projectKey: null,
        hostId: "local",
        summary: "",
        workspace: "",
        owner: "user",
        goal: "",
        archived: false,
        parentThreadId: null,
        ancestorThreadIds: [],
        writeSet: [],
        createdAt: 0,
        updatedAt: 0,
        turns: []
      });
      return Promise.resolve(promise).then(normalizeCoordinationThread);
    },
    resumeThread(request: ThreadResumeRequest) {
      const promise = candidate?.resumeThread?.(request) ?? Promise.resolve({
        id: request.threadId,
        status: { type: "notLoaded" },
        sessionId: request.threadId,
        projectKey: null,
        hostId: "local",
        summary: "",
        workspace: "",
        owner: "user",
        goal: "",
        archived: false,
        parentThreadId: null,
        ancestorThreadIds: [],
        writeSet: [],
        createdAt: 0,
        updatedAt: 0,
        turns: []
      });
      return Promise.resolve(promise).then(normalizeCoordinationThread);
    },
    prepareCoordination(request: CoordinationRequest) {
      const promise = candidate?.prepareCoordination?.(request) ?? Promise.resolve({
        state: "rejected",
        request,
        targetWriteSet: [],
        permissionDecision: "denied",
        guard: { code: "permission_denied", message: "native coordination host unavailable" },
        preparedAt: new Date().toISOString()
      });
      return Promise.resolve(promise).then((value) => normalizeCoordinationPreparation(value, request));
    },
    dispatchCoordination(request: DispatchCoordinationRequest) {
      const promise = candidate?.dispatchCoordination?.(request) ?? Promise.resolve({
        coordinationId: request.previewToken,
        state: "rejected",
        targetThreadId: "",
        guard: { code: "permission_denied", message: "native coordination host unavailable" },
        dispatchedAt: new Date().toISOString()
      });
      return Promise.resolve(promise).then(normalizeCoordinationDispatch);
    },
    forkThread(request: ThreadForkRequest) {
      const promise = candidate?.forkThread?.(request) ?? Promise.resolve({
        id: "",
        status: { type: "notLoaded" },
        sessionId: "",
        projectKey: null,
        hostId: "local",
        summary: "",
        workspace: "",
        owner: "user",
        goal: "",
        archived: false,
        parentThreadId: null,
        ancestorThreadIds: [],
        writeSet: [],
        createdAt: 0,
        updatedAt: 0,
        turns: []
      });
      return Promise.resolve(promise).then(normalizeCoordinationThread);
    },
    setArchived(request: SetArchivedRequest) {
      const promise = candidate?.setArchived?.(request) ?? Promise.resolve(request);
      return Promise.resolve(promise).then(() => ({ threadId: request.threadId, archived: request.archived }));
    },
    waitCoordination(request: WaitCoordinationRequest) {
      const promise = candidate?.waitCoordination?.(request) ?? Promise.resolve({
        coordinationId: request.coordinationId,
        state: "failed",
        targetThreadId: "",
        updatedAt: new Date().toISOString()
      });
      return Promise.resolve(promise).then(normalizeCoordinationWaitResult);
    },
    subscribeThreadEvents(onEvent) {
      if (candidate?.subscribeThreadEvents) {
        return candidate.subscribeThreadEvents((event) => onEvent(normalizeThreadCoordinationEvent(event)));
      }
      if (candidate?.subscribeEvents) {
        return candidate.subscribeEvents((event) => {
          const normalized = normalizeThreadCoordinationEvent(event);
          if (normalized.threadId || normalized.method.startsWith("coordination/")) onEvent(normalized);
        });
      }
      return () => undefined;
    },
    subscribeEvents(onEvent) {
      if (candidate?.subscribeEvents) {
        return candidate.subscribeEvents((event) => onEvent(normalizeBridgeEvent(event, "native_bridge")));
      }
      onEvent(normalizeBridgeEvent({ type: "bridge.preview_only", source: "browser-placeholder" }, "browser-placeholder"));
      return () => undefined;
    }
  };
}
