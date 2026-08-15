import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const desktopRoot = path.dirname(fileURLToPath(import.meta.url));

function normalizeProcessIds(processIds) {
  assert.ok(Array.isArray(processIds) && processIds.length > 0, "native accessibility requires a process identity");
  const normalized = [...new Set(processIds.map(Number))].sort((left, right) => left - right);
  assert.ok(normalized.every((pid) => Number.isInteger(pid) && pid > 0), "native accessibility process identities must be positive integers");
  return normalized;
}

export function nativeAccessibilityInvocation({ platform, processIds }) {
  const normalizedProcessIds = normalizeProcessIds(processIds);

  if (platform === "win32") {
    return {
      command: "pwsh",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-File",
        path.join(desktopRoot, "native-accessibility", "windows-uia.ps1"),
        "-TargetProcessId",
        String(normalizedProcessIds[0]),
        "-ExpectedWindowName",
        "One Person Lab"
      ]
    };
  }

  if (platform === "linux") {
    return {
      command: "/usr/bin/python3",
      args: [
        path.join(desktopRoot, "native-accessibility", "linux-atspi.py"),
        "--process-ids",
        normalizedProcessIds.join(","),
        "--expected-window-name",
        "One Person Lab"
      ]
    };
  }

  throw new Error(`native desktop accessibility qualification is unsupported on ${platform}`);
}

export function validateNativeAccessibilityReceipt(receipt, platform, expectedProcessIds) {
  const expectedSchema = {
    win32: "opl_desktop_windows_uia_qualification.v1",
    linux: "opl_desktop_linux_atspi_qualification.v1"
  }[platform];
  assert.ok(expectedSchema, `native desktop accessibility qualification is unsupported on ${platform}`);
  assert.equal(receipt?.status, "passed", receipt?.detail ?? "native accessibility qualification failed");
  assert.equal(receipt.schema, expectedSchema, "native accessibility receipt reported the wrong schema");
  assert.equal(receipt.platform, platform, "native accessibility receipt reported the wrong platform");
  assert.deepEqual(receipt.targetProcessIds, expectedProcessIds, "native accessibility receipt reported the wrong process identity");
  assert.ok(expectedProcessIds.includes(receipt.matchedProcessId), "native accessibility tree was not owned by the requested process identity");
  assert.equal(receipt.windowName, "One Person Lab", "native accessibility receipt reported the wrong window");
  assert.ok(receipt.nodeCount > 0, "native accessibility tree did not expose any nodes");
  assert.ok(receipt.interactiveNodeCount > 0, "native accessibility tree did not expose interactive controls");
  assert.equal(receipt.unnamedInteractiveCount, 0, "native accessibility tree exposed unnamed interactive controls");
  return receipt;
}

export function qualifyNativeAccessibility({
  platform = process.platform,
  processIds,
  run = spawnSync
}) {
  const invocation = nativeAccessibilityInvocation({ platform, processIds });
  const normalizedProcessIds = normalizeProcessIds(processIds);
  const expectedProcessIds = platform === "win32" ? [normalizedProcessIds[0]] : normalizedProcessIds;
  const result = run(invocation.command, invocation.args, {
    encoding: "utf8",
    env: process.env,
    timeout: 30_000,
    windowsHide: true
  });
  assert.equal(
    result.status,
    0,
    `native accessibility probe failed (status=${result.status ?? "null"}, signal=${result.signal ?? "null"}): ${result.error?.message || result.stderr || result.stdout || "<empty>"}`
  );
  let receipt;
  try {
    receipt = JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`native accessibility probe returned invalid JSON: ${result.stdout || "<empty>"}`, { cause: error });
  }
  return validateNativeAccessibilityReceipt(receipt, platform, expectedProcessIds);
}
