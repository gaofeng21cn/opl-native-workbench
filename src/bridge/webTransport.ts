import {
  normalizeBridgeEvent,
  parseEventSourceMessage,
  type OplBridgeEvent,
  type OplNativeWorkbenchSurface
} from "./oplBridge";
import type {
  CoordinationDispatch,
  CoordinationPreparation,
  CoordinationRequest,
  CoordinationWaitResult,
  ThreadCoordinationBridge,
  ThreadCoordinationEvent,
  ThreadListResult
} from "../coordination";

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
  onEvent: (event: ThreadCoordinationEvent) => void
): () => void {
  const source = new EventSource(eventSourceUrl);
  source.onmessage = (message) => {
    try {
      const value = JSON.parse(message.data);
      const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
      onEvent({
        method: typeof record.method === "string" ? record.method : "host/event",
        threadId: typeof record.threadId === "string" ? record.threadId : undefined,
        coordinationId: typeof record.coordinationId === "string" ? record.coordinationId : undefined,
        state: typeof record.state === "string" ? record.state as ThreadCoordinationEvent["state"] : undefined,
        raw: record.raw ?? record.params ?? value
      });
    } catch {
      onEvent({ method: "host/protocol-error", raw: message.data });
    }
  };
  source.onerror = () => onEvent({ method: "host/availability", raw: { available: false } });
  return () => source.close();
}

function coordinationBridge(): ThreadCoordinationBridge {
  return {
    listThreads: (request = {}) => postJson<ThreadListResult>("/api/threads/list", request),
    readThread: (request) => postJson("/api/threads/read", request),
    resumeThread: (request) => postJson("/api/threads/resume", request),
    prepareCoordination: (request: CoordinationRequest) => postJson<CoordinationPreparation>("/api/coordination/prepare", request),
    dispatchCoordination: (request) => postJson<CoordinationDispatch>("/api/coordination/dispatch", request),
    forkThread: (request) => postJson("/api/threads/fork", request),
    setArchived: (request) => postJson(request.archived ? "/api/threads/archive" : "/api/threads/unarchive", request),
    waitCoordination: (request) => postJson<CoordinationWaitResult>("/api/coordination/wait", request),
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
  Object.assign(surface, coordinationBridge());
  window.oplNativeWorkbench = surface;

  void requestJson<{
    localHost: boolean;
    threadCoordination: WebCapability;
  }>("/api/capabilities").then((capabilities) => {
    if (!capabilities.localHost || !capabilities.threadCoordination.available) return;
    surface.threadCoordinationCapability = capabilities.threadCoordination;
  }).catch(() => {
    // Static/browser-only builds intentionally do not declare coordination capability.
  });
}
