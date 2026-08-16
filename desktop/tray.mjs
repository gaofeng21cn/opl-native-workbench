import path from "node:path";

export function shouldCreateDesktopTray({
  platform = process.platform,
  ipcConnected = typeof process.send === "function",
  force = process.env.OPL_DESKTOP_TRAY_QUALIFICATION === "1"
} = {}) {
  return platform === "darwin" && (!ipcConnected || force);
}

function threadLabel(thread, index) {
  for (const candidate of [thread?.name, thread?.title, thread?.preview]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return `Task ${index + 1}`;
}

function threadId(thread) {
  for (const candidate of [thread?.id, thread?.threadId, thread?.thread_id]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function runningThread(thread) {
  const value = typeof thread?.status === "string"
    ? thread.status
    : typeof thread?.status?.type === "string"
      ? thread.status.type
      : "";
  return /running|active|in_progress/i.test(value);
}

function objectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function readProjectedRunningCount(value) {
  let cursor = objectRecord(value);
  for (let depth = 0; cursor && depth < 3; depth += 1) {
    const projection = objectRecord(objectRecord(objectRecord(cursor.operator)?.workbench)?.work_item_projection_v2);
    const count = projection?.summary && Number(projection.summary.running_count);
    if (Number.isFinite(count) && count >= 0) return Math.trunc(count);
    cursor = objectRecord(cursor.app_state);
  }
  return null;
}

export function buildDesktopTrayMenu({
  locale = "zh",
  recentThreads = [],
  runningCount = 0,
  actions
}) {
  const zh = locale === "zh";
  const recentItems = recentThreads.slice(0, 8).flatMap((thread, index) => {
    const id = threadId(thread);
    return id ? [{ label: threadLabel(thread, index), click: () => actions.openThread(id) }] : [];
  });
  return [
    { label: zh ? "显示 One Person Lab" : "Show One Person Lab", click: actions.showWindow },
    { label: zh ? "隐藏到状态栏" : "Hide to menu bar", click: actions.hideWindow },
    { type: "separator" },
    { label: zh ? "新建任务" : "New task", accelerator: "CommandOrControl+N", click: actions.newTask },
    { label: zh ? "运行状态" : "Run status", click: actions.openRuntime },
    { label: zh ? `运行中任务：${runningCount}` : `Running tasks: ${runningCount}`, enabled: false },
    {
      label: zh ? "最近任务" : "Recent tasks",
      submenu: recentItems.length ? recentItems : [{ label: zh ? "暂无最近任务" : "No recent tasks", enabled: false }]
    },
    { type: "separator" },
    { label: zh ? "检查更新" : "Check for updates", click: actions.checkForUpdates },
    { label: zh ? "关于 One Person Lab" : "About One Person Lab", click: actions.showAbout },
    { label: zh ? "重新启动" : "Restart", click: actions.restart },
    { type: "separator" },
    { label: zh ? "退出 One Person Lab" : "Quit One Person Lab", click: actions.quit }
  ];
}

function updateMessage(result, locale) {
  const zh = locale === "zh";
  if (!result?.supported) {
    return zh
      ? `当前安装包没有可用更新源${result?.reasonCode ? `（${result.reasonCode}）` : ""}。`
      : `This installation has no available update source${result?.reasonCode ? ` (${result.reasonCode})` : ""}.`;
  }
  if (result.state === "available") {
    const version = result.availableVersion ?? result.latestVersion;
    return zh
      ? `发现新版本${version ? ` ${version}` : ""}，可在“设置 > 更新”中安装。`
      : `An update${version ? ` (${version})` : ""} is available in Settings > Updates.`;
  }
  if (/error|failed/.test(String(result.state))) {
    return zh ? `检查更新失败：${result.errorMessage ?? result.reasonCode ?? result.state}` : `Update check failed: ${result.errorMessage ?? result.reasonCode ?? result.state}`;
  }
  return zh ? "当前已是最新版本。" : "One Person Lab is up to date.";
}

export async function createDesktopTray({
  electron,
  repositoryRoot,
  resourcesPath = process.resourcesPath,
  isPackaged = false,
  invokeHost,
  checkForUpdates,
  getWindow,
  sendRendererEvent,
  restart,
  quit,
  locale = "zh",
  enabled = shouldCreateDesktopTray()
}) {
  if (!enabled) return null;
  const { Tray, Menu, nativeImage, dialog, app } = electron;
  const iconPath = isPackaged
    ? path.join(resourcesPath, "branding", "trayTemplate.png")
    : path.join(repositoryRoot, "resources", "opl-branding", "trayTemplate.png");
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty?.()) throw new Error(`OPL tray icon is unavailable: ${iconPath}`);
  image.setTemplateImage?.(true);
  const tray = new Tray(image);
  tray.setToolTip("One Person Lab");
  let destroyed = false;

  const showWindow = () => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    window.show();
    window.focus();
  };
  const hideWindow = () => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    window.hide();
  };
  const navigate = (view) => {
    showWindow();
    sendRendererEvent("desktop/navigate", { view });
  };
  const showDialog = (options) => {
    const window = getWindow();
    return window && !window.isDestroyed()
      ? dialog.showMessageBox(window, options)
      : dialog.showMessageBox(options);
  };
  const actions = {
    showWindow,
    hideWindow,
    newTask: () => {
      showWindow();
      sendRendererEvent("desktop/new-task", {});
    },
    openRuntime: () => navigate("runtime"),
    openThread: (id) => {
      showWindow();
      sendRendererEvent("desktop/open-thread", { threadId: id });
    },
    checkForUpdates: async () => {
      const result = await checkForUpdates();
      sendRendererEvent("desktop/native-update-result", { result });
      await showDialog({
        type: result?.supported && result?.state === "available" ? "info" : result?.state === "error" ? "error" : "none",
        title: locale === "zh" ? "One Person Lab 更新" : "One Person Lab update",
        message: updateMessage(result, locale)
      });
    },
    showAbout: () => showDialog({
      type: "info",
      title: locale === "zh" ? "关于 One Person Lab" : "About One Person Lab",
      message: "One Person Lab",
      detail: `${locale === "zh" ? "候选桌面版本" : "Desktop candidate"} ${app.getVersion()}`
    }),
    restart,
    quit
  };

  const refresh = async () => {
    const [threadsResult, stateResult] = await Promise.allSettled([
      invokeHost("listThreads", { archived: false, limit: 8 }),
      invokeHost("readState", { profile: "fast" })
    ]);
    const recentThreads = threadsResult.status === "fulfilled" && Array.isArray(threadsResult.value?.data)
      ? threadsResult.value.data
      : [];
    const projectedRunningCount = stateResult.status === "fulfilled"
      ? readProjectedRunningCount(stateResult.value)
      : null;
    const menu = Menu.buildFromTemplate(buildDesktopTrayMenu({
      locale,
      recentThreads,
      runningCount: projectedRunningCount ?? recentThreads.filter(runningThread).length,
      actions
    }));
    if (!destroyed) tray.setContextMenu(menu);
    return menu;
  };

  await refresh();
  tray.on("click", showWindow);
  tray.on("right-click", () => { void refresh(); });
  return {
    tray,
    refresh,
    showWindow,
    hideWindow,
    destroy() {
      destroyed = true;
      tray.destroy();
    }
  };
}
