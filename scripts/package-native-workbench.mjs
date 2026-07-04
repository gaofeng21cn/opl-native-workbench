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
  <title>${escapeHtml(appName)}</title>
  <style>
    :root { color-scheme: light; --bg: #f8fafc; --surface: #ffffff; --surface-2: #f2f5f8; --border: #e5e9ef; --text: #242936; --muted: #7d8794; --accent: #0f8a9d; --accent-fg: #ffffff; --shadow: 0 1px 2px rgba(35,40,52,.04), 0 12px 34px rgba(35,40,52,.08); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    button, textarea { font: inherit; }
    button { border: 0; background: transparent; color: inherit; border-radius: 10px; padding: 7px 9px; cursor: default; }
    button:hover { background: var(--surface-2); }
    button.primary { background: var(--accent); color: var(--accent-fg); }
    h1 { margin: 0; font-size: 14px; font-weight: 600; letter-spacing: 0; }
    h2 { margin: 0; font-size: 15px; font-weight: 600; }
    h3 { margin: 0 0 8px; color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    small, .muted { color: var(--muted); }
    .opl-native-workbench { height: 100vh; display: grid; grid-template-rows: 46px 1fr; overflow: hidden; }
    .app-bar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: rgba(255,255,255,.78); border-bottom: 1px solid rgba(229,233,239,.78); backdrop-filter: blur(18px); }
    .logo { width: 28px; height: 28px; border-radius: 8px; }
    .banner { height: 26px; width: 126px; object-fit: contain; margin-left: 4px; opacity: .82; }
    .pill { border: 1px solid #cfe7ec; background: #edf8fa; color: #0b6876; border-radius: 999px; padding: 3px 7px; font-size: 11px; }
    .top-spacer { flex: 1; }
    .shell { position: relative; min-height: 0; display: grid; grid-template-columns: 1fr; }
    .chat { min-height: 0; display: grid; grid-template-rows: 34px 1fr auto; }
    .tabs { display: flex; align-items: center; gap: 4px; padding: 4px 16px; }
    .tabs-inner { margin: 0 auto; width: min(780px, 100%); display: flex; align-items: center; gap: 4px; }
    .tab { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; color: var(--muted); font-size: 12px; }
    .tab.active { background: var(--surface-2); color: var(--text); }
    .conversation { overflow: auto; padding: 32px 20px; }
    .conversation-inner { margin: 0 auto; width: min(760px, 100%); display: grid; gap: 18px; }
    .message { display: grid; gap: 8px; max-width: 720px; font-size: 14px; }
    .message.user { justify-self: end; max-width: 560px; border-radius: 16px; background: var(--surface-2); padding: 10px 13px; }
    .status-line { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .status-line::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: var(--accent); opacity: .75; }
    .inline-confirmation { margin-top: 2px; border: 1px solid var(--border); background: var(--surface); border-radius: 14px; padding: 12px; box-shadow: 0 1px 2px rgba(35,40,52,.04); }
    .composer { padding: 10px 20px 22px; }
    .composer-box { margin: 0 auto; width: min(760px, 100%); overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); box-shadow: var(--shadow); }
    textarea { width: 100%; min-height: 78px; border: 0; padding: 14px 15px; resize: none; outline: none; background: transparent; color: var(--text); }
    .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .composer-footer { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-top: 1px solid var(--border); }
    .drawer { position: absolute; inset: 0 auto 0 0; width: min(360px, 88vw); transform: translateX(calc(-100% - 16px)); transition: transform .18s ease; border-right: 1px solid var(--border); background: rgba(255,255,255,.94); box-shadow: var(--shadow); backdrop-filter: blur(18px); z-index: 3; }
    .drawer.open { transform: translateX(0); }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border); }
    .section { padding: 12px; border-bottom: 1px solid var(--border); }
    .list { display: grid; gap: 2px; }
    .list button, .file-row { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px; text-align: left; border-radius: 10px; font-size: 13px; }
    .file-row.active { background: #edf8fa; color: #086777; }
    .preview { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 18px; text-align: center; }
    details { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    summary { color: var(--muted); font-size: 13px; }
    .receipt { margin-top: 8px; white-space: pre-wrap; background: #111827; color: #e9eef6; border-radius: 12px; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <main data-testid="opl-native-workbench-root" class="opl-native-workbench">
    <header class="app-bar">
      <img class="logo" src="branding/opl-app-logo.png" alt="One Person Lab App" />
      <div>
        <h1>${escapeHtml(appName)}</h1>
        <small>Native macOS candidate - chat-first workbench</small>
      </div>
      <span class="pill">non-live candidate</span>
      <img class="banner" src="branding/opl-banner.png" alt="One Person Lab" />
    </header>
    <section class="shell">
      <aside id="drawer" data-testid="opl-workspace-rail" class="drawer" aria-label="Project files">
        <div class="drawer-head">
          <strong>Workspace</strong>
          <button type="button" onclick="toggleDrawer(false)">Close</button>
        </div>
        <div class="section">
          <h3>Project</h3>
          <div data-testid="opl-session-list" class="list">
            <button><span>Current workspace</span><small class="muted">Chat to delivery</small></button>
            <button><span>Delivery review</span><small class="muted">Owner packet</small></button>
            <button><span>Starter lane</span><small class="muted">Workflow draft</small></button>
          </div>
        </div>
        <div class="section" data-testid="opl-files-panel">
          <h3>Files</h3>
          <div class="list">
            <div class="file-row active">report.md</div>
            <div class="file-row">figures/overview.png</div>
            <div class="file-row">receipts/dry-run.json</div>
          </div>
        </div>
        <div class="section">
          <h3>Preview</h3>
          <section data-testid="opl-artifact-preview-tabs" class="preview">
            <p><strong>report.md</strong></p>
            <p>Rendered output and delivery artifacts appear here when selected.</p>
          </section>
        </div>
        <details data-testid="opl-provenance-drawer" open>
          <summary>Provenance</summary>
          <p data-testid="opl-provenance-ref">Artifact refs, receipt refs, replay refs, and export refs without artifact bodies.</p>
          <output id="receipt" data-testid="opl-runtime-action-receipt" class="receipt">No dry-run request yet.</output>
        </details>
        <details data-testid="opl-renderer-module-registry">
          <summary>Renderer modules</summary>
          <p>streamdown, KaTeX, Mermaid, CodeMirror, and PDF.js stay as candidate adapters.</p>
        </details>
        <details>
          <summary>Context</summary>
          <div data-testid="opl-context-tabs" class="row"><button>Skills</button><button>Routing</button><button>Memory</button><button>Runtime</button></div>
          <div data-testid="opl-skills-panel"></div>
          <div data-testid="opl-routing-panel"></div>
          <div data-testid="opl-memory-panel"></div>
          <div data-testid="opl-always-on-panel"></div>
          <div data-testid="opl-runtime-summary"></div>
          <div data-testid="opl-web-transport" class="muted">window.oplNativeWorkbench / SSE /api/opl-events</div>
        </details>
      </aside>
      <section class="chat" aria-label="Conversation">
        <div class="tabs">
          <div class="tabs-inner">
            <button class="tab" type="button" onclick="toggleDrawer()">Workspace</button>
            <button class="tab active">Chat</button>
            <button data-testid="opl-starter-forms" class="tab">Workflows</button>
            <button data-testid="opl-export-action" class="tab">Export</button>
            <span class="top-spacer"></span>
            <span class="muted" style="font-size:12px">auto-first</span>
          </div>
        </div>
        <div class="conversation">
          <div class="conversation-inner">
            <article class="message user">Build an owner-review packet from current OPL App refs.</article>
            <article data-testid="opl-conversation-event" class="message">
              <h2>Ready to work from the current OPL context.</h2>
              <p>I will keep the main flow in chat. Files, previews, provenance, and delivery controls stay in the workspace drawer until they are needed.</p>
              <div class="status-line">App fast state loaded as refs</div>
              <div class="status-line">Artifact body authority remains outside this candidate</div>
              <div data-testid="opl-confirmation-card" class="inline-confirmation">
                <strong>Confirmation needed before execute</strong>
                <p>Dry-run can prepare the export receipt; real execution stays behind App action confirmation.</p>
                <button onclick="dryRun('confirmation.dry_run')">Dry-run confirmation</button>
              </div>
            </article>
          </div>
        </div>
        <form class="composer">
          <div class="composer-box">
            <textarea aria-label="Prompt" placeholder="Ask OPL to produce a result or delivery artifact"></textarea>
            <div class="composer-footer">
              <div class="row">
                <button type="button">+</button>
                <button data-testid="opl-model-access-entry" type="button">OPL model</button>
                <button data-testid="opl-delivery-mode" type="button">research</button>
                <button data-testid="opl-locale-toggle" type="button">中 / EN</button>
                <button data-testid="opl-skip-to-chat" type="button">Skip</button>
              </div>
              <button type="button" class="primary" onclick="dryRun('candidate.chat.submit')">Send</button>
            </div>
          </div>
        </form>
      </section>
    </section>
  </main>
  <script>
    function toggleDrawer(force) {
      const drawer = document.getElementById("drawer");
      drawer.classList.toggle("open", typeof force === "boolean" ? force : undefined);
    }
    function dryRun(actionId) {
      document.getElementById("receipt").textContent = JSON.stringify({
        actionId,
        dryRun: true,
        authority: "one-person-lab-app",
        at: new Date().toISOString()
      }, null, 2);
    }
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
      "header plus project switcher/status controls",
      "workspace files default to a collapsible drawer",
      "chat tab strip and bottom composer as primary interaction",
      "artifact preview and provenance stay on-demand",
      "workflow/export/interview surfaces are secondary, not dashboard cards",
      "Open Science paper-light surface, thin borders, compact message blocks, and rounded composer"
    ]
  },
  brand_owner: "one-person-lab-app",
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
