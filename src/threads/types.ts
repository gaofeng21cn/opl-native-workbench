export type CodexThreadRuntimeStatus =
  | { type: "notLoaded" }
  | { type: "idle" }
  | { type: "systemError" }
  | { type: "active"; activeFlags: string[] };

export type CodexThreadState = "unloaded" | "idle" | "running" | "system_error";

export type CodexTurn = Record<string, unknown> & {
  id: string;
  status: "completed" | "interrupted" | "failed" | "inProgress";
};

export type CodexThread = Record<string, unknown> & {
  id: string;
  sessionId: string;
  projectKey: string | null;
  status: CodexThreadRuntimeStatus;
  state: CodexThreadState;
  summary: string;
  workspace: string;
  archived: boolean;
  parentThreadId: string | null;
  agentRole?: string;
  agentNickname?: string;
  sourceKind?: string;
  createdAt: number;
  updatedAt: number;
  turns: CodexTurn[];
  activeTurnId?: string;
};

export type ThreadListRequest = {
  projectKey?: string;
  archived?: boolean;
  workspace?: string | string[];
  limit?: number;
  searchTerm?: string;
};

export type ThreadListResult = { data: CodexThread[]; nextCursor: null };
export type ThreadReadRequest = { threadId: string; includeTurns?: boolean };
export type ThreadResumeRequest = { threadId: string };
export type ThreadForkRequest = { threadId: string; throughTurnId?: string };
export type SetArchivedRequest = {
  threadId: string;
  archived: boolean;
  confirmed?: boolean;
  confirmationId?: string;
};

export interface CodexThreadAdapterBridge {
  listThreads(request?: ThreadListRequest): Promise<ThreadListResult>;
  readThread(request: ThreadReadRequest): Promise<CodexThread>;
  resumeThread(request: ThreadResumeRequest): Promise<CodexThread>;
  forkThread(request: ThreadForkRequest): Promise<CodexThread>;
  setArchived(request: SetArchivedRequest): Promise<{ threadId: string; archived: boolean }>;
}
