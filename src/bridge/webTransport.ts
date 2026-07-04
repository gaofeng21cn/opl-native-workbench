import { createBrowserBridge } from "./oplBridge";

declare global {
  interface Window {
    oplNativeWorkbench?: unknown;
  }
}

export function installWebTransport(): void {
  const eventSourceUrl = "/api/opl-events";
  window.oplNativeWorkbench = {
    bridge: createBrowserBridge(),
    eventSourceUrl,
    connectEvents(onEvent: (event: unknown) => void) {
      const source = new EventSource(eventSourceUrl);
      source.onmessage = (message) => onEvent(JSON.parse(message.data));
      return () => source.close();
    }
  };
}
