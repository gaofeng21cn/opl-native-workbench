import {
  normalizeBridgeEvent,
  parseEventSourceMessage,
  type OplBridgeEvent,
  type OplNativeWorkbenchSurface
} from "./oplBridge";

export type ThreadScope = {
  projectKey?: string;
  hostId?: string;
  archived?: boolean;
  workspace?: string | string[];
  limit?: number;
  searchTerm?: string;
};

export type ThreadProjection = Record<string, unknown> & {
  id: string;
  sessionId: string;
  projectKey: string;
  hostId: string;
  status: { type: "notLoaded" | "idle" | "systemError" | "active"; activeFlags?: string[] };
  state: "unloaded" | "idle" | "running" | "system_error";
  summary: string;
  workspace: string;
  owner: string;
  goal: string;
  archived: boolean;
  parentThreadId: string | null;
  ancestorThreadIds: string[];
  parent: string | null;
  ancestors: string[];
  activeTurn: Record<string, unknown> | null;
  activeTurnId?: string;
  writeSet: string[];
  createdAt: number;
  updatedAt: number;
  turns: Array<Record<string, unknown> & { id: string; status: string }>;
};

type CoordinationDraftBase = {
  sourceThreadId: string;
  targetThreadId: string;
  sender: "user" | "model" | "system_rule";
  intent: "delegate" | "inform" | "review" | "block" | "handoff";
  reason: string;
  message: string;
  expectedWriteSet: string[];
  ancestorCoordinationIds: string[];
  priority: "normal" | "urgent";
  permissionDecision: "preauthorized" | "confirmation_required" | "confirmed" | "denied";
  hopCount: number;
  targetWriteSet?: string[];
};

export type CoordinationDraft = CoordinationDraftBase & ({
  messageSummary: string;
  idempotencyKey: string;
  project: { key: string } & Record<string, unknown>;
  host: { sourceHostId: string; targetHostId: string } & Record<string, unknown>;
  summary?: string;
  dedupeKey?: string;
  projectKey?: string;
  sourceHostId?: string;
  targetHostId?: string;
} | {
  summary: string;
  dedupeKey: string;
  projectKey: string;
  sourceHostId: string;
  targetHostId: string;
  messageSummary?: string;
  idempotencyKey?: string;
  project?: { key: string } & Record<string, unknown>;
  host?: { sourceHostId: string; targetHostId: string } & Record<string, unknown>;
});

export type CoordinationPreview = {
  state: "prepared" | "confirmation_required" | "rejected";
  previewToken: string;
  request: CoordinationDraft;
  target?: ThreadProjection;
  plannedDispatch?: "started" | "steered" | "queued";
  permissionDecision: CoordinationDraft["permissionDecision"];
  guard?: { code: string; message: string };
  preparedAt: string;
  expiresAt: string;
};

export type CoordinationReceipt = {
  coordinationId: string;
  state: "started" | "steered" | "queued" | "completed" | "failed" | "cancelled" | "rejected" | "wait_timeout";
  targetThreadId: string;
  turnId?: string;
  protocolMethod?: "thread/resume+turn/start" | "turn/start" | "turn/steer" | "host_queue";
  resultSummaryOrRef?: string;
  guard?: { code: string; message: string };
  updatedAt: string;
};

type ThreadCoordinationBridge = {
  listThreads(request?: ThreadScope): Promise<{ data: ThreadProjection[]; nextCursor: null }>;
  readThread(request: { threadId: string; includeTurns?: boolean }): Promise<ThreadProjection>;
  resumeThread(request: { threadId: string }): Promise<ThreadProjection>;
  prepareCoordination(request: CoordinationDraft): Promise<CoordinationPreview>;
  dispatchCoordination(request: { previewToken: string; confirmed?: boolean; confirmationId?: string }): Promise<CoordinationReceipt>;
  forkThread(request: { threadId: string; throughTurnId?: string }): Promise<ThreadProjection>;
  setArchived(request: { threadId: string; archived: boolean; confirmed?: boolean; confirmationId?: string }): Promise<{ threadId: string; archived: boolean }>;
  waitCoordination(request: { coordinationId: string; timeoutMs?: number }): Promise<CoordinationReceipt>;
  subscribeThreadEvents(onEvent: (event: Record<string, unknown>) => void): () => void;
};

type WebCapability = {
  available: boolean;
  transport: string;
  dynamicTools: "unprobed" | "available" | "unavailable";
};

type WebSurface = OplNativeWorkbenchSurface & Partial<ThreadCoordinationBridge> & {
  threadCoordinationCapability?: WebCapability;
};

class WebTransportError extends Error {
  code: string;
  details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "WebTransportError";
    this.code = code;
    this.details = details;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new WebTransportError("local_host_unavailable", "Local WebUI host is unavailable", {
      cause: String(error)
    });
  }
  const value = await response.json() as T & {
    error?: { code?: string; message?: string; details?: Record<string, unknown> };
  };
  if (!response.ok || value.error) {
    throw new WebTransportError(
      value.error?.code ?? "web_transport_error",
      value.error?.message ?? `Web transport failed with HTTP ${response.status}`,
      value.error?.details
    );
  }
  return value;
}

function postJson<T>(url: string, value: unknown): Promise<T> {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value)
  });
}

function connectServerEvents(
  eventSourceUrl: string,
  onEvent: (event: OplBridgeEvent) => void
): () => void {
  const source = new EventSource(eventSourceUrl);
  source.onopen = () => onEvent(normalizeBridgeEvent({ type: "bridge.ready", source: eventSourceUrl }, "web_transport_sse"));
  source.onmessage = (message) => onEvent(parseEventSourceMessage(message.data, "web_transport_sse"));
  source.onerror = () => onEvent(normalizeBridgeEvent({ type: "bridge.error", source: eventSourceUrl }, "web_transport_sse"));
  return () => source.close();
}

function connectThreadEvents(
  eventSourceUrl: string,
  onEvent: (event: Record<string, unknown>) => void
): () => void {
  const source = new EventSource(eventSourceUrl);
  source.onmessage = (message) => {
    try {
      const value = JSON.parse(message.data);
      onEvent(value && typeof value === "object" ? value as Record<string, unknown> : { method: "host/event", raw: value });
    } catch {
      onEvent({ method: "host/protocol-error", raw: message.data });
    }
  };
  source.onerror = () => onEvent({ method: "host/availability", raw: { available: false } });
  return () => source.close();
}

function coordinationBridge(): ThreadCoordinationBridge {
  return {
    listThreads: (request = {}) => postJson("/api/threads/list", request),
    readThread: (request) => postJson("/api/threads/read", request),
    resumeThread: (request) => postJson("/api/threads/resume", request),
    prepareCoordination: (request) => postJson("/api/coordination/prepare", request),
    dispatchCoordination: (request) => postJson("/api/coordination/dispatch", request),
    forkThread: (request) => postJson("/api/threads/fork", request),
    setArchived: (request) => postJson(request.archived ? "/api/threads/archive" : "/api/threads/unarchive", request),
    waitCoordination: (request) => postJson("/api/coordination/wait", request),
    subscribeThreadEvents: (onEvent) => connectThreadEvents("/api/coordination/events", onEvent)
  };
}

export function installWebTransport(): void {
  const eventSourceUrl = "/api/opl-events";
  const subscribeEvents = (onEvent: (event: OplBridgeEvent) => void) => connectServerEvents(eventSourceUrl, onEvent);
  const surface: WebSurface = {
    eventSourceUrl,
    readState: (profile = "fast") => requestJson(`/api/opl/state?profile=${encodeURIComponent(profile)}`),
    readFullDrilldown: () => requestJson("/api/opl/drilldown"),
    executeAction: (request) => postJson("/api/opl/action", request),
    readCodexModels: () => requestJson("/api/codex/models"),
    sendMessage: (request) => postJson("/api/send-message", request),
    subscribeEvents,
    connectEvents: subscribeEvents
  };
  window.oplNativeWorkbench = surface;

  void requestJson<{
    localHost: boolean;
    threadCoordination: WebCapability;
  }>("/api/capabilities").then((capabilities) => {
    if (!capabilities.localHost || !capabilities.threadCoordination.available) return;
    surface.threadCoordinationCapability = capabilities.threadCoordination;
    Object.assign(surface, coordinationBridge());
  }).catch(() => {
    // Static/browser-only builds intentionally do not declare coordination capability.
  });
}
