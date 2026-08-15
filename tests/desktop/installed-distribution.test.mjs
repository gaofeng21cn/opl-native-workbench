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
const builderPath = path.join(repositoryRoot, "electron-builder.yml");
const linuxAfterRemovePath = path.join(repositoryRoot, "scripts", "desktop", "linux-after-remove.sh");

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
  const workflow = YAML.parse(await readFile(workflowPath, "utf8"));
  const builder = YAML.parse(await readFile(builderPath, "utf8"));
  const install = stepByName(steps, "Install Windows NSIS package");
  const smoke = stepByName(steps, "Start installed Windows app and read Chromium AX tree");
  const cleanup = stepByName(steps, "Uninstall Windows NSIS package and verify cleanup");

  assert.equal(install.if, "matrix.distribution == 'windows'");
  assert.equal(workflow.jobs["desktop-distribution"].env.OPL_DESKTOP_WINDOWS_INSTALL_ID, builder.nsis.guid);
  assert.match(install.run, /Start-Process[^\n]+-ArgumentList '\/S'[^\n]+-Wait/);
  assert.match(install.run, /InstallLocation/);
  assert.match(install.run, /HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall/);
  assert.match(install.run, /OPL_DESKTOP_EXECUTABLE=/);
  assert.equal(smoke.run, "npm run smoke:desktop-live");
  assert.match(cleanup.if, /always\(\)/);
  assert.match(cleanup.run, /OPL_DESKTOP_WINDOWS_INSTALL_ATTEMPTED/);
  assert.match(cleanup.run, /Uninstall One Person Lab Preview\.exe/);
  assert.match(cleanup.run, /left exact product files or registry identity behind/);
  assert.doesNotMatch(cleanup.run, /Get-ChildItem[^\n]+-Recurse/);
});

test("Linux hosted qualification installs, smokes, and always purges the DEB package", async () => {
  const steps = await workflowSteps();
  const install = stepByName(steps, "Install Linux DEB package");
  const smoke = stepByName(steps, "Start installed Linux app and read Chromium AX tree");
  const cleanup = stepByName(steps, "Purge Linux DEB package and verify cleanup");

  assert.equal(install.if, "matrix.distribution == 'linux'");
  assert.match(install.run, /sudo apt-get install --no-install-recommends --yes/);
  assert.match(install.run, /unshare --user true/);
  assert.match(install.run, /root:root 755/);
  assert.match(install.run, /root:root 4755/);
  assert.match(install.run, /OPL_DESKTOP_EXECUTABLE=/);
  assert.match(smoke.run, /xvfb-run --auto-servernum npm run smoke:desktop-live/);
  assert.match(cleanup.if, /always\(\)/);
  assert.match(cleanup.run, /sudo dpkg --purge/);
  assert.match(cleanup.run, /test ! -e "\$OPL_DESKTOP_APP_PATH"/);
});

test("Linux DEB removal unregisters the installed alternative target", async () => {
  const builder = YAML.parse(await readFile(builderPath, "utf8"));
  const afterRemove = await readFile(linuxAfterRemovePath, "utf8");

  assert.equal(builder.deb.afterRemove, "scripts/desktop/linux-after-remove.sh");
  assert.match(afterRemove, /update-alternatives --remove/);
  assert.match(afterRemove, /\/opt\/One Person Lab Preview\/one-person-lab-preview/);
  assert.doesNotMatch(afterRemove, /--remove[^\n]+\/usr\/bin\/one-person-lab-preview/);
});

test("desktop live smoke waits for forced process cleanup before installer removal", async () => {
  const smoke = await readFile(smokePath, "utf8");
  assert.match(smoke, /await waitFor\([\s\S]+forced desktop process exit/);
  assert.match(smoke, /await waitFor\([\s\S]+forced App Server cleanup/);
});

test("installed lifecycle qualification never disables the Chromium sandbox", async () => {
  const source = await readFile(workflowPath, "utf8");
  assert.doesNotMatch(source, /--no-sandbox/);
});
