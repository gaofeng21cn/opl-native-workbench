import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("../..", import.meta.url).pathname);

test("clean VM and Gateway qualification remain candidate-only surfaces", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const cleanVm = fs.readFileSync(path.join(root, "scripts/desktop/qualify-clean-vm.mjs"), "utf8");
  const gateway = fs.readFileSync(path.join(root, "scripts/desktop/diagnose-gateway-credential-persistence.mjs"), "utf8");
  const docs = fs.readFileSync(path.join(root, "docs/delivery/desktop-distribution.md"), "utf8");

  assert.equal(packageJson.scripts["qualify:desktop:clean-vm"], "node scripts/desktop/qualify-clean-vm.mjs");
  assert.equal(packageJson.scripts["diagnose:gateway:persistence"], "node scripts/desktop/diagnose-gateway-credential-persistence.mjs");
  assert.match(cleanVm, /cleanVmReady: false/);
  assert.match(cleanVm, /releaseReady: false/);
  assert.match(cleanVm, /activeShellAdopted: false/);
  assert.match(cleanVm, /readbackStderr/);
  assert.match(cleanVm, /appServerErrors/);
  assert.match(cleanVm, /OPL_Framework_runtime_readback_not_proven_in_clean_VM/);
  assert.match(gateway, /credentials\.json/);
  assert.match(gateway, /sha256/);
  assert.match(gateway, /mode0600After/);
  assert.match(gateway, /window\.oplStudio\.readState/);
  assert.match(docs, /candidate evidence only/);
  assert.match(docs, /Framework-owned/);
});
