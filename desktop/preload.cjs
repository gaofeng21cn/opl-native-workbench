const { contextBridge, ipcRenderer } = require("electron");

const invoke = (method, payload = {}) => ipcRenderer.invoke("opl:invoke", { method, payload });
const subscriptions = new Map();

function subscribeEvents(listener) {
  const wrapped = (_event, payload) => listener(payload);
  subscriptions.set(listener, wrapped);
  ipcRenderer.on("opl:event", wrapped);
  return () => {
    const active = subscriptions.get(listener);
    if (active) ipcRenderer.removeListener("opl:event", active);
    subscriptions.delete(listener);
  };
}

contextBridge.exposeInMainWorld("oplStudio", {
  eventSourceUrl: "electron://opl",
  beginWindowDrag: () => invoke("beginWindowDrag"),
  readState: (profile = "fast") => invoke("readState", { profile }),
  readFullDrilldown: () => invoke("readFullDrilldown"),
  readContribution: (request) => invoke("readContribution", request),
  executeAction: (request) => invoke("executeAction", request),
  readCodexModels: () => invoke("readCodexModels"),
  readCodexCapabilities: (threadId) => invoke("readCodexCapabilities", { threadId }),
  readCodexPermissionProfiles: () => invoke("readCodexPermissionProfiles"),
  pickFiles: () => invoke("pickFiles"),
  pickDirectory: () => invoke("pickDirectory"),
  setLogDirectory: (request) => invoke("setLogDirectory", request),
  sendMessage: (request) => invoke("sendMessage", request),
  steerTurn: (request) => invoke("steerTurn", request),
  interruptTurn: (request) => invoke("interruptTurn", request),
  loginGatewayAccount: (request) => invoke("loginGatewayAccount", request),
  readNativeAppUpdateStatus: () => invoke("readNativeAppUpdateStatus"),
  checkNativeAppUpdate: () => invoke("checkNativeAppUpdate"),
  applyNativeAppUpdate: () => invoke("applyNativeAppUpdate"),
  restartNativeApp: () => invoke("restartNativeApp"),
  listThreads: (request = {}) => invoke("listThreads", request),
  readThread: (request) => invoke("readThread", request),
  resumeThread: (request) => invoke("resumeThread", request),
  forkThread: (request) => invoke("forkThread", request),
  setArchived: (request) => invoke("setArchived", request),
  subscribeEvents,
  connectEvents: subscribeEvents
});
