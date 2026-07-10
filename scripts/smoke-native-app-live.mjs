import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const appName = "One Person Lab Native Workbench Candidate";
const appPath = path.join(root, "out", `${appName}.app`);
const executablePath = path.join(appPath, "Contents", "MacOS", appName);
const plistPath = path.join(appPath, "Contents", "Info.plist");
const evidencePath = path.join(root, "out", "native-live-smoke.json");
const screenshotPath = path.join(root, "out", "native-live-smoke.png");

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8" });
}

function fail(message, extra = {}) {
  const evidence = {
    status: "failed",
    app_path: path.relative(root, appPath),
    app_path_absolute: appPath,
    timestamp: new Date().toISOString(),
    local_candidate_live_smoke: false,
    active_shell_adopted: false,
    release_ready: false,
    clean_vm_ready: false,
    error: message,
    ...extra
  };
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

function plistValue(key) {
  const result = run("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plistPath]);
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function listAppProcesses() {
  const result = run("/bin/ps", ["-axo", "pid=,args="]);
  if (result.status !== 0) {
    return { error: result.stderr.trim() || result.stdout.trim() || "ps failed", processes: [] };
  }
  const processes = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      return match ? { pid: Number(match[1]), command: match[2] } : null;
    })
    .filter(Boolean)
    .filter((processInfo) => processInfo.command.includes(executablePath));
  return { processes };
}

function waitForProcess(beforePids) {
  const deadline = Date.now() + 20_000;
  let last = { processes: [] };
  while (Date.now() < deadline) {
    last = listAppProcesses();
    const newProcesses = last.processes.filter((processInfo) => !beforePids.has(processInfo.pid));
    if (newProcesses.length > 0) return { processes: newProcesses, new_process_detected: true };
    if (last.processes.length > 0) return { processes: last.processes, new_process_detected: false };
    run("/bin/sleep", ["0.5"]);
  }
  return { processes: [], new_process_detected: false, last_error: last.error };
}

function windowEvidence(bundleId) {
  const script = [
    'tell application "System Events"',
    `set matches to processes whose bundle identifier is "${bundleId}"`,
    "if (count of matches) is 0 then return \"process_not_visible\"",
    "set p to item 1 of matches",
    "return \"visible=\" & visible of p & \";windows=\" & (count of windows of p)",
    "end tell"
  ].join("\n");
  const result = run("/usr/bin/osascript", ["-e", script]);
  return {
    status: result.status === 0 ? "checked" : "skipped",
    output: (result.stdout || result.stderr).trim()
  };
}

function captureScreenshot(bundleId) {
  run("/usr/bin/osascript", ["-e", `tell application id "${bundleId}" to activate`]);
  // Allow app-server initialize/model-list and the first App state read to settle.
  run("/bin/sleep", ["4"]);
  const result = run("/usr/sbin/screencapture", ["-x", screenshotPath]);
  if (result.status === 0 && fs.existsSync(screenshotPath) && fs.statSync(screenshotPath).size > 0) {
    return {
      screenshot_status: "fallback_fullscreen",
      screenshot_path: path.relative(root, screenshotPath),
      screenshot_bytes: fs.statSync(screenshotPath).size
    };
  }
  return {
    screenshot_status: "skipped",
    screenshot_path: path.relative(root, screenshotPath),
    screenshot_error: (result.stderr || result.stdout).trim() || "screencapture did not create a file"
  };
}

function terminateNewProcesses(processes, beforePids) {
  const newPids = processes.map((processInfo) => processInfo.pid).filter((pid) => !beforePids.has(pid));
  for (const pid of newPids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process may already have exited after the smoke evidence was collected.
    }
  }
  return newPids.length > 0 ? `terminated ${newPids.join(",")}` : "left_existing_processes_running";
}

if (process.platform !== "darwin") {
  fail("native packaged app live smoke requires macOS", { platform: process.platform });
}
if (!fs.existsSync(appPath) || !fs.statSync(appPath).isDirectory()) {
  fail("missing packaged .app; run npm run package first");
}
if (!fs.existsSync(executablePath)) {
  fail("missing packaged app executable");
}
if (!fs.existsSync(plistPath)) {
  fail("missing packaged app Info.plist");
}

const bundleId = plistValue("CFBundleIdentifier");
const bundleName = plistValue("CFBundleName") ?? appName;
if (!bundleId) fail("missing CFBundleIdentifier in packaged app Info.plist");

const before = listAppProcesses();
const beforePids = new Set(before.processes.map((processInfo) => processInfo.pid));
const openResult = run("/usr/bin/open", ["-n", appPath]);
if (openResult.status !== 0) {
  fail("open -n failed", { open_stdout: openResult.stdout.trim(), open_stderr: openResult.stderr.trim() });
}

const processEvidence = waitForProcess(beforePids);
if (processEvidence.processes.length === 0) {
  fail("packaged app process did not become visible", { process_evidence: processEvidence });
}

const windows = windowEvidence(bundleId);
const screenshot = captureScreenshot(bundleId);
const cleanup_status = terminateNewProcesses(processEvidence.processes, beforePids);
const evidence = {
  status: "passed",
  app_path: path.relative(root, appPath),
  app_path_absolute: appPath,
  bundle_id: bundleId,
  bundle_name: bundleName,
  pid: processEvidence.processes[0].pid,
  process_evidence: processEvidence,
  window_evidence: windows,
  timestamp: new Date().toISOString(),
  local_candidate_live_smoke: true,
  active_shell_adopted: false,
  release_ready: false,
  clean_vm_ready: false,
  ...screenshot,
  cleanup_status
};

fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
