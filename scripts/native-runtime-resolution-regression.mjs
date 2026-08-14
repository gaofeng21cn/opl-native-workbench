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
  "resolveExternalExecutable(",
  'explicitEnvironmentKeys: ["OPL_CODEX_BIN", "CODEX_CLI_PATH", "CODEX_BIN"]',
  'homeDirectory.appendingPathComponent(".local/bin/codex")',
  '"/opt/homebrew/bin/\\(name)"',
  "private let initializationLock = NSLock()",
  "initializationLock.lock()",
  "private let appServer: CodexAppServerClient"
]) assert(source.includes(marker), `missing native runtime resolution marker ${marker}`);

assert.equal(source.toLowerCase().includes("bundled-aioncore"), false, "Native must not resolve a bundled AionCore runtime");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-native-runtime-resolution-"));
try {
  const testSource = path.join(tempRoot, "OplStudioTestSource.swift");
  const executable = path.join(tempRoot, "native-runtime-resolution-regression");
  fs.writeFileSync(testSource, source.slice(0, bootstrapIndex));
  const compile = spawnSync("swiftc", [
    testSource,
    path.join(root, "scripts/native-runtime-resolution-regression.swift"),
    "-framework",
    "Cocoa",
    "-framework",
    "WebKit",
    "-o",
    executable
  ], { encoding: "utf8", cwd: root });
  assert.equal(compile.status, 0, `native runtime resolution compile failed\n${compile.stdout}\n${compile.stderr}`);
  const run = spawnSync(executable, [], { encoding: "utf8", cwd: root });
  assert.equal(run.status, 0, `native runtime resolution regression failed\n${run.stdout}\n${run.stderr}`);
  process.stdout.write(run.stdout);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
