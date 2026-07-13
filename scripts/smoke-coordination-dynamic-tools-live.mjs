import assert from "node:assert/strict";
import readline from "node:readline";
import { spawn } from "node:child_process";

const child = spawn("codex", ["app-server", "--stdio"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"]
});
const pending = new Map();
let nextId = 1;
let toolCall;
let completedTurn;
let stderr = "";

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-8000); });

function send(frame) {
  child.stdin.write(`${JSON.stringify(frame)}\n`);
}

function request(method, params) {
  const id = nextId++;
  send({ method, id, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}

const lines = readline.createInterface({ input: child.stdout });
lines.on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id != null && pending.has(message.id) && !message.method) {
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(`${entry.method}: ${JSON.stringify(message.error)}`));
    else entry.resolve(message.result);
    return;
  }
  if (message.method === "item/tool/call") {
    toolCall = message;
    send({
      id: message.id,
      result: { contentItems: [{ type: "inputText", text: "probe-ok" }], success: true }
    });
  }
  if (message.method === "turn/completed") completedTurn = message.params?.turn;
});

function waitFor(predicate, timeoutMs, label) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (predicate()) { clearInterval(timer); resolve(); }
      else if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        reject(new Error(`${label} timed out\n${stderr}`));
      }
    }, 50);
  });
}

try {
  await request("initialize", {
    clientInfo: { name: "opl-coordination-live-probe", title: "OPL coordination live probe", version: "0.1.0" },
    capabilities: { experimentalApi: true, requestAttestation: false }
  });
  send({ method: "initialized" });
  const started = await request("thread/start", {
    cwd: process.cwd(),
    sandbox: "read-only",
    approvalPolicy: "never",
    ephemeral: true,
    threadSource: "opl-native-workbench-coordination-probe",
    dynamicTools: [{
      type: "function",
      name: "opl_coordination_probe",
      description: "Return the supplied token. This tool must be called exactly once.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["token"],
        properties: { token: { const: "opl-live-probe-20260713" } }
      }
    }]
  });
  const threadId = started?.thread?.id;
  assert.equal(typeof threadId, "string", "thread/start must return thread id");
  await request("turn/start", {
    threadId,
    input: [{ type: "text", text: "Call opl_coordination_probe exactly once with token opl-live-probe-20260713, then answer probe complete.", text_elements: [] }],
    cwd: process.cwd(),
    approvalPolicy: "never",
    sandboxPolicy: { type: "readOnly", networkAccess: false }
  });
  await waitFor(() => toolCall && completedTurn, 180_000, "dynamicTools live probe");
  assert.equal(toolCall.method, "item/tool/call");
  assert.equal(toolCall.params?.threadId, threadId);
  assert.equal(toolCall.params?.tool, "opl_coordination_probe");
  assert.equal(toolCall.params?.arguments?.token, "opl-live-probe-20260713");
  assert.ok(toolCall.id != null, "server request id must be present");
  assert.equal(completedTurn.status, "completed");
  console.log(JSON.stringify({
    status: "coordination_dynamic_tools_live_passed",
    threadId,
    tool: toolCall.params.tool,
    serverRequestIdPreserved: true,
    turnStatus: completedTurn.status
  }));
} finally {
  lines.close();
  child.kill("SIGTERM");
}
