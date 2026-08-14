import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceIds = {
  darwin: "com.onepersonlab.headless",
  linux: "one-person-lab-headless.service",
  win32: "\\OnePersonLab\\Headless"
};
const actions = new Set(["install", "status", "start", "stop", "restart", "uninstall"]);
const modulePath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(modulePath), "../..");

function xml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertServiceValue(value, name) {
  if (typeof value !== "string" || value.length === 0 || /[\0\r\n]/.test(value)) {
    throw new Error(`${name} must be a non-empty single-line path`);
  }
  return value;
}

function systemdArgument(value) {
  const safe = assertServiceValue(value, "systemd argument")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("%", "%%");
  return `"${safe}"`;
}

function launchAgent({ nodeExecutable, headlessEntry, workingDirectory, stdoutPath, stderrPath }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${serviceIds.darwin}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(nodeExecutable)}</string>
    <string>${xml(headlessEntry)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(workingDirectory)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xml(stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(stderrPath)}</string>
</dict>
</plist>
`;
}

function systemdUnit({ nodeExecutable, headlessEntry, workingDirectory }) {
  return `[Unit]
Description=One Person Lab headless WebUI
After=network.target

[Service]
Type=simple
WorkingDirectory=${systemdArgument(workingDirectory)}
ExecStart=${systemdArgument(nodeExecutable)} ${systemdArgument(headlessEntry)}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
`;
}

function windowsTask({ nodeExecutable, headlessEntry, workingDirectory }) {
  return `\uFEFF<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xml(nodeExecutable)}</Command>
      <Arguments>${xml(`"${headlessEntry}"`)}</Arguments>
      <WorkingDirectory>${xml(workingDirectory)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
}

function executeProcess(command, args, { shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode, signal) => resolve({
      exitCode: exitCode ?? 1,
      signal,
      stdout,
      stderr
    }));
  });
}

export function createHeadlessServiceManager({
  platform = process.platform,
  homeDirectory = os.homedir(),
  localAppData = process.env.LOCALAPPDATA,
  uid = typeof process.getuid === "function" ? process.getuid() : undefined,
  nodeExecutable = process.execPath,
  headlessEntry = path.join(repositoryRoot, "scripts", "headless", "run.mjs"),
  execute = executeProcess,
  fileSystem = { mkdir, rm, writeFile }
} = {}) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const serviceId = serviceIds[platform];
  const safeNodeExecutable = assertServiceValue(nodeExecutable, "nodeExecutable");
  const safeHeadlessEntry = assertServiceValue(headlessEntry, "headlessEntry");
  const workingDirectory = pathApi.dirname(pathApi.dirname(pathApi.dirname(safeHeadlessEntry)));
  const definitions = platform === "darwin"
    ? {
        directory: pathApi.join(homeDirectory, "Library", "LaunchAgents"),
        logDirectory: pathApi.join(homeDirectory, "Library", "Logs", "One Person Lab"),
        file: pathApi.join(homeDirectory, "Library", "LaunchAgents", `${serviceId}.plist`)
      }
    : platform === "linux"
      ? {
          directory: pathApi.join(homeDirectory, ".config", "systemd", "user"),
          file: pathApi.join(homeDirectory, ".config", "systemd", "user", serviceId ?? "unknown.service")
        }
      : platform === "win32"
        ? {
            directory: pathApi.join(localAppData || pathApi.join(homeDirectory, "AppData", "Local"), "OnePersonLab", "Headless"),
            file: pathApi.join(localAppData || pathApi.join(homeDirectory, "AppData", "Local"), "OnePersonLab", "Headless", "headless-task.xml")
          }
        : null;

  async function invoke(command, args, { allowFailure = false } = {}) {
    const result = await execute(command, args, { shell: false });
    if (!result || !Number.isInteger(result.exitCode)) {
      throw new Error(`${command} returned an invalid execution result`);
    }
    if (result.exitCode !== 0 && !allowFailure) {
      const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.exitCode}`;
      throw new Error(`${command} failed: ${detail}`);
    }
    return result;
  }

  function outcome(action, native) {
    return {
      action,
      platform,
      scope: "user",
      serviceId,
      definitionPath: definitions?.file ?? null,
      native: native
        ? { exitCode: native.exitCode, stdout: native.stdout, stderr: native.stderr }
        : null
    };
  }

  async function runDarwin(action) {
    const domain = `gui/${uid}`;
    const target = `${domain}/${serviceId}`;
    if (action === "install") {
      await fileSystem.mkdir(definitions.directory, { recursive: true });
      await fileSystem.mkdir(definitions.logDirectory, { recursive: true });
      await fileSystem.writeFile(definitions.file, launchAgent({
        nodeExecutable: safeNodeExecutable,
        headlessEntry: safeHeadlessEntry,
        workingDirectory,
        stdoutPath: pathApi.join(definitions.logDirectory, "headless.stdout.log"),
        stderrPath: pathApi.join(definitions.logDirectory, "headless.stderr.log")
      }), { encoding: "utf8", mode: 0o644 });
      await invoke("launchctl", ["bootout", target], { allowFailure: true });
      const native = await invoke("launchctl", ["bootstrap", domain, definitions.file]);
      return outcome(action, native);
    }
    if (action === "status") return outcome(action, await invoke("launchctl", ["print", target], { allowFailure: true }));
    if (action === "start") return outcome(action, await invoke("launchctl", ["bootstrap", domain, definitions.file]));
    if (action === "stop") return outcome(action, await invoke("launchctl", ["bootout", target], { allowFailure: true }));
    if (action === "restart") {
      await invoke("launchctl", ["bootout", target], { allowFailure: true });
      return outcome(action, await invoke("launchctl", ["bootstrap", domain, definitions.file]));
    }
    const native = await invoke("launchctl", ["bootout", target], { allowFailure: true });
    await fileSystem.rm(definitions.file, { force: true });
    return outcome(action, native);
  }

  async function runLinux(action) {
    const prefix = ["--user"];
    if (action === "install") {
      await fileSystem.mkdir(definitions.directory, { recursive: true });
      await fileSystem.writeFile(definitions.file, systemdUnit({
        nodeExecutable: safeNodeExecutable,
        headlessEntry: safeHeadlessEntry,
        workingDirectory
      }), { encoding: "utf8", mode: 0o644 });
      await invoke("systemctl", [...prefix, "daemon-reload"]);
      const native = await invoke("systemctl", [...prefix, "enable", "--now", serviceId]);
      return outcome(action, native);
    }
    if (action === "status") {
      return outcome(action, await invoke("systemctl", [
        ...prefix,
        "show",
        serviceId,
        "--property=LoadState,ActiveState,SubState",
        "--no-pager"
      ], { allowFailure: true }));
    }
    if (action === "start") return outcome(action, await invoke("systemctl", [...prefix, "start", serviceId]));
    if (action === "stop") return outcome(action, await invoke("systemctl", [...prefix, "stop", serviceId], { allowFailure: true }));
    if (action === "restart") return outcome(action, await invoke("systemctl", [...prefix, "restart", serviceId]));
    const native = await invoke("systemctl", [...prefix, "disable", "--now", serviceId], { allowFailure: true });
    await fileSystem.rm(definitions.file, { force: true });
    await invoke("systemctl", [...prefix, "daemon-reload"]);
    return outcome(action, native);
  }

  async function runWindows(action) {
    const task = ["/TN", serviceId];
    if (action === "install") {
      await fileSystem.mkdir(definitions.directory, { recursive: true });
      await fileSystem.writeFile(definitions.file, windowsTask({
        nodeExecutable: safeNodeExecutable,
        headlessEntry: safeHeadlessEntry,
        workingDirectory
      }), { encoding: "utf16le", mode: 0o600 });
      await invoke("schtasks.exe", ["/Create", ...task, "/XML", definitions.file, "/F"]);
      const native = await invoke("schtasks.exe", ["/Run", ...task]);
      return outcome(action, native);
    }
    if (action === "status") return outcome(action, await invoke("schtasks.exe", ["/Query", ...task, "/FO", "LIST", "/V"], { allowFailure: true }));
    if (action === "start") return outcome(action, await invoke("schtasks.exe", ["/Run", ...task]));
    if (action === "stop") return outcome(action, await invoke("schtasks.exe", ["/End", ...task], { allowFailure: true }));
    if (action === "restart") {
      await invoke("schtasks.exe", ["/End", ...task], { allowFailure: true });
      return outcome(action, await invoke("schtasks.exe", ["/Run", ...task]));
    }
    await invoke("schtasks.exe", ["/End", ...task], { allowFailure: true });
    const native = await invoke("schtasks.exe", ["/Delete", ...task, "/F"], { allowFailure: true });
    await fileSystem.rm(definitions.file, { force: true });
    return outcome(action, native);
  }

  return {
    async run(action) {
      if (!actions.has(action)) throw new Error(`Unknown service action: ${action}`);
      if (!serviceId || !definitions) throw new Error(`Unsupported platform: ${platform}`);
      if (platform !== "win32") {
        if (!Number.isInteger(uid)) throw new Error("A numeric user id is required for the user service");
        if (uid === 0) throw new Error("Headless service management must run as a non-root user");
      }
      if (platform === "darwin") return runDarwin(action);
      if (platform === "linux") return runLinux(action);
      return runWindows(action);
    }
  };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || !actions.has(argv[0])) {
    throw new Error("Usage: node scripts/headless/service-manager.mjs <install|status|start|stop|restart|uninstall>");
  }
  const result = await createHeadlessServiceManager().run(argv[0]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "headless_service_action_failed", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
