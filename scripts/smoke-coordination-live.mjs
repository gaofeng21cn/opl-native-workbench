import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexAppServerTransport } from "./webui-host/app-server-transport.mjs";
import { ThreadCoordinationHost } from "./webui-host/coordination-host.mjs";
import { CoordinationLedger } from "./webui-host/coordination-ledger.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "out");
const ledgerPath = path.join(outputDirectory, "coordination-live-ledger.jsonl");
const artifactPath = path.join(outputDirectory, "coordination-live-smoke.json");
const transport = new CodexAppServerTransport({ cwd: root, turnTimeoutMs: 180_000 });
const host = new ThreadCoordinationHost(transport, {
  ledger: new CoordinationLedger({ filePath: ledgerPath, maxEntries: 200 })
});
const createdThreadIds = [];

async function archiveCreatedThreads() {
  for (const threadId of createdThreadIds) {
    await transport.archiveThread(threadId).catch(() => undefined);
  }
}

try {
  await mkdir(outputDirectory, { recursive: true });
  await transport.start();
  const sourceStart = await transport.startThread({
    ephemeral: false,
    threadSource: "opl-native-workbench-coordination-live-source"
  });
  const targetStart = await transport.startThread({
    ephemeral: false,
    threadSource: "opl-native-workbench-coordination-live-target"
  });
  const sourceThreadId = sourceStart.thread?.id;
  const targetThreadId = targetStart.thread?.id;
  assert.ok(sourceThreadId && targetThreadId && sourceThreadId !== targetThreadId, "two independent root thread ids are required");
  createdThreadIds.push(sourceThreadId, targetThreadId);

  const sourceWarmup = await transport.startTurn(sourceThreadId, "Reply exactly: OPL source ready");
  assert.ok(sourceWarmup.turn?.id, "source warmup turn must return an id");
  await transport.waitForTurn(sourceWarmup.turn.id, 180_000);
  const targetWarmup = await transport.startTurn(targetThreadId, "Reply exactly: OPL target ready");
  assert.ok(targetWarmup.turn?.id, "target warmup turn must return an id");
  await transport.waitForTurn(targetWarmup.turn.id, 180_000);

  const directory = await host.listThreads({ workspace: root, archived: false, limit: 100 });
  assert.equal(directory.nextCursor, null);
  assert.equal(directory.data.some((thread) => thread.id === sourceThreadId), true, "source thread must be listed");
  assert.equal(directory.data.some((thread) => thread.id === targetThreadId), true, "target thread must be listed");
  const source = await host.readThread({ threadId: sourceThreadId, includeTurns: false });
  const target = await host.readThread({ threadId: targetThreadId, includeTurns: true });
  assert.equal(source.id, sourceThreadId);
  assert.equal(target.id, targetThreadId);

  const preview = await host.prepareCoordination({
    sourceThreadId,
    targetThreadId,
    sender: "user",
    intent: "inform",
    reason: "verify the local cross-thread live path",
    message: "Reply exactly: OPL coordination live complete",
    summary: "Live coordination probe",
    expectedWriteSet: [],
    ancestorCoordinationIds: [],
    priority: "normal",
    dedupeKey: `live-${Date.now()}`,
    hopCount: 0
  });
  assert.equal(preview.state, "prepared");
  assert.equal(preview.permissionDecision, "preauthorized");
  assert.equal(preview.plannedDispatch, "started");
  const dispatch = await host.dispatchCoordination({ previewToken: preview.previewToken });
  assert.equal(dispatch.protocolMethod, "turn/start");
  const completed = await host.waitCoordination({ coordinationId: dispatch.coordinationId, timeoutMs: 180_000 });
  assert.equal(completed.state, "completed");
  assert.ok(completed.resultSummaryOrRef, "completed coordination must return a result summary or ref");

  const activeTurn = await transport.startTurn(
    targetThreadId,
    "Run the terminal command `sleep 15`, then reply exactly: OPL active turn complete"
  );
  assert.ok(activeTurn.turn?.id, "active turn must return an id");
  const activeReadback = await host.readThread({ threadId: targetThreadId, includeTurns: true });
  assert.equal(activeReadback.state, "running", "target must be running before queue and steer probes");

  const queuedPreview = await host.prepareCoordination({
    sourceThreadId,
    targetThreadId,
    sender: "user",
    intent: "review",
    reason: "verify nonurgent host queue routing",
    message: "After the active turn, reply exactly: OPL queued coordination complete",
    summary: "Queued live coordination probe",
    expectedWriteSet: [],
    ancestorCoordinationIds: [],
    priority: "normal",
    dedupeKey: `live-queue-${Date.now()}`,
    hopCount: 0
  });
  assert.equal(queuedPreview.plannedDispatch, "queued");
  assert.equal(queuedPreview.permissionDecision, "preauthorized");
  const queuedDispatch = await host.dispatchCoordination({ previewToken: queuedPreview.previewToken });
  assert.equal(queuedDispatch.protocolMethod, "host_queue");
  const queuedProtocol = queuedDispatch.protocolMethod;

  const steerPreview = await host.prepareCoordination({
    sourceThreadId,
    targetThreadId,
    sender: "user",
    intent: "block",
    reason: "verify confirmed realtime steering",
    message: "Finish the current turn now and preserve the queued follow-up.",
    summary: "Urgent live coordination probe",
    expectedWriteSet: [],
    ancestorCoordinationIds: [],
    priority: "urgent",
    dedupeKey: `live-steer-${Date.now()}`,
    hopCount: 0
  });
  assert.equal(steerPreview.state, "confirmation_required");
  assert.equal(steerPreview.plannedDispatch, "steered");
  const steerDispatch = await host.dispatchCoordination({
    previewToken: steerPreview.previewToken,
    confirmed: true,
    confirmationId: `live-steer-confirm-${Date.now()}`
  });
  assert.equal(steerDispatch.protocolMethod, "turn/steer");
  const steerProtocol = steerDispatch.protocolMethod;
  await transport.waitForTurn(activeTurn.turn.id, 180_000);
  const [steerCompleted, queueCompleted] = await Promise.all([
    host.waitCoordination({ coordinationId: steerDispatch.coordinationId, timeoutMs: 180_000 }),
    host.waitCoordination({ coordinationId: queuedDispatch.coordinationId, timeoutMs: 180_000 })
  ]);
  assert.equal(steerCompleted.state, "completed");
  assert.equal(queueCompleted.state, "completed");
  assert.ok(queueCompleted.resultSummaryOrRef, "queued coordination must return a result summary or ref");

  const forked = await host.forkThread({ threadId: targetThreadId });
  assert.ok(forked.id && forked.id !== targetThreadId, "fork must return a new opaque thread id");
  createdThreadIds.push(forked.id);
  const archived = await host.setArchived({
    threadId: targetThreadId,
    archived: true,
    confirmed: true,
    confirmationId: `live-archive-${Date.now()}`
  });
  assert.equal(archived.archived, true);
  const unarchived = await host.setArchived({ threadId: targetThreadId, archived: false });
  assert.equal(unarchived.archived, false);

  const artifact = {
    status: "coordination_live_passed",
    observedAt: new Date().toISOString(),
    appServer: "codex app-server --stdio",
    sourceThreadId,
    targetThreadId,
    forkedThreadId: forked.id,
    listTerminalCursor: directory.nextCursor,
    dispatch: {
      state: dispatch.state,
      protocolMethod: dispatch.protocolMethod,
      coordinationId: dispatch.coordinationId,
      turnId: dispatch.turnId
    },
    terminal: {
      state: completed.state,
      resultSummaryOrRef: completed.resultSummaryOrRef
    },
    runningRouting: {
      queuedProtocol,
      queuedDeliveryProtocol: queuedDispatch.protocolMethod,
      queueTerminal: queueCompleted.state,
      steerProtocol,
      steerTerminal: steerCompleted.state
    },
    lifecycle: { archive: archived.archived, unarchive: unarchived.archived },
    boundaries: {
      activeShellAdopted: false,
      releaseReady: false,
      remoteReady: false
    }
  };
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify(artifact));
} finally {
  await archiveCreatedThreads();
  await transport.stop();
}
