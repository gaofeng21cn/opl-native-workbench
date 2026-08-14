import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAppLogDirectoryController } from "./app-log-directory.mjs";

async function fixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opl-app-log-directory-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const storageFile = path.join(directory, "system-info.json");
  let livePath = path.join(directory, "default-logs");
  const calls = [];
  const electronApp = {
    getPath(name) {
      if (name === "userData") return directory;
      if (name === "logs") return livePath;
      throw new Error(`Unexpected Electron path: ${name}`);
    },
    setAppLogsPath(nextPath) {
      calls.push(nextPath);
      overrides.beforeSet?.(nextPath, storageFile);
      livePath = nextPath;
    }
  };
  const controller = createAppLogDirectoryController({
    electronApp,
    fs: overrides.fs ?? fs,
    storageFile
  });
  return { calls, controller, electronApp, storageFile, get livePath() { return livePath; } };
}

test("persists the selected directory before switching Electron's live log writer", async (t) => {
  const nextPath = path.join(os.tmpdir(), "opl-selected-logs");
  const state = await fixture(t, {
    beforeSet(selectedPath, storageFile) {
      const persisted = JSON.parse(readFileSync(storageFile, "utf8"));
      assert.equal(persisted.desktop_client_system_info.logDir, selectedPath);
    }
  });

  assert.deepEqual(await state.controller.setLogDirectory({ path: nextPath }), {
    schema: "opl_app_log_directory_update.v1",
    owner: "one-person-lab-app_desktop_host",
    carrier: "electron_desktop",
    action: "application.setLogDirectory",
    status: "updated",
    success: true,
    hostLogDir: nextPath
  });
  assert.deepEqual(state.calls, [nextPath]);
  assert.deepEqual((await fs.readdir(path.dirname(state.storageFile))).filter((name) => name.includes(".tmp-")), []);
});

test("does not switch the live writer when persistence fails", async (t) => {
  const state = await fixture(t, {
    fs: { ...fs, writeFile: async () => { throw new Error("disk unavailable"); } }
  });
  const result = await state.controller.setLogDirectory({ path: path.join(os.tmpdir(), "opl-new-logs") });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "log_directory_persistence_failed");
  assert.deepEqual(state.calls, []);
});

test("rolls persistence and the live writer back when the switch fails", async (t) => {
  const oldPath = path.join(os.tmpdir(), "opl-old-logs");
  const nextPath = path.join(os.tmpdir(), "opl-new-logs");
  let failNext = false;
  const state = await fixture(t, {
    beforeSet(selectedPath) {
      if (failNext && selectedPath === nextPath) throw new Error("switch rejected");
    }
  });
  await state.controller.setLogDirectory({ path: oldPath });
  failNext = true;

  const result = await state.controller.setLogDirectory({ path: nextPath });
  const persisted = JSON.parse(await fs.readFile(state.storageFile, "utf8"));
  assert.equal(result.errorCode, "log_directory_switch_failed");
  assert.equal(result.rollbackStatus, "restored");
  assert.equal(persisted.desktop_client_system_info.logDir, oldPath);
  assert.equal(state.livePath, oldPath);
});

test("returns a typed failure when the live rollback also fails", async (t) => {
  const initialPath = path.join(os.tmpdir(), "opl-initial-logs");
  const nextPath = path.join(os.tmpdir(), "opl-next-logs");
  let rejectSwitches = false;
  const state = await fixture(t, {
    beforeSet() {
      if (rejectSwitches) throw new Error("live writer unavailable");
    }
  });
  await state.controller.setLogDirectory({ path: initialPath });
  rejectSwitches = true;

  const result = await state.controller.setLogDirectory({ path: nextPath });
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "log_directory_switch_rollback_failed");
  assert.equal(result.rollbackStatus, "failed");
});

test("restores the persisted directory during early startup", async (t) => {
  const state = await fixture(t);
  const persistedPath = path.join(os.tmpdir(), "opl-persisted-logs");
  await state.controller.setLogDirectory({ path: persistedPath });
  state.calls.length = 0;

  assert.deepEqual(await state.controller.restore(), { restored: true, hostLogDir: persistedPath });
  assert.deepEqual(state.calls, [persistedPath]);
});

test("rejects relative and empty paths without mutating persistence or Electron", async (t) => {
  const state = await fixture(t);
  for (const invalidPath of ["", "relative/logs"]) {
    const result = await state.controller.setLogDirectory({ path: invalidPath });
    assert.equal(result.errorCode, "invalid_log_directory");
  }
  assert.deepEqual(state.calls, []);
  await assert.rejects(fs.access(state.storageFile), (error) => error.code === "ENOENT");
});
