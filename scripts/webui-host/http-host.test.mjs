import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";
import { CodexAppServerTransport } from "./app-server-transport.mjs";
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

test("loopback HTTP host exposes standard thread lifecycle, subagent projection, SSE, and OPL passthrough", async (t) => {
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
  const host = await createWebUiHost({ transport, opl, webRoot: directory });
  t.after(async () => {
    host.server.closeAllConnections();
    await host.close();
  });
  await new Promise((resolve, reject) => {
    host.server.once("error", reject);
    host.server.listen(0, "127.0.0.1", resolve);
  });
  const address = host.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const capabilities = await fetch(`${baseUrl}/api/capabilities`).then((response) => response.json());
  assert.equal(capabilities.localHost, true);
  assert.equal(capabilities.threadAdapter.available, true);
  assert.equal(capabilities.threadAdapter.threadStoreOwner, "codex_core_app_server");
  assert.equal(capabilities.threadAdapter.privateCoordinationLayer, false);
  assert.deepEqual(
    capabilities.threadAdapter.subagentProjection.itemTypes,
    ["collabAgentToolCall", "subAgentActivity"]
  );

  const eventAbort = new AbortController();
  const eventResponse = await fetch(`${baseUrl}/api/opl-events`, { signal: eventAbort.signal });
  const eventReader = eventResponse.body.getReader();
  const firstEvent = await eventReader.read();
  assert.match(new TextDecoder().decode(firstEvent.value), /host\/ready/);
  await eventReader.cancel();
  eventAbort.abort();

  const list = await post(baseUrl, "/api/threads/list", { projectKey: "project-a" });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 5);
  assert.equal(list.body.data.find((thread) => thread.id === "thread-idle").sessionId, "session-thread-idle");
  const subagent = list.body.data.find((thread) => thread.id === "thread-subagent");
  assert.equal(subagent.parentThreadId, "thread-source");
  assert.equal(subagent.agentRole, "reviewer");
  assert.equal(subagent.agentNickname, "Scout");
  assert.equal(subagent.sourceKind, "subAgentReview");

  const read = await post(baseUrl, "/api/threads/read", { threadId: "thread-subagent", includeTurns: true });
  assert.equal(read.body.id, "thread-subagent");
  assert.deepEqual(
    read.body.turns[0].items.map((item) => item.type),
    ["collabAgentToolCall", "subAgentActivity"]
  );
  const resumed = await post(baseUrl, "/api/threads/resume", { threadId: "thread-unloaded" });
  assert.equal(resumed.body.state, "idle");
  const forked = await post(baseUrl, "/api/threads/fork", { threadId: "thread-idle", throughTurnId: "turn-1" });
  assert.equal(forked.body.parentThreadId, "thread-idle");

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

  const retiredEndpoint = await post(baseUrl, "/api/coordination/prepare", {});
  assert.equal(retiredEndpoint.status, 404);
  assert.equal(retiredEndpoint.body.error.code, "endpoint_not_found");

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
