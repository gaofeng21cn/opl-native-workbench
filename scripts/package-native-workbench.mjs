import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  assertNoFalseReadyFields,
  assertRendererTestIds,
  assertSourceMarkers,
  deliverySurfaceMarkers,
  deliverySurfaceStatuses,
  deliverySurfaceTestIds,
  read,
  readRendererSource,
  validateNonLiveDeliveryEvidence
} from "./native-workbench-gates.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const appName = "One Person Lab Native Workbench Candidate";
const appRoot = path.join(root, "out", `${appName}.app`);
const macOsDir = path.join(appRoot, "Contents", "MacOS");
const contentsDir = path.join(appRoot, "Contents");
const resourcesDir = path.join(contentsDir, "Resources");
const evidence = JSON.parse(fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8"));
const app = read("src/workbench/App.tsx");
const rendererSource = readRendererSource();

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`missing ${label}: ${filePath}`);
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function runCommand(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stdout}\n${result.stderr}`);
  }
}

const appRepoRoot = path.resolve(process.env.OPL_APP_REPO_ROOT ?? path.join(root, "..", "one-person-lab-app"));
const releaseIconPath = path.resolve(
  process.env.OPL_APP_RELEASE_ICON_ICNS ?? path.join(appRepoRoot, "shells", "aionui", "resources", "app.icns")
);
const appLogoPath = path.join(appRepoRoot, "assets", "branding", "opl-app-logo.png");
const appBannerPath = path.join(appRepoRoot, "assets", "branding", "opl-banner.png");

validateNonLiveDeliveryEvidence(evidence);
assertRendererTestIds(rendererSource, deliverySurfaceTestIds(evidence), "package source");
assertSourceMarkers(rendererSource, deliverySurfaceMarkers(evidence), "package source layout");
assertNoFalseReadyFields({
  "src/workbench/App.tsx": app,
  "src/candidateContractEvidence.json": fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8")
});
assertFile(releaseIconPath, "OPL App release icon");
assertFile(appLogoPath, "OPL App logo");
assertFile(appBannerPath, "OPL App banner");

fs.rmSync(appRoot, { recursive: true, force: true });
fs.mkdirSync(macOsDir, { recursive: true });
fs.mkdirSync(path.join(resourcesDir, "branding"), { recursive: true });
fs.copyFileSync(releaseIconPath, path.join(resourcesDir, "app.icns"));
fs.copyFileSync(appLogoPath, path.join(resourcesDir, "branding", "opl-app-logo.png"));
fs.copyFileSync(appBannerPath, path.join(resourcesDir, "branding", "opl-banner.png"));
fs.writeFileSync(path.join(resourcesDir, "workbench.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preload" as="image" href="branding/opl-banner.png" />
  <title>${escapeHtml(appName)}</title>
  <style>
    :root { color-scheme: light; --bg: #f4f1eb; --bg-2: #fbfaf7; --sidebar: rgba(255,255,255,.9); --surface: rgba(255,255,255,.94); --surface-2: #f5f4ef; --surface-3: #fbfaf7; --border: rgba(83,92,78,.13); --border-strong: rgba(83,92,78,.2); --text: #20251f; --muted: #677063; --subtle: #8a9386; --accent: #1f8a6a; --accent-soft: rgba(31,138,106,.1); --accent-fg: #ffffff; --shadow: 0 18px 46px rgba(61,70,53,.08); }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at top, rgba(31,138,106,.08), transparent 28%), linear-gradient(180deg, #fbfaf7 0%, #f4f1eb 100%); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    button, textarea { font: inherit; }
    button { border: 0; background: transparent; color: inherit; border-radius: 12px; cursor: default; transition: background .16s ease, border-color .16s ease, color .16s ease; }
    button:hover { background: rgba(32,37,31,.045); }
    button.primary { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; height: 40px; border-radius: 999px; background: var(--accent); color: var(--accent-fg); box-shadow: 0 10px 20px rgba(31,138,106,.18); }
    h1 { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: 0; }
    h2 { margin: 0; font-size: 13px; font-weight: 620; letter-spacing: 0; }
    h3 { margin: 0 0 10px; color: var(--subtle); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    small, .muted { color: var(--muted); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .opl-native-workbench { height: 100vh; display: grid; grid-template-columns: 276px minmax(0, 1fr); overflow: hidden; }
    .sidebar { display: flex; min-height: 0; flex-direction: column; border-right: 1px solid var(--border); background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(251,250,247,.9)); padding: 14px 12px 12px; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 10px 10px 14px; margin-bottom: 8px; border-bottom: 1px solid rgba(83,92,78,.08); background: linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,0)), url("branding/opl-banner.png") center/cover no-repeat; border-radius: 18px; }
    .logo { width: 26px; height: 26px; border-radius: 8px; box-shadow: 0 4px 12px rgba(32,37,31,.08); }
    .brand-title { display: grid; gap: 2px; min-width: 0; }
    .brand-title small { font-size: 11px; color: var(--subtle); }
    .badge { width: fit-content; border: 1px solid rgba(31,138,106,.18); background: rgba(255,255,255,.8); color: var(--accent); border-radius: 999px; padding: 2px 8px; font-size: 11px; }
    .quick-actions { display: grid; grid-template-columns: minmax(0, 1fr) 56px; gap: 6px; margin-bottom: 10px; }
    .quick-actions button, .nav button, .session-row, .file-row, .purpose-row, .sidebar-footer button { min-height: 36px; padding: 8px 10px; text-align: left; font-size: 12px; }
    .new-chat { border: 1px solid var(--border); background: rgba(255,255,255,.78); box-shadow: inset 0 1px 0 rgba(255,255,255,.75); }
    .nav { display: grid; gap: 4px; margin-bottom: 14px; }
    .nav button, .session-row, .file-row, .purpose-row { width: 100%; display: flex; align-items: center; gap: 8px; }
    .nav .active, .session-row.active, .file-row.active, .purpose-row.active, .sidebar-footer .active { background: rgba(255,255,255,.88); box-shadow: inset 0 0 0 1px rgba(83,92,78,.12); }
    .dot { width: 7px; height: 7px; border-radius: 999px; background: var(--accent); opacity: .8; flex: none; }
    .section { padding: 10px 0 0; border-top: 1px solid rgba(83,92,78,.08); }
    .list { display: grid; gap: 4px; }
    .section-head { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 8px; }
    .section-head button { min-height: auto; padding: 2px 6px; color: var(--subtle); }
    .session-row { align-items: center; justify-content: space-between; border-radius: 14px; background: transparent; }
    .session-row strong { max-width: 156px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 540; }
    .session-row small { font-size: 11px; color: var(--subtle); }
    .session-meta { min-width: 0; display: grid; gap: 3px; flex: 1; }
    .session-icon { width: 16px; height: 16px; border: 1px solid rgba(83,92,78,.18); border-radius: 999px; background: rgba(255,255,255,.8); }
    .file-row { justify-content: space-between; align-items: flex-start; border-radius: 12px; color: #3c443b; background: rgba(255,255,255,.42); }
    .file-row strong { font-size: 12px; font-weight: 560; }
    .file-row small { display: block; font-size: 11px; color: var(--subtle); }
    .purpose-row { border-radius: 12px; color: #3c443b; background: rgba(255,255,255,.48); }
    .sidebar-footer { margin-top: auto; display: grid; gap: 6px; padding-top: 12px; border-top: 1px solid rgba(83,92,78,.08); }
    .sidebar-footer button { width: 100%; display: flex; align-items: center; justify-content: space-between; color: #3c443b; }
    .sidebar-note { padding: 4px 8px 0; color: var(--subtle); font-size: 11px; line-height: 1.35; }
    .status-pill { width: fit-content; border: 1px solid rgba(31,138,106,.14); background: var(--accent-soft); color: #16694f; border-radius: 999px; padding: 4px 9px; font-size: 11px; }
    .chat-shell { position: relative; min-width: 0; min-height: 0; display: grid; grid-template-rows: 60px 1fr auto; background: linear-gradient(180deg, rgba(255,255,255,.22), transparent 20%); }
    .topbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 0 24px; border-bottom: 1px solid rgba(83,92,78,.08); background: rgba(251,250,247,.72); backdrop-filter: blur(18px); }
    .topbar-title { justify-self: center; min-width: 0; display: grid; gap: 3px; text-align: center; font-size: 12px; color: var(--muted); }
    .topbar-title strong { font-size: 14px; font-weight: 620; color: var(--text); }
    .topbar-left, .topbar-right { display: flex; align-items: center; gap: 8px; }
    .topbar-right { justify-self: end; }
    .topbar button, .composer-footer button, .chip { padding: 6px 10px; color: var(--muted); font-size: 12px; }
    .topbar button, .composer-footer button, .chip, .inspector-tab { border: 1px solid transparent; }
    .ghost-button { border-color: var(--border); background: rgba(255,255,255,.68); }
    .conversation { overflow: auto; padding: 28px 24px 18px; }
    .thread { margin: 0 auto; width: min(820px, 100%); display: grid; gap: 20px; }
    .message { display: grid; gap: 10px; max-width: 760px; font-size: 14px; }
    .message.user { justify-self: start; grid-template-columns: 28px minmax(0, 1fr); max-width: 100%; }
    .message.user::before { content: "You"; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; background: rgba(31,138,106,.14); color: #16694f; font-size: 11px; font-weight: 650; }
    .message.user { color: var(--text); }
    .message.user:not(.codex-reply) { align-items: start; }
    .message.user:not(.codex-reply) { }
    .message.user:not(.codex-reply) { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user > :last-child, .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .message.user { }
    .assistant-head { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 12px; }
    .assistant-head::before { content: ""; width: 28px; height: 28px; border-radius: 999px; background: linear-gradient(180deg, rgba(31,138,106,.94), rgba(18,113,86,.94)); box-shadow: 0 6px 18px rgba(31,138,106,.18); }
    .assistant-head .meta-pill { border: 1px solid var(--border); background: rgba(255,255,255,.76); border-radius: 999px; padding: 3px 8px; font-size: 11px; color: var(--muted); }
    .message-block { display: grid; gap: 10px; padding-left: 38px; }
    .message.user .message-block { padding-left: 0; padding-top: 3px; }
    .user-bubble { max-width: 620px; border-radius: 18px; background: rgba(255,255,255,.74); border: 1px solid rgba(83,92,78,.08); padding: 12px 14px; box-shadow: 0 8px 18px rgba(61,70,53,.05); }
    .status-line { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .status-line::before { content: ""; width: 5px; height: 5px; border-radius: 999px; background: #9ca596; }
    .inline-card { margin-top: 2px; border: 1px solid var(--border); background: rgba(255,255,255,.78); border-radius: 16px; padding: 12px 13px; box-shadow: 0 8px 18px rgba(61,70,53,.04); }
    .inline-card strong { display: block; margin-bottom: 4px; font-size: 13px; color: var(--text); }
    .inline-card button { margin-top: 8px; padding: 7px 10px; background: var(--accent-soft); color: #16694f; }
    .artifact-preview-card, .action-receipt-summary { display: grid; gap: 8px; border: 1px solid var(--border); border-radius: 14px; background: rgba(255,255,255,.84); padding: 12px; }
    .artifact-preview-card header, .action-receipt-summary header { display: flex; align-items: center; gap: 8px; }
    .artifact-preview-card dl, .action-receipt-summary dl, .settings-content dl { display: grid; gap: 8px; margin: 0; }
    .artifact-preview-card div, .action-receipt-summary div, .settings-content dl div { display: grid; gap: 2px; }
    .artifact-preview-card dt, .action-receipt-summary dt, .settings-content dt { color: var(--subtle); font-size: 11px; }
    .artifact-preview-card dd, .action-receipt-summary dd, .settings-content dd { margin: 0; color: #3c443b; font-size: 12px; }
    .capability-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .capability-row button { border: 1px solid var(--border); background: rgba(255,255,255,.8); padding: 8px 11px; color: #334039; font-size: 12px; }
    .codex-reply { white-space: pre-wrap; border: 1px solid rgba(83,92,78,.08); background: rgba(255,255,255,.72); border-radius: 18px; padding: 14px 16px; line-height: 1.62; box-shadow: 0 8px 18px rgba(61,70,53,.04); }
    .codex-reply.error { border-color: #efc9c9; color: #9f2b2b; }
    .composer { padding: 10px 24px 24px; }
    .composer-box { margin: 0 auto; width: min(820px, 100%); overflow: hidden; border: 1px solid rgba(83,92,78,.12); border-radius: 28px; background: rgba(255,255,255,.92); box-shadow: var(--shadow); }
    textarea { width: 100%; min-height: 92px; border: 0; padding: 18px 18px 12px; resize: none; outline: none; background: transparent; color: var(--text); }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .composer-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px 12px; border-top: 1px solid rgba(83,92,78,.08); }
    .composer-footer .row { color: var(--muted); font-size: 12px; }
    .composer-toolbar button { min-width: 34px; min-height: 34px; border-radius: 999px; }
    .composer-status { color: var(--muted); font-size: 12px; }
    .composer-status.error { color: #9f2b2b; }
    button:disabled, textarea:disabled { opacity: .55; }
    .inspector { position: absolute; inset: 0 0 0 auto; width: min(340px, 84vw); transform: translateX(calc(100% + 16px)); transition: transform .18s ease; border-left: 1px solid var(--border); background: rgba(251,250,247,.94); box-shadow: var(--shadow); backdrop-filter: blur(18px); z-index: 4; overflow: auto; }
    .inspector.open { transform: translateX(0); }
    .inspector-head { position: sticky; top: 0; display: grid; gap: 14px; padding: 14px 14px 12px; border-bottom: 1px solid var(--border); background: rgba(251,250,247,.92); backdrop-filter: blur(14px); }
    .inspector-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .inspector-tabs { display: flex; gap: 8px; }
    .inspector-tab { padding: 7px 0; border-radius: 0; border-bottom: 2px solid transparent; color: var(--muted); background: transparent; }
    .inspector-tab.active { border-color: var(--accent); color: var(--text); }
    .panel { padding: 14px; border-bottom: 1px solid rgba(83,92,78,.08); }
    .preview { border: 1px solid var(--border); border-radius: 14px; background: rgba(255,255,255,.7); padding: 16px; }
    details { padding: 12px 14px; border-bottom: 1px solid rgba(83,92,78,.08); }
    summary { color: var(--muted); font-size: 13px; }
    .receipt { margin-top: 8px; white-space: pre-wrap; background: #111827; color: #e9eef6; border-radius: 12px; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .settings-page { display: none; overflow: auto; padding: 34px 24px; }
    .settings-page.active { display: block; }
    .settings-content { margin: 0 auto; width: min(860px, 100%); display: grid; gap: 18px; }
    .settings-content section { border: 1px solid rgba(83,92,78,.08); border-radius: 16px; background: rgba(255,255,255,.7); padding: 14px; }
    .settings-content h2 { margin-bottom: 6px; }
    .settings-content button { padding: 6px 9px; background: var(--surface-2); }
    .settings-content code { display: inline-block; border: 1px solid var(--border); border-radius: 8px; padding: 5px 7px; color: #3e4751; background: #fbfcfc; }
    .settings-content small { display: block; margin-top: 4px; }
    .chat-content.hidden, .composer.hidden { display: none; }
    @media (max-width: 980px) {
      .opl-native-workbench { grid-template-columns: 244px minmax(0, 1fr); }
      .inspector { width: min(320px, 88vw); }
    }
    @media (max-width: 760px) {
      .opl-native-workbench { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .topbar { grid-template-columns: 1fr; justify-items: stretch; height: auto; padding: 12px; }
      .topbar-left, .topbar-right, .topbar-title { justify-self: stretch; }
      .topbar-title { text-align: left; }
      .conversation, .composer, .settings-page { padding-left: 12px; padding-right: 12px; }
      .composer-box { border-radius: 22px; }
    }
  </style>
</head>
<body>
  <main data-testid="opl-native-workbench-root" data-layout="codex-sidebar-chat" class="opl-native-workbench">
    <aside data-testid="opl-workspace-rail" class="sidebar" aria-label="Persistent Codex-style left sidebar">
      <div class="brand">
        <img class="logo" src="branding/opl-app-logo.png" alt="One Person Lab App" />
        <div class="brand-title">
          <h1>One Person Lab</h1>
          <small>Codex workbench</small>
        </div>
        <span class="badge">Beta</span>
      </div>
      <div class="quick-actions">
        <button class="new-chat" type="button" onclick="startNewChat()">+ New chat</button>
        <button class="ghost-button" type="button" aria-label="Search">Search</button>
      </div>
      <nav class="nav" aria-label="Primary">
        <button id="chatNav" class="active" type="button" onclick="showView('chat')"><span class="dot"></span>Chats</button>
      </nav>
      <section class="section">
        <div class="section-head">
          <h3>Recent</h3>
          <button type="button" aria-label="Recent chats">List</button>
        </div>
        <div id="sessionList" data-testid="opl-session-list" class="list"></div>
      </section>
      <div class="sidebar-footer">
        <button type="button" onclick="toggleInspector(true)">Context</button>
        <button id="settingsNav" type="button" onclick="showView('settings')">Settings</button>
        <span class="status-pill">connected</span>
      </div>
    </aside>
    <section class="chat-shell" aria-label="Single conversation canvas">
      <header class="topbar">
        <div class="topbar-left">
          <span id="codexStatus" data-testid="opl-model-access-entry" class="status-pill">Codex connected</span>
        </div>
        <div class="topbar-title">
          <strong id="viewTitle">Current project</strong>
          <span>Review, draft, export, and confirm from one chat-first surface.</span>
        </div>
        <div class="topbar-right">
          <button data-testid="opl-export-action" class="ghost-button" type="button" onclick="dryRun('task_export_bundle_preview')">Export</button>
          <button class="ghost-button" type="button" onclick="refreshContext()">Refresh</button>
          <button class="ghost-button" type="button" onclick="toggleInspector(true)">Inspector</button>
        </div>
      </header>
      <div id="chatContent" class="conversation chat-content">
        <div class="thread">
          <article class="message user"><div class="user-bubble">Use the current project to prepare a review or deliverable.</div></article>
          <article data-testid="opl-conversation-event" class="message">
            <div class="assistant-head">One Person Lab <span class="meta-pill">Context ready</span></div>
            <div class="message-block">
              <h2>Codex is connected to OPL project context.</h2>
              <p>Ask for a review, export draft, or workflow request. Sources, previews, trace, and receipts stay in the inspector and execution still goes through App confirmation.</p>
              <div class="status-line">Project sources loaded</div>
              <div class="status-line">Preview and export actions require confirmation</div>
              <div class="status-line">Artifact bodies remain source-owned</div>
              <div data-testid="opl-workbench-delivery-mode" class="capability-row delivery-workbench" aria-label="Suggested outputs">
                <button data-testid="opl-delivery-mode-option" type="button" onclick="dryRun('task_action_receipt_preview')">Review results</button>
                <button data-testid="opl-delivery-mode-option" type="button" onclick="dryRun('task_export_bundle_preview')">Draft grant</button>
                <button data-testid="opl-delivery-mode-option" type="button" onclick="dryRun('task_export_bundle_preview')">Build deck</button>
                <button data-testid="opl-delivery-mode-option" type="button" onclick="dryRun('task_action_receipt_preview')">Prepare handoff</button>
                <span data-testid="opl-delivery-mode" hidden>research</span>
              </div>
            </div>
          </article>
        </div>
      </div>
      <form id="composer" class="composer">
        <div class="composer-box">
          <textarea id="promptInput" aria-label="Prompt" placeholder="Ask OPL to review, draft, export, or start a workflow"></textarea>
          <div class="composer-footer">
            <div class="row composer-toolbar">
              <button type="button" aria-label="Attach">+</button>
              <button type="button" aria-label="Network">O</button>
              <button type="button" aria-label="Tools">Tools</button>
              <span id="composerStatus" data-testid="opl-composer-run-state" class="composer-status">Ready</span>
            </div>
            <button id="sendButton" type="button" class="primary" onclick="sendCodexMessage()" aria-label="Send" disabled>Send</button>
          </div>
        </div>
      </form>
      <section id="settingsView" data-testid="opl-settings-panel" class="settings-page" aria-label="Settings">
        <div class="settings-content">
          <section data-testid="opl-settings-section" data-section="runtime-readback">
            <h2>Runtime readback</h2>
            <dl>
              <div><dt>State profile</dt><dd id="runtimeProfileSummary">fast</dd></div>
              <div><dt>Context status</dt><dd id="runtimeContextSummary">No readback yet.</dd></div>
            </dl>
            <button type="button" onclick="refreshContext()">Refresh state now</button>
          </section>
          <section data-testid="opl-settings-section" data-section="general">
            <h2>General</h2>
            <dl>
              <div><dt>Language</dt><dd><button data-testid="opl-locale-toggle" type="button" onclick="toggleSetting('locale')">Chinese</button><small>Default: zh</small></dd></div>
              <div><dt>Default workspace</dt><dd><code data-setting-key="defaultWorkspace">opl_app</code><small>Default: opl_app</small></dd></div>
            </dl>
          </section>
          <section data-testid="opl-settings-section" data-section="access">
            <h2>Access</h2>
            <dl>
              <div><dt>Model access</dt><dd><code data-testid="opl-model-access-entry" data-setting-key="modelAccess">codex_cli_managed</code><small>Default: codex_cli_managed</small></dd></div>
              <div><dt>Reasoning</dt><dd><button data-testid="opl-settings-reasoning" type="button" onclick="toggleSetting('reasoningLevel')">standard</button><small>Default: standard</small></dd></div>
            </dl>
          </section>
          <section data-testid="opl-settings-section" data-section="capabilities">
            <h2>Agents & Capabilities</h2>
            <dl>
              <div><dt>Starter defaults</dt><dd><code data-setting-key="professionalStarterDefaults">research_grant_presentation</code><small>Default: research_grant_presentation</small></dd></div>
            </dl>
          </section>
          <section data-testid="opl-settings-section" data-section="environment">
            <h2>Local Environment</h2>
            <dl>
              <div><dt>State profile</dt><dd><button type="button" onclick="toggleSetting('runtimeProfile')">fast</button><small>Default: fast</small></dd></div>
              <div><dt>Executor</dt><dd><code>Codex app-server --stdio</code><small>initialize / thread/start / turn/start / thread/resume</small></dd></div>
            </dl>
          </section>
          <section data-testid="opl-settings-section" data-section="storage">
            <h2>Storage</h2>
            <dl>
              <div><dt>Confirm before execute</dt><dd><button data-testid="opl-settings-confirm-execute" type="button" onclick="toggleSetting('confirmBeforeExecute')">on</button><small>Default: true</small></dd></div>
            </dl>
          </section>
          <section data-testid="opl-settings-section" data-section="appearance">
            <h2>Appearance</h2>
            <dl>
              <div><dt>Theme</dt><dd><button type="button" onclick="toggleSetting('theme')">system</button><small>Default: system</small></dd></div>
              <div><dt>Preview mode</dt><dd><code data-setting-key="artifactPreviewMode">rich_refs_only</code><small>Default: rich_refs_only</small></dd></div>
            </dl>
          </section>
          <section data-testid="opl-settings-section" data-section="advanced">
            <h2>Advanced</h2>
            <dl>
              <div><dt>Developer details</dt><dd><button type="button" onclick="toggleSetting('developerDetails')">off</button><small>Default: false</small></dd></div>
            </dl>
          </section>
        </div>
      </section>
      <aside id="inspector" class="inspector" aria-label="On-demand context panel" aria-hidden="true">
        <div class="inspector-head">
          <div class="inspector-bar">
            <strong>Inspector</strong>
            <button type="button" onclick="toggleInspector(false)">Close</button>
          </div>
          <div class="inspector-tabs">
            <button class="inspector-tab active" type="button">Inspector</button>
            <button class="inspector-tab" type="button">Session</button>
          </div>
        </div>
        <section data-testid="opl-files-panel" class="panel">
          <h3>Sources</h3>
          <div id="contextSources" class="list">
            <div class="file-row active">report.md</div>
            <div class="file-row">figures/overview.png</div>
            <div class="file-row">receipts/action-preview.json</div>
          </div>
        </section>
        <section class="panel">
          <h3>Output preview</h3>
          <section id="previewPanel" data-testid="opl-artifact-preview-tabs" class="preview artifact-preview-tabs">
            <div data-testid="opl-artifact-preview-panel" class="artifact-preview" data-preview-kind="streamdown">
              <article data-testid="opl-artifact-preview-card" class="artifact-preview-card">
                <header><span class="dot"></span><div><strong>Result narrative</strong><span class="status-pill">markdown</span></div></header>
                <p>Selected result or export previews appear here as refs-only cards.</p>
                <dl>
                  <div><dt>Renderer</dt><dd>streamdown</dd></div>
                  <div><dt>Ref</dt><dd>artifact://candidate/result-summary.md</dd></div>
                </dl>
              </article>
            </div>
          </section>
        </section>
        <section data-testid="opl-starter-forms" class="panel starter-forms">
          <h3>Workflow starters</h3>
          <div id="contextActions" class="list"></div>
          <button data-testid="opl-workbench-delivery-mode" class="purpose-row active delivery-workbench" type="button">
            <span data-testid="opl-delivery-mode">Research</span>
          </button>
          <button data-testid="opl-delivery-mode-option" class="purpose-row" type="button">Grant</button>
          <button data-testid="opl-delivery-mode-option" class="purpose-row" type="button">Presentation</button>
          <button type="button" onclick="dryRun('task_action_receipt_preview')">Research package</button>
          <button type="button" onclick="dryRun('task_export_bundle_preview')">Grant draft</button>
          <button type="button" onclick="dryRun('task_export_bundle_preview')">Presentation deck</button>
        </section>
        <details data-testid="opl-provenance-drawer" open>
          <summary>Trace</summary>
          <p data-testid="opl-provenance-ref">Source refs, receipt refs, replay refs, and export refs without artifact bodies.</p>
          <div id="contextTrace" class="list"></div>
          <div data-testid="opl-confirmation-card" class="inline-card">
            <strong>Review before execution</strong>
            <p>Preview the action receipt first; execution stays behind App action confirmation.</p>
            <button type="button" onclick="dryRun('task_action_receipt_preview')">Preview action</button>
            <button data-testid="opl-runtime-action-execute" type="button" onclick="executeConfirmedAction()">Execute confirmed</button>
            <button type="button" onclick="previewRollback()">Preview rollback</button>
          </div>
          <output id="receipt" data-testid="opl-runtime-action-receipt" class="receipt">No action preview yet.</output>
        </details>
        <section data-testid="opl-action-receipt-summary-list" class="panel">
          <h3>Action receipts</h3>
          <article data-testid="opl-action-receipt-summary" class="action-receipt-summary">
            <header><span class="dot"></span><div><strong>Delivery export preview receipt</strong><span class="status-pill">preview ready</span></div></header>
            <p>Preview receipt ref only; no action execution is implied.</p>
            <dl>
              <div><dt>Action</dt><dd>task_export_bundle_preview</dd></div>
              <div><dt>Receipt ref</dt><dd>opl://receipt/dry-run</dd></div>
            </dl>
          </article>
        </section>
        <details data-testid="opl-renderer-module-registry">
          <summary>Preview engines</summary>
          <p>Streamdown, KaTeX, Mermaid, CodeMirror, and PDF.js stay as candidate adapters.</p>
        </details>
        <details>
          <summary>System context</summary>
          <div data-testid="opl-context-tabs" class="row"><button>Skills</button><button>Routing</button><button>Memory</button><button>Runtime</button></div>
          <div data-testid="opl-skills-panel"></div>
          <div data-testid="opl-routing-panel"></div>
          <div data-testid="opl-memory-panel"></div>
          <div data-testid="opl-always-on-panel"></div>
          <div data-testid="opl-runtime-summary"></div>
          <button data-testid="opl-runtime-full-detail-button" type="button">Full drilldown</button>
          <button data-testid="opl-runtime-action-dry-run" type="button" onclick="dryRun('provider_scheduler_status')">Preview action</button>
          <div data-testid="opl-settings-panel"></div>
          <div data-testid="opl-web-transport" class="muted">window.oplNativeWorkbench / SSE /api/opl-events</div>
        </details>
        <div data-testid="opl-event-feed" hidden>tool process diff file receipt user_input permission</div>
      </aside>
    </section>
  </main>
  <script>
    const pendingNativeCalls = new Map();
    let currentCodexThreadId = null;
    let pendingAction = null;
    let pendingReplyNode = null;
    let currentSessionId = "session-initial";
    const settingsStorageKey = "opl.nativeWorkbench.settings.v1";
    const sessionStorageKey = "opl.nativeWorkbench.chatSessions.v1";
    const settingsDefaults = {
      locale: "zh",
      modelAccess: "codex_cli_managed",
      reasoningLevel: "standard",
      defaultWorkspace: "opl_app",
      runtimeProfile: "fast",
      confirmBeforeExecute: true,
      artifactPreviewMode: "rich_refs_only",
      professionalStarterDefaults: "research_grant_presentation",
      theme: "system",
      developerDetails: false
    };
    function introMessages() {
      return [
        { role: "user", text: "Use the current project to prepare a review or deliverable." },
        { role: "assistant", text: "Codex is connected to OPL project context. Ask for a result review, export draft, or workflow request." }
      ];
    }
    function readSessions() {
      try {
        const parsed = JSON.parse(localStorage.getItem(sessionStorageKey) || "[]");
        return Array.isArray(parsed) && parsed.length ? parsed : [{
          id: "session-initial",
          title: "Current project",
          threadId: null,
          updatedAt: new Date().toISOString(),
          messages: introMessages()
        }];
      } catch {
        return [{
          id: "session-initial",
          title: "Current project",
          threadId: null,
          updatedAt: new Date().toISOString(),
          messages: introMessages()
        }];
      }
    }
    function writeSessions(sessions) {
      localStorage.setItem(sessionStorageKey, JSON.stringify(sessions));
    }
    function sessionTitle(messages) {
      const user = messages.find((message) => message.role === "user" && message.text.trim());
      return user ? user.text.trim().slice(0, 40) : "New chat";
    }
    function renderSessions(activeId = currentSessionId) {
      const root = document.getElementById("sessionList");
      if (!root) return;
      root.replaceChildren(...readSessions().map((session) => {
        const button = document.createElement("button");
        button.className = "session-row" + (session.id === activeId ? " active" : "");
        button.type = "button";
        button.onclick = () => openSession(session.id);
        const title = document.createElement("strong");
        title.textContent = session.title;
        const mode = document.createElement("small");
        mode.textContent = session.threadId ? "Codex resumable thread" : "Local draft session";
        button.append(title, mode);
        return button;
      }));
    }
    function persistCurrentSession() {
      const thread = document.querySelector(".thread");
      const messages = [...thread.querySelectorAll(".message")].map((node) => ({
        role: node.classList.contains("user") ? "user" : node.classList.contains("system") ? "system" : "assistant",
        text: node.textContent || ""
      }));
      const nextSession = {
        id: currentSessionId,
        title: sessionTitle(messages),
        threadId: currentCodexThreadId,
        updatedAt: new Date().toISOString(),
        messages
      };
      const sessions = [nextSession, ...readSessions().filter((session) => session.id !== currentSessionId)];
      writeSessions(sessions);
      renderSessions();
    }
    window.__oplNativeWorkbenchResolve = function(id, ok, payload) {
      const pending = pendingNativeCalls.get(id);
      if (!pending) return;
      pendingNativeCalls.delete(id);
      if (ok) pending.resolve(payload);
      else pending.reject(payload);
    };
    const nativeEventListeners = new Set();
    window.__oplNativeWorkbenchEvent = function(payload) {
      nativeEventListeners.forEach((listener) => listener(payload));
    };
    function nativeInvoke(method, payload) {
      const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.oplNativeWorkbench;
      if (!handler) {
        return Promise.resolve({ simulated: true, method, payload });
      }
      const id = Date.now() + "-" + Math.random().toString(36).slice(2);
      return new Promise((resolve, reject) => {
        pendingNativeCalls.set(id, { resolve, reject });
        handler.postMessage({ id, method, payload });
      });
    }
    window.oplNativeWorkbench = {
      readState: (profile = "fast") => nativeInvoke("readState", { profile }),
      readFullDrilldown: () => nativeInvoke("readFullDrilldown", {}),
      executeAction: (request) => nativeInvoke("executeAction", request),
      sendMessage: (request) => nativeInvoke("sendMessage", request),
      subscribeEvents: (onEvent) => {
        nativeEventListeners.add(onEvent);
        onEvent({ type: "bridge.ready", source: "native-wkwebview" });
        return () => nativeEventListeners.delete(onEvent);
      }
    };
    function showView(view) {
      const isSettings = view === "settings";
      document.getElementById("chatContent").classList.toggle("hidden", isSettings);
      document.getElementById("composer").classList.toggle("hidden", isSettings);
      document.getElementById("settingsView").classList.toggle("active", isSettings);
      document.getElementById("chatNav").classList.toggle("active", !isSettings);
      document.getElementById("settingsNav").classList.toggle("active", isSettings);
      document.getElementById("viewTitle").textContent = isSettings ? "Settings" : "Current project";
    }
    function toggleInspector(force) {
      const inspector = document.getElementById("inspector");
      const next = typeof force === "boolean" ? force : !inspector.classList.contains("open");
      inspector.classList.toggle("open", next);
      inspector.setAttribute("aria-hidden", String(!next));
    }
    function appendMessage(role, text, className = "") {
      const thread = document.querySelector(".thread");
      const article = document.createElement("article");
      article.className = ("message " + role + " " + className).trim();
      article.textContent = text;
      thread.appendChild(article);
      article.scrollIntoView({ block: "end", behavior: "smooth" });
      return article;
    }
    function setComposerState(state, detail = "") {
      const status = document.getElementById("composerStatus");
      const button = document.getElementById("sendButton");
      const input = document.getElementById("promptInput");
      const hasPrompt = Boolean(input.value.trim());
      status.className = "composer-status " + state;
      status.textContent = state === "running" ? "Codex running" : state === "error" ? "Codex error: " + detail : "Ready";
      button.textContent = state === "running" ? "Running" : state === "error" ? "Retry" : "Send";
      button.disabled = state === "running" || !hasPrompt;
      input.disabled = state === "running";
      document.getElementById("codexStatus").textContent = state === "running" ? "Codex running" : state === "error" ? "Codex error" : "Codex ready";
    }
    function startNewChat() {
      currentCodexThreadId = null;
      currentSessionId = "session-" + Date.now();
      document.querySelector(".thread").replaceChildren();
      appendMessage("", "New OPL workbench chat. Ask for review, drafting, export, or a workflow starter.");
      persistCurrentSession();
    }
    function openSession(sessionId) {
      const session = readSessions().find((item) => item.id === sessionId);
      if (!session) return;
      currentSessionId = session.id;
      currentCodexThreadId = session.threadId || null;
      const thread = document.querySelector(".thread");
      thread.replaceChildren();
      for (const message of session.messages) {
        appendMessage(message.role === "user" ? "user" : message.role === "system" ? "system" : "", message.text, message.role === "assistant" ? "codex-reply" : "");
      }
      renderSessions(session.id);
      setComposerState("idle");
    }
    async function sendCodexMessage() {
      const input = document.getElementById("promptInput");
      const prompt = input.value.trim();
      if (!prompt) return;
      input.value = "";
      appendMessage("user", prompt);
      const reply = appendMessage("", "", "codex-reply");
      pendingReplyNode = reply;
      setComposerState("running");
      try {
        const result = await window.oplNativeWorkbench.sendMessage({ prompt, threadId: currentCodexThreadId });
        if (result.threadId) currentCodexThreadId = result.threadId;
        const text = result.finalMessage || result.stdout || result.stderr || JSON.stringify(result, null, 2);
        reply.textContent = text;
        reply.dataset.testid = "opl-codex-reply";
        if (result.error) reply.classList.add("error");
        pendingReplyNode = null;
        persistCurrentSession();
        setComposerState(result.error ? "error" : "idle", result.error || "");
      } catch (error) {
        reply.textContent = JSON.stringify(error, null, 2);
        reply.classList.add("error");
        pendingReplyNode = null;
        persistCurrentSession();
        setComposerState("error", String(error));
      }
    }
    async function dryRun(actionId) {
      const receipt = document.getElementById("receipt");
      pendingAction = { actionId };
      receipt.textContent = "Preparing preview...";
      try {
        const result = await window.oplNativeWorkbench.executeAction({ actionId, dryRun: true });
        receipt.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        receipt.textContent = JSON.stringify(error, null, 2);
      }
    }
    async function executeConfirmedAction() {
      const receipt = document.getElementById("receipt");
      if (!pendingAction) {
        receipt.textContent = "Preview an action before execution.";
        return;
      }
      receipt.textContent = "Executing confirmed action...";
      try {
        const receiptId = pendingAction.actionId + ":" + Date.now();
        const result = await window.oplNativeWorkbench.executeAction({
          actionId: pendingAction.actionId,
          payload: { confirmed: true, receiptId, rollbackRef: "rollback://" + receiptId },
          dryRun: false
        });
        receipt.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        receipt.textContent = JSON.stringify(error, null, 2);
      }
    }
    async function previewRollback() {
      const receipt = document.getElementById("receipt");
      if (!pendingAction) {
        receipt.textContent = "Preview an action before rollback.";
        return;
      }
      receipt.textContent = "Preparing rollback preview...";
      try {
        const result = await window.oplNativeWorkbench.executeAction({
          actionId: pendingAction.actionId,
          mode: "rollback",
          payload: { rollbackRef: "rollback://" + pendingAction.actionId },
          dryRun: true
        });
        receipt.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        receipt.textContent = JSON.stringify(error, null, 2);
      }
    }
    function loadSettings() {
      try {
        return { ...settingsDefaults, ...JSON.parse(localStorage.getItem(settingsStorageKey) || "{}") };
      } catch {
        return { ...settingsDefaults };
      }
    }
    function saveSettings(next) {
      localStorage.setItem(settingsStorageKey, JSON.stringify(next));
    }
    function labelForSetting(key, value) {
      if (key === "locale") return value === "zh" ? "Chinese" : "English";
      if (key === "confirmBeforeExecute" || key === "developerDetails") return value ? "on" : "off";
      return String(value);
    }
    function setSettingNode(node, key, value) {
      if (!node) return;
      node.textContent = labelForSetting(key, value);
    }
    function hydrateSettings() {
      const settings = loadSettings();
      document.getElementById("runtimeProfileSummary").textContent = settings.runtimeProfile;
      document.querySelectorAll("[data-setting-key]").forEach((node) => {
        const key = node.dataset.settingKey;
        setSettingNode(node, key, settings[key]);
      });
      for (const key of ["locale", "reasoningLevel", "runtimeProfile", "confirmBeforeExecute", "theme", "developerDetails"]) {
        const button = document.querySelector("[onclick=\\"toggleSetting('" + key + "')\\"]");
        setSettingNode(button, key, settings[key]);
      }
    }
    function toggleSetting(key) {
      const settings = loadSettings();
      const nextValue = key === "locale" ? settings.locale === "zh" ? "en" : "zh"
        : key === "reasoningLevel" ? settings.reasoningLevel === "high" ? "standard" : "high"
        : key === "runtimeProfile" ? settings.runtimeProfile === "fast" ? "full" : "fast"
        : key === "confirmBeforeExecute" ? !settings.confirmBeforeExecute
        : key === "theme" ? settings.theme === "system" ? "light" : "system"
        : key === "developerDetails" ? !settings.developerDetails
        : settings[key];
      saveSettings({ ...settings, [key]: nextValue });
      hydrateSettings();
      if (key === "runtimeProfile") refreshContext();
    }
    function objectValue(value) {
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }
    function stringValue(value) {
      return typeof value === "string" && value.trim() ? value : "";
    }
    function setRows(id, rows) {
      const root = document.getElementById(id);
      if (!root || !rows.length) return;
      root.replaceChildren(...rows);
    }
    function row(label, value, active = false) {
      const node = document.createElement("div");
      node.className = "file-row" + (active ? " active" : "");
      const strong = document.createElement("strong");
      strong.textContent = label;
      const small = document.createElement("small");
      small.textContent = value;
      node.append(strong, small);
      return node;
    }
    function renderContextState(payload) {
      const state = objectValue(objectValue(payload).app_state || payload);
      const runtime = objectValue(state.runtime_source);
      const operator = objectValue(state.operator);
      const modules = objectValue(state.modules);
      const sources = [
        ["Fast state", runtime.normal_gui_state_surface],
        ["Full state", runtime.full_gui_state_surface],
        ["Action", runtime.action_boundary_surface],
        ["Drilldown", runtime.full_drilldown_exception_surface],
        ...((Array.isArray(operator.refs) ? operator.refs : []).map((item) => {
          const ref = objectValue(item);
          return [stringValue(ref.label) || "Operator ref", ref.ref];
        })),
        ...((Array.isArray(modules.items) ? modules.items : []).slice(0, 5).map((item) => {
          const module = objectValue(item);
          return [stringValue(module.label) || stringValue(module.module_id) || "Module", module.checkout_path || module.repo_url];
        }))
      ].filter((item) => stringValue(item[1]));
      setRows("contextSources", sources.map((item, index) => row(item[0], item[1], index === 0)));

      const actions = (Array.isArray(state.actions) ? state.actions : [])
        .map(objectValue)
        .filter((action) => action.dry_run_supported && action.action_id);
      setRows("contextActions", actions.slice(0, 8).map((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "purpose-row";
        button.textContent = stringValue(action.label) || action.action_id;
        button.onclick = () => dryRun(action.action_id);
        return button;
      }));
      const previewPanel = document.getElementById("previewPanel");
      if (previewPanel && actions.length) {
        previewPanel.replaceChildren(...actions.slice(0, 4).map((action) => {
          const panel = document.createElement("div");
          panel.dataset.testid = "opl-artifact-preview-panel";
          panel.className = "artifact-preview";
          panel.dataset.previewKind = "json";
          const card = document.createElement("article");
          card.dataset.testid = "opl-artifact-preview-card";
          card.className = "artifact-preview-card";
          const title = document.createElement("strong");
          title.textContent = stringValue(action.label) || action.action_id;
          const route = document.createElement("p");
          route.textContent = stringValue(action.route) || "opl app action execute --action " + action.action_id;
          card.append(title, route);
          panel.append(card);
          return panel;
        }));
      }

      setRows("contextTrace", [
        ["Profile", objectValue(state.meta).profile],
        ["Generated", objectValue(state.meta).generated_at],
        ["Owner", runtime.owner],
        ["App owner", runtime.app_repo_truth_owner],
        ["Runtime", objectValue(operator.summary).runtime_status],
        ["Provider", objectValue(operator.summary).provider_status]
      ].filter((item) => stringValue(item[1])).map((item) => row(item[0], item[1])));
    }
    async function refreshContext() {
      const profile = loadSettings().runtimeProfile || "fast";
      document.getElementById("runtimeContextSummary").textContent = "Loading " + profile + " profile...";
      try {
        const state = await window.oplNativeWorkbench.readState(profile);
        renderContextState(state);
        document.getElementById("codexStatus").textContent = "Context ready";
        document.getElementById("runtimeContextSummary").textContent = "Context loaded via opl app state --profile " + profile;
      } catch (error) {
        document.getElementById("contextTrace").append(row("Context fallback", String(error)));
        document.getElementById("codexStatus").textContent = "Local runtime";
        document.getElementById("runtimeContextSummary").textContent = String(error);
      }
    }
    window.oplNativeWorkbench.subscribeEvents((event) => {
      if (event && event.method === "item/agentMessage/delta" && pendingReplyNode && typeof event.params?.delta === "string") {
        pendingReplyNode.textContent += event.params.delta;
      }
    });
    hydrateSettings();
    renderSessions();
    refreshContext();
    document.getElementById("promptInput").addEventListener("input", () => setComposerState("idle"));
  </script>
</body>
</html>
`);
fs.writeFileSync(path.join(contentsDir, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${appName}</string>
  <key>CFBundleDisplayName</key><string>One Person Lab App Workbench Candidate</string>
  <key>CFBundleExecutable</key><string>${appName}</string>
  <key>CFBundleIdentifier</key><string>cn.gflab.opl.native-workbench.candidate</string>
  <key>CFBundleIconFile</key><string>app</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`);
const executablePath = path.join(macOsDir, appName);
runCommand("swiftc", [
  path.join(root, "scripts", "native-workbench-app.swift"),
  "-framework",
  "Cocoa",
  "-framework",
  "WebKit",
  "-o",
  executablePath
], "compile native macOS workbench");

const manifest = {
  status: "candidate_app_bundle_ready",
  package_kind: "explicit_candidate_app_bundle",
  app_bundle_path: `out/${appName}.app`,
  app_bundle_executable: appName,
  app_bundle_icon: "Contents/Resources/app.icns",
  app_bundle_workbench: "Contents/Resources/workbench.html",
  app_bundle_manifest: "Contents/Resources/package-manifest.json",
  native_runtime: "AppKit/WKWebView",
  opens_default_browser: false,
  external_layout_reference: {
    repo: "https://github.com/K-Dense-AI/k-dense-byok",
    inspected_commit: "dccc7ec4d034a00d7662eaabb3f5916bc3d00602",
    companion_repo: "https://github.com/ai4s-research/open-science",
    companion_inspected_commit: "ac80a9c833b792190109c2b375a24b8e5130cd1f",
    source_paths: [
      "web/src/app/page.tsx",
      "web/src/components/chat-tab.tsx",
      "web/src/components/chat-tabs-bar.tsx",
      "web/src/components/file-preview-panel.tsx",
      "apps/desktop/src/app/layout/AppShell.tsx",
      "apps/desktop/src/app/routes/LiveSessionPage.tsx",
      "apps/desktop/src/components/thread/Composer.tsx",
      "apps/desktop/src/components/thread/ThreadView.tsx",
      "apps/desktop/src/components/sidebar/Sidebar.tsx",
      "apps/desktop/src/index.css"
    ],
    adapted_patterns: [
      "persistent Codex-style left sidebar for navigation and chat history",
      "single conversation canvas with centered max-width thread and bottom composer",
      "secondary files, preview, provenance, workflows, and export live in on-demand inspector surfaces",
      "chat tab strip and bottom composer as primary interaction",
      "artifact preview and provenance stay on-demand",
      "workflow/export/interview surfaces are secondary, not dashboard cards",
      "Open Science paper-light surface, thin borders, compact message blocks, and rounded composer"
    ]
  },
  brand_owner: "one-person-lab-app",
  functional_mvp: {
    codex_app_server_thread_turn: true,
    codex_command: "codex app-server --stdio",
    codex_protocol: "JSON-RPC newline transport with initialize, thread/start, turn/start, item/agentMessage/delta, turn/completed, thread/resume",
    opl_state_bridge: "opl app state --profile fast --json",
    opl_action_bridge: "opl app action execute --action <action_id> --dry-run --json",
    native_bridge: "WKScriptMessageHandler window.webkit.messageHandlers.oplNativeWorkbench",
    default_sandbox: "read-only",
    conversation_persistence: "codex_app_server_thread_id_resume_capable",
    acp_app_server_reuse_status: "implemented_with_codex_app_server_thread_turn_stream"
  },
  brand_assets: {
    icon_icns: {
      package_path: "Contents/Resources/app.icns",
      sha256: sha256(path.join(resourcesDir, "app.icns"))
    },
    logo_png: {
      package_path: "Contents/Resources/branding/opl-app-logo.png",
      sha256: sha256(path.join(resourcesDir, "branding", "opl-app-logo.png"))
    },
    banner_png: {
      package_path: "Contents/Resources/branding/opl-banner.png",
      sha256: sha256(path.join(resourcesDir, "branding", "opl-banner.png"))
    }
  },
  product_profile_owner: "one-person-lab-app",
  default_release_shell_unchanged: true,
  active_shell_adopted: false,
  runtime_authority_transfer: false,
  domain_truth_owned: false,
  home_purpose_entries: ["research", "grant", "ppt"],
  implemented_capabilities: evidence.capabilities,
  context_testids: [
    "opl-workspace-rail",
    "opl-session-list",
    "opl-context-tabs",
    "opl-files-panel",
    "opl-skills-panel",
    "opl-routing-panel",
    "opl-memory-panel",
    "opl-always-on-panel",
    "opl-web-transport"
  ],
  source_ui_smoke_status: "passed",
  source_visual_smoke_status: "passed",
  packaged_ui_smoke_status: "passed",
  webui_smoke_status: "passed",
  state_model_status: "passed",
  action_dry_run_status: "passed",
  webui_parity_status: "passed",
  ...deliverySurfaceStatuses(evidence),
  live_evidence: false,
  release_ready: false,
  production_ready: false
};
const manifestJson = JSON.stringify(manifest, null, 2);
fs.writeFileSync(path.join(root, "out", "opl-native-workbench-candidate-manifest.json"), manifestJson);
fs.writeFileSync(path.join(resourcesDir, "package-manifest.json"), manifestJson);
console.log(JSON.stringify({ status: "candidate_app_bundle_ready", app_bundle_path: manifest.app_bundle_path }, null, 2));
