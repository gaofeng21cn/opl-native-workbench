import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assistantDisplayMarkdown } from "../../src/workbench/messageDisplay.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const app = read("src/workbench/App.tsx");
const main = read("src/main.tsx");
const bridge = read("src/bridge/oplBridge.ts");
const webTransport = read("src/bridge/webTransport.ts");
const model = read("src/workbench/workbenchModel.ts");
const settingsPanel = read("src/workbench/SettingsPanel.tsx");
const styles = read("src/workbench/codexWorkbenchStyles.ts");
const nativeWindow = read("scripts/native-workbench-app.swift");
const nativeSmoke = read("scripts/smoke-native-app-live.mjs");
const rail = read("src/workbench/threads/ThreadRail.tsx");
const detail = read("src/workbench/threads/ThreadDetailPopover.tsx");
const lifecycle = read("src/workbench/threads/ThreadLifecycleConfirmationDialog.tsx");
const threadSearch = read("src/workbench/ThreadSearchDialog.tsx");
const composerPalette = read("src/workbench/ComposerCapabilityPalette.tsx");
const settings = read("src/workbench/settingsModel.ts");

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
  assert.match(rail, /project\.projectless \? project\.threads/);
  assert.doesNotMatch(rail, /\bInbox\b/);
  assert.match(rail, /agentNickname \?\? thread\.agentRole/);
  assert.match(detail, /opl-thread-resume/);
  assert.match(detail, /onRequestArchive/);
  assert.doesNotMatch(detail, /onCoordinate|coordinate/);
  assert.match(lifecycle, /opl-thread-lifecycle-confirmation/);
  assert.match(lifecycle, /ThreadLifecycleAction/);
  assert.match(app, /action === "fork"/);
  assert.match(app, /confirmed: true/);
  assert.match(app, /deriveThreadMessages/);
  assert.match(app, /<Streamdown/);
  assert.match(app, /linkSafety=\{assistantMarkdownLinkSafety\}/);
  assert.match(app, /assistantDisplayMarkdown\(/);
  assert.doesNotMatch(app, /opl-assistant-artifact-card/);
  assert.match(app, /bridge\.readThread\(\{ threadId: thread\.id, includeTurns: true \}\)/);
  assert.doesNotMatch(app, /const resumed = thread\.status === "unloaded"/);
  assert.match(app, /async function resumeThreadAndOpen/);
  assert.match(app, /thread-read-error/);
  assert.match(app, /message\.subagent \? " subagent"/);
  assert.match(model, /"collabAgentToolCall" \| "subAgentActivity"/);
  assert.match(model, /type === "collabagenttoolcall"/);
  assert.match(model, /type === "subagentactivity"/);
  assert.match(model, /parentThreadId/);
  assert.match(model, /sourceKind/);
});

test("starting a new task clears errors from the previous thread", () => {
  const startNewChat = app.match(/function startNewChat\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(startNewChat, /setThreadActionError\(""\)/);
});

test("assistant display consumes Codex UI directives without rewriting Markdown examples", () => {
  const visible = assistantDisplayMarkdown([
    "发布完成。",
    "",
    '::git-stage{cwd="/tmp/example"}',
    '::git-commit{cwd="/tmp/example"}',
    '::git-push{cwd="/tmp/example" branch="main"}',
    '::git-create-branch{cwd="/tmp/example" branch="codex/example"}',
    '::git-create-pr{cwd="/tmp/example" branch="codex/example" url="https://example.test" isDraft=false}',
    '::created-thread{threadId="thread-1"}',
    '::code-comment{title="Review" body="Keep this hidden" file="/tmp/example.ts" start=1}',
    "",
    "普通正文中的 `::git-commit{...}` 示例应保留。",
    "",
    "```text",
    '::git-commit{cwd="/tmp/fenced-example"}',
    "```",
    "::unknown-directive{value=\"visible\"}"
  ].join("\n"));

  for (const hidden of ["::git-stage{", "::git-push{", "::git-create-pr{", "::created-thread{", "::code-comment{"]) {
    assert.equal(visible.includes(hidden), false, `display text leaked ${hidden}`);
  }
  assert.match(visible, /普通正文中的 `::git-commit\{\.\.\.\}` 示例应保留。/);
  assert.match(visible, /```text\n::git-commit\{cwd="\/tmp\/fenced-example"\}\n```/);
  assert.match(visible, /::unknown-directive\{value="visible"\}/);
});

test("native window chrome follows the compact Codex composition", () => {
  assert.doesNotMatch(app, /className="brand-name">Codex/);
  assert.match(app, /<strong className="brand-mark">One Person Lab<\/strong>/);
  const brandRow = app.match(/<header className="brand-row"[\s\S]*?<\/header>/)?.[0] ?? "";
  assert.doesNotMatch(brandRow, /ChevronDown/);
  assert.match(main, /document\.documentElement\.dataset\.oplHost = nativeTransportInstalled \? "native" : "web"/);
  assert.match(styles, /:root\[data-opl-host="native"\]/);
  assert.match(styles, /--opl-native-titlebar-inset: 34px/);
  assert.match(styles, /padding-top: var\(--opl-native-titlebar-inset\)/);
  assert.match(nativeWindow, /\.fullSizeContentView/);
  assert.match(nativeWindow, /window\.titleVisibility = \.hidden/);
  assert.match(nativeWindow, /window\.titlebarAppearsTransparent = true/);
  assert.match(nativeWindow, /window\.titlebarSeparatorStyle = \.none/);
  assert.match(nativeWindow, /window\.isMovableByWindowBackground = true/);
  assert.match(app, /className="brand-row" onPointerDown=\{beginWindowDrag\}/);
  assert.match(app, /className="topbar" onPointerDown=\{beginWindowDrag\}/);
  assert.match(bridge, /beginWindowDrag\(\)/);
  assert.match(main, /beginWindowDrag: \(\) => \{\s*void post\("beginWindowDrag"\)/s);
  assert.match(webTransport, /beginWindowDrag: \(\) => undefined/);
  assert.match(nativeWindow, /if method == "beginWindowDrag"/);
  assert.match(nativeWindow, /let currentEvent = NSApp\.currentEvent/);
  assert.match(nativeWindow, /NSEvent\.mouseEvent\(/);
  assert.match(nativeWindow, /NSEvent\.mouseLocation/);
  assert.match(nativeWindow, /dragWindow\.performDrag\(with: event\)/);
  assert.match(nativeWindow, /final class WindowDragView: NSView/);
  assert.match(nativeWindow, /dragView\.leadingAnchor\.constraint\(equalTo: contentView\.leadingAnchor, constant: 96\)/);
  assert.match(nativeWindow, /dragView\.trailingAnchor\.constraint\(equalTo: contentView\.trailingAnchor, constant: -64\)/);
  assert.match(nativeWindow, /dragView\.heightAnchor\.constraint\(equalToConstant: 18\)/);
  assert.doesNotMatch(nativeWindow, /dragView\.widthAnchor|equalToConstant: 164/);
  assert.match(nativeSmoke, /output\.includes\("brand=1"\)/);
  assert.doesNotMatch(nativeSmoke, /output\.includes\("codex=0"\)/);
  assert.match(nativeSmoke, /global Codex project names are allowed/);
});

test("search, composer attachments, and Agent permissions route to real renderer and bridge behavior", () => {
  assert.match(app, /className="icon-button sidebar-search"[^>]*onClick=\{\(\) => setThreadSearchOpen\(true\)\}/);
  assert.match(app, /className="sidebar-section-search"[^>]*onClick=\{\(\) => setThreadSearchOpen\(true\)\}/);
  assert.match(app, /<ThreadSearchDialog/);
  assert.match(threadSearch, /!thread\.isTemporaryWorkspace && !project\.projectless/);
  assert.match(app, /<ComposerCapabilityPalette/);
  assert.match(app, /function openComposerPalette\(\)/);
  assert.doesNotMatch(app, /openComposerPalette\("capabilities"\)|composerPaletteMode/);
  assert.match(app, /inputs: pendingSelections\.map\(\(selection\) => selection\.input\)/);
  assert.match(app, /permissions: settings\.agentPermissions/);
  assert.match(app, /setComposerSelections\(pendingSelections\)/);
  assert.match(app, /aria-label=\{t\.agentPermissions\}/);
  assert.match(app, /<ShieldCheck className="composer-permission-icon"/);
  assert.match(settings, /agentPermissions: ":danger-full-access"/);
  for (const method of ["readCodexCapabilities", "readCodexPermissionProfiles", "pickFiles", "pickDirectory"]) {
    assert.match(main, new RegExp(`${method}:`));
    assert.match(bridge, new RegExp(`${method}\\(`));
  }
  assert.match(nativeWindow, /case "readCodexCapabilities"/);
  assert.match(nativeWindow, /case "readCodexPermissionProfiles"/);
  assert.match(nativeWindow, /method: "permissionProfile\/list"/);
  assert.match(nativeWindow, /private static let defaultPermissions = ":danger-full-access"/);
  assert.match(nativeWindow, /case "pickFiles"/);
  assert.match(nativeWindow, /case "pickDirectory"/);
  assert.match(composerPalette, /catalog\.skills/);
  assert.match(composerPalette, /seenSkillNames/);
  assert.match(composerPalette, /if \(!open\) \{\s*setQuery\(""\)/s);
  assert.match(composerPalette, /catalog\.plugins/);
  assert.match(composerPalette, /catalog\.apps/);
});

test("native visual tokens track the current ChatGPT Codex light workbench", () => {
  for (const marker of [
    "ChatGPT Codex macOS 26.707.61608 visual token baseline",
    "--opl-sidebar-width: 236px",
    '--opl-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "--opl-canvas: #fff",
    "--opl-sidebar: #f7f7f8",
    "--opl-surface-secondary: #f4f4f4",
    "--opl-text: #202123",
    "--opl-muted: color-mix(in oklab, var(--opl-text) 70%, transparent)",
    "--opl-faint: color-mix(in oklab, var(--opl-text) 50%, transparent)",
    "--opl-border: color-mix(in oklab, var(--opl-text) 8%, transparent)"
  ]) assert.ok(styles.includes(marker), `missing ChatGPT Codex visual token: ${marker}`);
  assert.match(styles, /font-family: var\(--opl-font-sans\);\s*font-size: 13px;\s*font-weight: 400;\s*line-height: 1\.5;/s);
  assert.match(styles, /\.composer-frame \{[^}]*border-radius: 17px;/s);
  assert.match(styles, /\[hidden\] \{\s*display: none !important;/s);
  for (const legacyColor of ["#0d9488", "#e7f5f3", "#f7f7f7", "#eeeeec", "#e9e9e7"]) {
    assert.ok(!styles.toLowerCase().includes(legacyColor), `legacy native palette color must stay removed: ${legacyColor}`);
  }
  assert.doesNotMatch(styles, /OpenAISans|OpenAI Sans|SF Pro Text|Helvetica Neue/);
  assert.match(styles, /\[data-streamdown="link"\]/);
  assert.match(styles, /\[data-streamdown="inline-code"\]/);
  assert.match(styles, /\[data-streamdown="code-block"\]/);
});

test("primary canvas hides its scrollbar without disabling scrolling", () => {
  assert.match(styles, /\.conversation \{[^}]*overflow-y: auto;[^}]*scrollbar-width: none;/s);
  assert.match(styles, /\.settings-detail \{[^}]*overflow-y: auto;[^}]*scrollbar-width: none;/s);
  assert.match(styles, /\.sidebar-scroll \{[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/s);
  assert.match(styles, /\.sidebar-scroll::\-webkit-scrollbar \{[^}]*width: 5px;[^}]*height: 0;/s);
  assert.match(styles, /\.sidebar-scroll::\-webkit-scrollbar-track \{[^}]*background: transparent;/s);
  assert.match(styles, /\.sidebar-scroll::\-webkit-scrollbar-thumb \{[^}]*background: color-mix\(in oklab, var\(--opl-text\) 12%, transparent\);/s);
  assert.match(styles, /\.sidebar-scroll > \*,[\s\S]*\.thread-directory-row \{[^}]*min-width: 0;[^}]*max-width: 100%;/s);
  assert.match(styles, /\.history-list li \.thread-directory-open \{[^}]*max-width: 100%;[^}]*overflow: hidden;/s);
  assert.match(styles, /\.history-list li \.thread-directory-open \.thread-directory-copy \{[^}]*max-width: 100%;[^}]*overflow: hidden;/s);
  assert.match(styles, /\.thread-directory-copy strong \{[^}]*max-width: 100%;[^}]*display: block;/s);
  assert.match(styles, /\.context-scroll \{[^}]*overflow-y: auto;/s);
});

test("desktop sidebar width is adjustable, bounded, and persisted as UI metadata", () => {
  assert.match(app, /sidebarWidth: number/);
  assert.match(app, /const minimumSidebarWidth = 200/);
  assert.match(app, /const maximumSidebarWidth = 420/);
  assert.match(app, /sidebarWidth: clampSidebarWidth\(metadata\?\.sidebarWidth\)/);
  assert.match(app, /data-testid="opl-sidebar-resizer"/);
  assert.match(app, /role="separator"/);
  assert.match(app, /onPointerDown=\{beginSidebarResize\}/);
  assert.match(app, /onDoubleClick=\{\(\) => persistSidebarWidth\(defaultSidebarWidth\)\}/);
  assert.match(app, /style=\{\{ "--opl-sidebar-width": `\$\{sidebarWidth\}px` \} as CSSProperties\}/);
  assert.match(styles, /\.sidebar-resizer \{[^}]*left: calc\(var\(--opl-sidebar-width\) - 3px\);[^}]*width: 6px;/s);
  assert.match(styles, /:root\[data-opl-sidebar-resizing="true"\]/);
  assert.match(styles, /\.sidebar-closed \.chat-shell \{\s*grid-column: 1 \/ -1;/s);
  assert.doesNotMatch(styles, /grid-template-columns: 224px minmax\(0, 1fr\)/);
});

test("sidebar and Settings consume the canonical Gateway account read model", () => {
  assert.match(model, /app_settings_read_model/);
  assert.match(model, /opl_gateway_account_read_model\.v1/);
  assert.match(model, /gatewayAccountRecord\?\.display_name/);
  assert.match(model, /gatewayAccountProjection\.connection_mode === "account"/);
  assert.match(model, /gatewayConnectionMode/);
  assert.match(app, /data-account-mode=\{sidebarAccountMode\}/);
  assert.match(app, /sidebarAccountMode === "manual_key" \? <KeyRound/);
  assert.match(app, /gatewayAccountInitials\(model\.gatewayAccount\?\.displayName\)/);
  assert.match(settingsPanel, /opl-settings-gateway-username/);
  assert.match(settingsPanel, /gateway\?\.displayName/);
  assert.match(settingsPanel, /gateway\?\.email/);
  assert.match(settingsPanel, /gateway\?\.usage\?\.todayTokens/);
  assert.match(settingsPanel, /stateLoading \? "loading" : stateFailed \? "attention_needed"/);
  assert.match(settingsPanel, /正在读取账户/);
  assert.match(settingsPanel, /账户状态不可用/);
  assert.match(settingsPanel, /Not required \(not included\)/);
  assert.doesNotMatch(`${app}\n${settingsPanel}\n${model}`, /masked_email/);
});

test("Settings uses the App-owned navigation groups and one shared read model", () => {
  for (const id of ["overview", "account_models", "connections_deployment", "workspace", "agents_capabilities", "runtime_maintenance", "preferences"]) {
    assert.match(settingsPanel, new RegExp(`id: "${id}"`));
  }
  for (const destination of ["account", "models", "resources", "storage", "instructions", "services", "updates", "diagnostics", "about"]) {
    assert.match(settingsPanel, new RegExp(`id: "${destination}"`));
  }
  assert.match(model, /settingsProjection/);
  assert.match(model, /codex_model_policy/);
  assert.match(model, /workspace_services/);
  assert.match(model, /storage_lifecycle/);
  assert.match(app, /<SettingsSidebar/);
  assert.match(settingsPanel, /opl-settings-back-to-app/);
  assert.match(settingsPanel, /onDestinationChange/);
  assert.doesNotMatch(settingsPanel, /useState<SettingsDestinationId>/);
  assert.doesNotMatch(styles, /grid-template-columns: 220px minmax\(0, 1fr\)/);
  assert.match(styles, /\.settings-mobile-navigation/);
});

test("desktop remains two-column and mobile thread dialogs are full-height", () => {
  assert.match(styles, /grid-template-columns: var\(--opl-sidebar-width\) minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*var\(--opl-sidebar-width\)\s+minmax\(0, 1fr\)\s+\d/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(app, /window\.matchMedia\("\(max-width: 760px\)"\)\.matches\) setSidebarOpen\(false\)/);
  assert.match(rail, /project\.threads\.slice\(0, 2\)/);
  assert.match(app, /conversation\.scrollTop = conversation\.scrollHeight/);
  assert.match(app, /mobile\.addEventListener\?\.\("change", syncSidebar\)/);
  assert.match(app, /aria-label=\{t\.agentPermissions\}/);
  assert.match(styles, /\.thread-detail-popover,\s*\.thread-confirmation-dialog \{\s*inset: 0;/s);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /border-radius: 0/);
  assert.match(styles, /\.history-list li \.thread-directory-open \.thread-directory-copy/);
  assert.match(styles, /\.message\.system\.subagent \.message-frame/);
  assert.doesNotMatch(styles, /\.coordination-/);
  assert.match(styles, /\.composer-permissions select \{[^}]*max-width: 118px;/s);
});
