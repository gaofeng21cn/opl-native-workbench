import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const nativePath = path.join(root, "scripts/opl-studio-app.swift");
const source = fs.readFileSync(nativePath, "utf8");
const bootstrapIndex = source.indexOf("\nlet app = NSApplication.shared");
assert(bootstrapIndex >= 0, "native bootstrap marker");

for (const marker of [
  'case "steerTurn"',
  '"expectedTurnId": expectedTurnId',
  'case "loginGatewayAccount"',
  '"--credentials-stdin"',
  'case "readNativeAppUpdateStatus"',
  'case "checkNativeAppUpdate"',
  'case "applyNativeAppUpdate"',
  'case "restartNativeApp"'
]) assert(source.includes(marker), `missing native host transport marker ${marker}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-native-host-transport-"));
try {
  const testSource = path.join(tempRoot, "OplStudioTestSource.swift");
  const executable = path.join(tempRoot, "native-host-transport-regression");
  fs.writeFileSync(testSource, source.slice(0, bootstrapIndex));
  const compile = spawnSync("swiftc", [
    testSource,
    path.join(root, "scripts/native-host-transport-regression.swift"),
    "-framework",
    "Cocoa",
    "-framework",
    "WebKit",
    "-o",
    executable
  ], { encoding: "utf8", cwd: root });
  assert.equal(compile.status, 0, `native host transport compile failed\n${compile.stdout}\n${compile.stderr}`);
  const run = spawnSync(executable, [], { encoding: "utf8", cwd: root });
  assert.equal(run.status, 0, `native host transport regression failed\n${run.stdout}\n${run.stderr}`);
  process.stdout.write(run.stdout);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
