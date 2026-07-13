import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";

export class AppServerTransportError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AppServerTransportError";
    this.code = code;
    this.details = details;
  }
}

function rpcError(error) {
  if (error instanceof AppServerTransportError) return error;
  return new AppServerTransportError("app_server_error", String(error));
}

export class CodexAppServerTransport extends EventEmitter {
  constructor({
    command = process.env.CODEX_APP_SERVER_COMMAND ?? "codex",
    args = process.env.CODEX_APP_SERVER_ARGS?.split(" ").filter(Boolean) ?? ["app-server", "--stdio"],
    cwd = process.env.OPL_NATIVE_WORKBENCH_CODEX_CWD ?? process.cwd(),
    env = process.env,
    requestTimeoutMs = 45_000,
    turnTimeoutMs = 180_000
  } = {}) {
    super();
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.requestTimeoutMs = requestTimeoutMs;
    this.turnTimeoutMs = turnTimeoutMs;
    this.process = null;
    this.pending = new Map();
    this.turns = new Map();
    this.nextRequestId = 1;
    this.initialized = false;
    this.startPromise = null;
    this.stderrTail = "";
    this.dynamicToolsStatus = "unprobed";
    this.toolDispatcher = null;
  }

  setToolDispatcher(dispatcher) {
    this.toolDispatcher = dispatcher;
  }

  async start() {
    if (this.initialized && this.process?.exitCode === null) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.#startProcess();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async #startProcess() {
    const child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.process = child;
    child.once("error", (error) => this.#failAll(new AppServerTransportError(
      "app_server_unavailable",
      `Unable to start codex app-server: ${error.message}`
    )));
    child.once("exit", (code, signal) => {
      this.initialized = false;
      this.process = null;
      this.#failAll(new AppServerTransportError(
        "app_server_exited",
        `codex app-server exited (${signal ?? code ?? "unknown"})`,
        { code, signal, stderr: this.stderrTail }
      ));
      this.emit("availability", { available: false, code, signal });
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-8_000);
    });
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.#consumeLine(line));

    await this.request("initialize", {
      clientInfo: {
        name: "opl-native-workbench-webui",
        title: "One Person Lab Native Workbench WebUI",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false
      }
    }, 30_000, { skipStart: true });
    this.notify("initialized");
    this.initialized = true;
    this.emit("availability", { available: true });
  }

  async stop() {
    const child = this.process;
    if (!child) return;
    this.process = null;
    this.initialized = false;
    child.stdin.end();
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 2_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async request(method, params = {}, timeoutMs = this.requestTimeoutMs, { skipStart = false } = {}) {
    if (!skipStart) await this.start();
    if (!this.process?.stdin.writable) {
      throw new AppServerTransportError("app_server_unavailable", "codex app-server stdin is unavailable");
    }
    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new AppServerTransportError(
          "app_server_timeout",
          `codex app-server request timed out: ${method}`,
          { method, id, stderr: this.stderrTail }
        ));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timeout });
      this.#write({ id, method, params });
    });
  }

  notify(method, params) {
    this.#write(params === undefined ? { method } : { method, params });
  }

  async listThreads(params = {}) {
    return this.request("thread/list", params);
  }

  async listModels() {
    const data = [];
    const seenCursors = new Set();
    let cursor;
    do {
      const page = await this.request("model/list", {
        includeHidden: false,
        ...(cursor ? { cursor } : {})
      });
      if (!Array.isArray(page.data)) {
        throw new AppServerTransportError("invalid_app_server_response", "model/list returned invalid data");
      }
      data.push(...page.data);
      cursor = page.nextCursor ?? undefined;
      if (cursor && seenCursors.has(cursor)) {
        throw new AppServerTransportError("invalid_app_server_response", "model/list repeated its cursor", { cursor });
      }
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    return { data, nextCursor: null };
  }

  async readThread(threadId, includeTurns = false) {
    return this.request("thread/read", { threadId, includeTurns });
  }

  async resumeThread(threadId, overrides = {}) {
    return this.request("thread/resume", { threadId, ...overrides });
  }

  async forkThread(threadId, lastTurnId) {
    return this.request("thread/fork", {
      threadId,
      ...(lastTurnId ? { lastTurnId } : {})
    });
  }

  async archiveThread(threadId) {
    await this.request("thread/archive", { threadId });
    return { threadId, archived: true };
  }

  async unarchiveThread(threadId) {
    const response = await this.request("thread/unarchive", { threadId });
    return { threadId, archived: false, thread: response.thread };
  }

  async startTurn(threadId, message, overrides = {}) {
    return this.request("turn/start", {
      threadId,
      input: [{ type: "text", text: message, text_elements: [] }],
      ...overrides
    });
  }

  async steerTurn(threadId, expectedTurnId, message) {
    return this.request("turn/steer", {
      threadId,
      expectedTurnId,
      input: [{ type: "text", text: message, text_elements: [] }]
    });
  }

  async startThread({ dynamicTools, ...params } = {}) {
    try {
      const response = await this.request("thread/start", {
        cwd: this.cwd,
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: false,
        ...params,
        ...(dynamicTools ? { dynamicTools } : {})
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async probeDynamicTools(dynamicTools) {
    if (this.dynamicToolsStatus !== "unprobed") return this.dynamicToolsStatus;
    try {
      const started = await this.startThread({ dynamicTools, ephemeral: true });
      const threadId = started.thread?.id;
      if (!threadId) throw new AppServerTransportError("invalid_app_server_response", "Dynamic tool probe returned no thread id");
      const turn = await this.startTurn(
        threadId,
        "Call the coordination_capability_probe tool exactly once, then reply with its result."
      );
      if (!turn.turn?.id) throw new AppServerTransportError("invalid_app_server_response", "Dynamic tool probe returned no turn id");
      await this.waitForTurn(turn.turn.id, 45_000);
      if (this.dynamicToolsStatus !== "available") this.dynamicToolsStatus = "unavailable";
    } catch {
      this.dynamicToolsStatus = "unavailable";
    }
    return this.dynamicToolsStatus;
  }

  async sendMessage({ prompt, threadId, model, reasoningEffort, dynamicTools }) {
    let activeThreadId = threadId;
    if (activeThreadId) {
      await this.resumeThread(activeThreadId, { cwd: this.cwd, approvalPolicy: "never", sandbox: "read-only" });
    } else {
      try {
        const started = await this.startThread({
          dynamicTools,
          model: model || undefined,
          cwd: this.cwd,
          approvalPolicy: "never",
          sandbox: "read-only"
        });
        activeThreadId = started.thread?.id;
      } catch (error) {
        if (!dynamicTools) throw error;
        const started = await this.startThread({
          model: model || undefined,
          cwd: this.cwd,
          approvalPolicy: "never",
          sandbox: "read-only"
        });
        activeThreadId = started.thread?.id;
      }
    }
    if (!activeThreadId) {
      throw new AppServerTransportError("invalid_app_server_response", "thread/start returned no thread id");
    }
    const startedTurn = await this.startTurn(activeThreadId, prompt, {
      cwd: this.cwd,
      approvalPolicy: "never",
      sandboxPolicy: { type: "readOnly", networkAccess: false },
      ...(model ? { model } : {}),
      ...(reasoningEffort ? { effort: reasoningEffort } : {})
    });
    const turnId = startedTurn.turn?.id;
    if (!turnId) {
      throw new AppServerTransportError("invalid_app_server_response", "turn/start returned no turn id");
    }
    const completed = await this.waitForTurn(turnId);
    return {
      executor: "codex_app_server",
      transport: "stdio_json_rpc",
      threadId: activeThreadId,
      turnId,
      finalMessage: completed.finalMessage,
      eventCount: completed.events.length,
      completed: completed.notification,
      cwd: this.cwd
    };
  }

  waitForTurn(turnId, timeoutMs = this.turnTimeoutMs) {
    const existing = this.turns.get(turnId);
    if (existing?.completed) return Promise.resolve(existing.completed);
    return new Promise((resolve, reject) => {
      const bucket = existing ?? { events: [], text: "", waiters: [] };
      bucket.waiters ??= [];
      const timeout = setTimeout(() => {
        bucket.waiters = bucket.waiters.filter((waiter) => waiter.resolve !== resolve);
        reject(new AppServerTransportError("turn_timeout", `Turn timed out: ${turnId}`, { turnId }));
      }, timeoutMs);
      bucket.waiters.push({
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject
      });
      this.turns.set(turnId, bucket);
    });
  }

  turnResult(turnId) {
    const bucket = this.turns.get(turnId);
    if (!bucket) return undefined;
    return {
      finalMessage: bucket.completed?.finalMessage ?? bucket.finalMessage ?? bucket.text,
      completed: bucket.completed?.notification
    };
  }

  #write(frame) {
    if (!this.process?.stdin.writable) {
      throw new AppServerTransportError("app_server_unavailable", "codex app-server stdin is unavailable");
    }
    this.process.stdin.write(`${JSON.stringify(frame)}\n`);
  }

  #consumeLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.emit("protocolError", { code: "invalid_json", line });
      return;
    }
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) {
        pending.reject(new AppServerTransportError(
          "app_server_rpc_error",
          `codex app-server ${pending.method} failed`,
          { method: pending.method, error: message.error }
        ));
      } else {
        pending.resolve(message.result ?? {});
      }
      return;
    }
    if (message.id !== undefined && message.method) {
      void this.#handleServerRequest(message);
      return;
    }
    this.#recordEvent(message);
    this.emit("event", message);
  }

  async #handleServerRequest(message) {
    if (message.method !== "item/tool/call") {
      this.#write({
        id: message.id,
        error: { code: -32601, message: `Unsupported app-server request: ${message.method}` }
      });
      return;
    }
    const params = message.params ?? {};
    try {
      this.dynamicToolsStatus = "available";
      this.emit("dynamicTools", { available: true, params });
      if (params.tool === "coordination_capability_probe") {
        this.#write({
          id: message.id,
          result: {
            contentItems: [{ type: "inputText", text: JSON.stringify({ available: true, transport: "client_executed_dynamic_tools" }) }],
            success: true
          }
        });
        return;
      }
      if (!this.toolDispatcher) {
        throw new AppServerTransportError("dynamic_tools_unavailable", "Dynamic tool dispatcher is unavailable");
      }
      const result = await this.toolDispatcher({
        threadId: params.threadId,
        turnId: params.turnId,
        callId: params.callId,
        namespace: params.namespace,
        tool: params.tool,
        arguments: params.arguments
      });
      this.#write({
        id: message.id,
        result: {
          contentItems: [{ type: "inputText", text: JSON.stringify(result) }],
          success: true
        }
      });
    } catch (error) {
      const typed = rpcError(error);
      this.#write({
        id: message.id,
        result: {
          contentItems: [{
            type: "inputText",
            text: JSON.stringify({ error: { code: typed.code, message: typed.message, details: typed.details } })
          }],
          success: false
        }
      });
    }
  }

  #recordEvent(message) {
    const params = message.params ?? {};
    const turnId = params.turnId ?? params.turn?.id;
    if (!turnId) return;
    const bucket = this.turns.get(turnId) ?? { events: [], text: "", waiters: [] };
    bucket.events.push(message);
    if (message.method === "item/agentMessage/delta" && typeof params.delta === "string") {
      bucket.text += params.delta;
    }
    if (message.method === "item/completed" && params.item?.type === "agentMessage") {
      bucket.finalMessage = params.item.text;
    }
    if (message.method === "turn/completed") {
      bucket.completed = {
        finalMessage: bucket.finalMessage ?? bucket.text,
        events: bucket.events,
        notification: params
      };
      for (const waiter of bucket.waiters ?? []) waiter.resolve(bucket.completed);
      bucket.waiters = [];
    }
    this.turns.set(turnId, bucket);
  }

  #failAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    for (const bucket of this.turns.values()) {
      for (const waiter of bucket.waiters ?? []) waiter.reject(error);
      bucket.waiters = [];
    }
  }
}
