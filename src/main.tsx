import { createRoot } from "react-dom/client";
import "./integrations/deepseek-harness/theme";
import type { OplBridgeEvent, OplStudioSurface } from "./bridge/oplBridge";
import { installWebTransport } from "./bridge/webTransport";
import { renderOplStudioRoot } from "./composition/dshSlotHost";

declare global {
  interface Window {
    __oplStudioResolve?: (id: string, ok: boolean, payload: unknown) => void;
    __oplStudioEvent?: (event: unknown) => void;
    oplStudio?: OplStudioSurface;
    webkit?: {
      messageHandlers?: {
        oplStudio?: {
          postMessage(message: unknown): void;
        };
      };
    };
  }
}

type PendingRequest<T> = {
  resolve(value: T): void;
  reject(reason?: unknown): void;
};

function installNativeTransport(): boolean {
  const handler = window.webkit?.messageHandlers?.oplStudio;
  if (!handler || window.oplStudio) return false;

  const pending = new Map<string, PendingRequest<unknown>>();
  const listeners = new Set<(event: OplBridgeEvent) => void>();

  const post = <T,>(method: string, payload: Record<string, unknown> = {}) =>
    new Promise<T>((resolve, reject) => {
      const id = globalThis.crypto?.randomUUID?.() ?? `${method}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      pending.set(id, { resolve, reject });
      handler.postMessage({ id, method, payload });
    });

  window.__oplStudioResolve = (id, ok, payload) => {
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

  window.__oplStudioEvent = (event) => {
    listeners.forEach((listener) => listener(event as OplBridgeEvent));
  };

  const subscribeEvents = (onEvent: (event: OplBridgeEvent) => void) => {
    listeners.add(onEvent);
    return () => listeners.delete(onEvent);
  };

  window.oplStudio = {
    eventSourceUrl: "native://oplStudio",
    beginWindowDrag: () => {
      void post("beginWindowDrag").catch(() => undefined);
    },
    readState: (profile) => post("readState", { profile }),
    readFullDrilldown: () => post("readFullDrilldown"),
    readContribution: (request) => post("readContribution", request as Record<string, unknown>),
    executeAction: (request) => post("executeAction", request as Record<string, unknown>),
    readCodexModels: () => post("readCodexModels"),
    readCodexCapabilities: (threadId) => post("readCodexCapabilities", { threadId }),
    readCodexPermissionProfiles: () => post("readCodexPermissionProfiles"),
    pickFiles: () => post("pickFiles"),
    pickDirectory: () => post("pickDirectory"),
    sendMessage: (request) => post("sendMessage", request as Record<string, unknown>),
    listThreads: (request = {}) => post("listThreads", request),
    readThread: (request) => post("readThread", request),
    resumeThread: (request) => post("resumeThread", request),
    forkThread: (request) => post("forkThread", request),
    setArchived: (request) => post("setArchived", request),
    subscribeEvents,
    connectEvents: subscribeEvents
  };
  return true;
}

const nativeTransportInstalled = installNativeTransport();
document.documentElement.dataset.oplHost = nativeTransportInstalled ? "native" : "web";

if (!nativeTransportInstalled && window.location.protocol !== "file:") {
  installWebTransport();
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("missing #root renderer mount");
}

createRoot(rootElement).render(renderOplStudioRoot());
