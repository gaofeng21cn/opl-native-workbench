import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("oplNativeWorkbench", {
  readState: (profile = "fast") => ipcRenderer.invoke("opl:state", { profile }),
  readFullDrilldown: () => ipcRenderer.invoke("opl:full-drilldown"),
  executeAction: (request: unknown) => ipcRenderer.invoke("opl:action", request),
  subscribeEvents: (onEvent: (event: unknown) => void) => {
    const listener = (_event: unknown, payload: unknown) => onEvent(payload);
    ipcRenderer.on("opl:event", listener);
    return () => ipcRenderer.off("opl:event", listener);
  }
});
