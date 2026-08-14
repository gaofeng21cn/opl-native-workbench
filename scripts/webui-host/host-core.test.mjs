import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";
import { CodexAppServerTransport } from "./app-server-transport.mjs";
import { createOplHostCore } from "./host-core.mjs";

const fixture = new URL("./fixtures/fake-app-server.mjs", import.meta.url).pathname;

test("shared host core serves desktop and HTTP adapters through one typed method surface", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opl-host-core-test-"));
  const transport = new CodexAppServerTransport({
    command: process.execPath,
    args: [fixture],
    cwd: directory,
    env: process.env,
    requestTimeoutMs: 2_000,
    turnTimeoutMs: 2_000
  });
  const updateOperations = [];
  const core = await createOplHostCore({
    transport,
    opl: {
      readState: async (profile) => ({ profile }),
      readFullDrilldown: async () => ({ detail: "full" }),
      readContribution: async (request) => ({ request }),
      executeAction: async (request) => ({ request, authorityBoundary: "app_bridge_no_domain_authority" })
    },
    gatewayAccountLogin: async () => ({ ok: true, stateRefreshRequired: true }),
    platform: {
      pickFiles: async () => ["/tmp/one.txt"],
      pickDirectory: async () => "/tmp/project"
    },
    nativeUpdater: {
      perform: async (operation) => {
        updateOperations.push(operation);
        return { supported: true, operation };
      }
    }
  });
  t.after(() => core.close());

  assert.equal(core.capabilities().threadAdapter.threadStoreOwner, "codex_core_app_server");
  assert.deepEqual(await core.invoke("readState", { profile: "full" }), { profile: "full" });
  assert.equal((await core.invoke("listThreads", {})).data.length, 5);
  assert.deepEqual(await core.invoke("pickFiles"), ["/tmp/one.txt"]);
  assert.equal(await core.invoke("pickDirectory"), "/tmp/project");
  assert.deepEqual(await core.invoke("readNativeAppUpdateStatus"), { supported: true, operation: "status" });
  assert.deepEqual(await core.invoke("checkNativeAppUpdate"), { supported: true, operation: "check" });
  assert.deepEqual(await core.invoke("applyNativeAppUpdate"), { supported: true, operation: "apply" });
  assert.deepEqual(await core.invoke("restartNativeApp"), { supported: true, operation: "restart" });
  assert.deepEqual(updateOperations, ["status", "check", "apply", "restart"]);
  await assert.rejects(
    core.invoke("unregisteredMethod"),
    (error) => error.code === "host_method_not_found" && error.httpStatus === 404
  );
});
