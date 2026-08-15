import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(root, "out");
const fakeAppServer = path.join(root, "scripts", "webui-host", "fixtures", "fake-app-server.mjs");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function findPackagedExecutable() {
  if (!fs.existsSync(outRoot)) return null;
  if (process.platform === "darwin") {
    for (const entry of fs.readdirSync(outRoot, { recursive: true }).map(String)) {
      if (entry.endsWith("One Person Lab Preview.app")) {
        const appPath = path.join(outRoot, entry);
        return {
          appPath,
          executable: path.join(appPath, "Contents", "MacOS", "One Person Lab Preview")
        };
      }
    }
  }
  if (process.platform === "win32") {
    const executable = path.join(outRoot, "win-unpacked", "One Person Lab Preview.exe");
    return fs.existsSync(executable) ? { appPath: path.dirname(executable), executable } : null;
  }
  if (process.platform === "linux") {
    const executable = path.join(outRoot, "linux-unpacked", "one-person-lab-preview");
    return fs.existsSync(executable) ? { appPath: path.dirname(executable), executable } : null;
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

async function waitFor(predicate, timeoutMs, label, timeoutDetails = () => "") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await delay(250);
  }
  const details = timeoutDetails();
  throw new Error(`timed out waiting for ${label}${details ? `\n${details}` : ""}`);
}

function lifecycleEvents(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

assert.ok(["darwin", "win32", "linux"].includes(process.platform), `unsupported desktop smoke platform: ${process.platform}`);
const packaged = findPackagedExecutable();
assert.ok(packaged, "run the current platform desktop package before the desktop live smoke");
const { appPath, executable } = packaged;
assert.ok(fs.existsSync(executable), `missing packaged executable: ${executable}`);
const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-desktop-live-smoke-"));
const lifecycleLog = path.join(stateRoot, "fake-app-server-lifecycle.jsonl");
const oplBinary = process.platform === "win32"
  ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "where.exe")
  : "/usr/bin/true";

const child = spawn(executable, ["--disable-gpu", "--enable-logging=stderr"], {
  cwd: root,
  env: {
    ...process.env,
    OPL_CODEX_BIN: process.execPath,
    CODEX_APP_SERVER_ARGS: fakeAppServer,
    FAKE_APP_SERVER_LIFECYCLE_LOG: lifecycleLog,
    OPL_APP_OPL_BIN: oplBinary,
    OPL_DESKTOP_ACCESSIBILITY_QUALIFICATION: "1",
    OPL_DESKTOP_UPDATE_QUALIFICATION_STATE_ROOT: stateRoot,
    OPL_NATIVE_WORKBENCH_CODEX_CWD: root,
    OPL_NATIVE_WORKBENCH_READ_ONLY: "1"
  },
  stdio: ["ignore", "pipe", "pipe", "ipc"]
});

let appServerPid;
let readyReceipt;
let spawnError;
let stdoutTail = "";
let stderrTail = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => { stdoutTail = `${stdoutTail}${chunk}`.slice(-8_000); });
child.stderr.on("data", (chunk) => { stderrTail = `${stderrTail}${chunk}`.slice(-8_000); });
child.once("error", (error) => { spawnError = error; });
child.on("message", (message) => {
  if (message?.type === "opl-desktop-ready") readyReceipt = message;
});
try {
  const windowState = await waitFor(
    () => {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error([
          `desktop process exited before ready (code=${child.exitCode ?? "null"}, signal=${child.signalCode ?? "null"})`,
          `stdout tail:\n${stdoutTail || "<empty>"}`,
          `stderr tail:\n${stderrTail || "<empty>"}`
        ].join("\n"));
      }
      return readyReceipt?.visible === true && readyReceipt.windowCount > 0 ? readyReceipt : null;
    },
    30_000,
    "a visible One Person Lab window",
    () => [
      `desktop process state: code=${child.exitCode ?? "null"}, signal=${child.signalCode ?? "null"}`,
      `stdout tail:\n${stdoutTail || "<empty>"}`,
      `stderr tail:\n${stderrTail || "<empty>"}`
    ].join("\n")
  );
  assert.equal(
    windowState.accessibilityQualification?.status,
    "passed",
    windowState.accessibilityQualification?.detail
      ?? `Chromium AX tree smoke failed: ${JSON.stringify(windowState.accessibilityQualification)}`
  );

  const appServerStart = await waitFor(
    () => lifecycleEvents(lifecycleLog).find((event) => event.event === "start"),
    10_000,
    "the shared Codex App Server child"
  );
  appServerPid = appServerStart.pid;
  if (process.platform === "darwin") {
    assert.ok(descendants(child.pid).some((row) => row.pid === appServerPid && row.command.includes("fake-app-server.mjs")));
  }

  child.send({ type: "opl-desktop-smoke-quit" });
  await waitFor(() => child.exitCode !== null || child.signalCode !== null, 15_000, "desktop process exit");
  await waitFor(() => !processExists(appServerPid), 10_000, "Codex App Server cleanup");
  const gracefulExit = lifecycleEvents(lifecycleLog).find((event) => event.event === "exit") ?? null;
  if (process.platform === "darwin") {
    await waitFor(() => !processRows().some((row) => row.pid === appServerPid), 10_000, "Codex App Server process cleanup");
  }

  console.log(JSON.stringify({
    status: "desktop_live_smoke_passed",
    platform: process.platform,
    appPath,
    windowState,
    accessibility: windowState.accessibilityQualification,
    appServerChildObserved: true,
    appServerChildCleaned: true,
    appServerGracefulExitObserved: gracefulExit !== null
  }, null, 2));
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  if (appServerPid && !lifecycleEvents(lifecycleLog).some((event) => event.event === "exit")) {
    try { process.kill(appServerPid, "SIGKILL"); } catch {}
  }
  fs.rmSync(stateRoot, { recursive: true, force: true });
}
