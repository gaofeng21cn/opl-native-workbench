import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const app = read("src/workbench/App.tsx");
const main = read("src/main.tsx");
const bridge = read("src/bridge/oplBridge.ts");
const webTransport = read("src/bridge/webTransport.ts");
const model = read("src/workbench/workbenchModel.ts");
const styles = read("src/workbench/codexWorkbenchStyles.ts");
const nativeWindow = read("scripts/native-workbench-app.swift");
const nativeSmoke = read("scripts/smoke-native-app-live.mjs");
const rail = read("src/workbench/threads/ThreadRail.tsx");
const detail = read("src/workbench/threads/ThreadDetailPopover.tsx");
const lifecycle = read("src/workbench/threads/ThreadLifecycleConfirmationDialog.tsx");

test("renderer consumes one standard Codex thread adapter", () => {
  assert.match(app, /from "\.\.\/threads\/types"/);
  assert.match(app, /from "\.\/threads\/ThreadRail"/);
  for (const method of ["listThreads", "readThread", "resumeThread", "forkThread", "setArchived"]) {
    assert.match(main, new RegExp(`${method}:`));
    assert.match(bridge, new RegExp(`${method}\\(`));
  }
  for (const route of ["/api/threads/list", "/api/threads/read", "/api/threads/resume", "/api/threads/fork", "/api/threads/archive", "/api/threads/unarchive"]) {
    assert.ok(webTransport.includes(route), `missing WebUI thread route ${route}`);
  }

  const runtimeSources = `${app}\n${main}\n${bridge}\n${webTransport}\n${nativeWindow}`;
  for (const retired of [
    "prepareCoordination",
    "dispatchCoordination",
    "waitCoordination",
    "subscribeThreadEvents",
    "CoordinationDialog",
    "coordination/lifecycle-proposal",
    "host_queue",
    "CoordinationLedger",
    "ThreadCoordinationHost"
  ]) assert.doesNotMatch(runtimeSources, new RegExp(retired));
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

test("thread rail, lifecycle, and Codex subagent projection stay explicit", () => {
  for (const scope of ["current", "all", "archived"]) assert.match(rail, new RegExp(`"${scope}"`));
  assert.match(rail, /data-projectless/);
  assert.match(rail, /agentNickname \?\? thread\.agentRole/);
  assert.match(detail, /opl-thread-resume/);
  assert.match(detail, /onRequestArchive/);
  assert.doesNotMatch(detail, /onCoordinate|coordinate/);
  assert.match(lifecycle, /opl-thread-lifecycle-confirmation/);
  assert.match(lifecycle, /ThreadLifecycleAction/);
  assert.match(app, /action === "fork"/);
  assert.match(app, /confirmed: true/);
  assert.match(app, /deriveThreadMessages/);
  assert.match(app, /message\.subagent \? " subagent"/);
  assert.match(model, /"collabAgentToolCall" \| "subAgentActivity"/);
  assert.match(model, /type === "collabagenttoolcall"/);
  assert.match(model, /type === "subagentactivity"/);
  assert.match(model, /parentThreadId/);
  assert.match(model, /sourceKind/);
});

test("native window chrome follows the compact Codex composition", () => {
  assert.doesNotMatch(app, /className="brand-name">Codex/);
  assert.match(app, /<strong className="brand-mark">One Person Lab<\/strong>/);
  assert.match(main, /document\.documentElement\.dataset\.oplHost = nativeTransportInstalled \? "native" : "web"/);
  assert.match(styles, /:root\[data-opl-host="native"\]/);
  assert.match(styles, /--opl-native-titlebar-inset: 34px/);
  assert.match(styles, /padding-top: var\(--opl-native-titlebar-inset\)/);
  assert.match(nativeWindow, /\.fullSizeContentView/);
  assert.match(nativeWindow, /window\.titleVisibility = \.hidden/);
  assert.match(nativeWindow, /window\.titlebarAppearsTransparent = true/);
  assert.match(nativeWindow, /window\.titlebarSeparatorStyle = \.none/);
  assert.match(nativeWindow, /window\.isMovableByWindowBackground = true/);
  assert.match(nativeWindow, /final class WindowDragView: NSView/);
  assert.match(nativeWindow, /window\?\.performDrag\(with: event\)/);
  assert.match(nativeWindow, /dragView\.leadingAnchor\.constraint\(equalTo: contentView\.leadingAnchor, constant: 96\)/);
  assert.match(nativeWindow, /dragView\.widthAnchor\.constraint\(equalToConstant: 164\)/);
  assert.match(nativeWindow, /dragView\.heightAnchor\.constraint\(equalToConstant: 18\)/);
  assert.match(nativeSmoke, /output\.includes\("brand=1"\)/);
  assert.match(nativeSmoke, /output\.includes\("codex=0"\)/);
  assert.match(nativeSmoke, /screenshot_absent_markers: \["Codex"\]/);
});

test("native visual tokens track the current ChatGPT Codex light workbench", () => {
  for (const marker of [
    "ChatGPT Codex macOS 26.707.61608 visual token baseline",
    "--opl-sidebar-width: 336px",
    '--opl-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "--opl-canvas: #fff",
    "--opl-sidebar: #f9f9f9",
    "--opl-surface-secondary: #f3f3f3",
    "--opl-text: #1a1c1f",
    "--opl-muted: color-mix(in oklab, var(--opl-text) 70%, transparent)",
    "--opl-faint: color-mix(in oklab, var(--opl-text) 50%, transparent)",
    "--opl-border: color-mix(in oklab, var(--opl-text) 8%, transparent)"
  ]) assert.ok(styles.includes(marker), `missing ChatGPT Codex visual token: ${marker}`);
  assert.match(styles, /font-family: var\(--opl-font-sans\);\s*font-size: 14px;\s*font-weight: 430;\s*line-height: 1\.5;/s);
  assert.match(styles, /\.composer-frame \{[^}]*border-radius: 20px;/s);
  for (const legacyColor of ["#0d9488", "#e7f5f3", "#202123", "#f7f7f7", "#eeeeec", "#e9e9e7"]) {
    assert.ok(!styles.toLowerCase().includes(legacyColor), `legacy native palette color must stay removed: ${legacyColor}`);
  }
  assert.doesNotMatch(styles, /OpenAISans|OpenAI Sans|SF Pro Text|Helvetica Neue/);
});

test("primary canvas hides its scrollbar without disabling scrolling", () => {
  assert.match(styles, /\.conversation,\s*\.settings-page \{[^}]*overflow-y: auto;[^}]*scrollbar-width: none;/s);
  assert.match(styles, /\.conversation::\-webkit-scrollbar,\s*\.settings-page::\-webkit-scrollbar \{[^}]*display: none;/s);
  assert.match(styles, /\.sidebar-scroll \{[^}]*overflow-y: auto;/s);
  assert.match(styles, /\.context-scroll \{[^}]*overflow-y: auto;/s);
});

test("sidebar account identity consumes only the canonical Gateway display name", () => {
  assert.match(model, /app_settings_read_model/);
  assert.match(model, /opl_gateway_account_read_model\.v1/);
  assert.match(model, /gatewayAccountRecord\?\.display_name/);
  assert.match(model, /gatewayAccountProjection\.connection_mode === "account"/);
  assert.match(app, /model\.gatewayAccount\?\.displayName \?\? "One Person Lab"/);
  assert.match(app, /model\.gatewayAccount \? "OPL Gateway" : t\.settings/);
  assert.doesNotMatch(app, /masked_email/);
});

test("desktop remains two-column and mobile thread dialogs are full-height", () => {
  assert.match(styles, /grid-template-columns: var\(--opl-sidebar-width\) minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*var\(--opl-sidebar-width\)\s+minmax\(0, 1fr\)\s+\d/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.thread-detail-popover,\s*\.thread-confirmation-dialog \{\s*inset: 0;/s);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /border-radius: 0/);
  assert.match(styles, /\.history-list li \.thread-directory-open \.thread-directory-copy/);
  assert.match(styles, /\.message\.system\.subagent \.message-frame/);
  assert.doesNotMatch(styles, /\.coordination-/);
  assert.match(styles, /\.composer-control-label \{\s*display: none;/s);
});
