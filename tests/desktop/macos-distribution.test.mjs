import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";
import {
  prepareMacUpdateFeed,
  validateMacUpdateFeed
} from "../../scripts/desktop/macos-distribution.mjs";
import { nextPatchVersion } from "../../scripts/desktop/qualify-local-updater.mjs";

const root = path.resolve(new URL("../..", import.meta.url).pathname);

test("local updater qualification derives exactly one patch-newer target", () => {
  assert.equal(nextPatchVersion("0.1.0"), "0.1.1");
  assert.throws(() => nextPatchVersion("0.1.0-preview.1"), /numeric semver/);
});

test("macOS builder declares hardened runtime, ULFO, and the dedicated Studio update feed", async () => {
  const builder = await readFile(path.join(root, "electron-builder.yml"), "utf8");
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.match(builder, /hardenedRuntime:\s*true/);
  assert.match(builder, /dmg:\s*\n\s+format:\s*ULFO/);
  assert.match(builder, /publish:\s*\n\s+provider:\s*github\s*\n\s+owner:\s*gaofeng21cn\s*\n\s+repo:\s*opl-studio/);
  assert.match(pkg.scripts["dist:mac"], /qualify:desktop:mac/);
  assert.equal(pkg.scripts["test:desktop-distribution"], "node --test tests/desktop/*.test.mjs");
  assert.equal(pkg.scripts["qualify:desktop:updater:local"], "node scripts/desktop/qualify-local-updater.mjs");
});

test("macOS updater feed binds exact ZIP and DMG bytes and creates the compatibility metadata copy", async () => {
  const outRoot = await mkdtemp(path.join(os.tmpdir(), "opl-mac-feed-test-"));
  const zipName = "one-person-lab-preview-1.1.0-mac-arm64.zip";
  const dmgName = "one-person-lab-preview-1.1.0-mac-arm64.dmg";
  const zipBytes = Buffer.from("signed zip fixture");
  const dmgBytes = Buffer.from("signed dmg fixture");
  await mkdir(outRoot, { recursive: true });
  await writeFile(path.join(outRoot, zipName), zipBytes);
  await writeFile(path.join(outRoot, dmgName), dmgBytes);
  const sha512 = (value) => createHash("sha512").update(value).digest("base64");
  await writeFile(path.join(outRoot, "latest-mac.yml"), [
    "version: 1.1.0",
    "files:",
    `  - url: ${zipName}`,
    `    sha512: ${sha512(zipBytes)}`,
    `    size: ${zipBytes.length}`,
    `  - url: ${dmgName}`,
    `    sha512: ${sha512(dmgBytes)}`,
    `    size: ${dmgBytes.length}`,
    `path: ${zipName}`,
    `sha512: ${sha512(zipBytes)}`,
    "releaseDate: '2026-08-15T00:00:00.000Z'",
    ""
  ].join("\n"));

  const prepared = await prepareMacUpdateFeed({ outRoot });
  assert.equal(prepared.version, "1.1.0");
  assert.equal(prepared.compatibilityMetadataByteIdentical, true);
  const primary = await readFile(path.join(outRoot, "latest-mac.yml"));
  const compatibility = await readFile(path.join(outRoot, "latest-arm64-mac.yml"));
  assert.deepEqual(compatibility, primary);

  const validated = await validateMacUpdateFeed({ outRoot, expectedVersion: "1.1.0" });
  assert.deepEqual(validated.artifacts.map((entry) => entry.name), [zipName, dmgName]);
  assert.equal(parse(primary.toString()).version, validated.version);
});

test("macOS updater feed rejects metadata that does not match artifact bytes", async () => {
  const outRoot = await mkdtemp(path.join(os.tmpdir(), "opl-mac-feed-invalid-test-"));
  const artifact = "one-person-lab-preview-1.1.0-mac-arm64.zip";
  const dmg = "one-person-lab-preview-1.1.0-mac-arm64.dmg";
  const dmgBytes = Buffer.from("dmg bytes");
  await writeFile(path.join(outRoot, artifact), "changed bytes");
  await writeFile(path.join(outRoot, dmg), dmgBytes);
  const dmgSha512 = createHash("sha512").update(dmgBytes).digest("base64");
  await writeFile(path.join(outRoot, "latest-mac.yml"), [
    "version: 1.1.0",
    "files:",
    `  - url: ${artifact}`,
    "    sha512: invalid",
    "    size: 1",
    `  - url: ${dmg}`,
    `    sha512: ${dmgSha512}`,
    `    size: ${dmgBytes.length}`,
    `path: ${artifact}`,
    "sha512: invalid",
    ""
  ].join("\n"));
  await assert.rejects(
    validateMacUpdateFeed({ outRoot, expectedVersion: "1.1.0" }),
    /does not match update metadata/
  );
});
