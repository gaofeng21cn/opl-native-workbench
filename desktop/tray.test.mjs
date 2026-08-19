import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  buildDesktopTrayMenu,
  createDesktopTray,
  readProjectedRunningCount,
  shouldCreateDesktopTray
} from "./tray.mjs";

test("macOS ordinary desktop enables the tray while IPC smoke launches stay isolated", () => {
  assert.equal(shouldCreateDesktopTray({ platform: "darwin", ipcConnected: false }), true);
  assert.equal(shouldCreateDesktopTray({ platform: "darwin", ipcConnected: true }), false);
  assert.equal(shouldCreateDesktopTray({ platform: "darwin", ipcConnected: true, force: true }), true);
  assert.equal(shouldCreateDesktopTray({ platform: "win32", ipcConnected: false }), false);
});

test("tray reads the bounded Host work-item projection for a global running count", () => {
  assert.equal(readProjectedRunningCount({
    app_state: {
      app_state: {
        operator: { workbench: { work_item_projection_v2: { summary: { running_count: 4.9 } } } }
      }
    }
  }), 4);
  assert.equal(readProjectedRunningCount({ app_state: { operator: { workbench: {} } } }), null);
});

test("tray menu exposes real window, runtime, recent-thread, update, restart, and quit actions", () => {
  const calls = [];
  const actions = {
    showWindow: () => calls.push("show"),
    hideWindow: () => calls.push("hide"),
    newTask: () => calls.push("new"),
    openRuntime: () => calls.push("runtime"),
    openThread: (id) => calls.push(`thread:${id}`),
    checkForUpdates: () => calls.push("update"),
    showAbout: () => calls.push("about"),
    restart: () => calls.push("restart"),
    quit: () => calls.push("quit")
  };
  const template = buildDesktopTrayMenu({
    locale: "zh",
    runningCount: 2,
    recentThreads: [{ id: "thread-1", name: "研究任务" }],
    actions
  });
  const byLabel = new Map(template.filter((item) => item.label).map((item) => [item.label, item]));
  assert.equal(byLabel.get("运行中任务：2")?.enabled, false);
  assert.equal(byLabel.get("最近任务")?.enabled, false);
  assert.equal(template.find((item) => item.label === "研究任务")?.label, "研究任务");
  byLabel.get("显示 One Person Lab")?.click();
  byLabel.get("运行状态")?.click();
  template.find((item) => item.label === "研究任务")?.click();
  byLabel.get("检查更新")?.click();
  byLabel.get("重新启动")?.click();
  byLabel.get("退出 One Person Lab")?.click();
  assert.deepEqual(calls, ["show", "runtime", "thread:thread-1", "update", "restart", "quit"]);
});

test("tray controller reads recent threads and routes menu actions through existing host and renderer callers", async () => {
  class FakeTray extends EventEmitter {
    constructor(image) {
      super();
      this.image = image;
    }
    setToolTip(value) { this.tooltip = value; }
    setContextMenu(value) { this.menu = value; }
    destroy() { this.destroyed = true; }
  }
  const builtTemplates = [];
  const image = { empty: false, isEmpty() { return this.empty; }, setTemplateImage(value) { this.template = value; } };
  const windowCalls = [];
  const window = {
    isDestroyed: () => false,
    isMinimized: () => false,
    show: () => windowCalls.push("show"),
    hide: () => windowCalls.push("hide"),
    restore: () => windowCalls.push("restore"),
    focus: () => windowCalls.push("focus")
  };
  const rendererEvents = [];
  const controller = await createDesktopTray({
    electron: {
      Tray: FakeTray,
      Menu: { buildFromTemplate: (template) => { builtTemplates.push(template); return { template }; } },
      nativeImage: { createFromPath: () => image },
      dialog: { showMessageBox: async () => ({ response: 0 }) },
      app: { getVersion: () => "0.1.0", dock: { show() { windowCalls.push("dock-show"); }, hide() { windowCalls.push("dock-hide"); } } }
    },
    repositoryRoot: "/workspace",
    resourcesPath: "/resources",
    isPackaged: true,
    invokeHost: async (method, payload) => {
      if (method === "listThreads") {
        assert.deepEqual(payload, { archived: false, limit: 8 });
        return { data: [{ id: "thread-1", name: "Recent", status: "running" }] };
      }
      assert.equal(method, "readState");
      assert.deepEqual(payload, { profile: "fast" });
      return { app_state: { operator: { workbench: { work_item_projection_v2: { summary: { running_count: 3 } } } } } };
    },
    checkForUpdates: async () => ({ supported: true, state: "not_available" }),
    getWindow: () => window,
    sendRendererEvent: (method, params) => rendererEvents.push({ method, params }),
    restart: () => undefined,
    quit: () => undefined,
    enabled: true
  });

  assert.ok(controller);
  assert.equal(image.template, true);
  assert.equal(controller.tray.tooltip, "One Person Lab");
  const template = builtTemplates.at(-1);
  assert.equal(template.find((item) => item.label === "运行中任务：3")?.enabled, false);
  assert.equal(template.find((item) => item.label === "最近任务")?.enabled, false);
  template.find((item) => item.label === "运行状态")?.click();
  template.find((item) => item.label === "Recent")?.click();
  assert.deepEqual(rendererEvents, [
    { method: "desktop/navigate", params: { view: "runtime" } },
    { method: "desktop/open-thread", params: { threadId: "thread-1" } }
  ]);
  assert.deepEqual(windowCalls, ["dock-show", "show", "focus", "dock-show", "show", "focus"]);
  controller.destroy();
  assert.equal(controller.tray.destroyed, true);
});
