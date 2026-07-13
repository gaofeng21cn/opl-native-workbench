export type CodexThreadRuntimeStatus =
  | { type: "notLoaded" }
  | { type: "idle" }
  | { type: "systemError" }
  | { type: "active"; activeFlags: string[] };

export type CoordinationThreadState = "unloaded" | "idle" | "running" | "system_error";
export type CoordinationPriority = "normal" | "urgent";
export type CoordinationDispatchKind = "started" | "steered" | "queued";
export type CoordinationTerminalState = "completed" | "failed" | "cancelled" | "rejected" | "wait_timeout";
export type CoordinationPermissionDecision = "preauthorized" | "confirmation_required" | "confirmed" | "denied";
export type CoordinationIntent = "delegate" | "inform" | "review" | "block" | "handoff";
export type CoordinationSender = "user" | "model" | "system_rule";
export type CoordinationGuardCode =
  | "offline"
  | "permission_denied"
  | "duplicate_rejected"
  | "loop_rejected"
  | "scope_mismatch"
  | "write_set_conflict"
  | "stale_status"
  | "archived_target"
  | "protocol_incompatible"
  | "dispatch_failed"
  | "wait_timeout";

export type CodexTurn = Record<string, unknown> & {
  id: string;
  status: "completed" | "interrupted" | "failed" | "inProgress";
};

export type CoordinationThread = Record<string, unknown> & {
  id: string;
  sessionId: string;
  projectKey: string | null;
  hostId: string;
  status: CodexThreadRuntimeStatus;
  state: CoordinationThreadState;
  summary: string;
  workspace: string;
  owner: string;
  goal: string;
  archived: boolean;
  parentThreadId: string | null;
  ancestorThreadIds: string[];
  writeSet: string[];
  createdAt: number;
  updatedAt: number;
  turns: CodexTurn[];
  activeTurnId?: string;
};

export type ThreadListRequest = {
  projectKey?: string;
  hostId?: string;
  archived?: boolean;
  workspace?: string | string[];
  limit?: number;
  searchTerm?: string;
};

export type ThreadListResult = { data: CoordinationThread[]; nextCursor: null };
export type ThreadReadRequest = { threadId: string; includeTurns?: boolean };
export type ThreadResumeRequest = { threadId: string };
export type ThreadForkRequest = { threadId: string; throughTurnId?: string };
export type SetArchivedRequest = { threadId: string; archived: boolean; confirmed?: boolean; confirmationId?: string };

export type CoordinationRequest = {
  sourceThreadId: string;
  targetThreadId: string;
  sourceHostId: string;
  targetHostId: string;
  projectKey?: string | null;
  sender: CoordinationSender;
  intent: CoordinationIntent;
  reason: string;
  message: string;
  summary: string;
  expectedWriteSet: string[];
  ancestorCoordinationIds: string[];
  priority: CoordinationPriority;
  dedupeKey: string;
  hopCount: number;
  model?: string;
  reasoningEffort?: string;
};

export type CoordinationGuardFailure = { code: CoordinationGuardCode; message: string };

export type CoordinationPreparation = {
  state: "prepared" | "confirmation_required" | "rejected";
  coordinationId?: string;
  previewToken?: string;
  request: CoordinationRequest;
  target?: CoordinationThread;
  targetWriteSet: string[];
  plannedDispatch?: CoordinationDispatchKind;
  permissionDecision: CoordinationPermissionDecision;
  guard?: CoordinationGuardFailure;
  preparedAt: string;
};

export type DispatchCoordinationRequest = {
  previewToken: string;
  confirmed?: boolean;
  confirmationId?: string;
};

export type CoordinationDispatch = {
  coordinationId: string;
  state: CoordinationDispatchKind | "rejected";
  targetThreadId: string;
  turnId?: string;
  protocolMethod?: "thread/resume+turn/start" | "turn/start" | "turn/steer" | "host_queue";
  guard?: CoordinationGuardFailure;
  dispatchedAt: string;
};

export type WaitCoordinationRequest = { coordinationId: string; timeoutMs?: number };

export type CoordinationWaitResult = {
  coordinationId: string;
  state: CoordinationDispatchKind | CoordinationTerminalState;
  targetThreadId: string;
  turnId?: string;
  resultSummaryOrRef?: string;
  updatedAt: string;
};

export type ThreadCoordinationEvent = {
  method: string;
  threadId?: string;
  coordinationId?: string;
  state?: CoordinationThreadState | CoordinationDispatchKind | CoordinationTerminalState | CoordinationPreparation["state"];
  raw: unknown;
};

export type DynamicToolFunctionSpec = {
  type: "function";
  name: string;
  description: string;
  inputSchema: unknown;
  deferLoading?: boolean;
};

export type DynamicToolCallParams = {
  threadId: string;
  turnId: string;
  callId: string;
  namespace: string | null;
  tool: string;
  arguments: unknown;
};

export type DynamicToolCallResponse = {
  contentItems: Array<{ type: "inputText"; text: string }>;
  success: boolean;
};

export interface ThreadCoordinationBridge {
  listThreads(request?: ThreadListRequest): Promise<ThreadListResult>;
  readThread(request: ThreadReadRequest): Promise<CoordinationThread>;
  resumeThread(request: ThreadResumeRequest): Promise<CoordinationThread>;
  prepareCoordination(request: CoordinationRequest): Promise<CoordinationPreparation>;
  dispatchCoordination(request: DispatchCoordinationRequest): Promise<CoordinationDispatch>;
  forkThread(request: ThreadForkRequest): Promise<CoordinationThread>;
  setArchived(request: SetArchivedRequest): Promise<{ threadId: string; archived: boolean }>;
  waitCoordination(request: WaitCoordinationRequest): Promise<CoordinationWaitResult>;
  subscribeThreadEvents(onEvent: (event: ThreadCoordinationEvent) => void): () => void;
}
