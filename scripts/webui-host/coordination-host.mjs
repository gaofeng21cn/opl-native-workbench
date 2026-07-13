import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { CoordinationLedger } from "./coordination-ledger.mjs";

const MAX_HOPS = 8;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1_000;
const PREVIEW_WINDOW_MS = 10 * 60 * 1_000;
const QUEUE_WINDOW_MS = 30 * 60 * 1_000;
const terminalStates = new Set(["completed", "failed", "cancelled", "rejected", "wait_timeout"]);

export class CoordinationError extends Error {
  constructor(code, message, details = {}, httpStatus = 409) {
    super(message);
    this.name = "CoordinationError";
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

function objectSchema(properties, required = []) {
  return { type: "object", properties, required, additionalProperties: false };
}

export function dynamicToolProbeSpec() {
  return {
    type: "function",
    name: "coordination_capability_probe",
    description: "Probe whether the client executes dynamic tool requests.",
    inputSchema: objectSchema({})
  };
}

export function coordinationDynamicTools() {
  const threadId = { type: "string", minLength: 1 };
  const tools = [
    {
      name: "list_threads",
      description: "List addressable local threads in an authorized project and host scope.",
      inputSchema: objectSchema({
        projectKey: { type: "string" },
        hostId: { type: "string" },
        archived: { type: "boolean" },
        workspace: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        searchTerm: { type: "string" }
      })
    },
    {
      name: "read_thread",
      description: "Read thread metadata and optionally turn history from Codex App Server.",
      inputSchema: objectSchema({ threadId, includeTurns: { type: "boolean" } }, ["threadId"])
    },
    {
      name: "send_message_to_thread",
      description: "Prepare a guarded message proposal for another top-level thread.",
      inputSchema: objectSchema({
        targetThreadId: threadId,
        intent: { enum: ["delegate", "inform", "review", "block", "handoff"] },
        reason: { type: "string", minLength: 1 },
        message: { type: "string", minLength: 1 },
        summary: { type: "string", minLength: 1 },
        expectedWriteSet: { type: "array", items: { type: "string" } },
        dedupeKey: { type: "string", minLength: 1 },
        ancestorCoordinationIds: { type: "array", items: { type: "string" } },
        priority: { enum: ["normal", "urgent"] },
        hopCount: { type: "integer", minimum: 0, maximum: MAX_HOPS }
      }, ["targetThreadId", "intent", "reason", "message", "summary", "expectedWriteSet", "dedupeKey"])
    },
    {
      name: "fork_thread",
      description: "Fork an authorized thread through an optional turn.",
      inputSchema: objectSchema({ threadId, throughTurnId: { type: "string" } }, ["threadId"])
    },
    {
      name: "archive_thread",
      description: "Archive a thread with explicit confirmation.",
      inputSchema: objectSchema({ threadId }, ["threadId"])
    },
    {
      name: "unarchive_thread",
      description: "Unarchive an authorized thread.",
      inputSchema: objectSchema({ threadId }, ["threadId"])
    },
    {
      name: "wait_thread",
      description: "Wait for a coordination receipt to reach a terminal state.",
      inputSchema: objectSchema({
        threadId,
        coordinationId: { type: "string" },
        condition: { type: "string" },
        timeoutMs: { type: "integer", minimum: 0, maximum: 180_000 }
      }, ["threadId"])
    }
  ];
  return tools.map((tool) => ({ type: "function", ...tool }));
}

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CoordinationError("protocol_incompatible", `Missing ${field}`, { field }, 400);
  }
  return value.trim();
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];
}

function runtimeStatus(value) {
  const type = typeof value === "string" ? value : value?.type;
  if (type === "active") return { type, activeFlags: strings(value?.activeFlags) };
  if (["notLoaded", "idle", "systemError"].includes(type)) return { type };
  return { type: "systemError" };
}

function stateFromStatus(status) {
  if (status.type === "notLoaded") return "unloaded";
  if (status.type === "idle") return "idle";
  if (status.type === "active") return "running";
  return "system_error";
}

function projectThread(thread, scope = {}) {
  const status = runtimeStatus(thread?.status);
  const turns = Array.isArray(thread?.turns) ? thread.turns : [];
  const activeTurn = [...turns].reverse().find((turn) => turn?.status === "inProgress") ?? null;
  const projectKey = thread?.projectKey ?? null;
  const writeSet = strings(thread?.writeSet ?? thread?.metadata?.writeSet ?? scope.targetWriteSet);
  return {
    ...thread,
    id: requiredString(thread?.id, "thread.id"),
    sessionId: typeof thread?.sessionId === "string" ? thread.sessionId : thread?.id,
    projectKey,
    hostId: thread?.hostId ?? scope.hostId ?? "local",
    status,
    state: stateFromStatus(status),
    summary: thread?.name ?? thread?.preview ?? "",
    workspace: thread?.cwd ?? "",
    currentWorkspace: Boolean(scope.currentWorkspace && thread?.cwd === scope.currentWorkspace),
    owner: thread?.owner ?? thread?.agentRole ?? thread?.agentNickname ?? "",
    goal: thread?.goal ?? thread?.name ?? thread?.preview ?? "",
    archived: Boolean(thread?.archived ?? scope.archived),
    parentThreadId: thread?.parentThreadId ?? null,
    ancestorThreadIds: strings(thread?.ancestorThreadIds).length
      ? strings(thread.ancestorThreadIds)
      : [thread?.forkedFromId].filter(Boolean),
    parent: thread?.parentThreadId ?? null,
    ancestors: strings(thread?.ancestorThreadIds).length
      ? strings(thread.ancestorThreadIds)
      : [thread?.forkedFromId].filter(Boolean),
    activeTurn,
    activeTurnId: activeTurn?.id,
    writeSet,
    createdAt: Number(thread?.createdAt ?? 0),
    updatedAt: Number(thread?.updatedAt ?? 0),
    turns
  };
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRequest(value, sourceThreadId, sender = "user") {
  const request = value && typeof value === "object" ? value : {};
  return {
    sourceThreadId: requiredString(request.sourceThreadId ?? sourceThreadId, "sourceThreadId"),
    targetThreadId: requiredString(request.targetThreadId, "targetThreadId"),
    sourceHostId: "local",
    targetHostId: "local",
    projectKey: optionalString(request.projectKey) ?? null,
    sender,
    intent: ["delegate", "inform", "review", "block", "handoff"].includes(request.intent) ? request.intent : "inform",
    reason: requiredString(request.reason, "reason"),
    message: requiredString(request.message, "message"),
    summary: requiredString(request.summary ?? request.messageSummary, "summary"),
    expectedWriteSet: strings(request.expectedWriteSet),
    ancestorCoordinationIds: strings(request.ancestorCoordinationIds),
    priority: request.priority === "urgent" ? "urgent" : "normal",
    dedupeKey: requiredString(request.dedupeKey ?? request.idempotencyKey, "idempotencyKey"),
    hopCount: Number.isInteger(request.hopCount) ? request.hopCount : strings(request.ancestorCoordinationIds).length,
    model: optionalString(request.model),
    reasoningEffort: optionalString(request.reasoningEffort)
  };
}

function normalizedPath(value) {
  return value.trim().replace(/^\.\//, "").replace(/\/$/, "");
}

function writeSetsOverlap(left, right) {
  return left.some((a) => right.some((b) => {
    const x = normalizedPath(a);
    const y = normalizedPath(b);
    return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`);
  }));
}

function failure(code, message) {
  return { code, message };
}

function typedError(error) {
  if (error instanceof CoordinationError) return error;
  return new CoordinationError(error.code ?? "dispatch_failed", error.message ?? String(error), error.details ?? {}, 502);
}

function sameProjectScope(source, target) {
  if (source.projectKey != null || target.projectKey != null) {
    return source.projectKey != null && source.projectKey === target.projectKey;
  }
  return Boolean(source.workspace) && source.workspace === target.workspace;
}

function persistedPreview(preview) {
  return {
    ...preview,
    target: preview.target ? { ...preview.target, turns: [] } : undefined
  };
}

function confirmationProposal(tool, request, message) {
  return {
    state: "confirmation_required",
    tool,
    request,
    permissionDecision: "confirmation_required",
    guard: { code: "permission_denied", message },
    preparedAt: new Date().toISOString()
  };
}

export class ThreadCoordinationHost extends EventEmitter {
  constructor(transport, { ledger = new CoordinationLedger(), canonicalStateDbOnly = false, hostId = "local" } = {}) {
    super();
    this.transport = transport;
    this.ledger = ledger;
    this.canonicalStateDbOnly = canonicalStateDbOnly;
    this.hostId = hostId;
    this.previews = new Map();
    this.receipts = new Map();
    this.dedupe = new Map();
    this.queues = new Map();
    this.waiters = new Map();
    this.turnReceipts = new Map();
    this.readyPromise = this.#restore();
    transport.on("event", (event) => this.#handleEvent(event));
    transport.setToolDispatcher((call) => this.dispatchTool(call));
  }

  async ready() {
    await this.readyPromise;
  }

  async #restore() {
    const entries = await this.ledger.load();
    const queueStates = new Map();
    for (const entry of entries) {
      if (entry.kind === "preview" && entry.preview?.previewToken && Date.parse(entry.preview.expiresAt) > Date.now()) {
        this.previews.set(entry.preview.previewToken, entry.preview);
      }
      if (entry.kind === "receipt" && entry.receipt?.coordinationId) this.receipts.set(entry.receipt.coordinationId, entry.receipt);
      if (entry.kind === "receipt" && entry.receipt?.turnId && !terminalStates.has(entry.receipt.state)) {
        this.turnReceipts.set(entry.receipt.turnId, entry.receipt.coordinationId);
      }
      if (entry.kind === "dedupe" && entry.dedupeKey) this.dedupe.set(entry.dedupeKey, Date.parse(entry.recordedAt));
      if (entry.kind === "queue" && entry.coordinationId) queueStates.set(entry.coordinationId, entry);
    }
    const now = Date.now();
    for (const [key, recordedAt] of this.dedupe) {
      if (now - recordedAt > DEDUPE_WINDOW_MS) this.dedupe.delete(key);
    }
    for (const entry of queueStates.values()) {
      if (entry.state !== "queued" || !entry.preview || !entry.receipt) continue;
      if (Date.parse(entry.expiresAt ?? entry.receipt.queueExpiresAt) <= now) {
        const receipt = { ...entry.receipt, state: "cancelled", resultSummaryOrRef: "queue_expired", updatedAt: new Date().toISOString() };
        this.receipts.set(receipt.coordinationId, receipt);
        await this.ledger.append({ kind: "receipt", receipt });
        continue;
      }
      const queue = this.queues.get(entry.receipt.targetThreadId) ?? [];
      queue.push({ preview: entry.preview, receipt: entry.receipt, expiresAt: entry.expiresAt ?? entry.receipt.queueExpiresAt });
      this.queues.set(entry.receipt.targetThreadId, queue);
    }
  }

  capabilities() {
    return {
      available: this.transport.initialized,
      transport: "local_http_sse_stdio_json_rpc",
      dynamicTools: this.transport.dynamicToolsStatus,
      threadStoreOwner: "codex_core_app_server",
      coordinationLedger: "host_owned_bounded_jsonl"
    };
  }

  async listThreads(request = {}) {
    await this.ready();
    const params = {
      ...(Number.isFinite(request.limit) ? { limit: request.limit } : {}),
      ...(typeof request.archived === "boolean" ? { archived: request.archived } : {}),
      ...(request.workspace ? { cwd: request.workspace } : {}),
      ...(request.searchTerm ? { searchTerm: request.searchTerm } : {}),
      ...(this.canonicalStateDbOnly ? { useStateDbOnly: true } : {})
    };
    const data = [];
    const seenCursors = new Set();
    let cursor;
    do {
      const page = await this.transport.listThreads({ ...params, ...(cursor ? { cursor } : {}) });
      data.push(...(page.data ?? []));
      cursor = page.nextCursor ?? undefined;
      if (cursor && seenCursors.has(cursor)) {
        throw new CoordinationError("protocol_incompatible", "thread/list repeated its pagination cursor", { cursor }, 502);
      }
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    const workspaceFilter = Array.isArray(request.workspace) ? request.workspace : request.workspace ? [request.workspace] : [];
    const projected = data.map((thread) => projectThread(thread, { currentWorkspace: this.transport.cwd }));
    return {
      data: projected.filter((thread) => (
        (request.projectKey === undefined || thread.projectKey === request.projectKey)
        && (request.hostId === undefined || thread.hostId === request.hostId)
        && (request.archived === undefined || thread.archived === request.archived)
        && (!workspaceFilter.length || workspaceFilter.includes(thread.workspace))
      )),
      nextCursor: null
    };
  }

  async readThread({ threadId, includeTurns = false, ...scope }) {
    await this.ready();
    const id = requiredString(threadId, "threadId");
    const response = await this.transport.readThread(id, includeTurns);
    const coordinationEvents = [...this.receipts.values()]
      .filter((receipt) => receipt.sourceThreadId === id || receipt.targetThreadId === id)
      .sort((left, right) => String(left.updatedAt ?? left.createdAt).localeCompare(String(right.updatedAt ?? right.createdAt)))
      .slice(-20)
      .map((receipt) => ({
        id: `coordination:${receipt.coordinationId}:${receipt.state}`,
        type: "coordinationReceipt",
        role: "system",
        direction: receipt.sourceThreadId === id ? "source" : "target",
        coordinationId: receipt.coordinationId,
        sourceThreadId: receipt.sourceThreadId,
        targetThreadId: receipt.targetThreadId,
        state: receipt.state,
        summary: receipt.messageSummary,
        resultSummaryOrRef: receipt.resultSummaryOrRef,
        occurredAt: receipt.completedAt ?? receipt.updatedAt ?? receipt.createdAt
      }));
    return { ...projectThread(response.thread, scope), coordinationEvents };
  }

  async resumeThread({ threadId }) {
    await this.ready();
    const response = await this.transport.resumeThread(requiredString(threadId, "threadId"));
    return projectThread(response.thread);
  }

  async prepareCoordination(value, sourceThreadId) {
    await this.ready();
    const request = normalizeRequest(value, sourceThreadId);
    const evaluation = await this.#evaluate(request, false);
    const preview = {
      ...evaluation,
      previewToken: randomUUID(),
      preparedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + PREVIEW_WINDOW_MS).toISOString()
    };
    this.previews.set(preview.previewToken, preview);
    await this.ledger.append({ kind: "preview", preview: persistedPreview(preview) });
    this.#emit("coordination/prepared", { coordinationId: preview.previewToken, state: preview.state, raw: preview });
    return preview;
  }

  async #evaluate(request, confirmed) {
    let sourceResponse;
    let targetResponse;
    try {
      [sourceResponse, targetResponse] = await Promise.all([
        this.transport.readThread(request.sourceThreadId, false),
        this.transport.readThread(request.targetThreadId, true)
      ]);
    } catch (error) {
      return {
        state: "rejected",
        request,
        targetWriteSet: [],
        permissionDecision: "denied",
        guard: failure("offline", `target refresh failed: ${error.code ?? error.message}`)
      };
    }
    const source = projectThread(sourceResponse.thread, { hostId: this.hostId });
    const target = projectThread(targetResponse.thread, {
      hostId: this.hostId,
      targetWriteSet: targetResponse.thread?.writeSet
    });
    const claimedProjectKey = request.projectKey;
    const canonicalRequest = {
      ...request,
      sourceHostId: source.hostId,
      targetHostId: target.hostId,
      projectKey: source.projectKey
    };
    const guard = this.#guard(canonicalRequest, source, target, claimedProjectKey);
    const plannedDispatch = target.state === "running"
      ? (request.priority === "urgent" ? "steered" : "queued")
      : "started";
    const preauthorized = request.sender === "user" && plannedDispatch !== "steered";
    const permissionDecision = confirmed ? "confirmed" : (preauthorized ? "preauthorized" : "confirmation_required");
    return {
      state: guard ? "rejected" : (permissionDecision === "confirmation_required" ? "confirmation_required" : "prepared"),
      request: canonicalRequest,
      target,
      targetWriteSet: target.writeSet,
      plannedDispatch,
      permissionDecision: guard ? "denied" : permissionDecision,
      ...(guard ? { guard } : {})
    };
  }

  #guard(request, source, target, claimedProjectKey) {
    if (request.sourceThreadId === request.targetThreadId
      || request.ancestorCoordinationIds.includes(request.dedupeKey)
      || request.hopCount > MAX_HOPS) {
      return failure("loop_rejected", "same-target, ancestor-cycle, or hop-budget guard rejected coordination");
    }
    if (this.dedupe.has(request.dedupeKey)) return failure("duplicate_rejected", "dedupe key was already accepted");
    if (target.archived) return failure("archived_target", "target thread is archived");
    if (source.hostId !== this.hostId || target.hostId !== this.hostId || source.hostId !== target.hostId) {
      return failure("scope_mismatch", "source and target must resolve to the local host");
    }
    if (!sameProjectScope(source, target)) return failure("scope_mismatch", "source and target project scope does not match");
    if (claimedProjectKey != null && (claimedProjectKey !== source.projectKey || claimedProjectKey !== target.projectKey)) {
      return failure("scope_mismatch", "claimed project does not match fresh source and target projections");
    }
    if (writeSetsOverlap(request.expectedWriteSet, target.writeSet)) {
      return failure("write_set_conflict", "expected and target write sets overlap");
    }
    if (target.state === "system_error") return failure("stale_status", "target status could not be refreshed safely");
    return undefined;
  }

  async dispatchCoordination({ previewToken, confirmed = false, confirmationId } = {}) {
    await this.ready();
    const token = requiredString(previewToken, "previewToken");
    const stored = this.previews.get(token);
    if (!stored) throw new CoordinationError("protocol_incompatible", "Unknown preview token", { previewToken: token }, 404);
    if (Date.parse(stored.expiresAt) < Date.now()) {
      throw new CoordinationError("stale_status", "Preview token expired; prepare again", { previewToken: token });
    }
    const refreshed = await this.#evaluate(stored.request, confirmed);
    if (refreshed.guard) throw new CoordinationError(refreshed.guard.code, refreshed.guard.message);
    if (refreshed.state === "confirmation_required" || (stored.state === "confirmation_required" && !confirmed)) {
      throw new CoordinationError("permission_denied", "Dispatch requires explicit confirmation", {
        previewToken: token,
        confirmationRequired: true
      });
    }
    if (confirmed && !optionalString(confirmationId)) {
      throw new CoordinationError("permission_denied", "Confirmed dispatch requires a user confirmation id", {
        previewToken: token,
        confirmationRequired: true
      });
    }
    const coordinationId = randomUUID();
    const now = new Date().toISOString();
    const receipt = {
      deliveryId: randomUUID(),
      coordinationId,
      previewToken: token,
      sourceThreadId: stored.request.sourceThreadId,
      targetThreadId: stored.request.targetThreadId,
      sender: stored.request.sender,
      intent: stored.request.intent,
      reason: stored.request.reason,
      sourceHostId: refreshed.request.sourceHostId,
      targetHostId: refreshed.request.targetHostId,
      projectKey: refreshed.request.projectKey,
      messageSummary: stored.request.summary,
      expectedWriteSet: stored.request.expectedWriteSet,
      dedupeKey: stored.request.dedupeKey,
      permissionDecision: refreshed.permissionDecision,
      writeSetDecision: "no_conflict",
      queueDecision: refreshed.plannedDispatch === "queued" ? "queued" : "direct",
      state: refreshed.plannedDispatch,
      protocolMethod: refreshed.plannedDispatch === "steered"
        ? "turn/steer"
        : refreshed.plannedDispatch === "queued"
          ? "host_queue"
          : (refreshed.target.state === "unloaded" ? "thread/resume+turn/start" : "turn/start"),
      turnId: undefined,
      resultSummaryOrRef: undefined,
      confirmationId: optionalString(confirmationId),
      createdAt: now,
      completedAt: undefined,
      dispatchedAt: now,
      updatedAt: now
    };
    this.dedupe.set(stored.request.dedupeKey, Date.now());
    await this.ledger.append({ kind: "dedupe", dedupeKey: stored.request.dedupeKey, coordinationId });
    if (refreshed.plannedDispatch === "queued") {
      const expiresAt = new Date(Date.now() + QUEUE_WINDOW_MS).toISOString();
      receipt.queueExpiresAt = expiresAt;
      this.receipts.set(coordinationId, receipt);
      const queue = this.queues.get(receipt.targetThreadId) ?? [];
      const queuedPreview = persistedPreview({ ...stored, ...refreshed });
      queue.push({ preview: queuedPreview, receipt, expiresAt });
      this.queues.set(receipt.targetThreadId, queue);
      await this.ledger.append({ kind: "queue", state: "queued", coordinationId, preview: queuedPreview, receipt, expiresAt });
      await this.#persistReceipt(receipt);
      return receipt;
    }
    return this.#deliver({ ...stored, ...refreshed }, receipt);
  }

  async #deliver(preview, receipt) {
    try {
      let target = preview.target;
      if (target.state === "unloaded") {
        const resumed = await this.transport.resumeThread(target.id);
        target = projectThread(resumed.thread, { projectKey: target.projectKey, hostId: target.hostId });
        if (target.state !== "idle") {
          const reread = await this.transport.readThread(target.id, true);
          target = projectThread(reread.thread, { projectKey: target.projectKey, hostId: target.hostId });
        }
      }
      if (preview.plannedDispatch === "steered") {
        if (!target.activeTurnId) throw new CoordinationError("stale_status", "running target has no active turn after refresh");
        const response = await this.transport.steerTurn(target.id, target.activeTurnId, preview.request.message);
        receipt.turnId = response.turnId;
      } else {
        const response = await this.transport.startTurn(target.id, preview.request.message);
        receipt.turnId = response.turn?.id;
      }
      if (!receipt.turnId) throw new CoordinationError("protocol_incompatible", "dispatch returned no turn id");
      this.turnReceipts.set(receipt.turnId, receipt.coordinationId);
      receipt.updatedAt = new Date().toISOString();
      await this.#persistReceipt(receipt);
      return receipt;
    } catch (error) {
      const typed = typedError(error);
      receipt.state = "rejected";
      receipt.guard = failure(typed.code, typed.message);
      receipt.updatedAt = new Date().toISOString();
      await this.#persistReceipt(receipt);
      throw typed;
    }
  }

  async forkThread({ threadId, throughTurnId }) {
    await this.ready();
    const response = await this.transport.forkThread(requiredString(threadId, "threadId"), throughTurnId);
    return projectThread(response.thread);
  }

  async setArchived({ threadId, archived, confirmed = false, confirmationId } = {}) {
    await this.ready();
    const id = requiredString(threadId, "threadId");
    if (archived && (!confirmed || !confirmationId)) {
      throw new CoordinationError("permission_denied", "Archive requires confirmed=true and confirmationId", {
        confirmationRequired: true
      });
    }
    return archived ? this.transport.archiveThread(id) : this.transport.unarchiveThread(id);
  }

  async waitCoordination({ coordinationId, timeoutMs = 30_000 } = {}) {
    await this.ready();
    const id = requiredString(coordinationId, "coordinationId");
    const receipt = this.receipts.get(id);
    if (!receipt) throw new CoordinationError("protocol_incompatible", "Coordination receipt not found", { coordinationId: id }, 404);
    if (terminalStates.has(receipt.state)) return receipt;
    return new Promise((resolve, reject) => {
      const boundedTimeout = Math.min(Math.max(timeoutMs, 1), 180_000);
      const timeout = setTimeout(() => {
        const waiters = this.waiters.get(id) ?? [];
        this.waiters.set(id, waiters.filter((waiter) => waiter.resolve !== resolve));
        reject(new CoordinationError("wait_timeout", "Coordination wait timed out", { coordinationId: id }, 408));
      }, boundedTimeout);
      const waiters = this.waiters.get(id) ?? [];
      waiters.push({ resolve: (value) => { clearTimeout(timeout); resolve(value); } });
      this.waiters.set(id, waiters);
    });
  }

  async dispatchTool({ threadId, namespace, tool, arguments: rawArguments }) {
    if (namespace) throw new CoordinationError("protocol_incompatible", `Unsupported tool namespace: ${namespace}`, {}, 404);
    const args = rawArguments && typeof rawArguments === "object" ? rawArguments : {};
    const source = await this.readThread({ threadId, includeTurns: false });
    const ensureSameScope = (target) => {
      if (target.hostId !== source.hostId || !sameProjectScope(source, target)) {
        throw new CoordinationError("scope_mismatch", "Model tools are limited to the source thread project and host");
      }
      return target;
    };
    switch (tool) {
      case "list_threads": {
        if (optionalString(args.projectKey) && args.projectKey !== source.projectKey) {
          throw new CoordinationError("scope_mismatch", "Model thread listing cannot broaden the source project scope");
        }
        return this.listThreads({
          ...args,
          hostId: source.hostId,
          ...(source.projectKey != null ? { projectKey: source.projectKey } : { workspace: source.workspace })
        });
      }
      case "read_thread": return ensureSameScope(await this.readThread(args));
      case "send_message_to_thread": {
        const request = normalizeRequest({
          ...args,
          sourceThreadId: threadId
        }, threadId, "model");
        const evaluation = await this.#evaluate(request, false);
        const preview = {
          ...evaluation,
          previewToken: randomUUID(),
          preparedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + PREVIEW_WINDOW_MS).toISOString()
        };
        this.previews.set(preview.previewToken, preview);
        await this.ledger.append({ kind: "preview", preview: persistedPreview(preview) });
        this.#emit("coordination/prepared", { coordinationId: preview.previewToken, state: preview.state, raw: preview });
        return preview;
      }
      case "fork_thread": {
        ensureSameScope(await this.readThread({ threadId: args.threadId, includeTurns: false }));
        const proposal = confirmationProposal(tool, args, "Fork requires user confirmation");
        this.#emit("coordination/lifecycle-proposal", { threadId, state: proposal.state, raw: proposal });
        return proposal;
      }
      case "archive_thread":
      case "unarchive_thread": {
        ensureSameScope(await this.readThread({ threadId: args.threadId, includeTurns: false }));
        const proposal = confirmationProposal(tool, args, `${tool} requires user confirmation`);
        this.#emit("coordination/lifecycle-proposal", { threadId, state: proposal.state, raw: proposal });
        return proposal;
      }
      case "wait_thread": {
        const coordinationId = optionalString(args.coordinationId)
          ?? [...this.receipts.values()].reverse().find((receipt) => receipt.targetThreadId === args.threadId)?.coordinationId;
        return this.waitCoordination({ coordinationId, timeoutMs: args.timeoutMs });
      }
      default: throw new CoordinationError("protocol_incompatible", `Unknown coordination tool: ${tool}`, {}, 404);
    }
  }

  async #persistReceipt(receipt) {
    this.receipts.set(receipt.coordinationId, receipt);
    await this.ledger.append({ kind: "receipt", receipt });
    this.#emit("coordination/receipt", {
      threadId: receipt.targetThreadId,
      coordinationId: receipt.coordinationId,
      state: receipt.state,
      raw: receipt
    });
    if (terminalStates.has(receipt.state)) {
      for (const waiter of this.waiters.get(receipt.coordinationId) ?? []) waiter.resolve(receipt);
      this.waiters.delete(receipt.coordinationId);
    }
  }

  #handleEvent(event) {
    const params = event.params ?? {};
    this.emit("event", event);
    if (event.method === "thread/status/changed" && runtimeStatus(params.status).type === "idle") {
      void this.#drainQueue(params.threadId);
    }
    if (event.method === "turn/completed") {
      const coordinationId = this.turnReceipts.get(params.turn?.id);
      const receipt = coordinationId ? this.receipts.get(coordinationId) : null;
      if (receipt) {
        receipt.state = params.turn?.status === "completed" ? "completed" : "failed";
        receipt.resultSummaryOrRef = this.transport.turnResult?.(params.turn?.id)?.finalMessage
          || `thread:${receipt.targetThreadId}/turn:${params.turn?.id}`;
        receipt.completedAt = new Date().toISOString();
        receipt.updatedAt = new Date().toISOString();
        void this.#persistReceipt(receipt);
      }
    }
  }

  async #drainQueue(threadId) {
    await this.ready();
    const queue = this.queues.get(threadId);
    if (!queue?.length) return;
    const item = queue.shift();
    if (!queue.length) this.queues.delete(threadId);
    if (Date.parse(item.expiresAt) <= Date.now()) {
      item.receipt.state = "cancelled";
      item.receipt.resultSummaryOrRef = "queue_expired";
      item.receipt.completedAt = new Date().toISOString();
      item.receipt.updatedAt = item.receipt.completedAt;
      await this.ledger.append({ kind: "queue", state: "expired", coordinationId: item.receipt.coordinationId });
      await this.#persistReceipt(item.receipt);
      if (queue.length) void this.#drainQueue(threadId);
      return;
    }
    await this.ledger.append({ kind: "queue", state: "consumed", coordinationId: item.receipt.coordinationId });
    item.preview.plannedDispatch = "started";
    item.preview.target.state = "idle";
    item.receipt.state = "started";
    item.receipt.protocolMethod = "turn/start";
    await this.#deliver(item.preview, item.receipt).catch(() => undefined);
  }

  #emit(method, event) {
    this.emit("event", { method, ...event });
  }
}
