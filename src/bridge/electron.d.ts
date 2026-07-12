// The candidate keeps an Electron preload adapter for historical transport
// evidence, but the packaged runtime is the Swift/WKWebView host. Keep this
// compile-time surface local instead of adding Electron as a runtime payload.
declare module "electron" {
  export const contextBridge: {
    exposeInMainWorld(name: string, api: Record<string, unknown>): void;
  };

  export const ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
    off(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
  };
}
