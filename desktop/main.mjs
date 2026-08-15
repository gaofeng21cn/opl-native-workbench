import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import updaterPackage from "electron-updater";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createOplHostCore } from "../scripts/webui-host/host-core.mjs";
import { captureDesktopAccessibility } from "./accessibility-qualification.mjs";
import { createAppLogDirectoryController } from "./app-log-directory.mjs";
import { createShutdownController } from "./shutdown.mjs";
import {
  configureDesktopUpdaterQualification,
  configureDesktopUpdaterQualificationState,
  createDesktopUpdater
} from "./updater.mjs";

const { autoUpdater } = updaterPackage;
const desktopRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(desktopRoot, "..");
const rendererIndex = path.join(repositoryRoot, "dist", "desktop", "index.html");
let hostCore;
let installingUpdate = false;
let updaterQualificationEnabled = false;
configureDesktopUpdaterQualificationState({
  electronApp: app,
  stateRoot: process.env.OPL_DESKTOP_UPDATE_QUALIFICATION_STATE_ROOT
});
const shutdown = createShutdownController({
  close: async () => {
    ipcMain.removeHandler("opl:invoke");
    await hostCore?.close();
  },
  quit: () => app.quit()
});

function trustedRendererUrl(url) {
  try {
    const candidate = new URL(url);
    candidate.hash = "";
    candidate.search = "";
    return candidate.href === pathToFileURL(rendererIndex).href;
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "One Person Lab",
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" } : {}),
    webPreferences: {
      preload: path.join(desktopRoot, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.once("ready-to-show", async () => {
    window.show();
    if (typeof process.send === "function") {
      let accessibilityQualification = null;
      if (process.env.OPL_DESKTOP_ACCESSIBILITY_QUALIFICATION === "1") {
        try {
          accessibilityQualification = await captureDesktopAccessibility(window.webContents);
        } catch (error) {
          accessibilityQualification = {
            schema: "opl_desktop_chromium_ax_tree_smoke.v1",
            status: "failed",
            detail: error instanceof Error ? error.message : String(error)
          };
        }
      }
      process.send({
        type: "opl-desktop-ready",
        visible: window.isVisible(),
        windowCount: BrowserWindow.getAllWindows().length,
        accessibilityQualification
      });
    }
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!trustedRendererUrl(url)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  void window.loadFile(rendererIndex);
  return window;
}

async function createDesktopHost(appLogDirectory) {
  const updateConfigAvailable = fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
  updaterQualificationEnabled = configureDesktopUpdaterQualification({
    autoUpdater,
    feedUrl: process.env.OPL_DESKTOP_UPDATE_QUALIFICATION_FEED_URL
  });
  let core;
  const desktopUpdater = createDesktopUpdater({
    autoUpdater,
    isPackaged: app.isPackaged,
    updateConfigAvailable,
    currentVersion: app.getVersion(),
    beforeRestart: async () => {
      await core?.close();
      ipcMain.removeHandler("opl:invoke");
      installingUpdate = true;
    }
  });
  core = await createOplHostCore({
    platform: {
      pickFiles: async () => {
        const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] });
        return result.canceled ? [] : result.filePaths;
      },
      pickDirectory: async () => {
        const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
        const directory = result.filePaths[0];
        return result.canceled || !directory
          ? []
          : [{ kind: "folder", name: path.basename(directory), path: directory }];
      }
    },
    carrierDiagnostics: {
      read: async () => ({
        schema: "opl_app_carrier_diagnostics.v1",
        owner: "one-person-lab-app_desktop_host",
        carrier: "electron_desktop",
        status: "available",
        application: { systemInfo: { logDir: app.getPath("logs") } },
        setLogDirectorySupported: true
      }),
      setLogDirectory: (request) => appLogDirectory.setLogDirectory(request)
    },
    nativeUpdater: desktopUpdater
  });

  ipcMain.handle("opl:invoke", async (event, request) => {
    if (!trustedRendererUrl(event.senderFrame.url)) {
      throw new Error("Untrusted renderer cannot invoke the OPL host");
    }
    return core.invoke(request?.method, request?.payload ?? {});
  });
  core.on("event", (event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send("opl:event", event);
    }
  });
  return { core, desktopUpdater };
}

app.whenReady().then(async () => {
  const appLogDirectory = createAppLogDirectoryController({ electronApp: app });
  await appLogDirectory.restore();
  const desktopHost = await createDesktopHost(appLogDirectory);
  hostCore = desktopHost.core;
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  if (desktopHost.desktopUpdater.snapshot().supported && !updaterQualificationEnabled) {
    void desktopHost.desktopUpdater.perform("check").catch(() => undefined);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (installingUpdate) return;
  if (!shutdown.exitAllowed) void shutdown.request(event);
});

if (typeof process.send === "function") {
  process.on("message", async (message) => {
    if (message?.type === "opl-desktop-smoke-quit") app.quit();
    if (message?.type === "opl-desktop-update-qualification" && updaterQualificationEnabled) {
      const methods = {
        status: "readNativeAppUpdateStatus",
        check: "checkNativeAppUpdate",
        apply: "applyNativeAppUpdate",
        restart: "restartNativeApp"
      };
      const method = methods[message.operation];
      if (!method) return;
      try {
        const result = await hostCore.invoke(method);
        process.send?.({ type: "opl-desktop-update-qualification-result", operation: message.operation, result });
      } catch (error) {
        process.send?.({
          type: "opl-desktop-update-qualification-result",
          operation: message.operation,
          error: error?.message ?? String(error)
        });
      }
    }
  });
}
