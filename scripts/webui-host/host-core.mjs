import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHANNEL_CALLBACK_SCHEMA, CodexAppServerTransport } from "./app-server-transport.mjs";
import { ChannelBindingStore } from "./channel-bindings.mjs";
import { createFrameworkChannelCallbackRegistrar } from "./framework-channel-bootstrap.mjs";
import { createCodexApiKeyConfiguration, createGatewayAccountLogin } from "./gateway-account-login.mjs";
import { createNativeAppUpdaterFromEnvironment } from "./native-app-updater.mjs";
import { createOplPassthrough } from "./opl-passthrough.mjs";
import { CodexThreadAdapter, ThreadAdapterError } from "./thread-adapter.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultWorkspaceRoot = process.env.OPL_NATIVE_WORKBENCH_CODEX_CWD
  ?? process.env.OPL_STUDIO_CODEX_CWD
  ?? repositoryRoot;

function unavailablePlatformCapability(capability) {
  return async () => {
    throw new ThreadAdapterError(
      "desktop_capability_unavailable",
      `${capability} is unavailable in this host`,
      { capability },
      501
    );
  };
}

function defaultPlatformServices() {
  return {
    beginWindowDrag: async () => ({ accepted: false, reasonCode: "host_window_drag_unavailable" }),
    pickFiles: unavailablePlatformCapability("pickFiles"),
    pickDirectory: unavailablePlatformCapability("pickDirectory")
  };
}

function defaultNativeUpdater() {
  return createNativeAppUpdaterFromEnvironment();
}

function defaultChannelBindingFile(env) {
  return env.OPL_STUDIO_CHANNEL_BINDINGS_FILE
    ?? path.join(env.OPL_DATA_DIR ?? os.homedir(), ".opl-studio", "channel-transport-bindings.json");
}

function unavailableCarrierDiagnostics(reasonCode = "carrier_log_directory_unavailable") {
  return {
    schema: "opl_app_carrier_diagnostics.v1",
    owner: "one-person-lab-app_native_host",
    carrier: "standalone_headless_webui",
    status: "unavailable",
    setLogDirectorySupported: false,
    reasonCode
  };
}

function unsupportedLogDirectoryUpdate(reasonCode = "desktop_host_required") {
  return {
    schema: "opl_app_log_directory_update.v1",
    owner: "one-person-lab-app_native_host",
    carrier: "standalone_headless_webui",
    action: "application.setLogDirectory",
    status: "unsupported",
    success: false,
    reasonCode
  };
}

function dockerCarrierConfirmed(env) {
  return env.HOME === "/data"
    && env.OPL_DATA_DIR === "/data"
    && env.OPL_WORKSPACE_ROOT === "/projects";
}

function defaultCarrierDiagnostics(env) {
  if (dockerCarrierConfirmed(env)) {
    return {
      read: async () => ({
        schema: "opl_app_carrier_diagnostics.v1",
        owner: "one-person-lab-app_native_host",
        carrier: "docker_webui",
        status: "available",
        application: { systemInfo: { logDir: "/data/logs" } },
        setLogDirectorySupported: false,
        reasonCode: "docker_log_directory_is_read_only"
      }),
      setLogDirectory: async () => unsupportedLogDirectoryUpdate("docker_log_directory_is_read_only")
    };
  }
  return {
    read: async () => unavailableCarrierDiagnostics(),
    setLogDirectory: async () => unsupportedLogDirectoryUpdate()
  };
}

export class OplHostCore extends EventEmitter {
  constructor({
    workspaceRoot = defaultWorkspaceRoot,
    transport,
    opl,
    candidateActionAllowlist = [],
    channelBindingFile,
    channelCallbackRegistrar,
    gatewayAccountLogin,
    codexApiKeyConfiguration,
    platform = defaultPlatformServices(),
    nativeUpdater = defaultNativeUpdater(),
    carrierDiagnostics,
    env = process.env
  } = {}) {
    super();
    const oplCommand = env.OPL_APP_OPL_BIN ?? env.OPL_COMMAND ?? "opl";
    const channelBindingStore = new ChannelBindingStore({
      filePath: channelBindingFile ?? defaultChannelBindingFile(env)
    });
    this.transport = transport ?? new CodexAppServerTransport({
      cwd: workspaceRoot,
      env,
      channelBindingStore
    });
    this.transport.channelBindingStore ??= channelBindingStore;
    this.opl = opl ?? createOplPassthrough({
      cwd: workspaceRoot,
      command: oplCommand,
      env,
      candidateActionAllowlist,
      channelCallbackRegistrar: channelCallbackRegistrar
        ?? createFrameworkChannelCallbackRegistrar({ command: oplCommand, env })
    });
    this.gatewayAccountLogin = gatewayAccountLogin ?? createGatewayAccountLogin({
      command: oplCommand,
      cwd: workspaceRoot,
      env
    });
    this.codexApiKeyConfiguration = codexApiKeyConfiguration ?? createCodexApiKeyConfiguration({
      command: oplCommand,
      cwd: workspaceRoot,
      env
    });
    this.platform = { ...defaultPlatformServices(), ...platform };
    this.nativeUpdater = nativeUpdater;
    this.carrierDiagnostics = carrierDiagnostics ?? defaultCarrierDiagnostics(env);
    this.threads = new CodexThreadAdapter(this.transport);
    this.channelCallbackAdapter = typeof this.transport.createChannelCallbackAdapter === "function"
      ? this.transport.createChannelCallbackAdapter()
      : null;
    this.channelCallbackRegistration = { status: "dormant", registered: false, dispose: async () => {} };
    this.channelCallbackRegistrationAttempted = false;
    this.closePromise = null;
    this.appServerError = null;

    this.threads.on("event", (event) => this.emit("event", event));
    this.transport.on("availability", (availability) => {
      this.appServerError = availability.available === true
        ? null
        : {
            code: "app_server_unavailable",
            message: `Codex App Server became unavailable (${availability.signal ?? availability.code ?? "unknown"})`
          };
      this.emit("event", { method: "host/availability", params: availability });
    });
    this.transport.on("serverRequest", (request) => {
      this.emit("event", { method: "codex/server-request", params: request });
    });
    this.transport.on("serverRequestsCleared", (detail) => {
      this.emit("event", { method: "codex/server-requests-cleared", params: detail });
    });
  }

  async start() {
    try {
      await this.transport.start();
      this.appServerError = null;
    } catch (error) {
      this.appServerError = {
        code: error.code ?? "app_server_unavailable",
        message: error.message ?? String(error)
      };
    }
    if (
      this.transport.initialized === true
      && !this.channelCallbackRegistrationAttempted
      && this.channelCallbackAdapter
      && typeof this.opl.registerChannelCallbackAdapter === "function"
    ) {
      this.channelCallbackRegistrationAttempted = true;
      try {
        this.channelCallbackRegistration = await this.opl.registerChannelCallbackAdapter(
          this.channelCallbackAdapter
        );
      } catch (error) {
        this.channelCallbackRegistration = {
          status: "failed",
          registered: false,
          reasonCode: error.code ?? "channel_provider_bootstrap_failed",
          dispose: async () => {}
        };
      }
    }
    return this.capabilities();
  }

  capabilities() {
    return {
      localHost: true,
      appServerAvailable: this.transport.initialized === true && this.appServerError === null,
      threadAdapter: this.threads.capabilities(),
      appServerError: this.appServerError,
      oplPassthrough: {
        available: true,
        authorityBoundary: "app_bridge_no_domain_authority",
        channelCallback: {
          schema: this.channelCallbackAdapter ? CHANNEL_CALLBACK_SCHEMA : null,
          status: this.channelCallbackRegistration?.status ?? "dormant",
          registered: this.channelCallbackRegistration?.registered === true,
          ...(this.channelCallbackRegistration?.reasonCode
            ? { reasonCode: this.channelCallbackRegistration.reasonCode }
            : {})
        }
      }
    };
  }

  async invoke(method, payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ThreadAdapterError("invalid_request", "Host payload must be an object", {}, 400);
    }

    switch (method) {
      case "beginWindowDrag": return this.platform.beginWindowDrag();
      case "readState": {
        const state = await this.opl.readState(payload.profile ?? "fast");
        let carrierDiagnostics;
        try {
          carrierDiagnostics = await this.carrierDiagnostics.read();
        } catch {
          carrierDiagnostics = unavailableCarrierDiagnostics("carrier_diagnostics_read_failed");
        }
        return { ...state, carrierDiagnostics };
      }
      case "readInitialize": return this.opl.readInitialize();
      case "readFullDrilldown": return this.opl.readFullDrilldown();
      case "readDomainDetailView": return this.opl.readDomainDetailView(payload);
      case "readContribution": return this.opl.readContribution(payload);
      case "executeAction": return this.opl.executeAction(payload);
      case "readCodexModels": return this.transport.listModels();
      case "readCodexCapabilities": return this.transport.listCapabilities(payload.threadId);
      case "readCodexPermissionProfiles": return this.transport.listPermissionProfiles();
      case "pickFiles": return this.platform.pickFiles(payload);
      case "pickDirectory": return this.platform.pickDirectory(payload);
      case "setLogDirectory": return this.carrierDiagnostics.setLogDirectory?.(payload)
        ?? unsupportedLogDirectoryUpdate();
      case "sendMessage": return this.transport.sendMessage(payload);
      case "listPendingServerRequests": return this.transport.listPendingServerRequests();
      case "respondToServerRequest": return this.transport.respondToServerRequest(payload?.id, payload?.response ?? {});
      case "steerTurn": return this.transport.steerMessage(payload);
      case "interruptTurn": return this.transport.interruptMessage(payload);
      case "loginGatewayAccount": return this.gatewayAccountLogin(payload);
      case "configureCodexApiKey": return this.codexApiKeyConfiguration(payload);
      case "readNativeAppUpdateStatus": return this.nativeUpdater.perform("status", payload);
      case "checkNativeAppUpdate": return this.nativeUpdater.perform("check", payload);
      case "applyNativeAppUpdate": return this.nativeUpdater.perform("apply", payload);
      case "restartNativeApp": return this.nativeUpdater.perform("restart", payload);
      case "listThreads": return this.threads.listThreads(payload);
      case "readThread": return this.threads.readThread(payload);
      case "resumeThread": return this.threads.resumeThread(payload);
      case "forkThread": return this.threads.forkThread(payload);
      case "renameThread": return this.threads.renameThread(payload);
      case "deleteThread": return this.threads.deleteThread(payload);
      case "setArchived": return this.threads.setArchived(payload);
      default:
        throw new ThreadAdapterError(
          "host_method_not_found",
          `Unknown host method: ${String(method)}`,
          { method },
          404
        );
    }
  }

  async close() {
    this.closePromise ??= (async () => {
      await this.channelCallbackRegistration?.dispose?.();
      await this.transport.stop();
    })();
    return this.closePromise;
  }
}

export async function createOplHostCore(options = {}) {
  const core = new OplHostCore(options);
  await core.start();
  return core;
}
