import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const main = fs.readFileSync(path.join(root, "desktop", "main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "desktop", "preload.cjs"), "utf8");
const settingsPanel = fs.readFileSync(path.join(root, "src", "workbench", "SettingsPanel.tsx"), "utf8");

test("Electron is a thin, isolated adapter over the shared host core", () => {
  assert.match(main, /createOplHostCore/);
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /ipcMain\.handle\("opl:invoke"/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\("oplStudio"/);
  assert.match(preload, /ipcRenderer\.invoke\("opl:invoke"/);
  assert.doesNotMatch(main, /AionCore|AionUI/);
});

test("Electron owns the App carrier log directory exposed in diagnostics", () => {
  assert.match(main, /app\.getPath\("logs"\)/);
  assert.match(main, /carrierDiagnostics:/);
  assert.match(main, /owner: "one-person-lab-app_desktop_host"/);
  assert.match(settingsPanel, /App 载体日志/);
  assert.match(settingsPanel, /Framework 运行时日志/);
  assert.doesNotMatch(settingsPanel, /label=\{settings\.locale === "zh" \? "日志" : "Logs"\}/);
});
