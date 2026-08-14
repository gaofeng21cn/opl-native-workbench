import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outRoot = path.join(root, "out");

assert.ok(fs.existsSync(outRoot), "desktop package output is missing");
const files = fs.readdirSync(outRoot, { recursive: true }).map(String);
const asar = files.find((entry) => entry.toLowerCase().endsWith(path.join("resources", "app.asar")));
assert.ok(asar, "desktop package must contain app.asar");
assert.ok(
  files.some((entry) => /One Person Lab Preview\.app\/Contents\/MacOS\/One Person Lab Preview$/.test(entry))
    || files.some((entry) => /One Person Lab Preview\.exe$/.test(entry))
    || files.some((entry) => /one-person-lab-preview$/i.test(entry)),
  "desktop package must contain the current platform executable"
);

const builderConfig = fs.readFileSync(path.join(root, "electron-builder.yml"), "utf8");
for (const marker of ["mac:", "win:", "linux:", "desktop/**/*", "dist/desktop/**/*", "scripts/webui-host/**/*"]) {
  assert.match(builderConfig, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing builder marker ${marker}`);
}
for (const forbidden of ["Package.swift", "WKWebView", "AppKit", "AionCore"]) {
  assert.doesNotMatch(builderConfig, new RegExp(forbidden), `desktop package config must not use ${forbidden}`);
}

console.log(JSON.stringify({
  status: "desktop_package_validated",
  platform: process.platform,
  appAsar: asar,
  sharedHostCore: true,
  desktopCarriers: ["macos", "windows", "linux"]
}, null, 2));
