import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(root, "out");
const fakeAppServer = path.join(root, "scripts", "webui-host", "fixtures", "fake-app-server.mjs");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function findMacApp() {
  if (!fs.existsSync(outRoot)) return null;
  for (const entry of fs.readdirSync(outRoot, { recursive: true }).map(String)) {
    if (entry.endsWith("One Person Lab Preview.app")) return path.join(outRoot, entry);
  }
  return null;
}

function processRows() {
  const result = spawnSync("/bin/ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || "unable to read process table");
  return result.stdout.trim().split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }] : [];
  });
}

function descendants(rootPid, rows = processRows()) {
  const selected = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (selected.has(row.ppid) && !selected.has(row.pid)) {
        selected.add(row.pid);
        changed = true;
      }
    }
  }
  return rows.filter((row) => row.pid !== rootPid && selected.has(row.pid));
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await delay(250);
  }
  throw new Error(`timed out waiting for ${label}`);
}

if (process.platform !== "darwin") {
  console.log(JSON.stringify({ status: "desktop_live_smoke_not_applicable", platform: process.platform }, null, 2));
  process.exit(0);
}

const appPath = findMacApp();
assert.ok(appPath, "run npm run package before the desktop live smoke");
const executable = path.join(appPath, "Contents", "MacOS", "One Person Lab Preview");
assert.ok(fs.existsSync(executable), `missing packaged executable: ${executable}`);

const child = spawn(executable, [], {
  cwd: root,
  env: {
    ...process.env,
    OPL_CODEX_BIN: process.execPath,
    CODEX_APP_SERVER_ARGS: fakeAppServer,
    OPL_APP_OPL_BIN: "/usr/bin/true",
    OPL_NATIVE_WORKBENCH_CODEX_CWD: root,
    OPL_NATIVE_WORKBENCH_READ_ONLY: "1"
  },
  stdio: ["ignore", "ignore", "ignore", "ipc"]
});

let appServerPid;
let readyReceipt;
child.on("message", (message) => {
  if (message?.type === "opl-desktop-ready") readyReceipt = message;
});
try {
  const windowState = await waitFor(
    () => readyReceipt?.visible === true && readyReceipt.windowCount > 0 ? readyReceipt : null,
    30_000,
    "a visible One Person Lab window"
  );

  const appServer = await waitFor(() => descendants(child.pid).find((row) => row.command.includes("fake-app-server.mjs")), 10_000, "the shared Codex App Server child");
  appServerPid = appServer.pid;

  child.send({ type: "opl-desktop-smoke-quit" });
  await waitFor(() => child.exitCode !== null, 15_000, "desktop process exit");
  await waitFor(() => !processRows().some((row) => row.pid === appServerPid), 10_000, "Codex App Server cleanup");

  console.log(JSON.stringify({
    status: "desktop_live_smoke_passed",
    platform: process.platform,
    appPath,
    windowState,
    appServerChildObserved: true,
    appServerChildCleaned: true
  }, null, 2));
} finally {
  if (child.exitCode === null) child.kill("SIGKILL");
  if (appServerPid && processRows().some((row) => row.pid === appServerPid)) {
    try { process.kill(appServerPid, "SIGKILL"); } catch {}
  }
}
