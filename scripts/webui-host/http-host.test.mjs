import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";
import { CodexAppServerTransport } from "./app-server-transport.mjs";
import { CoordinationLedger } from "./coordination-ledger.mjs";
import { createWebUiHost } from "./http-host.mjs";

const fixture = new URL("./fixtures/fake-app-server.mjs", import.meta.url).pathname;

async function post(baseUrl, route, value) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value)
  });
  return { status: response.status, body: await response.json() };
}

test("loopback HTTP host exposes parity endpoints, typed failures, SSE, and real bridge passthrough shape", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opl-webui-http-test-"));
  const transport = new CodexAppServerTransport({
    command: process.execPath,
    args: [fixture],
    cwd: directory,
    requestTimeoutMs: 2_000,
    turnTimeoutMs: 2_000
  });
  const opl = {
    readState: async (profile) => ({ profile, app_state: { meta: { profile } }, readback: { exitCode: 0 } }),
    readFullDrilldown: async () => ({ detail: "full", drilldown: {}, readback: { exitCode: 0 } }),
    executeAction: async (request) => ({
      actionId: request.actionId,
      authorityBoundary: "app_bridge_no_domain_authority",
      status: request.dryRun === false ? "executed" : "preview_ready"
    })
  };
  const host = await createWebUiHost({
    transport,
    ledger: new CoordinationLedger({ filePath: path.join(directory, "ledger.jsonl"), maxEntries: 100 }),
    opl,
    webRoot: directory
  });
  await new Promise((resolve) => host.server.listen(0, "127.0.0.1", resolve));
  t.after(() => host.close());
  const address = host.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const capabilities = await fetch(`${baseUrl}/api/capabilities`).then((response) => response.json());
  assert.equal(capabilities.localHost, true);
  assert.equal(capabilities.threadCoordination.available, true);
  assert.equal(capabilities.threadCoordination.dynamicTools, "unprobed");

  const eventResponse = await fetch(`${baseUrl}/api/coordination/events`);
  const eventReader = eventResponse.body.getReader();
  const firstEvent = await eventReader.read();
  assert.match(new TextDecoder().decode(firstEvent.value), /host\/ready/);
  await eventReader.cancel();

  const list = await post(baseUrl, "/api/threads/list", { projectKey: "project-a", hostId: "local" });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 5);
  assert.equal(list.body.data.find((thread) => thread.id === "thread-idle").sessionId, "session-thread-idle");
  const read = await post(baseUrl, "/api/threads/read", { threadId: "thread-idle", includeTurns: true });
  assert.equal(read.body.id, "thread-idle");
  const resumed = await post(baseUrl, "/api/threads/resume", { threadId: "thread-unloaded" });
  assert.equal(resumed.body.state, "idle");
  const forked = await post(baseUrl, "/api/threads/fork", { threadId: "thread-idle" });
  assert.equal(forked.body.parent, null);

  const preview = await post(baseUrl, "/api/coordination/prepare", {
    sourceThreadId: "thread-source",
    targetThreadId: "thread-idle",
    sender: "user",
    intent: "handoff",
    reason: "handoff evidence",
    message: "Continue with this verified evidence.",
    messageSummary: "Continue with verified evidence",
    expectedWriteSet: [],
    idempotencyKey: "http-smoke",
    ancestorCoordinationIds: [],
    project: { key: "project-a" },
    host: { sourceHostId: "local", targetHostId: "local" },
    priority: "normal",
    hopCount: 0
  });
  assert.equal(preview.status, 200);
  assert.ok(preview.body.previewToken);
  const dispatched = await post(baseUrl, "/api/coordination/dispatch", { previewToken: preview.body.previewToken });
  assert.equal(dispatched.status, 200);
  assert.equal(dispatched.body.protocolMethod, "turn/start");
  const waited = await post(baseUrl, "/api/coordination/wait", {
    coordinationId: dispatched.body.coordinationId,
    timeoutMs: 1_000
  });
  assert.equal(waited.body.state, "completed");

  const missingToken = await post(baseUrl, "/api/coordination/dispatch", { previewToken: "missing" });
  assert.equal(missingToken.status, 404);
  assert.equal(missingToken.body.error.code, "protocol_incompatible");

  const archiveDenied = await post(baseUrl, "/api/threads/archive", { threadId: "thread-idle" });
  assert.equal(archiveDenied.status, 409);
  assert.equal(archiveDenied.body.error.details.confirmationRequired, true);
  const archived = await post(baseUrl, "/api/threads/archive", {
    threadId: "thread-idle",
    confirmed: true,
    confirmationId: "archive-confirmation"
  });
  assert.equal(archived.body.archived, true);
  const unarchived = await post(baseUrl, "/api/threads/unarchive", { threadId: "thread-idle" });
  assert.equal(unarchived.body.archived, false);

  const state = await fetch(`${baseUrl}/api/opl/state?profile=full`).then((response) => response.json());
  assert.equal(state.profile, "full");
  const action = await post(baseUrl, "/api/opl/action", { actionId: "preview.test", dryRun: true });
  assert.equal(action.body.authorityBoundary, "app_bridge_no_domain_authority");

  const models = await fetch(`${baseUrl}/api/codex/models`).then((response) => response.json());
  assert.equal(models.data[0].id, "gpt-test");

  const chat = await post(baseUrl, "/api/send-message", { prompt: "Return a fake host response." });
  assert.equal(chat.status, 200);
  assert.equal(chat.body.executor, "codex_app_server");
  assert.equal(chat.body.finalMessage.startsWith("completed turn-created-"), true);
});
