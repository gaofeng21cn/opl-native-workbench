import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const source = fs.readFileSync(path.join(root, "scripts", "native-workbench-app.swift"), "utf8");
const bootstrap = "\nlet app = NSApplication.shared";
const bootstrapIndex = source.indexOf(bootstrap);
if (bootstrapIndex < 0) throw new Error("native workbench bootstrap marker is missing");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-native-model-list-"));
const testSource = path.join(tempRoot, "NativeWorkbenchTestSource.swift");
const executable = path.join(tempRoot, "model-list-pagination-regression");

try {
  fs.writeFileSync(testSource, source.slice(0, bootstrapIndex));
  const compile = spawnSync("swiftc", [
    testSource,
    path.join(root, "scripts", "model-list-pagination-regression.swift"),
    "-framework",
    "Cocoa",
    "-framework",
    "WebKit",
    "-o",
    executable
  ], { encoding: "utf8", cwd: root });
  if (compile.status !== 0) {
    throw new Error(`model/list pagination regression compile failed\n${compile.stdout}\n${compile.stderr}`);
  }
  const run = spawnSync(executable, [], { encoding: "utf8", cwd: root });
  if (run.status !== 0) {
    throw new Error(`model/list pagination regression failed\n${run.stdout}\n${run.stderr}`);
  }
  process.stdout.write(run.stdout);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
