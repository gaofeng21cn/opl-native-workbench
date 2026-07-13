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
  'method: "thread/list"', 'method: "thread/read"', 'method: "thread/resume"',
  'method: "thread/fork"', '"thread/archive"', '"thread/unarchive"',
  'method: "turn/start"', 'method: "turn/steer"', 'method == "thread/status/changed"',
  'method == "item/tool/call"', 'try self.send(frame: ["id": requestId, "result": result])',
  'state: "accepted_unverified"', 'state: "verified_available"', '"type": "function"',
  '"previewToken"', '"confirmationId"', '"host_queue"', '"preauthorized"',
  'coordination/lifecycle-proposal', 'resultSummaryOrRef', 'queueWindow'
]) assert(source.includes(marker), `missing protocol marker ${marker}`);
assert.equal(source.includes("mcp_servers.opl_coordination"), false, "coordination must not spawn a parallel MCP bridge");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-coordination-protocol-"));
try {
  const testSource = path.join(tempRoot, "NativeWorkbenchTestSource.swift");
  const executable = path.join(tempRoot, "coordination-protocol-regression");
  fs.writeFileSync(testSource, source.slice(0, bootstrapIndex));
  const compile = spawnSync("swiftc", [
    testSource, path.join(root, "scripts/coordination-protocol-regression.swift"),
    "-framework", "Cocoa", "-framework", "WebKit", "-o", executable
  ], { encoding: "utf8", cwd: root });
  assert.equal(compile.status, 0, `coordination protocol compile failed\n${compile.stdout}\n${compile.stderr}`);
  const run = spawnSync(executable, [], { encoding: "utf8", cwd: root });
  assert.equal(run.status, 0, `coordination protocol failed\n${run.stdout}\n${run.stderr}`);
  process.stdout.write(run.stdout);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
