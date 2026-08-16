import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createHeadlessUpdateRunner,
  installHeadlessPayload
} from "../../scripts/headless/update-runner.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function sourceFixture(version, marker) {
  const root = await mkdtemp(path.join(os.tmpdir(), "opl-headless-source-"));
  await mkdir(path.join(root, "dist", "webui"), { recursive: true });
  await mkdir(path.join(root, "scripts", "headless"), { recursive: true });
  await mkdir(path.join(root, "scripts", "webui-host"), { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version }), "utf8");
  await writeFile(path.join(root, "dist", "webui", "index.html"), `<main>${marker}</main>`, "utf8");
  await writeFile(path.join(root, "scripts", "headless", "run.mjs"), `export const marker = ${JSON.stringify(marker)};\n`, "utf8");
  await writeFile(path.join(root, "scripts", "headless", "service-manager.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "headless", "update-runner.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "install-headless.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "webui-host", "http-host.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "webui-host", "ignored.test.mjs"), "throw new Error('not payload');\n", "utf8");
  return root;
}

test("headless updater stages a newer runtime, keeps one previous payload, and reports the native updater ABI", async () => {
  const installRoot = await mkdtemp(path.join(os.tmpdir(), "opl-headless-install-"));
  const sourceV1 = await sourceFixture("1.0.0", "v1");
  const sourceV2 = await sourceFixture("1.1.0", "v2");
  await installHeadlessPayload({ sourceRoot: sourceV1, installRoot });

  const scheduled = [];
  const updater = createHeadlessUpdateRunner({
    installRoot,
    sourceRoot: sourceV2,
    scheduleRestart: async () => scheduled.push("restart")
  });
  assert.deepEqual(await updater.perform("check"), {
    schema: "opl_native_app_updater.v1",
    supported: true,
    state: "available",
    currentVersion: "1.0.0",
    targetVersion: "1.1.0",
    restartRequired: false
  });

  const applied = await updater.perform("apply");
  assert.equal(applied.schema, "opl_native_app_updater.v1");
  assert.equal(applied.state, "applied");
  assert.equal(applied.currentVersion, "1.0.0");
  assert.equal(applied.targetVersion, "1.1.0");
  assert.equal(applied.restartRequired, true);
  assert.match(await readFile(path.join(installRoot, "current", "dist", "webui", "index.html"), "utf8"), /v2/);
  assert.match(await readFile(path.join(installRoot, "previous", "dist", "webui", "index.html"), "utf8"), /v1/);
  await assert.rejects(readFile(path.join(installRoot, "current", "scripts", "webui-host", "ignored.test.mjs"), "utf8"), /ENOENT/);

  assert.equal((await updater.perform("status")).currentVersion, "1.1.0");
  assert.equal((await updater.perform("check")).state, "not_available");

  const rolledBack = await updater.perform("rollback");
  assert.equal(rolledBack.schema, "opl_native_app_updater.v1");
  assert.equal(rolledBack.state, "rolled_back");
  assert.equal(rolledBack.currentVersion, "1.1.0");
  assert.equal(rolledBack.targetVersion, "1.0.0");
  assert.equal(rolledBack.restartRequired, true);
  assert.match(await readFile(path.join(installRoot, "current", "dist", "webui", "index.html"), "utf8"), /v1/);
  assert.match(await readFile(path.join(installRoot, "previous", "dist", "webui", "index.html"), "utf8"), /v2/);
  assert.equal((await updater.perform("status")).currentVersion, "1.0.0");

  assert.equal((await updater.perform("restart")).state, "restart_scheduled");
  assert.deepEqual(scheduled, ["restart"]);
});

test("headless updater rejects rollback when no previous payload exists", async () => {
  const installRoot = await mkdtemp(path.join(os.tmpdir(), "opl-headless-install-"));
  const source = await sourceFixture("1.0.0", "current");
  await installHeadlessPayload({ sourceRoot: source, installRoot });

  const updater = createHeadlessUpdateRunner({ installRoot, sourceRoot: source });
  const rolledBack = await updater.perform("rollback");
  assert.equal(rolledBack.supported, false);
  assert.equal(rolledBack.state, "unsupported");
  assert.equal(rolledBack.reasonCode, "rollback_unavailable");
  assert.equal(rolledBack.currentVersion, "1.0.0");
  assert.match(await readFile(path.join(installRoot, "current", "dist", "webui", "index.html"), "utf8"), /current/);
});

test("headless updater refuses a downgrade and preserves the current payload", async () => {
  const installRoot = await mkdtemp(path.join(os.tmpdir(), "opl-headless-install-"));
  const sourceV2 = await sourceFixture("2.0.0", "current");
  const sourceV1 = await sourceFixture("1.9.0", "older");
  await installHeadlessPayload({ sourceRoot: sourceV2, installRoot });
  const updater = createHeadlessUpdateRunner({ installRoot, sourceRoot: sourceV1 });

  const checked = await updater.perform("check");
  assert.equal(checked.supported, false);
  assert.equal(checked.state, "unsupported");
  assert.equal(checked.reasonCode, "target_version_not_newer");
  const applied = await updater.perform("apply");
  assert.equal(applied.supported, false);
  assert.equal(applied.state, "unsupported");
  assert.match(await readFile(path.join(installRoot, "current", "dist", "webui", "index.html"), "utf8"), /current/);
});

test("installed updater emits JSON when its CLI path traverses a directory symlink", async () => {
  const installRoot = await mkdtemp(path.join(os.tmpdir(), "opl-headless-install-"));
  const source = await sourceFixture("1.0.0", "current");
  await installHeadlessPayload({ sourceRoot: source, installRoot });
  const aliasRoot = await mkdtemp(path.join(os.tmpdir(), "opl-headless-alias-"));
  const alias = path.join(aliasRoot, "headless");
  await symlink(path.join(repositoryRoot, "scripts", "headless"), alias, "dir");

  const stdout = execFileSync(process.execPath, [
    path.join(alias, "update-runner.mjs"),
    "status",
    "--install-root",
    installRoot
  ], { encoding: "utf8" });
  const result = JSON.parse(stdout);
  assert.equal(result.schema, "opl_native_app_updater.v1");
  assert.equal(result.state, "idle");
  assert.equal(result.currentVersion, "1.0.0");
});
