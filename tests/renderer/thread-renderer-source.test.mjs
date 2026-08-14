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
const adapterStyles = read("src/integrations/deepseek-harness/oplAdapter.css");
const slotHost = read("src/composition/dshSlotHost.tsx");
const appFrame = read("src/vendor/deepseek-harness/packages/client/ui-layout/src/client/AppFrame.tsx");
const appFrameStyles = read("src/vendor/deepseek-harness/packages/client/ui-layout/src/client/AppFrame.module.css");
const conversationStyles = read("src/vendor/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css");
const settingsRoot = read("src/vendor/deepseek-harness/packages/client/ui-settings-general/src/client/SettingsRoot.tsx");
const nativeWindow = read("scripts/opl-studio-app.swift");
const nativeSmoke = read("scripts/smoke-native-app-live.mjs");
const rail = read("src/workbench/threads/ThreadRail.tsx");
const detail = read("src/workbench/threads/ThreadDetailPopover.tsx");
const lifecycle = read("src/workbench/threads/ThreadLifecycleConfirmationDialog.tsx");
const threadSearch = read("src/workbench/ThreadSearchDialog.tsx");
const composerPalette = read("src/workbench/ComposerCapabilityPalette.tsx");
const settings = read("src/workbench/settingsModel.ts");
const contributionComponents = read("src/composition/contributionComponents.tsx");
const primitiveIndex = read("src/vendor/deepseek-harness/packages/client/ui-primitives/src/index.ts");
const sourceManifest = JSON.parse(read("src/composition/deepseekHarnessSourceManifest.json"));
const candidateEvidence = JSON.parse(read("src/candidateContractEvidence.json"));
const tsconfig = JSON.parse(read("tsconfig.json"));
const typecheckConfig = JSON.parse(read("tsconfig.typecheck.json"));

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
  assert.match(settingsPanel, /data-testid="opl-settings-action-confirmation"/);
  assert.match(lifecycle, /data-testid="opl-thread-lifecycle-confirmation"/);
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

test("native window hosts the live DeepSeek Harness composition root", () => {
  assert.match(slotHost, /import \{ AppFrame \} from "@opl-vendor\/dsh-app-frame"/);
  assert.match(slotHost, /import \{ SidebarRoot \} from "@opl-vendor\/dsh-sidebar-root"/);
  assert.match(slotHost, /import \{ ConversationRoot \} from "@opl-vendor\/dsh-conversation-root"/);
  assert.match(slotHost, /import \{ InputBar \} from "@opl-vendor\/dsh-input-bar"/);
  assert.match(slotHost, /import \{ SettingsRoot \} from "@opl-vendor\/dsh-settings-root"/);
  for (const component of ["AppFrame", "SidebarRoot", "ConversationRoot", "InputBar", "SettingsRoot"]) {
    assert.match(slotHost, new RegExp(`<${component}`));
  }
  assert.match(app, /return renderShell\(\{/);
  assert.match(app, /workspaceRail: studioWorkspaceRail/);
  assert.match(app, /conversationBody: studioConversationBody/);
  assert.match(app, /settings: studioSettings/);
  assert.match(main, /createRoot\(rootElement\)\.render\(renderOplStudioRoot\(\)\)/);
  assert.match(main, /document\.documentElement\.dataset\.oplHost = nativeTransportInstalled \? "native" : "web"/);
  assert.match(nativeWindow, /\.fullSizeContentView/);
  assert.match(nativeWindow, /window\.titleVisibility = \.hidden/);
  assert.match(nativeWindow, /window\.titlebarAppearsTransparent = true/);
  assert.match(nativeWindow, /window\.titlebarSeparatorStyle = \.none/);
  assert.match(nativeWindow, /window\.isMovableByWindowBackground = true/);
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
  assert.match(app, /data-testid="opl-workspace-rail"/);
  assert.match(app, /setThreadSearchOpen\(true\)/);
  assert.match(app, /<ThreadSearchDialog/);
  assert.match(slotHost, /<SidebarRoot/);
  assert.match(slotHost, /name: "sidebar\.workspaces"/);
  assert.match(threadSearch, /!thread\.isTemporaryWorkspace && !project\.projectless/);
  assert.match(app, /<ComposerCapabilityPalette/);
  assert.match(app, /function openComposerPalette\(\)/);
  assert.doesNotMatch(app, /openComposerPalette\("capabilities"\)|composerPaletteMode/);
  assert.match(app, /inputs: pendingSelections\.map\(\(selection\) => selection\.input\)/);
  assert.match(app, /permissions: settings\.agentPermissions/);
  assert.match(app, /setComposerSelections\(pendingSelections\)/);
  assert.match(settings, /agentPermissions: ":danger-full-access"/);
  assert.match(app, /permissions: settings\.agentPermissions/);
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

test("native visual shell uses vendored DeepSeek Harness roots and theme tokens", () => {
  const theme = read("src/vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css");
  for (const marker of ["--dsw-static-deepseek-450", "--dsw-alias-bg-base", "--dsw-specific-sidebar-fill", "--dsw-alias-button-primary-fill"]) {
    assert.ok(theme.includes(marker), `missing DeepSeek Harness visual token: ${marker}`);
  }
  assert.match(adapterStyles, /\.opl-studio-dsh-root \{/);
  assert.match(adapterStyles, /\.opl-dsh-workspace-rail \{/);
  assert.match(adapterStyles, /\.opl-dsh-conversation-header \{/);
  assert.match(adapterStyles, /\.opl-dsh-context-panel \{/);
  assert.match(adapterStyles, /\.opl-dsh-hero-actions \{[^}]*flex-wrap: wrap;/s);
  assert.match(adapterStyles, /letter-spacing: 0/);
  assert.match(styles, /\[data-streamdown="link"\]/);
  assert.match(styles, /\[data-streamdown="inline-code"\]/);
  assert.match(styles, /\[data-streamdown="code-block"\]/);
});

test("DSH controls resolve to the complete pinned upstream primitives tree while OPL identity stays text-only", () => {
  const primitiveAlias = ["src/vendor/deepseek-harness/packages/client/ui-primitives/src/index.ts"];
  assert.deepEqual(tsconfig.compilerOptions.paths["@deepseek-ai/dsh-client-ui-primitives"], primitiveAlias);
  assert.deepEqual(typecheckConfig.compilerOptions.paths["@deepseek-ai/dsh-client-ui-primitives"], primitiveAlias);
  assert.equal(sourceManifest.snapshot.file_count, 207);
  assert.equal(sourceManifest.files.length, 207);
  assert.equal(sourceManifest.snapshot.byte_identical_to_pinned_ref, true);
  assert.ok(sourceManifest.snapshot.package_roots.includes("packages/client/ui-primitives/src"));
  assert.equal(candidateEvidence.reused_oss_module_policy.vendored_file_count, 207);
  assert.equal(candidateEvidence.reused_oss_module_policy.byte_identical_to_pinned_ref, true);
  assert.equal(fs.existsSync(path.join(root, "src/integrations/deepseek-harness/uiPrimitives.tsx")), false);

  for (const [source, primitives] of [
    [app, ["MessageText", "Pill"]],
    [composerPalette, ["Button", "Input"]],
    [contributionComponents, ["Button", "Pill", "StateDot", "Tooltip"]]
  ]) {
    assert.match(source, /from "@deepseek-ai\/dsh-client-ui-primitives"/);
    for (const primitive of primitives) assert.match(primitiveIndex, new RegExp(`export \\{ ${primitive} \\}`));
  }

  assert.match(adapterStyles, /svg\[viewBox="0 0 182 24"\]/);
  assert.match(adapterStyles, /svg\[viewBox="0 0 23\.16 17\.04"\]/);
  assert.match(adapterStyles, /display: none/);
  assert.match(adapterStyles, /content: "OPL Studio"/);
  assert.doesNotMatch(main, /--opl-brand-logo/);
  assert.doesNotMatch(main, /branding\/opl-app-logo\.png/);
});

test("primary canvas hides its scrollbar without disabling scrolling", () => {
  assert.match(conversationStyles, /\.scrollBody \{[^}]*overflow-y: auto;[^}]*overflow-x: hidden;/s);
  assert.match(styles, /\.settings-detail \{[^}]*overflow-y: auto;[^}]*scrollbar-width: none;/s);
  assert.match(adapterStyles, /\.opl-dsh-projects > div \{[^}]*overflow-y: auto;[^}]*scrollbar-gutter: stable;/s);
  assert.match(styles, /\.sidebar-scroll > \*,[\s\S]*\.thread-directory-row \{[^}]*min-width: 0;[^}]*max-width: 100%;/s);
  assert.match(styles, /\.history-list li \.thread-directory-open \{[^}]*max-width: 100%;[^}]*overflow: hidden;/s);
  assert.match(styles, /\.history-list li \.thread-directory-open \.thread-directory-copy \{[^}]*max-width: 100%;[^}]*overflow: hidden;/s);
  assert.match(styles, /\.thread-directory-copy strong \{[^}]*max-width: 100%;[^}]*display: block;/s);
  assert.match(adapterStyles, /\.opl-dsh-context-panel \.context-scroll \{[^}]*overflow-y: auto;/s);
});

test("DSH AppFrame owns bounded sidebar/details resize and responsive collapse", () => {
  assert.match(appFrame, /computeColumns\(viewport, sidebarPreference/);
  assert.match(appFrame, /const narrow = viewport < SIDEBAR_AUTO_COLLAPSE/);
  assert.match(appFrame, /actions\.setSidebar\(sidebarBase\.current \+ dx\)/);
  assert.match(appFrame, /actions\.setDetails\(detailsBase\.current - dx\)/);
  assert.match(appFrame, /<DragHandle side="sidebar"/);
  assert.match(appFrame, /<DragHandle side="details"/);
  assert.match(appFrameStyles, /grid-template-rows: 100%/);
  assert.match(appFrameStyles, /transition: grid-template-columns/);
  assert.doesNotMatch(app, /data-testid="opl-sidebar-resizer"/);
});

test("DSH Settings content consumes the canonical Gateway account read model", () => {
  assert.match(model, /app_settings_read_model/);
  assert.match(model, /opl_gateway_account_read_model\.v1/);
  assert.match(model, /gatewayAccountRecord\?\.display_name/);
  assert.match(model, /gatewayAccountProjection\.connection_mode === "account"/);
  assert.match(model, /gatewayConnectionMode/);
  assert.match(app, /<SettingsPanel/);
  assert.match(app, /settings: studioSettings/);
  assert.match(slotHost, /<SettingsRoot/);
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
  assert.match(settingsRoot, /renderSlot\('settings\.section'/);
  assert.match(slotHost, /register\(\{ name: "settings\.section", id: "opl-studio-settings"/);
  assert.match(settingsPanel, /onDestinationChange/);
  assert.doesNotMatch(settingsPanel, /useState<SettingsDestinationId>/);
  assert.doesNotMatch(styles, /grid-template-columns: 220px minmax\(0, 1fr\)/);
  assert.match(styles, /\.settings-mobile-navigation/);
});

test("desktop uses DSH columns and mobile keeps full-height thread dialogs", () => {
  assert.match(appFrame, /gridTemplateColumns: `\$\{cols\.sidebar\}px minmax\(0, 1fr\) \$\{cols\.details\}px`/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(rail, /project\.threads\.slice\(0, 2\)/);
  assert.match(app, /conversation\.scrollTop = conversation\.scrollHeight/);
  assert.match(slotHost, /className="opl-dsh-rail-browser"/);
  assert.match(styles, /\.thread-detail-popover,\s*\.thread-confirmation-dialog \{\s*inset: 0;/s);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /border-radius: 0/);
  assert.match(styles, /\.history-list li \.thread-directory-open \.thread-directory-copy/);
  assert.match(styles, /\.message\.system\.subagent \.message-frame/);
  assert.doesNotMatch(styles, /\.coordination-/);
  assert.match(styles, /\.composer-permissions select \{[^}]*max-width: 118px;/s);
});
