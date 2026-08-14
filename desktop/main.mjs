import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import updaterPackage from "electron-updater";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createOplHostCore } from "../scripts/webui-host/host-core.mjs";
import { createShutdownController } from "./shutdown.mjs";
import { createDesktopUpdater } from "./updater.mjs";

const { autoUpdater } = updaterPackage;
const desktopRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(desktopRoot, "..");
const rendererIndex = path.join(repositoryRoot, "dist", "desktop", "index.html");
let hostCore;
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
  window.once("ready-to-show", () => {
    window.show();
    if (typeof process.send === "function") {
      process.send({
        type: "opl-desktop-ready",
        visible: window.isVisible(),
        windowCount: BrowserWindow.getAllWindows().length
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

async function createDesktopHost() {
  const updateConfigAvailable = fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
  const desktopUpdater = createDesktopUpdater({
    autoUpdater,
    isPackaged: app.isPackaged,
    updateConfigAvailable,
    currentVersion: app.getVersion()
  });
  const core = await createOplHostCore({
    platform: {
      pickFiles: async () => {
        const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] });
        return result.canceled ? [] : result.filePaths;
      },
      pickDirectory: async () => {
        const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
        return result.canceled ? null : result.filePaths[0] ?? null;
      }
    },
    carrierDiagnostics: {
      read: async () => ({
        schema: "opl_app_carrier_diagnostics.v1",
        owner: "one-person-lab-app_desktop_host",
        carrier: "electron_desktop",
        status: "available",
        logsDirectory: app.getPath("logs")
      })
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
  const desktopHost = await createDesktopHost();
  hostCore = desktopHost.core;
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  if (desktopHost.desktopUpdater.snapshot().supported) {
    void desktopHost.desktopUpdater.perform("check").catch(() => undefined);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (!shutdown.exitAllowed) void shutdown.request(event);
});

if (typeof process.send === "function") {
  process.on("message", (message) => {
    if (message?.type === "opl-desktop-smoke-quit") app.quit();
  });
}
