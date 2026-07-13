import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const app = read("src/workbench/App.tsx");
const model = read("src/workbench/workbenchModel.ts");
const styles = read("src/workbench/codexWorkbenchStyles.ts");
const dialog = read("src/workbench/coordination/CoordinationDialog.tsx");
const rail = read("src/workbench/coordination/ThreadRail.tsx");
const detail = read("src/workbench/coordination/ThreadDetailPopover.tsx");
const lifecycle = read("src/workbench/coordination/ThreadLifecycleConfirmationDialog.tsx");
const events = read("src/workbench/coordination/CoordinationEvents.tsx");

test("renderer consumes the host coordination authority", () => {
  assert.match(app, /from "\.\.\/coordination\/types"/);
  for (const method of [
    "listThreads",
    "readThread",
    "resumeThread",
    "prepareCoordination",
    "dispatchCoordination",
    "forkThread",
    "setArchived",
    "waitCoordination",
    "subscribeThreadEvents"
  ]) {
    assert.match(app, new RegExp(`coordinationBridge\\.${method}`));
  }
  for (const field of ["sourceHostId", "targetHostId", "sender", "intent", "reason", "message", "summary", "expectedWriteSet", "ancestorCoordinationIds", "dedupeKey"]) {
    assert.match(app, new RegExp(`${field}:`));
  }
  assert.doesNotMatch(app, /type CoordinationRequest\s*=/);
});
test("ordinary fallback data and example content stay out of the renderer", () => {
  for (const field of ["sessions", "results", "deliverables", "receipts", "artifactPreviews", "deliveryPackages", "actionReceipts", "confirmations", "questions", "activeProjectLines", "contextSources", "contextActions", "contextTrace"]) {
    assert.match(model, new RegExp(`${field}: \\[\\]`));
  }
  for (const example of ["GlycoFold", "Project brief.md", "Data inventory.csv", "Result summary"]) {
    assert.doesNotMatch(`${app}\n${model}`, new RegExp(example.replace(".", "\\.")));
  }
  assert.doesNotMatch(app, /model\.confirmations\[0\]!/);
  assert.match(app, /model\.confirmations\[0\] && model\.questions\[0\]/);
});

test("local storage keeps only UI metadata and drafts after one-way legacy backup", () => {
  assert.match(app, /legacyChatSessionsBackupKey/);
  assert.match(app, /storage\.removeItem\(legacyChatSessionsStorageKey\)/);
  assert.match(app, /uiMetadataStorageKey/);
  assert.match(app, /draftStorageKey/);
  assert.doesNotMatch(app, /writeChatSessions|messages:\s*nextMessages|setItem\(legacyChatSessionsStorageKey/);
});

test("rail, lifecycle, and dispatch states are explicit", () => {
  for (const scope of ["current", "all", "archived"]) assert.match(rail, new RegExp(`"${scope}"`));
  assert.match(rail, /data-projectless/);
  assert.match(detail, /opl-thread-resume/);
  assert.match(detail, /onRequestArchive/);
  assert.doesNotMatch(detail, /onArchive/);
  assert.match(lifecycle, /opl-thread-lifecycle-confirmation/);
  assert.match(lifecycle, /ThreadLifecycleAction/);
  assert.match(app, /coordination\/lifecycle-proposal/);
  assert.match(app, /action === "fork"/);
  assert.match(app, /confirmed: true/);
  assert.match(app, /if \(resumed\) await loadThreadDirectory\(false\)/);

  for (const intent of ["delegate", "inform", "review", "block", "handoff"]) assert.match(dialog, new RegExp(`${intent}:`));
  for (const field of ["reason", "intent", "message", "summary", "expectedWriteSet"]) assert.match(dialog, new RegExp(`draft\\.${field}`));
  assert.match(dialog, /targetProjectless && Boolean\(sourceThread\.workspace\) && thread\.workspace === sourceThread\.workspace/);
  assert.match(dialog, /coordination-steer-confirmation/);
  assert.match(dialog, /activeSteer && !steerConfirmed/);
  for (const phase of ["proposal", "confirmation", "queued", "conflict", "result"]) assert.match(events, new RegExp(`${phase}:`));
  assert.match(events, /source/);
  assert.match(events, /target/);
  assert.match(app, /preparation\.request\.sender !== "model"/);
  assert.match(model, /coordinationItems\.map\(coordinationMessageFromRecord\)/);
  assert.match(app, /Coordination receipt/);
  assert.match(app, /message\.coordination \? " coordination"/);
  assert.match(model, /queueText === null \? Number\.NaN/);
  assert.match(model, /coordinationId, method, state, direction/);
  assert.match(app, /if \(!event\.method\.startsWith\("coordination\/"\)\) return/);
  assert.match(app, /const seen = new Set<string>\(\)/);
});

test("desktop remains two-column and mobile overlays are full-height", () => {
  assert.match(styles, /grid-template-columns: 272px minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*272px\s+minmax\(0, 1fr\)\s+\d/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.thread-detail-popover,\s*\.thread-confirmation-dialog,\s*\.coordination-dialog\s*\{\s*inset: 0;/s);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /border-radius: 0/);
  assert.match(styles, /\.history-list li \.thread-directory-open \.thread-directory-copy/);
  assert.match(styles, /\.message\.system\.coordination \.message-frame/);
  assert.match(styles, /\.composer-control-label \{\s*display: none;/s);
});
