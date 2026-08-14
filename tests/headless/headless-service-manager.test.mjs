import assert from "node:assert/strict";
import test from "node:test";

import { createHeadlessServiceManager } from "../../scripts/headless/service-manager.mjs";

function harness(platform, overrides = {}) {
  const calls = [];
  const files = [];
  const manager = createHeadlessServiceManager({
    platform,
    homeDirectory: platform === "win32" ? "C:\\Users\\opl" : "/home/opl",
    uid: platform === "win32" ? undefined : 1001,
    nodeExecutable: platform === "win32" ? "C:\\Program Files\\nodejs\\node.exe" : "/usr/bin/node",
    headlessEntry: platform === "win32"
      ? "C:\\Program Files\\One Person Lab\\scripts\\headless\\run.mjs"
      : "/opt/one-person-lab/scripts/headless/run.mjs",
    execute: async (command, args, options) => {
      calls.push({ command, args, options });
      return { exitCode: 0, stdout: "active", stderr: "" };
    },
    fileSystem: {
      mkdir: async (target, options) => files.push({ operation: "mkdir", target, options }),
      writeFile: async (target, contents, options) => files.push({ operation: "writeFile", target, contents, options }),
      rm: async (target, options) => files.push({ operation: "rm", target, options })
    },
    ...overrides
  });
  return { manager, calls, files };
}

function assertNoShell(calls) {
  assert.ok(calls.length > 0);
  for (const call of calls) {
    assert.equal(call.options.shell, false);
    assert.ok(Array.isArray(call.args));
    assert.ok(call.args.every((argument) => typeof argument === "string"));
  }
}

test("macOS installs and controls a per-user launchd service with fixed argv", async () => {
  const { manager, calls, files } = harness("darwin", {
    homeDirectory: "/Users/opl",
    uid: 501
  });

  const installed = await manager.run("install");
  assert.equal(installed.scope, "user");
  assert.equal(installed.serviceId, "com.onepersonlab.headless");
  assert.deepEqual(calls.map(({ command, args }) => [command, args]), [
    ["launchctl", ["bootout", "gui/501/com.onepersonlab.headless"]],
    ["launchctl", ["bootstrap", "gui/501", "/Users/opl/Library/LaunchAgents/com.onepersonlab.headless.plist"]]
  ]);
  const plist = files.find((file) => file.operation === "writeFile");
  assert.equal(plist.target, "/Users/opl/Library/LaunchAgents/com.onepersonlab.headless.plist");
  assert.match(plist.contents, /<string>\/usr\/bin\/node<\/string>/);
  assert.match(plist.contents, /<string>\/opt\/one-person-lab\/scripts\/headless\/run\.mjs<\/string>/);
  assert.doesNotMatch(plist.contents, /\/bin\/(?:ba)?sh|--headless/);
  assertNoShell(calls);

  calls.length = 0;
  await manager.run("status");
  await manager.run("start");
  await manager.run("stop");
  await manager.run("restart");
  assert.deepEqual(calls.map(({ command, args }) => [command, args]), [
    ["launchctl", ["print", "gui/501/com.onepersonlab.headless"]],
    ["launchctl", ["kickstart", "gui/501/com.onepersonlab.headless"]],
    ["launchctl", ["kill", "SIGTERM", "gui/501/com.onepersonlab.headless"]],
    ["launchctl", ["kickstart", "-k", "gui/501/com.onepersonlab.headless"]]
  ]);
});

test("Linux uses systemd --user and removes only the user unit", async () => {
  const { manager, calls, files } = harness("linux");

  await manager.run("install");
  await manager.run("status");
  await manager.run("start");
  await manager.run("stop");
  await manager.run("restart");
  await manager.run("uninstall");

  assert.deepEqual(calls.map(({ command, args }) => [command, args]), [
    ["systemctl", ["--user", "daemon-reload"]],
    ["systemctl", ["--user", "enable", "--now", "one-person-lab-headless.service"]],
    ["systemctl", ["--user", "show", "one-person-lab-headless.service", "--property=LoadState,ActiveState,SubState", "--no-pager"]],
    ["systemctl", ["--user", "start", "one-person-lab-headless.service"]],
    ["systemctl", ["--user", "stop", "one-person-lab-headless.service"]],
    ["systemctl", ["--user", "restart", "one-person-lab-headless.service"]],
    ["systemctl", ["--user", "disable", "--now", "one-person-lab-headless.service"]],
    ["systemctl", ["--user", "daemon-reload"]]
  ]);
  const unit = files.find((file) => file.operation === "writeFile");
  assert.equal(unit.target, "/home/opl/.config/systemd/user/one-person-lab-headless.service");
  assert.match(unit.contents, /^\[Unit\]/);
  assert.match(unit.contents, /ExecStart="\/usr\/bin\/node" "\/opt\/one-person-lab\/scripts\/headless\/run\.mjs"/);
  assert.doesNotMatch(unit.contents, /--headless|ExecStart=.*(?:ba)?sh/);
  assert.ok(files.some((file) => file.operation === "rm" && file.target === unit.target));
  assertNoShell(calls);
});

test("Windows registers a limited current-user task without command-shell composition", async () => {
  const { manager, calls, files } = harness("win32", {
    localAppData: "C:\\Users\\opl\\AppData\\Local"
  });

  await manager.run("install");
  await manager.run("status");
  await manager.run("start");
  await manager.run("stop");
  await manager.run("restart");
  await manager.run("uninstall");

  const taskPath = "C:\\Users\\opl\\AppData\\Local\\OnePersonLab\\Headless\\headless-task.xml";
  assert.deepEqual(calls.map(({ command, args }) => [command, args]), [
    ["schtasks.exe", ["/Create", "/TN", "\\OnePersonLab\\Headless", "/XML", taskPath, "/F"]],
    ["schtasks.exe", ["/Run", "/TN", "\\OnePersonLab\\Headless"]],
    ["schtasks.exe", ["/Query", "/TN", "\\OnePersonLab\\Headless", "/FO", "LIST", "/V"]],
    ["schtasks.exe", ["/Run", "/TN", "\\OnePersonLab\\Headless"]],
    ["schtasks.exe", ["/End", "/TN", "\\OnePersonLab\\Headless"]],
    ["schtasks.exe", ["/End", "/TN", "\\OnePersonLab\\Headless"]],
    ["schtasks.exe", ["/Run", "/TN", "\\OnePersonLab\\Headless"]],
    ["schtasks.exe", ["/End", "/TN", "\\OnePersonLab\\Headless"]],
    ["schtasks.exe", ["/Delete", "/TN", "\\OnePersonLab\\Headless", "/F"]]
  ]);
  const xml = files.find((file) => file.operation === "writeFile");
  assert.equal(xml.target, taskPath);
  assert.match(xml.contents, /<RunLevel>LeastPrivilege<\/RunLevel>/);
  assert.match(xml.contents, /<Command>C:\\Program Files\\nodejs\\node\.exe<\/Command>/);
  assert.match(xml.contents, /<Arguments>&quot;C:\\Program Files\\One Person Lab\\scripts\\headless\\run\.mjs&quot;<\/Arguments>/);
  assert.doesNotMatch(xml.contents, /cmd\.exe|powershell|--headless/i);
  assertNoShell(calls);
});

test("POSIX root execution is rejected before files or service state are touched", async () => {
  const { manager, calls, files } = harness("linux", { uid: 0 });
  await assert.rejects(manager.run("install"), /must run as a non-root user/);
  assert.deepEqual(calls, []);
  assert.deepEqual(files, []);
});

test("unknown platforms and actions fail explicitly", async () => {
  const unsupported = harness("aix").manager;
  await assert.rejects(unsupported.run("install"), /Unsupported platform/);
  const supported = harness("linux").manager;
  await assert.rejects(supported.run("enable"), /Unknown service action/);
});
