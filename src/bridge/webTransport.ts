import { createBrowserBridge } from "./oplBridge";

declare global {
  interface Window {
    oplNativeWorkbench?: unknown;
  }
}

export function installWebTransport(): void {
  const eventSourceUrl = "/api/opl-events";
  const bridge = createBrowserBridge();
  window.oplNativeWorkbench = {
    ...bridge,
    eventSourceUrl,
    connectEvents(onEvent: (event: unknown) => void) {
      const source = new EventSource(eventSourceUrl);
      source.onmessage = (message) => onEvent(JSON.parse(message.data));
      return () => source.close();
    }
  };
}
