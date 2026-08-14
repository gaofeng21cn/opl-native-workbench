import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OCI carrier runs only the Node headless host with persistent non-root defaults", async () => {
  const [dockerfile, compose] = await Promise.all([
    readFile(new URL("../../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../../compose.yaml", import.meta.url), "utf8")
  ]);
  const runtime = dockerfile.slice(dockerfile.indexOf("FROM ${NODE_IMAGE} AS runtime"));
  assert.match(runtime, /USER node/);
  assert.match(runtime, /VOLUME \["\/data", "\/projects"\]/);
  assert.match(runtime, /HEALTHCHECK[\s\S]*\/healthz/);
  assert.match(runtime, /CMD \["node", "scripts\/headless\/run\.mjs"\]/);
  assert.doesNotMatch(runtime, /electron|aionui|aioncore/i);
  assert.doesNotMatch(runtime, /package\.json/);
  assert.match(compose, /127\.0\.0\.1:\$\{OPL_APP_PORT:-4178\}/);
  assert.match(compose, /opl-data:\/data/);
  assert.match(compose, /opl-projects:\/projects/);
});
