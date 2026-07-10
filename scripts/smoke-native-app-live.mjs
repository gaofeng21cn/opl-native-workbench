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
    if (last.error) return { processes: [], new_process_detected: false, last_error: last.error };
    const newProcesses = last.processes.filter((processInfo) => !beforePids.has(processInfo.pid));
    if (newProcesses.length > 0) return { processes: newProcesses, new_process_detected: true };
    run("/bin/sleep", ["0.5"]);
  }
  return { processes: [], new_process_detected: false, last_error: last.error };
}

function windowEvidence(pid) {
  const script = [
    'tell application "System Events"',
    `set matches to processes whose unix id is ${pid}`,
    "if (count of matches) is 0 then return \"process_not_visible\"",
    "set p to item 1 of matches",
    "return \"visible=\" & visible of p & \";windows=\" & (count of windows of p)",
    "end tell"
  ].join("\n");
  const result = run("/usr/bin/osascript", ["-e", script]);
  const output = (result.stdout || result.stderr).trim();
  const windowCount = Number(output.match(/windows=(\d+)/)?.[1] ?? -1);
  return {
    status: result.status === 0 ? "checked" : "skipped",
    output,
    window_count: windowCount
  };
}

function waitForWindow(pid) {
  const startedAt = Date.now();
  const deadline = startedAt + 20_000;
  let evidence = windowEvidence(pid);
  while (Date.now() < deadline && evidence.window_count < 1) {
    run("/bin/sleep", ["0.25"]);
    evidence = windowEvidence(pid);
  }
  return {
    ...evidence,
    wait_ms: Date.now() - startedAt
  };
}

function windowIdForProcess(pid) {
  const source = [
    "import CoreGraphics",
    `let targetPID = Int32(${pid})`,
    "let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []",
    "for window in windows {",
    "  guard let ownerPID = window[kCGWindowOwnerPID as String] as? Int, ownerPID == Int(targetPID),",
    "        let layer = window[kCGWindowLayer as String] as? Int, layer == 0,",
    "        let windowID = window[kCGWindowNumber as String] as? Int else { continue }",
    "  print(windowID)",
    "  break",
    "}"
  ].join("\n");
  const result = run("/usr/bin/swift", ["-e", source]);
  const windowId = Number(result.stdout.trim());
  return Number.isInteger(windowId) && windowId > 0 ? windowId : null;
}

function readScreenshotMarkers() {
  const source = [
    "import AppKit",
    "import Vision",
    "import Foundation",
    "let url = URL(fileURLWithPath: CommandLine.arguments[1])",
    "guard let image = NSImage(contentsOf: url), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(2) }",
    "let request = VNRecognizeTextRequest()",
    "request.recognitionLevel = .fast",
    "request.usesLanguageCorrection = false",
    "try VNImageRequestHandler(cgImage: cgImage).perform([request])",
    "let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: \" \" )",
    "let hasCodex = text.localizedCaseInsensitiveContains(\"Codex\")",
    "let hasModel = text.localizedCaseInsensitiveContains(\"5.6 Sol\")",
    "print(\"codex=\\(hasCodex ? 1 : 0);model=\\(hasModel ? 1 : 0)\")"
  ].join("\n");
  const result = run("/usr/bin/swift", ["-e", source, screenshotPath]);
  const output = result.stdout.trim();
  return {
    ready: result.status === 0 && output.includes("codex=1") && output.includes("model=1"),
    output,
    error: result.status === 0 ? "" : (result.stderr || result.stdout).trim()
  };
}

function captureScreenshot(pid) {
  run("/usr/bin/osascript", [
    "-e",
    `tell application "System Events" to set frontmost of first process whose unix id is ${pid} to true`
  ]);
  const windowId = windowIdForProcess(pid);
  if (!windowId) {
    return {
      screenshot_status: "skipped",
      screenshot_path: path.relative(root, screenshotPath),
      screenshot_error: `no on-screen layer-0 window found for pid ${pid}`
    };
  }
  const deadline = Date.now() + 15_000;
  let lastMarkers = { ready: false, output: "", error: "renderer markers not checked" };
  let lastCaptureError = "";
  while (Date.now() < deadline) {
    fs.rmSync(screenshotPath, { force: true });
    const result = run("/usr/sbin/screencapture", ["-x", "-o", "-l", String(windowId), screenshotPath]);
    lastCaptureError = (result.stderr || result.stdout).trim();
    if (result.status === 0 && fs.existsSync(screenshotPath) && fs.statSync(screenshotPath).size > 0) {
      lastMarkers = readScreenshotMarkers();
      if (lastMarkers.ready) {
        return {
          screenshot_status: "target_window_renderer_ready",
          screenshot_path: path.relative(root, screenshotPath),
          screenshot_bytes: fs.statSync(screenshotPath).size,
          screenshot_window_id: windowId,
          screenshot_markers: ["Codex", "5.6 Sol"]
        };
      }
    }
    run("/bin/sleep", ["0.75"]);
  }
  return {
    screenshot_status: "skipped",
    screenshot_path: path.relative(root, screenshotPath),
    screenshot_error: lastMarkers.error || lastCaptureError || "target window did not expose renderer-ready markers"
  };
}

function terminateNewProcesses(processes, beforePids) {
  const newPids = processes.map((processInfo) => processInfo.pid).filter((pid) => !beforePids.has(pid));
  if (!newPids.length) return { status: "none", requested_pids: [], surviving_pids: [] };
  for (const pid of newPids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process may already have exited after the smoke evidence was collected.
    }
  }
  const startedAt = Date.now();
  const remaining = () => {
    const current = listAppProcesses();
    return {
      error: current.error,
      pids: current.processes.filter((processInfo) => newPids.includes(processInfo.pid)).map((processInfo) => processInfo.pid)
    };
  };
  let state = remaining();
  while (!state.error && state.pids.length && Date.now() - startedAt < 8_000) {
    run("/bin/sleep", ["0.25"]);
    state = remaining();
  }
  let signal = "SIGTERM";
  if (!state.error && state.pids.length) {
    signal = "SIGKILL";
    for (const pid of state.pids) {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
    run("/bin/sleep", ["0.25"]);
    state = remaining();
  }
  return {
    status: state.error || state.pids.length ? "failed" : "terminated",
    requested_pids: newPids,
    surviving_pids: state.pids,
    signal,
    wait_ms: Date.now() - startedAt,
    error: state.error ?? null
  };
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
if (before.error) fail("could not enumerate existing packaged app processes", { process_evidence: before });
const beforePids = new Set(before.processes.map((processInfo) => processInfo.pid));
const openResult = run("/usr/bin/open", ["-n", "-F", "--env", "OPL_NATIVE_WORKBENCH_SMOKE=1", appPath]);
if (openResult.status !== 0) {
  fail("open -n failed", { open_stdout: openResult.stdout.trim(), open_stderr: openResult.stderr.trim() });
}

const processEvidence = waitForProcess(beforePids);
if (processEvidence.processes.length === 0) {
  fail("packaged app process did not become visible", { process_evidence: processEvidence });
}

const launchedPid = processEvidence.processes[0].pid;
const windows = waitForWindow(launchedPid);
if (windows.status !== "checked" || windows.window_count < 1) {
  const cleanup_status = terminateNewProcesses(processEvidence.processes, beforePids);
  fail("packaged app process started without creating a visible window", {
    process_evidence: processEvidence,
    window_evidence: windows,
    cleanup_status
  });
}
const screenshot = captureScreenshot(launchedPid);
if (screenshot.screenshot_status !== "target_window_renderer_ready") {
  const cleanup_status = terminateNewProcesses(processEvidence.processes, beforePids);
  fail("packaged app window screenshot could not be captured", {
    process_evidence: processEvidence,
    window_evidence: windows,
    ...screenshot,
    cleanup_status
  });
}
const cleanup_status = terminateNewProcesses(processEvidence.processes, beforePids);
if (cleanup_status.status === "failed") {
  fail("packaged app process cleanup could not be verified", {
    process_evidence: processEvidence,
    window_evidence: windows,
    ...screenshot,
    cleanup_status
  });
}
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
