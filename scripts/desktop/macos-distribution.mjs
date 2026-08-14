import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function command(executable, args, { input, allowFailure = false } = {}) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${path.basename(executable)} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function safeArtifactName(value) {
  invariant(typeof value === "string" && value === path.basename(value), `invalid update artifact path: ${String(value)}`);
  invariant(!value.includes("..") && !value.includes("/"), `invalid update artifact path: ${value}`);
  return value;
}

async function digest(file, algorithm, encoding) {
  return createHash(algorithm).update(await readFile(file)).digest(encoding);
}

export async function validateMacUpdateFeed({ outRoot, expectedVersion } = {}) {
  invariant(outRoot, "outRoot is required");
  const primaryPath = path.join(outRoot, "latest-mac.yml");
  const metadataBytes = await readFile(primaryPath);
  const metadata = parse(metadataBytes.toString("utf8"));
  invariant(metadata && typeof metadata === "object", "latest-mac.yml must contain an object");
  invariant(typeof metadata.version === "string", "latest-mac.yml version is required");
  if (expectedVersion) invariant(metadata.version === expectedVersion, `feed version ${metadata.version} does not match ${expectedVersion}`);
  invariant(Array.isArray(metadata.files) && metadata.files.length >= 2, "latest-mac.yml must list ZIP and DMG artifacts");

  const artifacts = [];
  for (const entry of metadata.files) {
    const name = safeArtifactName(entry?.url);
    invariant(typeof entry.sha512 === "string" && entry.sha512, `${name} sha512 is required`);
    invariant(Number.isSafeInteger(entry.size) && entry.size >= 0, `${name} size is required`);
    const file = path.join(outRoot, name);
    const actualSize = (await stat(file)).size;
    const actualSha512 = await digest(file, "sha512", "base64");
    invariant(
      actualSize === entry.size && actualSha512 === entry.sha512,
      `${name} does not match update metadata`
    );
    artifacts.push({ name, size: actualSize, sha512: actualSha512, sha256: await digest(file, "sha256", "hex") });
  }
  invariant(artifacts.some((entry) => entry.name.endsWith(".zip")), "latest-mac.yml must include the updater ZIP");
  invariant(artifacts.some((entry) => entry.name.endsWith(".dmg")), "latest-mac.yml must include the installer DMG");
  const primaryName = safeArtifactName(metadata.path);
  const primary = artifacts.find((entry) => entry.name === primaryName);
  invariant(primary && primary.sha512 === metadata.sha512, "latest-mac.yml primary path and sha512 must bind the updater ZIP");

  const compatibilityPath = path.join(outRoot, "latest-arm64-mac.yml");
  let compatibilityMetadataByteIdentical = false;
  try {
    compatibilityMetadataByteIdentical = Buffer.compare(metadataBytes, await readFile(compatibilityPath)) === 0;
  } catch {}
  return {
    schema: "opl_desktop_update_feed_qualification.v1",
    version: metadata.version,
    metadata: "latest-mac.yml",
    compatibilityMetadata: "latest-arm64-mac.yml",
    compatibilityMetadataByteIdentical,
    artifacts
  };
}

export async function prepareMacUpdateFeed({ outRoot } = {}) {
  invariant(outRoot, "outRoot is required");
  await copyFile(path.join(outRoot, "latest-mac.yml"), path.join(outRoot, "latest-arm64-mac.yml"));
  const result = await validateMacUpdateFeed({ outRoot });
  invariant(result.compatibilityMetadataByteIdentical, "compatibility metadata must be byte-identical to latest-mac.yml");
  return result;
}

function plistValue(plistPath, key) {
  return command("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plistPath]).stdout.trim();
}

function signatureDetails(appPath) {
  command("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  const details = command("/usr/bin/codesign", ["-dvvv", appPath], { allowFailure: true });
  const text = `${details.stdout}\n${details.stderr}`;
  const authority = text.match(/^Authority=(Developer ID Application: .+)$/m)?.[1];
  const teamIdentifier = text.match(/^TeamIdentifier=(.+)$/m)?.[1];
  return {
    valid: details.status === 0,
    authority,
    teamIdentifier,
    hardenedRuntime: /flags=.*\(runtime\)/.test(text)
  };
}

function trustResult(appPath, dmgPath) {
  const gatekeeper = command("/usr/sbin/spctl", ["-a", "-vv", "--type", "execute", appPath], { allowFailure: true });
  const appStaple = command("/usr/bin/xcrun", ["stapler", "validate", appPath], { allowFailure: true });
  const dmgStaple = command("/usr/bin/xcrun", ["stapler", "validate", dmgPath], { allowFailure: true });
  return {
    gatekeeperAccepted: gatekeeper.status === 0,
    appStapled: appStaple.status === 0,
    dmgStapled: dmgStaple.status === 0,
    gatekeeperDetail: (gatekeeper.stderr || gatekeeper.stdout).trim().split("\n").slice(-3)
  };
}

async function extractedUpdaterApp(zipPath, directory) {
  command("/usr/bin/ditto", ["-x", "-k", zipPath, directory]);
  const entries = await readdir(directory, { recursive: true });
  const relative = entries.map(String).find((entry) => entry.endsWith(".app/Contents/Info.plist"));
  invariant(relative, "updater ZIP does not contain a macOS App bundle");
  return path.join(directory, relative.slice(0, -"/Contents/Info.plist".length));
}

function dmgFormat(dmgPath) {
  const imageInfo = command("/usr/bin/hdiutil", ["imageinfo", "-plist", dmgPath]).stdout;
  return command("/usr/bin/plutil", ["-extract", "Format", "raw", "-o", "-", "-"], { input: imageInfo }).stdout.trim();
}

export async function qualifyMacDistribution({
  outRoot = path.join(repositoryRoot, "out"),
  packageFile = path.join(repositoryRoot, "package.json"),
  requireReleaseTrust = false
} = {}) {
  invariant(process.platform === "darwin", "macOS distribution qualification requires macOS");
  const pkg = JSON.parse(await readFile(packageFile, "utf8"));
  const feed = await prepareMacUpdateFeed({ outRoot });
  invariant(feed.version === pkg.version, `feed version ${feed.version} does not match package version ${pkg.version}`);
  const zip = feed.artifacts.find((entry) => entry.name.endsWith(".zip"));
  const dmg = feed.artifacts.find((entry) => entry.name.endsWith(".dmg"));
  invariant(zip && dmg, "qualified feed must bind one ZIP and one DMG");
  invariant(await stat(path.join(outRoot, `${zip.name}.blockmap`)), "updater ZIP blockmap is missing");
  command("/usr/bin/hdiutil", ["verify", path.join(outRoot, dmg.name)]);
  const format = dmgFormat(path.join(outRoot, dmg.name));
  invariant(format === "ULFO", `macOS DMG must use ULFO, observed ${format}`);

  const extractionRoot = await mkdtemp(path.join(os.tmpdir(), "opl-desktop-qualification-"));
  try {
    const appPath = await extractedUpdaterApp(path.join(outRoot, zip.name), extractionRoot);
    const infoPlist = path.join(appPath, "Contents", "Info.plist");
    const version = plistValue(infoPlist, "CFBundleShortVersionString");
    const buildVersion = plistValue(infoPlist, "CFBundleVersion");
    const bundleIdentifier = plistValue(infoPlist, "CFBundleIdentifier");
    const productName = plistValue(infoPlist, "CFBundleDisplayName");
    invariant(version === pkg.version && buildVersion === pkg.version, "App bundle version does not match update feed");

    const signature = signatureDetails(appPath);
    invariant(signature.valid, "updater ZIP App signature is invalid");
    invariant(signature.authority?.startsWith("Developer ID Application:"), "updater ZIP App is not Developer ID signed");
    invariant(signature.teamIdentifier, "updater ZIP App has no TeamIdentifier");
    invariant(signature.hardenedRuntime, "updater ZIP App does not enable hardened runtime");

    const appUpdate = parse(await readFile(path.join(appPath, "Contents", "Resources", "app-update.yml"), "utf8"));
    invariant(appUpdate?.provider === "github", "App update provider must be GitHub");
    invariant(appUpdate?.owner === "gaofeng21cn" && appUpdate?.repo === "opl-studio", "App must use the dedicated opl-studio updater feed");

    const trust = trustResult(appPath, path.join(outRoot, dmg.name));
    const releaseTrustAccepted = trust.gatekeeperAccepted && trust.appStapled && trust.dmgStapled;
    if (requireReleaseTrust) invariant(releaseTrustAccepted, "release trust requires Gatekeeper acceptance and stapled App/DMG tickets");
    const receipt = {
      schema: "opl_macos_desktop_distribution_qualification.v1",
      carrier: "electron_desktop",
      candidateId: "opl-studio",
      productName,
      bundleIdentifier,
      version,
      buildVersion,
      architecture: process.arch,
      feed,
      dmg: { name: dmg.name, format, verified: true },
      updaterZip: { name: zip.name, blockmapPresent: true },
      signature,
      trust,
      localDistributableCandidate: true,
      releaseReady: releaseTrustAccepted,
      releaseBlocker: releaseTrustAccepted ? null : "apple_notarization_and_stapling_required"
    };
    await writeFile(path.join(outRoot, "macos-distribution-qualification.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    return receipt;
  } finally {
    await rm(extractionRoot, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const receipt = await qualifyMacDistribution({
    requireReleaseTrust: process.argv.includes("--require-release-trust")
  });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
