import {
  normalizeBridgeEvent,
  parseEventSourceMessage,
  type OplBridgeEvent,
  type OplNativeWorkbenchSurface
} from "./oplBridge";

type WebSurface = OplNativeWorkbenchSurface;

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
    listThreads: (request = {}) => postJson("/api/threads/list", request),
    readThread: (request) => postJson("/api/threads/read", request),
    resumeThread: (request) => postJson("/api/threads/resume", request),
    forkThread: (request) => postJson("/api/threads/fork", request),
    setArchived: (request) => postJson(request.archived ? "/api/threads/archive" : "/api/threads/unarchive", request),
    subscribeEvents,
    connectEvents: subscribeEvents
  };
  window.oplNativeWorkbench = surface;
}
