import { appendFileSync } from "node:fs";
import readline from "node:readline";

const workspace = process.env.FAKE_WORKSPACE ?? "/workspace/project-a";
const configuredProjectKey = process.env.FAKE_PROJECT_KEY ?? "project-a";
const projectKey = configuredProjectKey === "__projectless__" ? null : configuredProjectKey;
const logPath = process.env.FAKE_APP_SERVER_LOG;
const threads = new Map([
  ["thread-source", thread("thread-source", { type: "idle" }, ["src/source.ts"])],
  ["thread-idle", thread("thread-idle", { type: "idle" }, ["src/idle.ts"])],
  ["thread-unloaded", thread("thread-unloaded", { type: "notLoaded" }, ["src/unloaded.ts"])],
  ["thread-running", thread("thread-running", { type: "active", activeFlags: [] }, ["src/running.ts"], [turn("turn-running", "inProgress")])],
  ["thread-subagent", thread("thread-subagent", { type: "idle" }, [], [turn("turn-subagent", "completed", [
    { id: "collab-call", type: "collabAgentToolCall", agentRole: "reviewer", text: "Review delegated" },
    { id: "subagent-activity", type: "subAgentActivity", agentNickname: "Scout", text: "Review completed" }
  ])], {
    parentThreadId: "thread-source",
    agentRole: "reviewer",
    agentNickname: "Scout",
    threadSource: { type: "subAgentReview" }
  })]
]);
let nextThread = 1;
let nextTurn = 1;

function turn(id, status, items = []) {
  return { id, items, itemsView: { type: "full" }, status, error: null, startedAt: 1, completedAt: null, durationMs: null };
}

function thread(id, status, writeSet = [], turns = [], overrides = {}) {
  return {
    id,
    sessionId: `session-${id}`,
    forkedFromId: null,
    parentThreadId: null,
    preview: `Preview ${id}`,
    ephemeral: false,
    modelProvider: "openai",
    createdAt: 1,
    updatedAt: 2,
    recencyAt: 2,
    status,
    path: null,
    cwd: workspace,
    cliVersion: "0.144.1",
    source: "appServer",
    threadSource: null,
    agentNickname: null,
    agentRole: "worker",
    gitInfo: null,
    name: `Thread ${id}`,
    turns,
    projectKey,
    hostId: "local",
    goal: `Goal ${id}`,
    writeSet,
    archived: false,
    ...overrides
  };
}

function send(frame) {
  process.stdout.write(`${JSON.stringify(frame)}\n`);
}

function log(frame) {
  if (logPath) appendFileSync(logPath, `${JSON.stringify(frame)}\n`);
}

function completeTurn(threadId, turnId, status = "completed") {
  const target = threads.get(threadId);
  if (target) {
    target.status = { type: "idle" };
    target.turns = target.turns.map((item) => item.id === turnId ? { ...item, status, completedAt: 2 } : item);
  }
  send({ method: "item/completed", params: { threadId, turnId, item: { type: "agentMessage", id: `message-${turnId}`, text: `completed ${turnId}` } } });
  send({ method: "turn/completed", params: { threadId, turn: { ...turn(turnId, status), completedAt: 2 } } });
  send({ method: "thread/status/changed", params: { threadId, status: { type: "idle" } } });
}

async function handle(frame) {
  log(frame);
  if (frame.id !== undefined && !frame.method) return;
  const { id, method, params = {} } = frame;
  if (id === undefined) return;
  if (method === "initialize") return send({ id, result: { userAgent: "fake-app-server/0.144.1" } });
  if (method === "thread/list") {
    const page = params.cursor === "page-2"
      ? [threads.get("thread-running"), threads.get("thread-subagent")]
      : [threads.get("thread-source"), threads.get("thread-idle"), threads.get("thread-unloaded")];
    return send({ id, result: { data: page, nextCursor: params.cursor ? null : "page-2", backwardsCursor: null } });
  }
  if (method === "thread/read") {
    const target = threads.get(params.threadId);
    if (!target) return send({ id, error: { code: -32004, message: "thread not found" } });
    return send({ id, result: { thread: { ...target, turns: params.includeTurns ? target.turns : [] } } });
  }
  if (method === "thread/resume") {
    const target = threads.get(params.threadId);
    if (!target) return send({ id, error: { code: -32004, message: "thread not found" } });
    target.status = { type: "idle" };
    return send({ id, result: { thread: target, model: "gpt-test", modelProvider: "openai", cwd: workspace } });
  }
  if (method === "thread/start") {
    const threadId = `thread-created-${nextThread++}`;
    const target = thread(threadId, { type: "idle" });
    target.ephemeral = Boolean(params.ephemeral);
    threads.set(threadId, target);
    return send({ id, result: { thread: target, model: "gpt-test", modelProvider: "openai", cwd: workspace } });
  }
  if (method === "thread/fork") {
    const source = threads.get(params.threadId);
    if (!source) return send({ id, error: { code: -32004, message: "thread not found" } });
    const threadId = `thread-fork-${nextThread++}`;
    const forked = { ...source, id: threadId, sessionId: `session-${threadId}`, forkedFromId: source.id, status: { type: "idle" } };
    threads.set(threadId, forked);
    return send({ id, result: { thread: forked, model: "gpt-test", modelProvider: "openai", cwd: workspace } });
  }
  if (method === "thread/archive") {
    threads.get(params.threadId).archived = true;
    return send({ id, result: {} });
  }
  if (method === "thread/unarchive") {
    const target = threads.get(params.threadId);
    target.archived = false;
    return send({ id, result: { thread: target } });
  }
  if (method === "turn/start") {
    const turnId = `turn-created-${nextTurn++}`;
    const target = threads.get(params.threadId);
    target.status = { type: "active", activeFlags: [] };
    target.turns.push(turn(turnId, "inProgress"));
    send({ id, result: { turn: turn(turnId, "inProgress") } });
    setTimeout(() => completeTurn(params.threadId, turnId), 10);
    return;
  }
  if (method === "turn/steer") {
    send({ id, result: { turnId: params.expectedTurnId } });
    setTimeout(() => completeTurn(params.threadId, params.expectedTurnId), 10);
    return;
  }
  if (method === "model/list") {
    return send({ id, result: { data: [{ id: "gpt-test", model: "gpt-test", isDefault: true }], nextCursor: null } });
  }
  send({ id, error: { code: -32601, message: `unsupported fake method ${method}` } });
}

const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  try {
    void handle(JSON.parse(line));
  } catch (error) {
    process.stderr.write(`${error.stack ?? error}\n`);
  }
});
