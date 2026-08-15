import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(modulePath), "..");

function normalizedEntries(directory) {
  return fs.readdirSync(directory, { recursive: true }).map(String).map((entry) => entry.split(path.sep).join("/"));
}

function executablePattern(platform) {
  if (platform === "darwin") return /One Person Lab Preview\.app\/Contents\/MacOS\/One Person Lab Preview$/;
  if (platform === "win32") return /win-unpacked\/One Person Lab Preview\.exe$/;
  if (platform === "linux") return /linux(?:-[^/]+)?-unpacked\/one-person-lab-preview$/i;
  throw new Error(`Unsupported desktop package platform: ${platform}`);
}

function requiredDistributionArtifacts({ platform, version, arch }) {
  const platformName = platform === "win32" ? "win" : platform === "darwin" ? "mac" : "linux";
  const base = `one-person-lab-preview-${version}-${platformName}-${arch}`;
  if (platform === "win32") return [`${base}.exe`, `${base}.zip`];
  if (platform === "linux") {
    const debArch = arch === "x64" ? "amd64" : arch;
    return [`one-person-lab-preview-${version}-${platformName}-${debArch}.deb`];
  }
  if (platform === "darwin") return [`${base}.dmg`, `${base}.zip`];
  throw new Error(`Unsupported desktop distribution platform: ${platform}`);
}

export function validateDesktopPackage({
  repositoryRoot = defaultRoot,
  outRoot = path.join(repositoryRoot, "out"),
  platform = process.platform,
  arch = process.arch,
  requireDistribution = false
} = {}) {
  assert.ok(fs.existsSync(outRoot), "desktop package output is missing");
  const files = normalizedEntries(outRoot);
  const asar = files.find((entry) => entry.toLowerCase().endsWith("/resources/app.asar"));
  assert.ok(asar, "desktop package must contain app.asar");
  assert.ok(files.some((entry) => executablePattern(platform).test(entry)), `desktop package must contain the ${platform} executable`);

  const builderConfig = fs.readFileSync(path.join(repositoryRoot, "electron-builder.yml"), "utf8");
  for (const marker of ["mac:", "win:", "linux:", "desktop/**/*", "dist/desktop/**/*", "scripts/webui-host/**/*"]) {
    assert.match(builderConfig, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing builder marker ${marker}`);
  }
  for (const forbidden of ["Package.swift", "WKWebView", "AppKit", "AionCore"]) {
    assert.doesNotMatch(builderConfig, new RegExp(forbidden), `desktop package config must not use ${forbidden}`);
  }

  const distributionArtifacts = [];
  if (requireDistribution) {
    const version = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8")).version;
    const topLevel = new Set(fs.readdirSync(outRoot));
    for (const name of requiredDistributionArtifacts({ platform, version, arch })) {
      assert.ok(topLevel.has(name), `desktop distribution artifact is missing: ${name}`);
      const artifactPath = path.join(outRoot, name);
      const artifact = fs.statSync(artifactPath);
      assert.ok(artifact.isFile() && artifact.size > 1024, `desktop distribution artifact is empty: ${name}`);
      distributionArtifacts.push({ name, size: artifact.size });
    }
  }

  return {
    schema: "opl_desktop_package_qualification.v1",
    status: "desktop_package_validated",
    platform,
    arch,
    appAsar: asar,
    sharedHostCore: true,
    desktopCarriers: ["macos", "windows", "linux"],
    distributionRequired: requireDistribution,
    distributionArtifacts
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  console.log(JSON.stringify(validateDesktopPackage({
    requireDistribution: process.argv.includes("--distribution")
  }), null, 2));
}
