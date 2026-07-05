import {
  createBrowserBridge,
  normalizeBridgeEvent,
  parseEventSourceMessage,
  type OplBridgeEvent,
  type OplNativeWorkbenchSurface
} from "./oplBridge";

declare global {
  interface Window {
    oplNativeWorkbench?: OplNativeWorkbenchSurface;
  }
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
  const bridge = createBrowserBridge();
  const subscribeEvents = (onEvent: (event: OplBridgeEvent) => void) => connectServerEvents(eventSourceUrl, onEvent);
  window.oplNativeWorkbench = {
    ...bridge,
    eventSourceUrl,
    subscribeEvents,
    connectEvents: subscribeEvents
  };
}
