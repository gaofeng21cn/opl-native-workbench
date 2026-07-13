import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COORDINATION_DYNAMIC_TOOLS,
  evaluateCoordinationGuards,
  selectDispatchKind,
  writeSetsOverlap
} from "../src/coordination/foundation.ts";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const cases = JSON.parse(fs.readFileSync(path.join(root, "fixtures/coordination/guard-cases.json"), "utf8"));
const typeSource = fs.readFileSync(path.join(root, "src/coordination/types.ts"), "utf8");

const baseRequest = {
  sourceThreadId: "source-thread",
  targetThreadId: "target-thread",
  sourceHostId: "local-host",
  targetHostId: "local-host",
  projectKey: "project-a",
  sender: "user",
  intent: "handoff",
  reason: "target owns the requested surface",
  message: "Please continue the scoped implementation.",
  summary: "Scoped implementation handoff",
  expectedWriteSet: ["src/feature/new.ts"],
  ancestorCoordinationIds: [],
  priority: "normal",
  dedupeKey: "dedupe-a",
  hopCount: 0
};

const baseTarget = {
  id: "target-thread",
  sessionId: "session-a",
  projectKey: "project-a",
  hostId: "local-host",
  status: { type: "idle" },
  state: "idle",
  summary: "Target thread",
  workspace: "/workspace/project-a",
  owner: "user",
  goal: "Implement coordination",
  archived: false,
  parentThreadId: null,
  ancestorThreadIds: [],
  writeSet: ["src/coordination"],
  createdAt: 1,
  updatedAt: 2,
  turns: []
};

for (const fixture of cases) {
  const request = { ...baseRequest };
  const target = { ...baseTarget };
  let permission = "confirmed";
  const recent = new Set();
  for (const [key, value] of Object.entries(fixture.mutation)) {
    if (key === "permission") permission = value;
    else if (key === "duplicate" && value) recent.add(request.dedupeKey);
    else if (key === "sameTarget" && value) request.targetThreadId = request.sourceThreadId;
    else if (key === "archived") target.archived = value;
    else if (key === "state") target.state = value;
    else request[key] = value;
  }
  const failure = evaluateCoordinationGuards(request, target, permission, recent);
  assert.equal(failure?.code ?? null, fixture.expected, fixture.name);
}

assert.equal(writeSetsOverlap(["src/coordination"], ["src/coordination/types.ts"]), true);
assert.equal(writeSetsOverlap(["src/bridge"], ["src/coordination"]), false);
assert.equal(selectDispatchKind("unloaded", "normal"), "started");
assert.equal(selectDispatchKind("idle", "normal"), "started");
assert.equal(selectDispatchKind("running", "urgent"), "steered");
assert.equal(selectDispatchKind("running", "normal"), "queued");

const expectedTools = [
  "list_threads", "read_thread", "send_message_to_thread", "fork_thread",
  "archive_thread", "unarchive_thread", "wait_thread"
];
assert.deepEqual(COORDINATION_DYNAMIC_TOOLS.map((tool) => tool.name), expectedTools);
for (const tool of COORDINATION_DYNAMIC_TOOLS) assert.equal(tool.type, "function", `${tool.name} discriminator`);
const sendTool = COORDINATION_DYNAMIC_TOOLS.find((tool) => tool.name === "send_message_to_thread");
const sendProperties = sendTool.inputSchema.properties;
for (const spoofField of ["coordinationId", "permissionDecision", "targetWriteSet", "confirmed", "confirmationId"]) {
  assert.equal(spoofField in sendProperties, false, `model tool must not accept ${spoofField}`);
}
const archiveTool = COORDINATION_DYNAMIC_TOOLS.find((tool) => tool.name === "archive_thread");
for (const spoofField of ["confirmed", "confirmationId"]) {
  assert.equal(spoofField in archiveTool.inputSchema.properties, false, `model archive must not accept ${spoofField}`);
}
const requestContract = typeSource.match(/export type CoordinationRequest = \{([\s\S]*?)\n\};/)?.[1] ?? "";
for (const hostOwnedField of ["coordinationId", "permissionDecision", "targetWriteSet"]) {
  assert.equal(requestContract.includes(`${hostOwnedField}:`), false, `caller request must not own ${hostOwnedField}`);
}
const dispatchContract = typeSource.match(/export type DispatchCoordinationRequest = \{([\s\S]*?)\n\};/)?.[1] ?? "";
assert.match(dispatchContract, /previewToken: string/);
assert.match(dispatchContract, /confirmed\?: boolean/);
assert.match(dispatchContract, /confirmationId\?: string/);

console.log(JSON.stringify({ status: "coordination_security_regression_passed", cases: cases.length, tools: expectedTools.length }));
