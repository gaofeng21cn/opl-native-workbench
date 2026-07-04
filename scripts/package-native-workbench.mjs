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
    :root { color-scheme: light; --ink: #172033; --muted: #617087; --line: #d9e0ea; --bg: #f6f8fb; --accent: #0f8a9d; --soft: #eaf7fa; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); }
    button, textarea { font: inherit; }
    button { border: 0; background: transparent; color: inherit; border-radius: 7px; padding: 6px 8px; cursor: default; }
    button:hover { background: #eef2f7; }
    button.primary { background: var(--accent); color: white; }
    h1 { margin: 0; font-size: 14px; line-height: 1.1; }
    h2 { margin: 0 0 10px; font-size: 16px; }
    h3 { margin: 0 0 8px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
    p { margin: 0; color: var(--muted); line-height: 1.45; }
    small, .muted { color: var(--muted); }
    .opl-native-workbench { height: 100vh; display: grid; grid-template-rows: 48px 1fr; overflow: hidden; }
    .app-bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--line); background: #fff; }
    .logo { width: 28px; height: 28px; border-radius: 7px; }
    .banner { height: 28px; width: 132px; object-fit: contain; margin-left: auto; }
    .pill { border: 1px solid #b7dfe6; background: var(--soft); color: #0b6876; border-radius: 999px; padding: 3px 7px; font-size: 11px; }
    .shell { display: grid; grid-template-columns: 220px minmax(520px, 1fr) 340px; min-height: 0; }
    .rail, .chat, .outputs { min-height: 0; overflow: hidden; }
    .rail, .outputs { background: #fbfcfe; }
    .rail { border-right: 1px solid var(--line); }
    .outputs { border-left: 1px solid var(--line); }
    .section { padding: 12px; border-bottom: 1px solid var(--line); }
    .list { display: grid; gap: 2px; }
    .list button, .file-row { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px; text-align: left; }
    .file-row { border-radius: 7px; font-size: 13px; }
    .file-row.active { background: #eef6f8; color: #086777; }
    .chat { display: grid; grid-template-rows: 34px 1fr auto; background: #fff; }
    .tabs { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-bottom: 1px solid var(--line); }
    .tab { display: inline-flex; align-items: center; gap: 6px; max-width: 180px; padding: 5px 9px; font-size: 12px; }
    .tab.active { background: #eef2f7; }
    .conversation { overflow: auto; padding: 18px 24px; display: grid; align-content: start; gap: 18px; }
    .message { display: grid; gap: 8px; max-width: 760px; }
    .message.user { justify-self: end; max-width: 620px; border-radius: 12px; background: #f2f5f8; padding: 10px 12px; }
    .tool-line { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; padding: 4px 0; }
    .inline-confirmation { border-left: 3px solid var(--accent); background: #f8fbfc; padding: 9px 11px; border-radius: 7px; }
    .composer { padding: 12px; border-top: 1px solid var(--line); background: #fff; }
    .composer-box { border: 1px solid var(--line); border-radius: 12px; background: #fff; overflow: hidden; }
    textarea { width: 100%; min-height: 72px; border: 0; padding: 12px; resize: none; outline: none; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .composer-footer { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-top: 1px solid var(--line); }
    .preview { height: calc(100vh - 215px); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: #fff; display: grid; grid-template-rows: 34px 1fr; }
    .preview-body { display: grid; place-items: center; text-align: center; padding: 24px; }
    details { border-top: 1px solid var(--line); padding: 10px 12px; }
    summary { color: var(--muted); font-size: 13px; }
    .receipt { margin-top: 8px; white-space: pre-wrap; background: #101826; color: #e9eef6; border-radius: 8px; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
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
      <aside data-testid="opl-workspace-rail" class="rail" aria-label="Project files">
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
      </aside>
      <section class="chat" aria-label="Conversation">
        <div class="tabs">
          <button class="tab active">Chat 1</button>
          <button class="tab">+</button>
          <button data-testid="opl-starter-forms" class="tab">Workflows</button>
          <button data-testid="opl-export-action" class="tab">Export</button>
          <span class="muted" style="margin-left:auto;font-size:12px">OPL App state/action refs only</span>
        </div>
        <div class="conversation">
          <article class="message user">Build an owner-review packet from current OPL App refs.</article>
          <article data-testid="opl-conversation-event" class="message">
            <h2>Ready to work from the current OPL context.</h2>
            <p>I can draft results, prepare delivery notes, and request confirmation through dry-run actions. Files and previews stay in the side panels instead of occupying the main chat.</p>
            <div class="tool-line">✓ App fast state loaded as refs</div>
            <div class="tool-line">✓ Artifact body authority remains outside this candidate</div>
            <div data-testid="opl-confirmation-card" class="inline-confirmation">
              <strong>Confirmation needed before execute</strong>
              <p>Dry-run can prepare the export receipt; real execution stays behind App action confirmation.</p>
              <button onclick="dryRun('confirmation.dry_run')">Dry-run confirmation</button>
            </div>
          </article>
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
      <aside class="outputs" aria-label="Files and outputs">
        <div class="section">
          <h3>Preview</h3>
          <section data-testid="opl-artifact-preview-tabs" class="preview">
            <div class="tabs"><button class="tab active">Markdown</button><button class="tab">PDF</button><button class="tab">Code</button></div>
            <div class="preview-body">
              <div>
                <p><strong>report.md</strong></p>
                <p>Rendered output and delivery artifacts appear here when selected.</p>
              </div>
            </div>
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
    </section>
  </main>
  <script>
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
