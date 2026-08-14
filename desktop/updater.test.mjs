import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createDesktopUpdater } from "./updater.mjs";

class FakeAutoUpdater extends EventEmitter {
  async checkForUpdates() {
    this.emit("update-available", { version: "1.1.0" });
  }

  async downloadUpdate() {
    this.emit("download-progress", { percent: 50 });
    this.emit("update-downloaded", { version: "1.1.0" });
  }

  quitAndInstall() {
    this.quitAndInstallCalled = true;
  }
}

test("desktop updater preserves check, download, and explicit restart states", async () => {
  const autoUpdater = new FakeAutoUpdater();
  const updater = createDesktopUpdater({ autoUpdater, isPackaged: true, currentVersion: "1.0.0" });
  assert.equal((await updater.perform("check")).state, "available");
  const applied = await updater.perform("apply");
  assert.equal(applied.state, "downloaded");
  assert.equal(applied.restartRequired, true);
  const restarted = await updater.perform("restart");
  assert.equal(restarted.state, "installing");
  assert.equal(restarted.accepted, true);
});

test("unpackaged desktop reports a truthful unsupported updater", async () => {
  const updater = createDesktopUpdater({ autoUpdater: new FakeAutoUpdater(), isPackaged: false, currentVersion: "0.1.0" });
  const result = await updater.perform("check");
  assert.equal(result.supported, false);
  assert.equal(result.reasonCode, "desktop_updater_requires_packaged_app");
});

test("directory package stays truthful until release update metadata is present", async () => {
  const updater = createDesktopUpdater({
    autoUpdater: new FakeAutoUpdater(),
    isPackaged: true,
    updateConfigAvailable: false,
    currentVersion: "0.1.0"
  });
  const result = await updater.perform("check");
  assert.equal(result.supported, false);
  assert.equal(result.reasonCode, "desktop_update_config_unavailable");
});
