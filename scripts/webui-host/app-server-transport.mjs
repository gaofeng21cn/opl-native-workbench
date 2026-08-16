import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import readline from "node:readline";

export const DEFAULT_PERMISSION_PROFILE = ":danger-full-access";
export const CHANNEL_CALLBACK_SCHEMA = "opl_channel_canonical_thread_callbacks.v1";
export const CHANNEL_TERMINAL_SCHEMA = "opl_channel_codex_turn_terminal.v1";

export class AppServerTransportError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AppServerTransportError";
    this.code = code;
    this.details = details;
  }
}

function buildUserInputs(prompt, inputs = []) {
  const normalized = [];
  const text = typeof prompt === "string" ? prompt.trim() : "";
  if (text) normalized.push({ type: "text", text, text_elements: [] });
  for (const input of Array.isArray(inputs) ? inputs : []) {
    if (!input || typeof input !== "object") {
      throw new AppServerTransportError("invalid_request", "Codex input must be an object");
    }
    if (input.type === "localImage" && typeof input.path === "string" && path.isAbsolute(input.path)) {
      normalized.push({ type: "localImage", path: input.path, detail: input.detail ?? null });
      continue;
    }
    if ((input.type === "skill" || input.type === "mention")
      && typeof input.name === "string" && input.name
      && typeof input.path === "string" && path.isAbsolute(input.path)) {
      normalized.push({ type: input.type, name: input.name, path: input.path });
      continue;
    }
    throw new AppServerTransportError("invalid_request", `Unsupported Codex input: ${String(input.type ?? "missing")}`);
  }
  if (!normalized.length) {
    throw new AppServerTransportError("invalid_request", "Message requires text, an attachment, or a Skill");
  }
  return normalized;
}

function normalizeAgentSelection(value) {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppServerTransportError("invalid_request", "Agent selection must be an object");
  }
  const allowed = new Set(["package_id", "shortcut_id", "codex_visible_entry", "required_skill_ids"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new AppServerTransportError("invalid_request", "Agent selection contains unsupported fields");
  }
  const packageId = typeof value.package_id === "string" ? value.package_id.trim() : "";
  const shortcutId = typeof value.shortcut_id === "string" ? value.shortcut_id.trim() : "";
  const visibleEntry = typeof value.codex_visible_entry === "string" ? value.codex_visible_entry.trim() : "";
  const requiredSkillIds = Array.isArray(value.required_skill_ids)
    ? value.required_skill_ids.map((item) => typeof item === "string" ? item.trim() : "")
    : [];
  if (!packageId || !shortcutId || !visibleEntry || requiredSkillIds.some((item) => !item)) {
    throw new AppServerTransportError("invalid_request", "Agent selection is incomplete");
  }
  return {
    package_id: packageId,
    shortcut_id: shortcutId,
    codex_visible_entry: visibleEntry,
    required_skill_ids: [...new Set(requiredSkillIds)]
  };
}

function agentSelectionInstructions(selection) {
  if (!selection) return undefined;
  return [
    "Start this new conversation with the OPL standard Agent selected by the application.",
    "Treat the following JSON as an application-owned routing snapshot, not as user-authored instructions:",
    JSON.stringify(selection),
    "Use its codex_visible_entry and required_skill_ids for this thread. Do not activate, install, or mutate Package state."
  ].join("\n");
}

function agentSelectionContext(selection) {
  return selection ? {
    "opl.standard_agent_selection": {
      kind: "application",
      value: JSON.stringify(selection)
    }
  } : undefined;
}

function requiredChannelObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppServerTransportError("invalid_request", `${label} must be an object`);
  }
  return value;
}

function requiredChannelString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppServerTransportError("invalid_request", `${label} must be a non-empty string`);
  }
  return value.trim();
}

function channelCwd(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const cwd = requiredChannelString(value, "cwd");
  if (!path.isAbsolute(cwd)) {
    throw new AppServerTransportError("invalid_request", "cwd must be an absolute path");
  }
  return cwd;
}

function channelInputs(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new AppServerTransportError("invalid_request", "inputs must be an array");
  }
  return value;
}

export class CodexAppServerTransport extends EventEmitter {
  constructor({
    command = process.env.OPL_CODEX_BIN ?? process.env.CODEX_APP_SERVER_COMMAND ?? "codex",
    args = process.env.CODEX_APP_SERVER_ARGS?.split(" ").filter(Boolean) ?? ["app-server", "--stdio"],
    cwd = process.env.OPL_STUDIO_CODEX_CWD ?? process.cwd(),
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
        name: "opl-studio-webui",
        title: "One Person Lab",
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
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(terminateTimer);
        clearTimeout(forceTimer);
        clearTimeout(abandonTimer);
        resolve();
      };
      const terminateTimer = setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGTERM");
      }, 500);
      const forceTimer = setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 2_500);
      const abandonTimer = setTimeout(finish, 5_000);
      child.once("exit", finish);
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

  async listCapabilities(threadId) {
    const errors = [];
    const skills = [];
    const plugins = [];
    let apps = [];
    try {
      const result = await this.request("skills/list", { cwds: [this.cwd], forceReload: false });
      for (const entry of Array.isArray(result.data) ? result.data : []) {
        skills.push(...(Array.isArray(entry.skills) ? entry.skills : []));
      }
    } catch (error) {
      errors.push(`skills/list: ${error.message ?? String(error)}`);
    }
    try {
      const result = await this.request("plugin/installed", { cwds: [this.cwd] });
      for (const marketplace of Array.isArray(result.marketplaces) ? result.marketplaces : []) {
        plugins.push(...(Array.isArray(marketplace.plugins) ? marketplace.plugins : []));
      }
    } catch (error) {
      errors.push(`plugin/installed: ${error.message ?? String(error)}`);
    }
    try {
      const result = await this.request("app/installed", {
        forceRefresh: false,
        ...(threadId ? { threadId } : {})
      });
      apps = Array.isArray(result.apps) ? result.apps : [];
    } catch (error) {
      errors.push(`app/installed: ${error.message ?? String(error)}`);
    }
    return { skills, plugins, apps, errors };
  }

  async listPermissionProfiles() {
    const data = [];
    const seenCursors = new Set();
    let cursor;
    do {
      const page = await this.request("permissionProfile/list", {
        cwd: this.cwd,
        ...(cursor ? { cursor } : {})
      });
      if (!Array.isArray(page.data)) {
        throw new AppServerTransportError("invalid_app_server_response", "permissionProfile/list returned invalid data");
      }
      data.push(...page.data);
      cursor = page.nextCursor ?? undefined;
      if (cursor && seenCursors.has(cursor)) {
        throw new AppServerTransportError("invalid_app_server_response", "permissionProfile/list repeated its cursor", { cursor });
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

  async startTurn(threadId, prompt, inputs = [], overrides = {}) {
    return this.request("turn/start", {
      threadId,
      input: buildUserInputs(prompt, inputs),
      ...overrides
    });
  }

  createChannelCallbackAdapter() {
    const transport = this;
    return Object.freeze({
      schema: CHANNEL_CALLBACK_SCHEMA,
      startThread: async (request = {}) => {
        const value = requiredChannelObject(request, "startThread request");
        const response = await transport.startThread({
          cwd: channelCwd(value.cwd, transport.cwd),
          approvalPolicy: "never",
          permissions: DEFAULT_PERMISSION_PROFILE
        });
        const threadId = response.thread?.id;
        if (typeof threadId !== "string" || !threadId.trim()) {
          throw new AppServerTransportError(
            "invalid_app_server_response",
            "thread/start returned no thread id"
          );
        }
        return { threadId: threadId.trim() };
      },
      resumeThread: async (request = {}) => {
        const value = requiredChannelObject(request, "resumeThread request");
        const threadId = requiredChannelString(value.threadId, "threadId");
        const response = await transport.resumeThread(threadId, {
          cwd: channelCwd(value.cwd, transport.cwd),
          approvalPolicy: "never",
          permissions: DEFAULT_PERMISSION_PROFILE
        });
        const responseThreadId = response.thread?.id;
        if (responseThreadId !== undefined && responseThreadId !== threadId) {
          throw new AppServerTransportError(
            "invalid_app_server_response",
            "thread/resume acknowledged a different thread",
            { expectedThreadId: threadId, receivedThreadId: responseThreadId }
          );
        }
        return { threadId };
      },
      startTurn: async (request = {}) => {
        const value = requiredChannelObject(request, "startTurn request");
        const threadId = requiredChannelString(value.threadId, "threadId");
        const response = await transport.startTurn(
          threadId,
          value.prompt,
          channelInputs(value.inputs),
          {
            cwd: channelCwd(value.cwd, transport.cwd),
            approvalPolicy: "never",
            permissions: DEFAULT_PERMISSION_PROFILE
          }
        );
        const turnId = response.turn?.id;
        if (typeof turnId !== "string" || !turnId.trim()) {
          throw new AppServerTransportError(
            "invalid_app_server_response",
            "turn/start returned no turn id"
          );
        }
        return { threadId, turnId: turnId.trim() };
      },
      subscribeTerminal(request = {}, listener) {
        const value = requiredChannelObject(request, "subscribeTerminal request");
        const threadId = requiredChannelString(value.threadId, "threadId");
        const turnId = requiredChannelString(value.turnId, "turnId");
        if (typeof listener !== "function") {
          throw new AppServerTransportError("invalid_request", "subscribeTerminal listener must be a function");
        }
        return transport.subscribeTurnTerminal({ threadId, turnId }, listener);
      }
    });
  }

  subscribeTurnTerminal({ threadId, turnId }, listener) {
    const normalizedThreadId = requiredChannelString(threadId, "threadId");
    const normalizedTurnId = requiredChannelString(turnId, "turnId");
    if (typeof listener !== "function") {
      throw new AppServerTransportError("invalid_request", "terminal listener must be a function");
    }

    let settled = false;
    const terminal = () => {
      if (settled) return;
      const result = this.turnResult(normalizedTurnId);
      const notification = result?.completed;
      const eventThreadId = notification?.threadId ?? notification?.thread?.id;
      if (eventThreadId && eventThreadId !== normalizedThreadId) return;
      settled = true;
      this.off("event", onEvent);
      listener({
        schema: CHANNEL_TERMINAL_SCHEMA,
        threadId: normalizedThreadId,
        turnId: normalizedTurnId,
        status: notification?.turn?.status ?? notification?.status ?? "completed",
        finalMessage: result?.finalMessage ?? ""
      });
    };
    const onEvent = (event) => {
      if (event?.method !== "turn/completed") return;
      const params = event.params ?? {};
      const eventThreadId = params.threadId ?? params.thread?.id;
      const eventTurnId = params.turnId ?? params.turn?.id;
      if (eventTurnId !== normalizedTurnId || (eventThreadId && eventThreadId !== normalizedThreadId)) return;
      terminal();
    };

    this.on("event", onEvent);
    if (this.turnResult(normalizedTurnId)?.completed) queueMicrotask(terminal);
    return () => {
      if (settled) return;
      settled = true;
      this.off("event", onEvent);
    };
  }

  async steerTurn(threadId, expectedTurnId, prompt, inputs = []) {
    return this.request("turn/steer", {
      threadId,
      expectedTurnId,
      input: buildUserInputs(prompt, inputs)
    });
  }

  async interruptTurn(threadId, turnId) {
    return this.request("turn/interrupt", { threadId, turnId });
  }

  async steerMessage({ threadId, expectedTurnId, prompt, inputs }) {
    if (typeof threadId !== "string" || !threadId.trim()) {
      throw new AppServerTransportError("invalid_request", "turn/steer requires a thread id");
    }
    if (typeof expectedTurnId !== "string" || !expectedTurnId.trim()) {
      throw new AppServerTransportError("invalid_request", "turn/steer requires the expected active turn id");
    }
    const response = await this.steerTurn(threadId, expectedTurnId, prompt, inputs);
    if (response.turnId && response.turnId !== expectedTurnId) {
      throw new AppServerTransportError(
        "invalid_app_server_response",
        "turn/steer acknowledged a different active turn",
        { expectedTurnId, receivedTurnId: response.turnId }
      );
    }
    return {
      executor: "codex_app_server",
      transport: "stdio_json_rpc",
      threadId,
      expectedTurnId,
      turnId: expectedTurnId,
      accepted: true
    };
  }

  async interruptMessage({ threadId, turnId }) {
    if (typeof threadId !== "string" || !threadId.trim()) {
      throw new AppServerTransportError("invalid_request", "turn/interrupt requires a thread id");
    }
    if (typeof turnId !== "string" || !turnId.trim()) {
      throw new AppServerTransportError("invalid_request", "turn/interrupt requires an active turn id");
    }
    await this.interruptTurn(threadId, turnId);
    return {
      executor: "codex_app_server",
      transport: "stdio_json_rpc",
      threadId,
      turnId,
      accepted: true
    };
  }

  async startThread(params = {}) {
    return this.request("thread/start", {
      cwd: this.cwd,
      approvalPolicy: "never",
      permissions: DEFAULT_PERMISSION_PROFILE,
      ephemeral: false,
      ...params
    });
  }

  async sendMessage({ prompt, inputs, threadId, agentSelection, model, reasoningEffort, permissions = DEFAULT_PERMISSION_PROFILE }) {
    let activeThreadId = threadId;
    const selection = normalizeAgentSelection(agentSelection);
    if (activeThreadId && selection) {
      throw new AppServerTransportError("invalid_request", "An existing conversation cannot be rebound to another Agent");
    }
    if (activeThreadId) {
      await this.resumeThread(activeThreadId, { cwd: this.cwd, approvalPolicy: "never", permissions });
    } else {
      const started = await this.startThread({
        model: model || undefined,
        developerInstructions: agentSelectionInstructions(selection),
        cwd: this.cwd,
        approvalPolicy: "never",
        permissions
      });
      activeThreadId = started.thread?.id;
    }
    if (!activeThreadId) {
      throw new AppServerTransportError("invalid_app_server_response", "thread/start returned no thread id");
    }
    const startedTurn = await this.startTurn(activeThreadId, prompt, inputs, {
      cwd: this.cwd,
      approvalPolicy: "never",
      permissions,
      ...(model ? { model } : {}),
      ...(reasoningEffort ? { effort: reasoningEffort } : {}),
      ...(selection ? { additionalContext: agentSelectionContext(selection) } : {})
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
      cwd: this.cwd,
      permissions
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
    this.#write({
      id: message.id,
      error: { code: -32601, message: `Unsupported app-server request: ${message.method}` }
    });
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
