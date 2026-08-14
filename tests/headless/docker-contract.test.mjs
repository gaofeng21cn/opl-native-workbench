import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OCI carrier runs only the Node headless host with persistent non-root defaults", async () => {
  const [dockerfile, compose, distribution] = await Promise.all([
    readFile(new URL("../../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../../compose.yaml", import.meta.url), "utf8"),
    readFile(new URL("../../docker-compose.distribution.yaml", import.meta.url), "utf8")
  ]);
  assert.match(dockerfile, /node:22-bookworm-slim@sha256:[a-f0-9]{64}/);
  assert.match(dockerfile, /ARG OPL_APP_REF=65e6d5674d0bcd6aacd977dfbfcbecd925627ae6/);
  const runtime = dockerfile.slice(dockerfile.indexOf("FROM ${NODE_IMAGE} AS runtime"));
  assert.match(runtime, /org\.opencontainers\.image\.revision="\$\{OPL_SOURCE_REVISION\}"/);
  assert.doesNotMatch(runtime, /org\.opencontainers\.image\.licenses/);
  assert.match(runtime, /USER node/);
  assert.match(runtime, /VOLUME \["\/data", "\/projects"\]/);
  assert.match(runtime, /HEALTHCHECK[\s\S]*\/healthz/);
  assert.match(runtime, /CMD \["node", "scripts\/headless\/run\.mjs"\]/);
  assert.doesNotMatch(runtime, /electron|aionui|aioncore/i);
  assert.doesNotMatch(runtime, /package\.json/);
  assert.match(compose, /127\.0\.0\.1:\$\{OPL_APP_PORT:-4178\}/);
  assert.match(compose, /opl-data:\/data/);
  assert.match(compose, /opl-projects:\/projects/);
  for (const value of [compose, distribution]) {
    assert.match(value, /read_only: true/);
    assert.match(value, /no-new-privileges:true/);
    assert.match(value, /cap_drop:\s*\n\s*- ALL/);
    assert.match(value, /pids_limit: 512/);
    assert.match(value, /\/tmp:rw,noexec,nosuid,nodev,size=256m/);
    assert.doesNotMatch(value, /0\.0\.0\.0:\$\{OPL_APP_PORT/);
  }
  assert.match(distribution, /image: \$\{OPL_APP_IMAGE:\?immutable OPL_APP_IMAGE is required\}/);
  assert.match(distribution, /pull_policy: never/);
  assert.doesNotMatch(distribution, /\bbuild:/);
});
