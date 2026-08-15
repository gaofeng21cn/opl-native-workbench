import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowPath = path.join(repositoryRoot, ".github", "workflows", "non-release-validation.yml");
const smokePath = path.join(repositoryRoot, "scripts", "smoke-desktop-live.mjs");

async function workflowSteps() {
  const workflow = YAML.parse(await readFile(workflowPath, "utf8"));
  return workflow.jobs["desktop-distribution"].steps;
}

function stepByName(steps, name) {
  const step = steps.find((candidate) => candidate.name === name);
  assert.ok(step, `missing workflow step: ${name}`);
  return step;
}

test("desktop live smoke prioritizes an explicitly installed executable", () => {
  const missingExecutable = path.join(os.tmpdir(), "opl-installed-smoke-missing", "One Person Lab Preview.exe");
  const result = spawnSync(process.execPath, [smokePath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPL_DESKTOP_EXECUTABLE: missingExecutable,
      OPL_DESKTOP_APP_PATH: path.dirname(missingExecutable)
    }
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(`missing packaged executable: ${missingExecutable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

test("Windows hosted qualification installs, smokes, and always removes the NSIS package", async () => {
  const steps = await workflowSteps();
  const install = stepByName(steps, "Install Windows NSIS package");
  const smoke = stepByName(steps, "Start installed Windows app and read Chromium AX tree");
  const cleanup = stepByName(steps, "Uninstall Windows NSIS package and verify cleanup");

  assert.equal(install.if, "matrix.distribution == 'windows'");
  assert.match(install.run, /Start-Process[^\n]+-ArgumentList '\/S'[^\n]+-Wait/);
  assert.match(install.run, /OPL_DESKTOP_EXECUTABLE=/);
  assert.equal(smoke.run, "npm run smoke:desktop-live");
  assert.match(cleanup.if, /always\(\)/);
  assert.match(cleanup.run, /Uninstall\*\.exe/);
  assert.match(cleanup.run, /left the installation directory behind/);
  assert.match(cleanup.run, /left installed executable bytes behind/);
});

test("Linux hosted qualification installs, smokes, and always purges the DEB package", async () => {
  const steps = await workflowSteps();
  const install = stepByName(steps, "Install Linux DEB package");
  const smoke = stepByName(steps, "Start installed Linux app and read Chromium AX tree");
  const cleanup = stepByName(steps, "Purge Linux DEB package and verify cleanup");

  assert.equal(install.if, "matrix.distribution == 'linux'");
  assert.match(install.run, /sudo apt-get install --no-install-recommends --yes/);
  assert.match(install.run, /root:root 4755/);
  assert.match(install.run, /OPL_DESKTOP_EXECUTABLE=/);
  assert.match(smoke.run, /xvfb-run --auto-servernum npm run smoke:desktop-live/);
  assert.match(cleanup.if, /always\(\)/);
  assert.match(cleanup.run, /sudo dpkg --purge/);
  assert.match(cleanup.run, /test ! -e "\$OPL_DESKTOP_APP_PATH"/);
});

test("installed lifecycle qualification never disables the Chromium sandbox", async () => {
  const source = await readFile(workflowPath, "utf8");
  assert.doesNotMatch(source, /--no-sandbox/);
});
