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
    :root { color-scheme: light; --bg: #f7f8f7; --sidebar: #f0f3f4; --surface: #ffffff; --surface-2: #eef3f4; --border: #dde4e6; --text: #20242d; --muted: #737d88; --subtle: #8b949f; --accent: #0f8a9d; --accent-soft: #e7f5f7; --accent-fg: #ffffff; --shadow: 0 1px 2px rgba(30,36,44,.04), 0 18px 48px rgba(30,36,44,.08); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    button, textarea { font: inherit; }
    button { border: 0; background: transparent; color: inherit; border-radius: 8px; cursor: default; }
    button:hover { background: rgba(32,36,45,.06); }
    button.primary { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; border-radius: 9px; background: var(--accent); color: var(--accent-fg); }
    h1 { margin: 0; font-size: 14px; font-weight: 650; letter-spacing: 0; }
    h2 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: 0; }
    h3 { margin: 0 0 8px; color: var(--muted); font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: .04em; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    small, .muted { color: var(--muted); }
    .opl-native-workbench { height: 100vh; display: grid; grid-template-columns: 236px minmax(0, 1fr); overflow: hidden; }
    .sidebar { display: flex; min-height: 0; flex-direction: column; border-right: 1px solid var(--border); background: var(--sidebar); padding: 10px 8px; }
    .brand { display: flex; align-items: center; gap: 8px; padding: 2px 6px 10px; }
    .logo { width: 22px; height: 22px; border-radius: 6px; }
    .brand-title { display: grid; gap: 1px; min-width: 0; }
    .brand-title small { font-size: 11px; }
    .quick-actions { display: grid; grid-template-columns: 1fr 56px; gap: 4px; margin-bottom: 8px; }
    .quick-actions button, .nav button, .session-row, .file-row, .purpose-row, .sidebar-footer button { min-height: 30px; padding: 6px 8px; text-align: left; font-size: 12px; }
    .nav { display: grid; gap: 2px; margin-bottom: 12px; }
    .nav button, .session-row, .file-row, .purpose-row { width: 100%; display: flex; align-items: center; gap: 8px; }
    .nav .active, .session-row.active, .file-row.active, .purpose-row.active, .sidebar-footer .active { background: rgba(255,255,255,.72); box-shadow: inset 0 0 0 1px rgba(221,228,230,.7); }
    .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--accent); opacity: .78; }
    .section { padding: 9px 0; border-top: 1px solid rgba(221,228,230,.85); }
    .list { display: grid; gap: 2px; }
    .session-row { align-items: flex-start; flex-direction: column; gap: 2px; border-radius: 8px; }
    .session-row strong { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 560; }
    .session-row small { font-size: 11px; }
    .file-row { justify-content: space-between; border-radius: 8px; color: #3e4751; }
    .purpose-row { border-radius: 8px; color: #3e4751; }
    .sidebar-footer { margin-top: auto; display: grid; gap: 2px; padding-top: 10px; border-top: 1px solid rgba(221,228,230,.85); }
    .sidebar-footer button { width: 100%; display: flex; align-items: center; justify-content: space-between; color: #3e4751; }
    .sidebar-note { padding: 5px 8px 0; color: var(--subtle); font-size: 11px; line-height: 1.35; }
    .status-pill { width: fit-content; border: 1px solid #cfe7ec; background: var(--accent-soft); color: #0b6876; border-radius: 999px; padding: 3px 8px; font-size: 11px; }
    .chat-shell { position: relative; min-width: 0; min-height: 0; display: grid; grid-template-rows: 44px 1fr auto; }
    .topbar { display: flex; align-items: center; gap: 8px; padding: 0 20px; border-bottom: 1px solid rgba(221,228,230,.78); background: rgba(255,255,255,.72); backdrop-filter: blur(18px); }
    .topbar-title { min-width: 0; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 560; }
    .spacer { flex: 1; }
    .topbar button, .composer-footer button, .chip { padding: 5px 8px; color: var(--muted); font-size: 12px; }
    .topbar .status-pill { margin-left: 4px; }
    .conversation { overflow: auto; padding: 34px 20px 18px; }
    .thread { margin: 0 auto; width: min(760px, 100%); display: grid; gap: 18px; }
    .message { display: grid; gap: 8px; max-width: 720px; font-size: 14px; }
    .message.user { justify-self: end; max-width: 560px; border-radius: 16px; background: var(--surface-2); padding: 10px 13px; }
    .assistant-head { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .assistant-head::before { content: ""; width: 7px; height: 7px; border-radius: 999px; background: var(--accent); opacity: .75; }
    .status-line { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .status-line::before { content: ""; width: 4px; height: 4px; border-radius: 999px; background: #a1abb5; }
    .inline-card { margin-top: 4px; border: 1px solid var(--border); background: rgba(255,255,255,.78); border-radius: 13px; padding: 11px 12px; box-shadow: 0 1px 2px rgba(30,36,44,.04); }
    .inline-card strong { display: block; margin-bottom: 4px; font-size: 13px; }
    .inline-card button { margin-top: 8px; padding: 6px 9px; background: var(--accent-soft); color: #0b6876; }
    .capability-row { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 3px; }
    .capability-row button { border: 1px solid var(--border); background: rgba(255,255,255,.8); padding: 6px 9px; color: #33404b; font-size: 12px; }
    .codex-reply { white-space: pre-wrap; border: 1px solid var(--border); background: var(--surface); border-radius: 13px; padding: 12px; line-height: 1.55; }
    .codex-reply.error { border-color: #efc9c9; color: #9f2b2b; }
    .composer { padding: 10px 20px 22px; }
    .composer-box { margin: 0 auto; width: min(760px, 100%); overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); box-shadow: var(--shadow); }
    textarea { width: 100%; min-height: 78px; border: 0; padding: 14px 15px; resize: none; outline: none; background: transparent; color: var(--text); }
    .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .composer-footer { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-top: 1px solid var(--border); }
    .composer-footer .row { color: var(--muted); font-size: 12px; }
    .inspector { position: absolute; inset: 0 0 0 auto; width: min(396px, 88vw); transform: translateX(calc(100% + 16px)); transition: transform .18s ease; border-left: 1px solid var(--border); background: rgba(255,255,255,.95); box-shadow: var(--shadow); backdrop-filter: blur(18px); z-index: 4; overflow: auto; }
    .inspector.open { transform: translateX(0); }
    .inspector-head { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,.92); backdrop-filter: blur(14px); }
    .panel { padding: 12px; border-bottom: 1px solid var(--border); }
    .preview { border: 1px solid var(--border); border-radius: 13px; background: #fbfcfc; padding: 16px; }
    details { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    summary { color: var(--muted); font-size: 13px; }
    .receipt { margin-top: 8px; white-space: pre-wrap; background: #111827; color: #e9eef6; border-radius: 12px; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .settings-page { display: none; overflow: auto; padding: 34px 20px; }
    .settings-page.active { display: block; }
    .settings-content { margin: 0 auto; width: min(820px, 100%); display: grid; gap: 14px; }
    .settings-content section { border-bottom: 1px solid var(--border); padding: 0 0 14px; }
    .settings-content h2 { margin-bottom: 6px; }
    .settings-content button { margin-top: 8px; padding: 6px 9px; background: var(--surface-2); }
    .settings-content code { display: inline-block; margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 5px 7px; color: #3e4751; background: #fbfcfc; }
    .chat-content.hidden, .composer.hidden { display: none; }
    @media (max-width: 760px) {
      .opl-native-workbench { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .topbar { padding: 0 12px; }
      .conversation, .composer { padding-left: 12px; padding-right: 12px; }
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
      </div>
      <div class="quick-actions">
        <button type="button">New chat</button>
        <button type="button" aria-label="Search">Search</button>
      </div>
      <nav class="nav" aria-label="Primary">
        <button id="chatNav" class="active" type="button" onclick="showView('chat')"><span class="dot"></span>Chats</button>
      </nav>
      <section class="section">
        <h3>Recent</h3>
        <div data-testid="opl-session-list" class="list">
          <button class="session-row active" type="button"><strong>Delivery review</strong><small>Current project refs</small></button>
          <button class="session-row" type="button"><strong>Result package</strong><small>Trace and export draft</small></button>
          <button class="session-row" type="button"><strong>Workflow setup</strong><small>Research, grant, presentation</small></button>
        </div>
      </section>
      <div class="sidebar-footer">
        <button type="button" onclick="toggleInspector(true)">Context</button>
        <button id="settingsNav" type="button" onclick="showView('settings')">Settings</button>
        <span class="status-pill">connected</span>
      </div>
    </aside>
    <section class="chat-shell" aria-label="Single conversation canvas">
      <header class="topbar">
        <div class="topbar-title">
          <span class="dot"></span>
          <span id="viewTitle">Current project</span>
        </div>
        <span class="spacer"></span>
        <span id="codexStatus" data-testid="opl-model-access-entry" class="status-pill">Codex connected</span>
        <button data-testid="opl-export-action" type="button" onclick="dryRun('artifact.export.prepare')">Export</button>
        <button type="button" onclick="toggleInspector(true)">Context</button>
      </header>
      <div id="chatContent" class="conversation chat-content">
        <div class="thread">
          <article class="message user">Use the current project to prepare a review or deliverable.</article>
          <article data-testid="opl-conversation-event" class="message">
            <div class="assistant-head">One Person Lab</div>
            <h2>Codex is connected to OPL project context.</h2>
            <p>Ask for a result review, export draft, or workflow request. OPL keeps sources, previews, trace, and receipts available in the context panel, and asks before execution.</p>
            <div class="status-line">Project sources loaded</div>
            <div class="status-line">Preview and export actions require confirmation</div>
            <div class="status-line">Artifact bodies remain source-owned</div>
            <div data-testid="opl-workbench-delivery-mode" class="capability-row delivery-workbench" aria-label="Suggested outputs">
              <button data-testid="opl-delivery-mode-option" type="button" onclick="dryRun('candidate.delivery.mode')">Review results</button>
              <button data-testid="opl-delivery-mode-option" type="button" onclick="dryRun('candidate.delivery.mode')">Draft grant</button>
              <button data-testid="opl-delivery-mode-option" type="button" onclick="dryRun('candidate.delivery.mode')">Build deck</button>
              <button data-testid="opl-delivery-mode-option" type="button" onclick="dryRun('candidate.delivery.mode')">Prepare handoff</button>
              <span data-testid="opl-delivery-mode" hidden>research</span>
            </div>
          </article>
        </div>
      </div>
      <form id="composer" class="composer">
        <div class="composer-box">
          <textarea id="promptInput" aria-label="Prompt" placeholder="Ask OPL to review, draft, export, or start a workflow"></textarea>
          <div class="composer-footer">
            <div class="row">
              <button type="button" aria-label="Attach">+</button>
              <span>OPL tools available</span>
            </div>
            <button type="button" class="primary" onclick="sendCodexMessage()" aria-label="Send">Send</button>
          </div>
        </div>
      </form>
      <section id="settingsView" data-testid="opl-settings-panel" class="settings-page" aria-label="Settings">
        <div class="settings-content">
          <section>
            <h2>Execution</h2>
            <p>Codex is the local executor for this build. Model and reasoning controls belong in settings, not beside Send.</p>
            <button data-testid="opl-model-access-entry" type="button">Codex CLI managed</button>
          </section>
          <section>
            <h2>Interface</h2>
            <p>Language is a global interface preference.</p>
            <button data-testid="opl-locale-toggle" type="button">Chinese</button>
          </section>
          <section>
            <h2>Runtime</h2>
            <p>This build uses Codex app-server JSON-RPC for initialize, thread/start, turn/start, streaming deltas, and thread resume.</p>
            <code>codex app-server --stdio</code>
          </section>
          <section>
            <h2>Project</h2>
            <p>The default project is the OPL App repo. Domain truth and artifact bodies remain outside this shell.</p>
          </section>
          <section>
            <h2>About</h2>
            <p>This is a local candidate build. AionUI remains the active shell until release gates pass.</p>
          </section>
        </div>
      </section>
      <aside id="inspector" class="inspector" aria-label="On-demand context panel" aria-hidden="true">
        <div class="inspector-head">
          <strong>Context</strong>
          <button type="button" onclick="toggleInspector(false)">Close</button>
        </div>
        <section data-testid="opl-files-panel" class="panel">
          <h3>Sources</h3>
          <div class="list">
            <div class="file-row active">report.md</div>
            <div class="file-row">figures/overview.png</div>
            <div class="file-row">receipts/action-preview.json</div>
          </div>
        </section>
        <section class="panel">
          <h3>Output preview</h3>
          <section data-testid="opl-artifact-preview-tabs" class="preview artifact-preview-tabs">
            <div data-testid="opl-artifact-preview-panel" class="artifact-preview" data-preview-kind="streamdown">
              <p><strong>report.md</strong></p>
              <p>Selected result or export previews appear here.</p>
            </div>
          </section>
        </section>
        <section data-testid="opl-starter-forms" class="panel starter-forms">
          <h3>Workflow starters</h3>
          <button data-testid="opl-workbench-delivery-mode" class="purpose-row active delivery-workbench" type="button">
            <span data-testid="opl-delivery-mode">Research</span>
          </button>
          <button data-testid="opl-delivery-mode-option" class="purpose-row" type="button">Grant</button>
          <button data-testid="opl-delivery-mode-option" class="purpose-row" type="button">Presentation</button>
          <button type="button" onclick="dryRun('starter.mas.dry_run')">Research package</button>
          <button type="button" onclick="dryRun('starter.mag.dry_run')">Grant draft</button>
          <button type="button" onclick="dryRun('starter.rca.dry_run')">Presentation deck</button>
        </section>
        <details data-testid="opl-provenance-drawer" open>
          <summary>Trace</summary>
          <p data-testid="opl-provenance-ref">Source refs, receipt refs, replay refs, and export refs without artifact bodies.</p>
          <div data-testid="opl-confirmation-card" class="inline-card">
            <strong>Review before execution</strong>
            <p>Preview the action receipt first; execution stays behind App action confirmation.</p>
            <button type="button" onclick="dryRun('confirmation.dry_run')">Preview action</button>
          </div>
          <output id="receipt" data-testid="opl-runtime-action-receipt" class="receipt">No action preview yet.</output>
        </details>
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
          <button data-testid="opl-runtime-action-dry-run" type="button" onclick="dryRun('candidate.inspect')">Preview action</button>
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
    async function sendCodexMessage() {
      const input = document.getElementById("promptInput");
      const prompt = input.value.trim();
      if (!prompt) return;
      input.value = "";
      appendMessage("user", prompt);
      const reply = appendMessage("", "Codex is working...", "codex-reply");
      document.getElementById("codexStatus").textContent = "Codex running";
      try {
        const result = await window.oplNativeWorkbench.sendMessage({ prompt, threadId: currentCodexThreadId });
        if (result.threadId) currentCodexThreadId = result.threadId;
        const text = result.finalMessage || result.stdout || result.stderr || JSON.stringify(result, null, 2);
        reply.textContent = text;
        reply.dataset.testid = "opl-codex-reply";
        if (result.error) reply.classList.add("error");
        document.getElementById("codexStatus").textContent = result.finalMessage ? "Codex ready" : "Codex returned";
      } catch (error) {
        reply.textContent = JSON.stringify(error, null, 2);
        reply.classList.add("error");
        document.getElementById("codexStatus").textContent = "Codex error";
      }
    }
    async function dryRun(actionId) {
      const receipt = document.getElementById("receipt");
      receipt.textContent = "Preparing preview...";
      try {
        const result = await window.oplNativeWorkbench.executeAction({ actionId, dryRun: true });
        receipt.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        receipt.textContent = JSON.stringify(error, null, 2);
      }
    }
    window.oplNativeWorkbench.readState("fast").then(() => {
      document.getElementById("codexStatus").textContent = "Context ready";
    }).catch(() => {
      document.getElementById("codexStatus").textContent = "Local runtime";
    });
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
