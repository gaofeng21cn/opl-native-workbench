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
  const logDirectoryUpdates = [];
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
    carrierDiagnostics: {
      read: async () => ({
        schema: "opl_app_carrier_diagnostics.v1",
        owner: "one-person-lab-app_desktop_host",
        carrier: "electron_desktop",
        status: "available",
        application: { systemInfo: { logDir: "/tmp/one-person-lab/logs" } },
        setLogDirectorySupported: true
      }),
      setLogDirectory: async (request) => {
        logDirectoryUpdates.push(request);
        return {
          schema: "opl_app_log_directory_update.v1",
          owner: "one-person-lab-app_desktop_host",
          carrier: "electron_desktop",
          action: "application.setLogDirectory",
          status: "updated",
          success: true,
          hostLogDir: request.path
        };
      }
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
  assert.deepEqual(await core.invoke("readState", { profile: "full" }), {
    profile: "full",
    carrierDiagnostics: {
      schema: "opl_app_carrier_diagnostics.v1",
      owner: "one-person-lab-app_desktop_host",
      carrier: "electron_desktop",
      status: "available",
      application: { systemInfo: { logDir: "/tmp/one-person-lab/logs" } },
      setLogDirectorySupported: true
    }
  });
  assert.equal((await core.invoke("listThreads", {})).data.length, 5);
  assert.deepEqual(await core.invoke("pickFiles"), ["/tmp/one.txt"]);
  assert.equal(await core.invoke("pickDirectory"), "/tmp/project");
  assert.deepEqual(await core.invoke("setLogDirectory", { path: "/tmp/new-logs" }), {
    schema: "opl_app_log_directory_update.v1",
    owner: "one-person-lab-app_desktop_host",
    carrier: "electron_desktop",
    action: "application.setLogDirectory",
    status: "updated",
    success: true,
    hostLogDir: "/tmp/new-logs"
  });
  assert.deepEqual(logDirectoryUpdates, [{ path: "/tmp/new-logs" }]);
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

test("shared host core reports unavailable carrier logs instead of borrowing Framework logs", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opl-host-core-unavailable-test-"));
  const transport = new CodexAppServerTransport({
    command: process.execPath,
    args: [fixture],
    cwd: directory,
    env: process.env,
    requestTimeoutMs: 2_000,
    turnTimeoutMs: 2_000
  });
  const core = await createOplHostCore({
    transport,
    opl: {
      readState: async () => ({
        app_state: {
          settings_control_center: {
            app_settings_read_model: {
              local_environment: { logs_dir: "/framework/runtime/logs" }
            }
          }
        }
      })
    }
  });
  t.after(() => core.close());

  const readback = await core.invoke("readState", { profile: "fast" });
  assert.deepEqual(readback.carrierDiagnostics, {
    schema: "opl_app_carrier_diagnostics.v1",
    owner: "one-person-lab-app_native_host",
    carrier: "standalone_headless_webui",
    status: "unavailable",
    setLogDirectorySupported: false,
    reasonCode: "carrier_log_directory_unavailable"
  });
  assert.equal("logsDirectory" in readback.carrierDiagnostics, false);
  assert.equal("application" in readback.carrierDiagnostics, false);
});

test("Docker projects application.systemInfo.logDir as read-only /data/logs", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opl-host-core-docker-test-"));
  const transport = new CodexAppServerTransport({
    command: process.execPath,
    args: [fixture],
    cwd: directory,
    env: process.env,
    requestTimeoutMs: 2_000,
    turnTimeoutMs: 2_000
  });
  const core = await createOplHostCore({
    transport,
    opl: { readState: async () => ({ profile: "fast" }) },
    env: {
      HOME: "/data",
      OPL_DATA_DIR: "/data",
      OPL_WORKSPACE_ROOT: "/projects"
    }
  });
  t.after(() => core.close());

  assert.deepEqual((await core.invoke("readState", { profile: "fast" })).carrierDiagnostics, {
    schema: "opl_app_carrier_diagnostics.v1",
    owner: "one-person-lab-app_native_host",
    carrier: "docker_webui",
    status: "available",
    application: { systemInfo: { logDir: "/data/logs" } },
    setLogDirectorySupported: false,
    reasonCode: "docker_log_directory_is_read_only"
  });
});
