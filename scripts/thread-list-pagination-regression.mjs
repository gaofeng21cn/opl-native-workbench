import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const nativePath = path.join(root, "scripts/native-workbench-app.swift");
const source = fs.readFileSync(nativePath, "utf8");
const bootstrapIndex = source.indexOf("\nlet app = NSApplication.shared");
assert(bootstrapIndex >= 0, "native bootstrap marker");

for (const marker of [
  'method: "thread/list"',
  'method: "thread/read"',
  'method: "thread/resume"',
  'method: "thread/fork"',
  '"thread/archive"',
  '"thread/unarchive"',
  'method: "turn/start"',
  'method: "turn/steer"',
  "final class CodexThreadAdapter",
  'case "listThreads"',
  'case "readThread"',
  'case "resumeThread"',
  'case "forkThread"',
  'case "setArchived"',
  'payload["workspace"] as? String',
  'workspaceFilter.contains(thread["workspace"] as? String ?? "")',
  'projected["parentThreadId"]',
  'projected["agentRole"]',
  'projected["agentNickname"]',
  'projected["sourceKind"]'
]) assert(source.includes(marker), `missing standard thread marker ${marker}`);

for (const retired of [
  "prepareCoordination",
  "dispatchCoordination",
  "waitCoordination",
  "host_queue",
  "coordination/lifecycle-proposal",
  "item/tool/call",
  "dynamicTools",
  "CoordinationLedger",
  "ThreadCoordinationHost"
]) assert.equal(source.includes(retired), false, `retired private thread marker remains: ${retired}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-thread-list-pagination-"));
try {
  const testSource = path.join(tempRoot, "NativeWorkbenchTestSource.swift");
  const executable = path.join(tempRoot, "thread-list-pagination-regression");
  fs.writeFileSync(testSource, source.slice(0, bootstrapIndex));
  const compile = spawnSync("swiftc", [
    testSource,
    path.join(root, "scripts/thread-list-pagination-regression.swift"),
    "-framework",
    "Cocoa",
    "-framework",
    "WebKit",
    "-o",
    executable
  ], { encoding: "utf8", cwd: root });
  assert.equal(compile.status, 0, `thread/list pagination compile failed\n${compile.stdout}\n${compile.stderr}`);
  const run = spawnSync(executable, [], { encoding: "utf8", cwd: root });
  assert.equal(run.status, 0, `thread/list pagination regression failed\n${run.stdout}\n${run.stderr}`);
  process.stdout.write(run.stdout);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
