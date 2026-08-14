const baseState = (currentVersion) => ({
  schema: "opl_native_app_updater.v1",
  owner: "one-person-lab-app_desktop_host",
  host: "electron",
  supported: true,
  state: "idle",
  currentVersion,
  restartRequired: false
});

export function createDesktopUpdater({ autoUpdater, isPackaged, updateConfigAvailable = true, currentVersion }) {
  const supported = isPackaged && updateConfigAvailable;
  let state = supported
    ? baseState(currentVersion)
    : {
        ...baseState(currentVersion),
        supported: false,
        state: "unsupported",
        reasonCode: isPackaged ? "desktop_update_config_unavailable" : "desktop_updater_requires_packaged_app"
      };

  const update = (next) => {
    state = { ...state, ...next };
  };

  if (supported) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on("checking-for-update", () => update({ state: "checking", operation: "check" }));
    autoUpdater.on("update-not-available", (info) => update({
      state: "not_available",
      operation: "check",
      targetVersion: info?.version,
      restartRequired: false
    }));
    autoUpdater.on("update-available", (info) => update({
      state: "available",
      operation: "check",
      targetVersion: info?.version,
      restartRequired: false
    }));
    autoUpdater.on("download-progress", (progress) => update({
      state: "downloading",
      operation: "apply",
      progressPercent: progress?.percent
    }));
    autoUpdater.on("update-downloaded", (info) => update({
      state: "downloaded",
      operation: "apply",
      targetVersion: info?.version ?? state.targetVersion,
      restartRequired: true
    }));
    autoUpdater.on("error", (error) => update({
      state: "error",
      errorCode: "desktop_updater_error",
      message: error?.message ?? String(error)
    }));
  }

  return {
    snapshot(operation = "status") {
      return { ...state, operation };
    },
    async perform(operation) {
      if (operation === "status") return this.snapshot(operation);
      if (!supported) return this.snapshot(operation);
      if (operation === "check") {
        update({ state: "checking", operation });
        await autoUpdater.checkForUpdates();
        return this.snapshot(operation);
      }
      if (operation === "apply") {
        if (state.state !== "available") {
          return { ...this.snapshot(operation), accepted: false, reasonCode: "update_not_available" };
        }
        update({ state: "downloading", operation });
        await autoUpdater.downloadUpdate();
        return { ...this.snapshot(operation), accepted: state.state === "downloaded" };
      }
      if (operation === "restart") {
        if (state.state !== "downloaded") {
          return { ...this.snapshot(operation), accepted: false, reasonCode: "downloaded_update_required" };
        }
        update({ state: "installing", operation, restartRequired: true });
        setImmediate(() => autoUpdater.quitAndInstall(false, true));
        return { ...this.snapshot(operation), accepted: true };
      }
      return { ...this.snapshot(operation), accepted: false, reasonCode: "unsupported_update_operation" };
    }
  };
}
