import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowPath = path.join(repositoryRoot, ".github", "workflows", "non-release-validation.yml");

function named(steps, name) {
  const step = steps.find((candidate) => candidate.name === name);
  assert.ok(step, `missing workflow step: ${name}`);
  return step;
}

test("package scripts expose the supported headless install surface", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["headless:install"], "node scripts/install-headless.mjs install");
  assert.equal(packageJson.scripts["headless:status"], "node scripts/install-headless.mjs status");
  assert.equal(packageJson.scripts["headless:update"], "node scripts/install-headless.mjs update");
  assert.equal(packageJson.scripts["headless:rollback"], "node scripts/install-headless.mjs rollback");
  assert.equal(packageJson.scripts["headless:uninstall"], "node scripts/install-headless.mjs uninstall");
});

test("hosted macOS qualification installs pinned runtime inputs and reads owner state", async () => {
  const workflow = YAML.parse(await readFile(workflowPath, "utf8"));
  const job = workflow.jobs["headless-installed-macos"];
  assert.ok(job, "missing hosted macOS headless installed job");
  assert.equal(job["runs-on"], "macos-latest");

  const cohort = named(job.steps, "Read pinned Framework/App cohort");
  const framework = named(job.steps, "Checkout Framework Host");
  const frameworkRuntime = named(job.steps, "Prepare pinned Framework runtime");
  const app = named(job.steps, "Checkout App product authority");
  const bun = named(job.steps, "Set up Bun");
  const codex = named(job.steps, "Install pinned Codex CLI");
  const install = named(job.steps, "Install headless macOS user service");
  const update = named(job.steps, "Update and restart installed headless runtime");
  const rollback = named(job.steps, "Roll back and restart installed headless runtime");
  const inspect = named(job.steps, "Inspect installed headless runtime");
  const binding = named(job.steps, "Verify installed LaunchAgent binding");

  assert.match(cohort.run, /candidateContractEvidence\.json/);
  assert.match(cohort.run, /framework_commit/);
  assert.match(cohort.run, /app_commit/);
  assert.equal(framework.with.repository, "gaofeng21cn/one-person-lab");
  assert.equal(framework.with.ref, "${{ steps.runtime-cohort.outputs.framework_sha }}");
  assert.equal(job.env.OPL_APP_OPL_BIN, "${{ github.workspace }}/framework/bin/opl");
  assert.equal(frameworkRuntime["working-directory"], "framework");
  assert.match(frameworkRuntime.run, /npm ci --ignore-scripts/);
  assert.match(frameworkRuntime.run, /npm run build:packages/);
  assert.doesNotMatch(frameworkRuntime.run, /npm run build(?:\s|$)/);
  assert.equal(app.with.repository, "gaofeng21cn/one-person-lab-app");
  assert.equal(app.with.ref, "${{ steps.runtime-cohort.outputs.app_sha }}");
  assert.equal(bun.uses, "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6");
  assert.equal(bun.with["bun-version"], "1.3.14");
  assert.match(codex.run, /@openai\/codex@0\.147\.0/);
  assert.match(codex.run, /OPL_CODEX_BIN=/);
  assert.match(codex.run, /OPL_HEADLESS_TARGET_VERSION=\$\(node -p 'require\("\.\/package\.json"\)\.version'\)/);
  assert.doesNotMatch(codex.run, /require\(\\"/);

  assert.match(install.run, /headless:install/);
  assert.match(install.run, /--readback-timeout-ms 120000/);
  assert.match(install.run, /ready\?\.status !== "ready"/);
  assert.match(install.run, /appServerAvailable !== true/);
  assert.match(install.run, /surfaceKind !== "opl_app_state\.v1"/);
  assert.match(update.run, /headless:update/);
  assert.match(update.run, /status !== "updated"/);
  assert.match(update.run, /version !== process\.env\.OPL_HEADLESS_TARGET_VERSION/);
  assert.match(rollback.run, /headless:rollback/);
  assert.match(rollback.run, /status !== "rolled_back"/);
  assert.match(rollback.run, /version !== process\.env\.OPL_HEADLESS_BASE_VERSION/);
  assert.match(inspect.run, /headless:status/);
  assert.match(inspect.run, /readback\?\.exitCode !== 0/);
  assert.match(binding.run, /ProgramArguments\.1/);
  assert.match(binding.run, /current\/scripts\/headless\/run\.mjs/);
  assert.match(binding.run, /EnvironmentVariables\.OPL_APP_OPL_BIN/);
  assert.match(binding.run, /EnvironmentVariables\.OPL_APP_STATE_TIMEOUT_MS/);
});

test("hosted macOS qualification always removes service definition and installed payload", async () => {
  const workflowSource = await readFile(workflowPath, "utf8");
  const workflow = YAML.parse(workflowSource);
  const job = workflow.jobs["headless-installed-macos"];
  assert.ok(job, "missing hosted macOS headless installed job");
  const cleanup = named(job.steps, "Uninstall headless macOS user service and verify cleanup");

  assert.match(cleanup.if, /always\(\)/);
  assert.match(cleanup.run, /headless:uninstall/);
  assert.match(cleanup.run, /launchctl print/);
  assert.match(cleanup.run, /LaunchAgents\/com\.onepersonlab\.headless\.plist/);
  assert.match(cleanup.run, /test ! -e "\$OPL_HEADLESS_INSTALL_ROOT"/);

  const serializedJob = JSON.stringify(job);
  assert.doesNotMatch(serializedJob, /--no-sandbox/);
  assert.doesNotMatch(serializedJob, /(?:release|publish|deploy|notary)\s*:/i);
});
