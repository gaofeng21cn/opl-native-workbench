import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateDesktopPackage } from "../../scripts/validate-desktop-package.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const version = "0.1.0";

async function artifact(file, { executable = false } = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.alloc(2048, 1));
  if (executable) await chmod(file, 0o755);
}

async function fixture(platform) {
  const outRoot = await mkdtemp(path.join(os.tmpdir(), `opl-${platform}-distribution-`));
  if (platform === "win32") {
    await artifact(path.join(outRoot, "win-unpacked", "resources", "app.asar"));
    await artifact(path.join(outRoot, "win-unpacked", "One Person Lab Preview.exe"));
    await artifact(path.join(outRoot, `one-person-lab-preview-${version}-win-x64.exe`));
    await artifact(path.join(outRoot, `one-person-lab-preview-${version}-win-x64.zip`));
  } else {
    await artifact(path.join(outRoot, "linux-unpacked", "resources", "app.asar"));
    await artifact(path.join(outRoot, "linux-unpacked", "one-person-lab-preview"), { executable: true });
    await artifact(path.join(outRoot, `one-person-lab-preview-${version}-linux-x86_64.AppImage`), { executable: true });
    await artifact(path.join(outRoot, `one-person-lab-preview-${version}-linux-amd64.deb`));
  }
  return outRoot;
}

test("Windows distribution qualification requires unpacked, NSIS, and ZIP artifacts", async () => {
  const outRoot = await fixture("win32");
  const receipt = validateDesktopPackage({ repositoryRoot, outRoot, platform: "win32", arch: "x64", requireDistribution: true });
  assert.equal(receipt.status, "desktop_package_validated");
  assert.deepEqual(receipt.distributionArtifacts.map((entry) => entry.name), [
    `one-person-lab-preview-${version}-win-x64.exe`,
    `one-person-lab-preview-${version}-win-x64.zip`
  ]);
});

test("Linux distribution qualification requires unpacked, AppImage, and DEB artifacts", async () => {
  const outRoot = await fixture("linux");
  const receipt = validateDesktopPackage({ repositoryRoot, outRoot, platform: "linux", arch: "x64", requireDistribution: true });
  assert.equal(receipt.status, "desktop_package_validated");
  assert.deepEqual(receipt.distributionArtifacts.map((entry) => entry.name), [
    `one-person-lab-preview-${version}-linux-x86_64.AppImage`,
    `one-person-lab-preview-${version}-linux-amd64.deb`
  ]);
});

test("platform qualification fails closed when one native distribution artifact is absent", async () => {
  const outRoot = await fixture("win32");
  await rm(path.join(outRoot, `one-person-lab-preview-${version}-win-x64.zip`));
  assert.throws(
    () => validateDesktopPackage({ repositoryRoot, outRoot, platform: "win32", arch: "x64", requireDistribution: true }),
    /artifact is missing/
  );
});
