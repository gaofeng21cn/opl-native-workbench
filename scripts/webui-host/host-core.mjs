import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexAppServerTransport } from "./app-server-transport.mjs";
import { createGatewayAccountLogin } from "./gateway-account-login.mjs";
import { createNativeAppUpdaterFromEnvironment } from "./native-app-updater.mjs";
import { createOplPassthrough } from "./opl-passthrough.mjs";
import { CodexThreadAdapter, ThreadAdapterError } from "./thread-adapter.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = process.env.OPL_NATIVE_WORKBENCH_CODEX_CWD
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

export class OplHostCore extends EventEmitter {
  constructor({
    transport = new CodexAppServerTransport({ cwd: workspaceRoot }),
    opl = createOplPassthrough({ cwd: workspaceRoot }),
    gatewayAccountLogin = createGatewayAccountLogin({ cwd: workspaceRoot }),
    platform = defaultPlatformServices(),
    nativeUpdater = defaultNativeUpdater()
  } = {}) {
    super();
    this.transport = transport;
    this.opl = opl;
    this.gatewayAccountLogin = gatewayAccountLogin;
    this.platform = { ...defaultPlatformServices(), ...platform };
    this.nativeUpdater = nativeUpdater;
    this.threads = new CodexThreadAdapter(transport);
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
    return this.capabilities();
  }

  capabilities() {
    return {
      localHost: true,
      appServerAvailable: this.transport.initialized === true && this.appServerError === null,
      threadAdapter: this.threads.capabilities(),
      appServerError: this.appServerError,
      oplPassthrough: { available: true, authorityBoundary: "app_bridge_no_domain_authority" }
    };
  }

  async invoke(method, payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ThreadAdapterError("invalid_request", "Host payload must be an object", {}, 400);
    }

    switch (method) {
      case "beginWindowDrag": return this.platform.beginWindowDrag();
      case "readState": return this.opl.readState(payload.profile ?? "fast");
      case "readFullDrilldown": return this.opl.readFullDrilldown();
      case "readContribution": return this.opl.readContribution(payload);
      case "executeAction": return this.opl.executeAction(payload);
      case "readCodexModels": return this.transport.listModels();
      case "readCodexCapabilities": return this.transport.listCapabilities(payload.threadId);
      case "readCodexPermissionProfiles": return this.transport.listPermissionProfiles();
      case "pickFiles": return this.platform.pickFiles(payload);
      case "pickDirectory": return this.platform.pickDirectory(payload);
      case "sendMessage": return this.transport.sendMessage(payload);
      case "steerTurn": return this.transport.steerMessage(payload);
      case "interruptTurn": return this.transport.interruptMessage(payload);
      case "loginGatewayAccount": return this.gatewayAccountLogin(payload);
      case "readNativeAppUpdateStatus": return this.nativeUpdater.perform("status", payload);
      case "checkNativeAppUpdate": return this.nativeUpdater.perform("check", payload);
      case "applyNativeAppUpdate": return this.nativeUpdater.perform("apply", payload);
      case "restartNativeApp": return this.nativeUpdater.perform("restart", payload);
      case "listThreads": return this.threads.listThreads(payload);
      case "readThread": return this.threads.readThread(payload);
      case "resumeThread": return this.threads.resumeThread(payload);
      case "forkThread": return this.threads.forkThread(payload);
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
    await this.transport.stop();
  }
}

export async function createOplHostCore(options = {}) {
  const core = new OplHostCore(options);
  await core.start();
  return core;
}
