import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CodexAppServerTransport } from "../../scripts/webui-host/app-server-transport.mjs";
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
const desktopMain = read("desktop/main.mjs");
const desktopPreload = read("desktop/preload.cjs");
const hostCore = read("scripts/webui-host/host-core.mjs");
const appServerTransport = read("scripts/webui-host/app-server-transport.mjs");
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
    assert.match(desktopPreload, new RegExp(`${method}:`));
    assert.match(hostCore, new RegExp(`case "${method}"`));
    assert.match(bridge, new RegExp(`${method}\\(`));
  }
  for (const route of ["/api/threads/list", "/api/threads/read", "/api/threads/resume", "/api/threads/fork", "/api/threads/archive", "/api/threads/unarchive"]) {
    assert.ok(webTransport.includes(route), `missing WebUI thread route ${route}`);
  }

  const runtimeSources = `${app}\n${main}\n${bridge}\n${webTransport}\n${desktopMain}\n${desktopPreload}\n${hostCore}`;
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

test("starting a new task clears the previous thread identity and errors", () => {
  const startNewChat = app.match(/function startNewChat\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(startNewChat, /setCodexThreadId\(undefined\)/);
  assert.match(startNewChat, /selectedThreadId: undefined/);
  assert.match(startNewChat, /setThreadActionError\(""\)/);
});

test("standard Agent selection binds only to a newly created Codex thread", async () => {
  const requests = [];
  let threadSequence = 0;
  let turnSequence = 0;
  const transport = new CodexAppServerTransport({ cwd: "/tmp/opl-studio-agent-fixture" });
  transport.request = async (method, params) => {
    requests.push({ method, params });
    if (method === "thread/start") return { thread: { id: `thread-${++threadSequence}` } };
    if (method === "turn/start") return { turn: { id: `turn-${++turnSequence}` } };
    throw new Error(`unexpected request: ${method}`);
  };
  transport.waitForTurn = async (turnId) => ({
    finalMessage: `completed ${turnId}`,
    events: [],
    notification: { turn: { id: turnId, status: "completed" } }
  });

  const selection = {
    package_id: "mas",
    shortcut_id: "medical-autoscience",
    codex_visible_entry: "med-autoscience:med-autoscience",
    required_skill_ids: ["medical-research-lit", "medical-statistical-review"]
  };
  const first = await transport.sendMessage({
    prompt: "Start the study",
    inputs: [],
    agentSelection: selection
  });
  const firstThreadStart = requests.find((request) => request.method === "thread/start");
  const firstTurnStart = requests.find((request) => request.method === "turn/start");
  assert.equal(first.threadId, "thread-1");
  assert.match(firstThreadStart.params.developerInstructions, /application-owned routing snapshot/);
  assert.ok(firstThreadStart.params.developerInstructions.includes(JSON.stringify(selection)));
  assert.deepEqual(firstTurnStart.params.additionalContext, {
    "opl.standard_agent_selection": {
      kind: "application",
      value: JSON.stringify(selection)
    }
  });

  await assert.rejects(
    transport.sendMessage({
      prompt: "Rebind the existing conversation",
      inputs: [],
      threadId: first.threadId,
      agentSelection: selection
    }),
    (error) => error?.code === "invalid_request" && /cannot be rebound/.test(error.message)
  );

  const second = await transport.sendMessage({ prompt: "Start another task", inputs: [] });
  assert.equal(second.threadId, "thread-2");
  assert.notEqual(second.threadId, first.threadId);
  assert.equal(requests.filter((request) => request.method === "thread/start").length, 2);
});

test("turn steering preserves the active thread and expected turn identity", async () => {
  const requests = [];
  let acknowledgedTurnId = "turn-active";
  const transport = new CodexAppServerTransport({ cwd: "/tmp/opl-studio-steer-fixture" });
  transport.request = async (method, params) => {
    requests.push({ method, params });
    assert.equal(method, "turn/steer");
    return { turnId: acknowledgedTurnId };
  };

  const accepted = await transport.steerMessage({
    threadId: "thread-active",
    expectedTurnId: "turn-active",
    prompt: "Prioritize the new evidence",
    inputs: []
  });
  assert.deepEqual(requests[0], {
    method: "turn/steer",
    params: {
      threadId: "thread-active",
      expectedTurnId: "turn-active",
      input: [{ type: "text", text: "Prioritize the new evidence", text_elements: [] }]
    }
  });
  assert.deepEqual(accepted, {
    executor: "codex_app_server",
    transport: "stdio_json_rpc",
    threadId: "thread-active",
    expectedTurnId: "turn-active",
    turnId: "turn-active",
    accepted: true
  });

  acknowledgedTurnId = "turn-other";
  await assert.rejects(
    transport.steerMessage({
      threadId: "thread-active",
      expectedTurnId: "turn-active",
      prompt: "Do not accept a stale acknowledgement",
      inputs: []
    }),
    (error) => error?.code === "invalid_app_server_response"
      && error?.details?.receivedTurnId === "turn-other"
  );
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

test("Electron desktop hosts the live DeepSeek Harness composition root", () => {
  assert.match(slotHost, /import \{ AppFrame \} from "@opl-vendor\/dsh-app-frame"/);
  assert.match(slotHost, /import \{ SidebarRoot \} from "@opl-vendor\/dsh-sidebar-root"/);
  assert.match(slotHost, /import \{ ConversationRoot \} from "@opl-vendor\/dsh-conversation-root"/);
  assert.match(slotHost, /import \{ InputBar \} from "@opl-vendor\/dsh-input-bar"/);
  assert.match(slotHost, /import \{ QueueDock \} from "@opl-vendor\/dsh-queue-dock"/);
  assert.match(slotHost, /import \{ SettingsRoot \} from "@opl-vendor\/dsh-settings-root"/);
  for (const component of ["AppFrame", "SidebarRoot", "ConversationRoot", "InputBar", "QueueDock", "SettingsRoot"]) {
    assert.match(slotHost, new RegExp(`<${component}`));
  }
  assert.match(app, /return renderShell\(\{/);
  assert.match(app, /workspaceRail: studioWorkspaceRail/);
  assert.match(app, /conversationBody: studioConversationBody/);
  assert.match(app, /renderSettings: renderStudioSettings/);
  assert.match(main, /createRoot\(rootElement\)\.render\(renderOplStudioRoot\(\)\)/);
  assert.match(main, /document\.documentElement\.dataset\.oplHost = desktopTransportInstalled \? "desktop" : "web"/);
  assert.match(desktopMain, /new BrowserWindow\(/);
  assert.match(desktopMain, /titleBarStyle: "hiddenInset"/);
  assert.match(desktopMain, /contextIsolation: true/);
  assert.match(desktopMain, /nodeIntegration: false/);
  assert.match(desktopMain, /sandbox: true/);
  assert.match(desktopMain, /ipcMain\.handle\("opl:invoke"/);
  assert.match(desktopMain, /trustedRendererUrl\(event\.senderFrame\.url\)/);
  assert.match(desktopPreload, /contextBridge\.exposeInMainWorld\("oplStudio"/);
  assert.match(desktopPreload, /ipcRenderer\.invoke\("opl:invoke"/);
});

test("Web host exposes the product brand while keeping Studio as an internal client id", () => {
  const webHostTransport = read("scripts/webui-host/app-server-transport.mjs");
  assert.match(webHostTransport, /name: "opl-studio-webui"/);
  assert.match(webHostTransport, /title: "One Person Lab"/);
  assert.doesNotMatch(webHostTransport, /title: "OPL Studio WebUI"/);
});

test("App update restart follows the carrier result instead of a host-name special case", () => {
  assert.match(app, /nativeAppUpdate\?\.supported === true && nativeAppUpdate\.restartRequired === true/);
  assert.doesNotMatch(app, /nativeAppUpdate\?\.host === "native"/);
});

test("Framework managed updates reuse the projected App action bus", () => {
  const settingsActionFlow = app.match(/async function runSettingsAction\([\s\S]*?\n  async function runSettingsHostAction/)?.[0] ?? "";
  assert.match(app, /readProjectedManagedUpdateActions\(state\)/);
  assert.match(app, /setProjectedManagedUpdateActions/);
  assert.match(app, /managedUpdateActions: \[[\s\S]*\.\.\.projectedManagedUpdateHostActions/);
  assert.match(app, /runSettingsAction\(\{[\s\S]*actionId: projectedAction\.actionId/);
  assert.match(settingsActionFlow, /dryRun: true/);
  assert.match(settingsActionFlow, /payload: \{ \.\.\.request\.payload, confirmed: true \}[\s\S]*dryRun: false/);
  assert.match(settingsActionFlow, /payload: \{ \.\.\.confirmation\.request\.payload, confirmed: true \}[\s\S]*dryRun: false/);
  assert.match(settingsActionFlow, /captureManagedUpdateReceipt\(receipt\)/);
  assert.match(settingsActionFlow, /await loadState\(settings\.runtimeProfile\)/);
  assert.doesNotMatch(app, /Framework 尚未投影此更新操作|Framework has not projected this update operation/);
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
  assert.match(app, /\.\.\.pendingSelections\.map\(\(selection\) => selection\.input\)/);
  assert.match(app, /\.\.\.\(codexThreadId \? \[\] : selectedAgentInputs\(\)\)/);
  assert.match(app, /permissions: settings\.agentPermissions/);
  assert.match(app, /setComposerSelections\(pendingSelections\)/);
  assert.match(settings, /agentPermissions: ":danger-full-access"/);
  assert.match(app, /permissions: settings\.agentPermissions/);
  for (const method of ["readCodexCapabilities", "readCodexPermissionProfiles", "pickFiles", "pickDirectory", "setLogDirectory"]) {
    assert.match(desktopPreload, new RegExp(`${method}:`));
    assert.match(hostCore, new RegExp(`case "${method}"`));
    assert.match(bridge, new RegExp(`${method}\\(`));
  }
  assert.match(appServerTransport, /this\.request\("permissionProfile\/list"/);
  assert.match(appServerTransport, /DEFAULT_PERMISSION_PROFILE = ":danger-full-access"/);
  assert.match(desktopMain, /dialog\.showOpenDialog/);
  assert.match(composerPalette, /catalog\.skills/);
  assert.match(composerPalette, /seenSkillNames/);
  assert.match(composerPalette, /if \(!open\) \{\s*setQuery\(""\)/s);
  assert.match(composerPalette, /catalog\.plugins/);
  assert.match(composerPalette, /catalog\.apps/);
});

test("DSH QueueDock owns queued follow-ups and steers the exact active Codex turn", () => {
  assert.match(slotHost, /function QueueDockSlot\(\)/);
  assert.match(slotHost, /updateQueue=\{studio\.updateQueue\}/);
  assert.match(slotHost, /name: "conversation\.input\.dock", id: "queue", order: 20/);
  assert.match(app, /await bridge\.steerTurn\(\{\s*threadId: active\.threadId,\s*expectedTurnId: active\.turnId,/s);
  assert.doesNotMatch(`${app}\n${slotHost}`, /host_queue/);
});

test("desktop visual shell uses vendored DeepSeek Harness roots and theme tokens", () => {
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
  assert.match(adapterStyles, /content: "One Person Lab"/);
  assert.match(slotHost, /"hero.preview": \["One Person Lab", "One Person Lab"\]/);
  assert.match(slotHost, /function SettingsHeaderSlot\(\) \{ return <>One Person Lab<\/>; \}/);
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
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.composer-palette \{[^}]*position: fixed;[^}]*inset: 54px 0 0 56px;/s);
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
  assert.match(app, /renderSettings: renderStudioSettings/);
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
  assert.match(model, /readManagedUpdateProjection/);
  assert.match(model, /mergeManagedUpdateProjections/);
  assert.match(app, /captureManagedUpdateReceipt\(receipt\)/);
  assert.match(app, /managedUpdate=\{managedUpdate\}/);
  assert.match(app, /setCarrierDiagnostics\(state\.carrierDiagnostics\)/);
  assert.match(app, /carrierDiagnostics=\{carrierDiagnostics\}/);
  assert.match(app, /await bridge\.setLogDirectory\(\{ path: selected\.path \}\)/);
  assert.doesNotMatch(settingsPanel, /createBrowserBridge|\.readState\(/);
  assert.match(settingsPanel, /carrierDiagnostics\.application\?\.systemInfo\.logDir/);
  assert.match(settingsPanel, /carrierDiagnostics\.setLogDirectorySupported/);
  assert.match(webTransport, /setLogDirectory: \(\) => Promise\.resolve/);
  assert.doesNotMatch(webTransport, /\/api\/.*log.*director/i);
  for (const componentId of ["opl_app", "opl_base", "opl_packages"]) {
    assert.match(settingsPanel, new RegExp(`component\\("${componentId}"\\)`));
  }
  assert.match(settingsPanel, /settings_apply_opl_packages/);
  assert.match(settingsPanel, /shortcut_id: shortcut\.shortcutId/);
  assert.match(settingsPanel, /visible,/);
  assert.match(settingsPanel, /sort_order: sortOrder/);
  assert.match(settingsRoot, /renderSlot\('settings\.section'/);
  assert.match(slotHost, /settingsDestinations\("en"\)\.entries\(\)/);
  assert.match(slotHost, /id: settingsSectionId\(destination\.id\)/);
  assert.match(slotHost, /renderSettings\(destination\)/);
  assert.doesNotMatch(settingsPanel, /settings-mobile-navigation/);
  assert.doesNotMatch(settingsPanel, /useState<SettingsDestinationId>/);
  assert.doesNotMatch(styles, /grid-template-columns: 220px minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /\.settings-mobile-navigation/);
});

test("Settings directly reuses DSH appearance controls and applies the selected palette", () => {
  assert.match(settingsPanel, /from "\.\.\/vendor\/deepseek-harness\/packages\/client\/ui-theme\/src\/client\/AppearanceRow"/);
  assert.match(settingsPanel, /<AppearanceRow/);
  assert.match(app, /document\.body\.toggleAttribute\("data-ds-dark-theme", dark\)/);
  assert.match(app, /matchMedia\?\.\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(settings, /theme: "system" \| "light" \| "dark"/);
  assert.match(styles, /--opl-text: var\(--dsw-alias-label-primary\)/);
  assert.match(styles, /--opl-canvas: var\(--dsw-alias-bg-base\)/);
});

test("composer separates OPL standard agents from Skills, connections, and other modules", () => {
  assert.match(app, /standardAgents=\{codexThreadId \? \[\] : model\.packageLifecycle\.filter\(\(item\) => \(\s*item\.packageRole === "standard_agent"\s*&& item\.official\s*&& item\.readiness\.selectable\s*&& item\.homeShortcuts\.some\(\(shortcut\) => Boolean\(shortcut\.route\)\)\s*\)\)\}/s);
  assert.match(app, /agentSelection: codexThreadId \? undefined : selectedAgentSnapshot\(\)/);
  assert.match(composerPalette, /data-testid="opl-standard-agents"/);
  assert.match(composerPalette, /OPL 标准智能体/);
  assert.match(composerPalette, /其他模块/);
});

test("desktop uses DSH columns and mobile keeps full-height thread dialogs", () => {
  assert.match(appFrame, /gridTemplateColumns: `\$\{cols\.sidebar\}px minmax\(0, 1fr\) \$\{cols\.details\}px`/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\[role="dialog"\]\[aria-labelledby\]:has\(> nav\) > nav > div:last-child/);
  assert.match(styles, /flex-direction: row/);
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
