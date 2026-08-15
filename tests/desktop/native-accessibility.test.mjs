import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  nativeAccessibilityInvocation,
  qualifyNativeAccessibility,
  validateNativeAccessibilityReceipt
} from "../../desktop/native-accessibility-qualification.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

function passingReceipt(platform, processIds) {
  return {
    schema: platform === "win32"
      ? "opl_desktop_windows_uia_qualification.v1"
      : "opl_desktop_linux_atspi_qualification.v1",
    status: "passed",
    platform,
    targetProcessIds: processIds,
    matchedProcessId: processIds.at(-1),
    windowName: "One Person Lab",
    nodeCount: 12,
    interactiveNodeCount: 4,
    unnamedInteractiveCount: 0,
    roles: { Button: 4 }
  };
}

test("native accessibility invocation binds UIA and AT-SPI probes to product process identities", () => {
  const windows = nativeAccessibilityInvocation({ platform: "win32", processIds: [101, 101] });
  assert.equal(windows.command, "pwsh");
  assert.ok(windows.args.some((value) => value.endsWith(path.join("native-accessibility", "windows-uia.ps1"))));
  assert.deepEqual(windows.args.slice(-4), ["-TargetProcessId", "101", "-ExpectedWindowName", "One Person Lab"]);

  const linux = nativeAccessibilityInvocation({ platform: "linux", processIds: [202, 303, 202] });
  assert.equal(linux.command, "/usr/bin/python3");
  assert.ok(linux.args[0].endsWith(path.join("native-accessibility", "linux-atspi.py")));
  assert.deepEqual(linux.args.slice(-4), ["--process-ids", "202,303", "--expected-window-name", "One Person Lab"]);
});

test("native accessibility qualification accepts a process-bound named interactive tree", () => {
  const receipt = passingReceipt("linux", [202, 303]);
  const observed = qualifyNativeAccessibility({
    platform: "linux",
    processIds: [202, 303],
    run: () => ({ status: 0, signal: null, stderr: "", stdout: JSON.stringify(receipt) })
  });
  assert.deepEqual(observed, receipt);
});

test("native accessibility qualification rejects wrong identities and unnamed controls", () => {
  const wrongIdentity = passingReceipt("win32", [999]);
  assert.throws(
    () => validateNativeAccessibilityReceipt(wrongIdentity, "win32", [101]),
    /wrong process identity/
  );

  const unnamed = { ...passingReceipt("linux", [202]), unnamedInteractiveCount: 1 };
  assert.throws(
    () => validateNativeAccessibilityReceipt(unnamed, "linux", [202]),
    /unnamed interactive controls/
  );
});

test("native accessibility qualification fails closed on invalid inputs and probe errors", () => {
  assert.throws(
    () => nativeAccessibilityInvocation({ platform: "linux", processIds: [] }),
    /requires a process identity/
  );
  assert.throws(
    () => nativeAccessibilityInvocation({ platform: "darwin", processIds: [101] }),
    /unsupported on darwin/
  );
  assert.throws(
    () => qualifyNativeAccessibility({
      platform: "win32",
      processIds: [101],
      run: () => ({ status: 1, signal: null, stderr: "UIAutomation unavailable", stdout: "" })
    }),
    /UIAutomation unavailable/
  );
});

test("hosted installed lifecycle exercises native platform trees without disabling the sandbox", async () => {
  const workflowSource = await readFile(
    path.join(repositoryRoot, ".github", "workflows", "non-release-validation.yml"),
    "utf8"
  );
  const workflow = YAML.parse(workflowSource);
  const steps = workflow.jobs["desktop-distribution"].steps;
  const named = (name) => {
    const step = steps.find((candidate) => candidate.name === name);
    assert.ok(step, `missing workflow step: ${name}`);
    return step;
  };

  const linuxRuntime = named("Install Linux native accessibility runtime");
  assert.equal(linuxRuntime.if, "matrix.distribution == 'linux'");
  assert.match(linuxRuntime.run, /at-spi2-core/);
  assert.match(linuxRuntime.run, /python3-pyatspi/);

  for (const name of [
    "Start base Windows app and read exact version",
    "Start updated Windows app and read exact version",
    "Start rolled-back Windows app and read exact version"
  ]) {
    assert.match(named(name).run, /OPL_DESKTOP_NATIVE_ACCESSIBILITY_QUALIFICATION/);
  }
  for (const name of [
    "Start base Linux app and read exact version",
    "Start updated Linux app and read exact version",
    "Start rolled-back Linux app and read exact version"
  ]) {
    const run = named(name).run;
    assert.match(run, /dbus-run-session/);
    assert.match(run, /NO_AT_BRIDGE=0/);
    assert.match(run, /OPL_DESKTOP_NATIVE_ACCESSIBILITY_QUALIFICATION=1/);
    assert.match(run, /xvfb-run/);
  }

  assert.doesNotMatch(workflowSource, /--no-sandbox/);
  assert.doesNotMatch(workflowSource, /APPIMAGE_EXTRACT_AND_RUN/);
});
