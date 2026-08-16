import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import { CodexAppServerTransport } from "./app-server-transport.mjs";
import { ChannelBindingStore } from "./channel-bindings.mjs";
import {
  createFrameworkChannelCallbackRegistrar,
  loadFrameworkCordisProfiles
} from "./framework-channel-bootstrap.mjs";
import { createOplHostCore, OplHostCore } from "./host-core.mjs";
import { createOplPassthrough } from "./opl-passthrough.mjs";

const fixture = new URL("./fixtures/fake-app-server.mjs", import.meta.url).pathname;

test("desktop hosts can supply a real working directory instead of the packaged app.asar path", () => {
  const core = new OplHostCore({ workspaceRoot: "/Users/opl" });
  assert.equal(core.transport.cwd, "/Users/opl");
  assert.deepEqual(core.capabilities().oplPassthrough.channelCallback, {
    schema: "opl_channel_canonical_thread_callbacks.v1",
    status: "dormant",
    registered: false
  });
});

test("optional channel provider receives canonical App Server callbacks without changing the default host path", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opl-host-channel-callback-test-"));
  const transport = new CodexAppServerTransport({
    command: process.execPath,
    args: [fixture],
    cwd: directory,
    host: "local",
    env: process.env,
    requestTimeoutMs: 2_000,
    turnTimeoutMs: 2_000
  });
  let callbacks;
  let disposeCount = 0;
  const core = await createOplHostCore({
    transport,
    channelBindingFile: path.join(directory, "channel-bindings.json"),
    opl: createOplPassthrough({
      cwd: directory,
      channelCallbackRegistrar: async (value) => {
        callbacks = value;
        return {
          appStatePatch: () => ({ ui_contributions: { entries: [] } }),
          readChannelAccess: async () => ({}),
          executeChannelAccessAction: async () => ({}),
          dispose: () => { disposeCount += 1; }
        };
      }
    })
  });
  let closed = false;
  t.after(async () => {
    if (!closed) await core.close();
  });

  assert.deepEqual(core.capabilities().oplPassthrough.channelCallback, {
    schema: "opl_channel_canonical_thread_callbacks.v1",
    status: "registered",
    registered: true
  });
  assert.deepEqual(
    Object.keys(callbacks).sort(),
    ["readTransportBindings", "resumeThread", "startThread", "startTurn", "subscribeTurn"]
  );
  assert.deepEqual(
    [
      callbacks.readTransportBindings,
      callbacks.startThread,
      callbacks.resumeThread,
      callbacks.startTurn,
      callbacks.subscribeTurn
    ].map((value) => typeof value),
    ["function", "function", "function", "function", "function"]
  );

  const started = await callbacks.startThread({
    provider_id: "opl-channel-weixin",
    account_id: "account-1",
    channel_session_id: "session-1"
  });
  assert.equal(started.canonical_thread_host, "local");
  assert.match(started.canonical_thread_id, /^thread-created-/);
  assert.equal(await callbacks.resumeThread(started), undefined);
  const turn = await callbacks.startTurn({
    ...started,
    text: "Reply through the canonical channel callback."
  });
  let subscription;
  const terminal = await new Promise((resolve) => {
    subscription = callbacks.subscribeTurn(turn, { onTerminal: resolve });
  });
  assert.deepEqual(terminal, {
    canonical_thread_host: "local",
    canonical_thread_id: started.canonical_thread_id,
    canonical_turn_id: turn.canonical_turn_id,
    status: "completed",
    response_text: `completed ${turn.canonical_turn_id}`
  });
  assert.equal(typeof subscription.dispose, "function");
  subscription.dispose();

  await assert.rejects(
    callbacks.resumeThread({ ...started, canonical_thread_host: "other-host" }),
    (error) => error.code === "invalid_app_server_response" && /different canonical thread/.test(error.message)
  );
  await core.close();
  closed = true;
  assert.equal(disposeCount, 1);
  const bindings = JSON.parse(await readFile(path.join(directory, "channel-bindings.json"), "utf8"));
  assert.deepEqual(bindings.entries, [{
    provider_id: "opl-channel-weixin",
    account_id: "account-1",
    channel_session_id: "session-1",
    canonical_thread_host: "local",
    canonical_thread_id: started.canonical_thread_id
  }]);
});

test("channel binding restart recovers the exact thread and rejects unknown or mismatched refs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opl-channel-binding-restart-test-"));
  const bindingFile = path.join(directory, "bindings.json");
  const identity = {
    provider_id: "opl-channel-weixin",
    account_id: "account-exact",
    channel_session_id: "session-exact"
  };
  const calls = [];
  const first = new CodexAppServerTransport({
    host: "host-exact",
    channelBindingStore: new ChannelBindingStore({ filePath: bindingFile })
  });
  first.startThread = async () => {
    calls.push("start:first");
    return { thread: { id: "thread-exact" } };
  };
  first.readThread = async (threadId) => {
    calls.push(`read:first:${threadId}`);
    return { thread: { id: threadId } };
  };
  const created = await first.createChannelCallbackAdapter().startThread(identity);
  assert.deepEqual(created, {
    canonical_thread_host: "host-exact",
    canonical_thread_id: "thread-exact"
  });

  const restarted = new CodexAppServerTransport({
    host: "host-exact",
    channelBindingStore: new ChannelBindingStore({ filePath: bindingFile })
  });
  restarted.startThread = async () => {
    throw new Error("restart must not create a replacement thread");
  };
  restarted.readThread = async (threadId) => {
    calls.push(`read:restart:${threadId}`);
    return { thread: { id: threadId } };
  };
  restarted.resumeThread = async (threadId) => {
    calls.push(`resume:restart:${threadId}`);
    return { thread: { id: threadId } };
  };
  const recovered = await restarted.createChannelCallbackAdapter().startThread(identity);
  assert.deepEqual(recovered, created);
  assert.deepEqual(await restarted.createChannelCallbackAdapter().readTransportBindings(), [{
    ...identity,
    ...created
  }]);
  assert.deepEqual(calls, [
    "start:first",
    "read:first:thread-exact",
    "read:restart:thread-exact"
  ]);

  await restarted.createChannelCallbackAdapter().resumeThread(recovered);
  assert.deepEqual(calls, [
    "start:first",
    "read:first:thread-exact",
    "read:restart:thread-exact",
    "read:restart:thread-exact",
    "resume:restart:thread-exact"
  ]);
  assert.equal(calls.filter((call) => call.startsWith("resume:")).length, 1);

  await assert.rejects(
    restarted.createChannelCallbackAdapter().resumeThread({
      canonical_thread_host: "host-exact",
      canonical_thread_id: "thread-unknown"
    }),
    (error) => error.code === "channel_binding_unknown"
  );
  const mismatchedThread = new CodexAppServerTransport({
    host: "host-exact",
    channelBindingStore: new ChannelBindingStore({ filePath: bindingFile })
  });
  mismatchedThread.readThread = async () => ({ thread: { id: "thread-other" } });
  await assert.rejects(
    mismatchedThread.createChannelCallbackAdapter().startThread(identity),
    (error) => error.code === "invalid_app_server_response" && /different canonical thread/.test(error.message)
  );
  const otherHost = new CodexAppServerTransport({
    host: "host-other",
    channelBindingStore: new ChannelBindingStore({ filePath: bindingFile })
  });
  otherHost.readThread = async () => { throw new Error("host mismatch must fail before thread/read"); };
  await assert.rejects(
    otherHost.createChannelCallbackAdapter().startThread(identity),
    (error) => error.code === "invalid_app_server_response" && /different canonical thread/.test(error.message)
  );

  await writeFile(bindingFile, "{broken", "utf8");
  await assert.rejects(
    restarted.createChannelCallbackAdapter().readTransportBindings(),
    (error) => error.code === "channel_binding_state_invalid"
  );
  await writeFile(bindingFile, JSON.stringify({
    schema: "opl_studio_channel_transport_bindings.v1",
    entries: [
      { ...identity, ...created },
      { ...identity, canonical_thread_host: "host-exact", canonical_thread_id: "thread-other" }
    ]
  }), "utf8");
  await assert.rejects(
    restarted.createChannelCallbackAdapter().readTransportBindings(),
    (error) => error.code === "channel_binding_state_invalid"
  );
});

test("shared Host attaches after App Server start and tears the provider down before transport", async () => {
  const calls = [];
  const transport = new EventEmitter();
  transport.cwd = "/tmp/studio-order";
  transport.initialized = false;
  transport.createChannelCallbackAdapter = () => ({
    startThread: async () => {},
    resumeThread: async () => {},
    startTurn: async () => {},
    subscribeTurn: () => ({ dispose() {} })
  });
  transport.start = async () => {
    calls.push("transport:start");
    transport.initialized = true;
  };
  transport.stop = async () => {
    calls.push("transport:stop");
    transport.initialized = false;
  };
  const opl = createOplPassthrough({
    channelCallbackRegistrar: async () => {
      calls.push("provider:attach");
      return {
        appStatePatch: () => ({ ui_contributions: { entries: [] } }),
        readChannelAccess: async () => ({}),
        executeChannelAccessAction: async () => ({}),
        dispose: async () => { calls.push("provider:dispose"); }
      };
    }
  });
  const core = await createOplHostCore({ transport, opl });
  assert.deepEqual(calls, ["transport:start", "provider:attach"]);
  await core.close();
  await core.close();
  assert.deepEqual(calls, [
    "transport:start",
    "provider:attach",
    "provider:dispose",
    "transport:stop"
  ]);
});

test("Framework registrar loads only the carrier public Cordis export and returns its disposable Host", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opl-framework-carrier-test-"));
  await mkdir(path.join(directory, "bin"), { recursive: true });
  await mkdir(path.join(directory, "dist", "host"), { recursive: true });
  const command = path.join(directory, "bin", "opl");
  await writeFile(command, "#!/bin/sh\nexit 0\n", "utf8");
  await chmod(command, 0o755);
  await writeFile(path.join(directory, "package.json"), JSON.stringify({
    name: "opl-framework",
    type: "module",
    exports: { "./cordis-profiles": "./dist/host/composition-profiles.js" }
  }), "utf8");
  await writeFile(
    path.join(directory, "dist", "host", "composition-profiles.js"),
    "export const publicCarrierMarker = 'framework-public-export';\n",
    "utf8"
  );
  const profiles = await loadFrameworkCordisProfiles({ command, env: { PATH: "" } });
  assert.equal(profiles.publicCarrierMarker, "framework-public-export");

  const calls = [];
  const callback = Object.freeze({});
  const registrar = createFrameworkChannelCallbackRegistrar({
    command,
    env: { PATH: "" },
    loadProfiles: async () => ({
      startCordisChannelProviderHost: async (options) => {
        calls.push({ operation: "attach", callback: options.callback });
        return {
          appStatePatch: () => ({ ui_contributions: { entries: [] } }),
          readChannelAccess: async (input) => ({ input }),
          executeChannelAccessAction: async (input) => ({ input }),
          dispose: async () => { calls.push({ operation: "dispose" }); }
        };
      }
    })
  });
  const registration = await registrar(callback);
  assert.deepEqual(calls, [{ operation: "attach", callback }]);
  assert.deepEqual(registration.appStatePatch(), { ui_contributions: { entries: [] } });
  assert.deepEqual(await registration.readChannelAccess({ ref: "state" }), { input: { ref: "state" } });
  assert.deepEqual(
    await registration.executeChannelAccessAction({ ref: "connect" }),
    { input: { ref: "connect" } }
  );
  await registration.dispose();
  assert.deepEqual(calls, [
    { operation: "attach", callback },
    { operation: "dispose" }
  ]);
});

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
