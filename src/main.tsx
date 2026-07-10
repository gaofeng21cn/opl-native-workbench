import { createRoot } from "react-dom/client";
import type { OplBridgeEvent, OplNativeWorkbenchSurface } from "./bridge/oplBridge";
import { installWebTransport } from "./bridge/webTransport";
import App from "./workbench/App";

declare global {
  interface Window {
    __oplNativeWorkbenchResolve?: (id: string, ok: boolean, payload: unknown) => void;
    __oplNativeWorkbenchEvent?: (event: unknown) => void;
    oplNativeWorkbench?: OplNativeWorkbenchSurface;
    webkit?: {
      messageHandlers?: {
        oplNativeWorkbench?: {
          postMessage(message: unknown): void;
        };
      };
    };
  }
}

type PendingRequest = {
  resolve(value: unknown): void;
  reject(reason?: unknown): void;
};

function installNativeTransport(): boolean {
  const handler = window.webkit?.messageHandlers?.oplNativeWorkbench;
  if (!handler || window.oplNativeWorkbench) return false;

  const pending = new Map<string, PendingRequest>();
  const listeners = new Set<(event: OplBridgeEvent) => void>();

  const post = (method: string, payload: Record<string, unknown> = {}) =>
    new Promise<unknown>((resolve, reject) => {
      const id = globalThis.crypto?.randomUUID?.() ?? `${method}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      pending.set(id, { resolve, reject });
      handler.postMessage({ id, method, payload });
    });

  window.__oplNativeWorkbenchResolve = (id, ok, payload) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (ok) {
      request.resolve(payload);
      return;
    }
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: unknown }).error ?? "native bridge error")
        : "native bridge error";
    request.reject(new Error(message));
  };

  window.__oplNativeWorkbenchEvent = (event) => {
    listeners.forEach((listener) => listener(event as OplBridgeEvent));
  };

  const subscribeEvents = (onEvent: (event: OplBridgeEvent) => void) => {
    listeners.add(onEvent);
    return () => listeners.delete(onEvent);
  };

  window.oplNativeWorkbench = {
    eventSourceUrl: "native://oplNativeWorkbench",
    readState: (profile) => post("readState", { profile }),
    readFullDrilldown: () => post("readFullDrilldown"),
    executeAction: (request) => post("executeAction", request as Record<string, unknown>),
    readCodexModels: () => post("readCodexModels"),
    sendMessage: (request) => post("sendMessage", request as Record<string, unknown>),
    subscribeEvents,
    connectEvents: subscribeEvents
  };
  return true;
}

if (!installNativeTransport() && window.location.protocol !== "file:") {
  installWebTransport();
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("missing #root renderer mount");
}

createRoot(rootElement).render(<App />);
