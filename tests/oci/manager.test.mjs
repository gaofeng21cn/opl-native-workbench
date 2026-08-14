import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createMultiArchBuildPlan, multiArchPlatforms } from "../../scripts/oci/build-plan.mjs";
import { createOciManager, OciManagerError } from "../../scripts/oci/manage.mjs";

const imageA = {
  id: `sha256:${"a".repeat(64)}`,
  digests: [],
  revision: "1".repeat(40)
};
const imageB = {
  id: `sha256:${"b".repeat(64)}`,
  digests: [],
  revision: "2".repeat(40)
};

function fakeDocker({ images, failUpFor = new Set() }) {
  const calls = [];
  const execute = async (command, args, options = {}) => {
    calls.push({ command, args, env: options.env });
    const success = (stdout = "") => ({ exitCode: 0, signal: null, stdout, stderr: "" });
    const failure = (stderr = "failed") => ({ exitCode: 1, signal: null, stdout: "", stderr });
    if (command !== "docker") return failure("unexpected command");
    if (args[0] === "info") return success("27.0.0\n");
    if (args[0] === "compose" && args[1] === "version") return success("2.30.0\n");
    if (args[0] === "pull") return images.has(args[1]) ? success() : failure("missing image");
    if (args[0] === "image" && args[1] === "inspect") {
      const image = images.get(args[2]);
      if (!image) return failure("missing image");
      const format = args.at(-1);
      if (format === "{{.Id}}") return success(`${image.id}\n`);
      if (format === "{{json .RepoDigests}}") return success(`${JSON.stringify(image.digests)}\n`);
      if (format === "{{json .Config.Labels}}") {
        return success(`${JSON.stringify({ "org.opencontainers.image.revision": image.revision })}\n`);
      }
    }
    if (args[0] === "compose") {
      const operation = args.find((value) => ["up", "ps", "down"].includes(value));
      if (operation === "up" && failUpFor.has(options.env?.OPL_APP_IMAGE)) return failure("fixture update failure");
      if (operation === "ps") return success("fixture-container\n");
      return success();
    }
    if (args[0] === "inspect" && args.at(-1) === "{{.State.Health.Status}}") return success("healthy\n");
    return failure(`unexpected docker args: ${args.join(" ")}`);
  };
  return { calls, execute };
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "opl-oci-manager-"));
  const sourceRoot = path.join(root, "source");
  const stateDirectory = path.join(root, "state");
  await mkdir(sourceRoot);
  await writeFile(path.join(sourceRoot, "docker-compose.distribution.yaml"), "services: {}\n", "utf8");
  return { root, sourceRoot, stateDirectory };
}

test("manager rejects mutable image references outside explicit local candidate validation", async () => {
  const paths = await fixture();
  const docker = fakeDocker({ images: new Map([["fixture:a", imageA]]) });
  const manager = createOciManager({ execute: docker.execute, sourceRoot: paths.sourceRoot });
  await assert.rejects(
    manager.run("install", { image: "fixture:a", stateDirectory: paths.stateDirectory }),
    (error) => error instanceof OciManagerError && error.code === "mutable_image_ref_rejected"
  );
});

test("manager rejects image references that Docker could parse as options", async () => {
  const paths = await fixture();
  const docker = fakeDocker({ images: new Map() });
  const manager = createOciManager({ execute: docker.execute, sourceRoot: paths.sourceRoot });
  await assert.rejects(
    manager.run("install", {
      image: `--config@sha256:${"c".repeat(64)}`,
      stateDirectory: paths.stateDirectory
    }),
    (error) => error instanceof OciManagerError && error.code === "invalid_argument"
  );
  assert.equal(docker.calls.some((call) => call.args[0] === "image"), false);
});

test("manager rejects broad state directories before creating lifecycle files", async () => {
  const paths = await fixture();
  const docker = fakeDocker({ images: new Map([["fixture:a", imageA]]) });
  const manager = createOciManager({ execute: docker.execute, sourceRoot: paths.sourceRoot });
  await assert.rejects(
    manager.run("install", { image: "fixture:a", allowLocalImage: true, stateDirectory: path.parse(paths.root).root }),
    (error) => error.code === "state_directory_unsafe"
  );
  assert.equal(docker.calls.length, 0);
});

test("manager installs, updates, recreates, rolls back, and uninstalls with immutable local IDs", async () => {
  const paths = await fixture();
  const docker = fakeDocker({ images: new Map([
    ["fixture:a", imageA],
    ["fixture:b", imageB]
  ]) });
  let tick = 0;
  const manager = createOciManager({
    execute: docker.execute,
    sourceRoot: paths.sourceRoot,
    now: () => `2026-08-15T00:00:0${tick += 1}.000Z`
  });
  const base = {
    allowLocalImage: true,
    stateDirectory: paths.stateDirectory,
    projectName: "opl-fixture",
    port: 49178
  };

  const installed = await manager.run("install", { ...base, image: "fixture:a" });
  assert.equal(installed.status, "oci_installed");
  assert.equal(installed.current.immutableRef, imageA.id);
  assert.equal(installed.current.supplyChain.localCandidateOnly, true);
  const firstState = JSON.parse(await readFile(path.join(paths.stateDirectory, "installation.json"), "utf8"));
  assert.equal(firstState.current.observedId, imageA.id);
  assert.equal(firstState.previous, null);

  const updated = await manager.run("update", { ...base, image: "fixture:b" });
  assert.equal(updated.status, "oci_updated");
  assert.equal(updated.current.observedId, imageB.id);
  assert.equal(updated.previous.observedId, imageA.id);

  assert.equal((await manager.run("recreate", base)).status, "oci_recreated");
  const rolledBack = await manager.run("rollback", base);
  assert.equal(rolledBack.status, "oci_rolled_back");
  assert.equal(rolledBack.current.observedId, imageA.id);
  assert.equal(rolledBack.previous.observedId, imageB.id);
  assert.equal((await manager.run("status", base)).health, "healthy");

  const uninstalled = await manager.run("uninstall", base);
  assert.equal(uninstalled.dataPreserved, true);
  assert.equal((await manager.run("status", base)).installed, false);
  const downCall = docker.calls.findLast((call) => call.args.includes("down"));
  assert.ok(downCall);
  assert.equal(downCall.args.includes("--volumes"), false);
});

test("failed update restores the previous image and does not advance installation state", async () => {
  const paths = await fixture();
  const docker = fakeDocker({
    images: new Map([["fixture:a", imageA], ["fixture:b", imageB]]),
    failUpFor: new Set([imageB.id])
  });
  const manager = createOciManager({ execute: docker.execute, sourceRoot: paths.sourceRoot });
  const base = { allowLocalImage: true, stateDirectory: paths.stateDirectory, projectName: "opl-recovery", port: 49179 };
  await manager.run("install", { ...base, image: "fixture:a" });
  await assert.rejects(
    manager.run("update", { ...base, image: "fixture:b" }),
    (error) => error.code === "update_failed" && error.details.recovered === true
  );
  const state = JSON.parse(await readFile(path.join(paths.stateDirectory, "installation.json"), "utf8"));
  assert.equal(state.current.observedId, imageA.id);
  assert.equal(state.previous, null);
});

test("manager rejects a modified installed Compose template before Docker mutation", async () => {
  const paths = await fixture();
  const docker = fakeDocker({ images: new Map([["fixture:a", imageA]]) });
  const manager = createOciManager({ execute: docker.execute, sourceRoot: paths.sourceRoot });
  const base = { allowLocalImage: true, stateDirectory: paths.stateDirectory, projectName: "opl-integrity", port: 49182 };
  await manager.run("install", { ...base, image: "fixture:a" });
  await writeFile(path.join(paths.stateDirectory, "docker-compose.yaml"), "services: { changed: {} }\n", "utf8");
  const callsBefore = docker.calls.length;
  await assert.rejects(
    manager.run("recreate", base),
    (error) => error.code === "compose_integrity_invalid"
  );
  assert.equal(docker.calls.slice(callsBefore).some((call) => call.args.includes("up")), false);
});

test("digest installation records the immutable registry identity without claiming signature verification", async () => {
  const paths = await fixture();
  const digest = `ghcr.io/example/one-person-lab@sha256:${"c".repeat(64)}`;
  const image = { id: `sha256:${"d".repeat(64)}`, digests: [digest], revision: "3".repeat(40) };
  const docker = fakeDocker({ images: new Map([[digest, image]]) });
  const manager = createOciManager({ execute: docker.execute, sourceRoot: paths.sourceRoot });
  const receipt = await manager.run("install", {
    image: digest,
    stateDirectory: paths.stateDirectory,
    projectName: "opl-digest",
    port: 49180
  });
  assert.equal(receipt.current.immutableRef, digest);
  assert.equal(receipt.current.supplyChain.registryDigestPinned, true);
  assert.equal(receipt.current.supplyChain.signatureVerification, "not_implemented");
  await manager.run("uninstall", { stateDirectory: paths.stateDirectory });
});

test("purge-data is the only uninstall path that removes named volumes", async () => {
  const paths = await fixture();
  const docker = fakeDocker({ images: new Map([["fixture:a", imageA]]) });
  const manager = createOciManager({ execute: docker.execute, sourceRoot: paths.sourceRoot });
  const base = { allowLocalImage: true, stateDirectory: paths.stateDirectory, projectName: "opl-purge", port: 49181 };
  await manager.run("install", { ...base, image: "fixture:a" });
  const receipt = await manager.run("uninstall", { ...base, purgeData: true });
  assert.equal(receipt.dataPreserved, false);
  assert.ok(docker.calls.findLast((call) => call.args.includes("down")).args.includes("--volumes"));
});

test("multi-arch build contract is plan-only and requests SBOM plus provenance", () => {
  const plan = createMultiArchBuildPlan({
    image: "ghcr.io/example/one-person-lab:v26.8.15",
    sourceRevision: "a".repeat(40),
    output: "./out/one-person-lab.oci.tar"
  });
  assert.deepEqual(plan.platforms, multiArchPlatforms);
  assert.ok(plan.command.includes("linux/amd64,linux/arm64"));
  assert.ok(plan.command.includes("--provenance=mode=max"));
  assert.ok(plan.command.includes("--sbom=true"));
  assert.equal(plan.evidenceBoundary.executesBuild, false);
  assert.equal(plan.evidenceBoundary.hostedArchitectureQualified, false);
  assert.throws(() => createMultiArchBuildPlan({
    image: "ghcr.io/example/one-person-lab:latest",
    sourceRevision: "a".repeat(40),
    output: "./out/image.tar"
  }), /latest/);
});
