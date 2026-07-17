import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { buildRenderer } from "./build-renderer.mjs";
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
const appName = "One Person Lab Native";
const appRoot = path.join(root, "out", `${appName}.app`);
const macOsDir = path.join(appRoot, "Contents", "MacOS");
const contentsDir = path.join(appRoot, "Contents");
const resourcesDir = path.join(contentsDir, "Resources");
const rendererOutDir = path.join(root, "dist", "package");
const evidence = JSON.parse(fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8"));
const app = read("src/workbench/App.tsx");
const rendererSource = readRendererSource();
const nativeIconPath = path.resolve(
  process.env.OPL_NATIVE_WORKBENCH_ICON_ICNS ?? path.join(root, "assets", "branding", "one-person-lab-native.icns")
);

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`missing ${label}: ${filePath}`);
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function runCommand(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8", cwd: root });
  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stdout}\n${result.stderr}`);
  }
}

validateNonLiveDeliveryEvidence(evidence);
assertRendererTestIds(rendererSource, deliverySurfaceTestIds(evidence), "package source");
assertSourceMarkers(rendererSource, deliverySurfaceMarkers(evidence), "package source layout");
assertNoFalseReadyFields({
  "src/workbench/App.tsx": app,
  "src/candidateContractEvidence.json": fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8")
});
assertFile(nativeIconPath, "OPL Native app icon");

const rendererBuild = buildRenderer({
  outDir: rendererOutDir,
  htmlName: "workbench.html",
  jsName: "renderer.js",
  format: "iife",
  scriptType: "classic"
});

fs.rmSync(appRoot, { recursive: true, force: true });
fs.mkdirSync(macOsDir, { recursive: true });
fs.mkdirSync(resourcesDir, { recursive: true });
fs.copyFileSync(nativeIconPath, path.join(resourcesDir, "app.icns"));
fs.copyFileSync(path.join(rendererOutDir, "workbench.html"), path.join(resourcesDir, "workbench.html"));
fs.copyFileSync(path.join(rendererOutDir, "renderer.js"), path.join(resourcesDir, "renderer.js"));
fs.copyFileSync(path.join(rendererOutDir, "renderer-build.json"), path.join(resourcesDir, "renderer-build.json"));
fs.cpSync(path.join(rendererOutDir, "branding"), path.join(resourcesDir, "branding"), { recursive: true });

fs.writeFileSync(path.join(contentsDir, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${appName}</string>
  <key>CFBundleDisplayName</key><string>${appName}</string>
  <key>CFBundleExecutable</key><string>${appName}</string>
  <key>CFBundleIdentifier</key><string>cn.gflab.opl.native-workbench.candidate</string>
  <key>CFBundleIconFile</key><string>app</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>LSMultipleInstancesProhibited</key><true/>
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
  status: "candidate_app_bundle_built",
  package_kind: "explicit_candidate_app_bundle",
  bundle_identity: {
    display_name: appName,
    bundle_id: "cn.gflab.opl.native-workbench.candidate",
    installed_app_path: "/Applications/One Person Lab Native.app",
    isolated_from_active_mainline_bundle_id: "cn.onepersonlab.opl",
    active_mainline_installed_app_path: "/Applications/One Person Lab.app"
  },
  launcher_runtime_resolution: {
    source: "one-person-lab-app npm run gui",
    identity_schema: "app_runtime_executable_identity.v1",
    explicit_executable_env: ["OPL_APP_OPL_BIN", "OPL_CODEX_BIN"],
    identity_readback_env: "OPL_APP_RUNTIME_IDENTITY_JSON",
    direct_launch_fallback: "host_path_without_runtime_parity_claim"
  },
  candidate_mutation_policy: {
    launcher_default: "dry_run_only",
    guard_env: "OPL_NATIVE_WORKBENCH_READ_ONLY=1",
    explicit_override: "one-person-lab-app gui launcher --allow-actions",
    blocked_receipt_kind: "blocked_read_only"
  },
  app_bundle_path: `out/${appName}.app`,
  app_bundle_executable: appName,
  app_bundle_icon: "Contents/Resources/app.icns",
  app_bundle_workbench: "Contents/Resources/workbench.html",
  app_bundle_script: "Contents/Resources/renderer.js",
  app_bundle_manifest: "Contents/Resources/package-manifest.json",
  native_runtime: "AppKit/WKWebView",
  opens_default_browser: false,
  primary_visual_reference: {
    product: "ChatGPT Codex macOS",
    version: "26.707.41301",
    reference_date: "2026-07-11",
    source_usage: "visual_and_interaction_reference_only_no_code_or_brand_copy",
    aligned_regions: [
      "persistent project and conversation rail",
      "single dominant conversation timeline",
      "model and reasoning controls in the composer bottom row",
      "floating user-requested environment details",
      "account-row Settings entry"
    ]
  },
  default_home_layout: {
    project_rail_visible: true,
    environment_details_default_open: false,
    environment_details_presentation: "floating"
  },
  codex_model_policy: {
    source: rendererBuild.modelPolicySource,
    default_model: rendererBuild.defaultModel,
    default_reasoning_effort: rendererBuild.defaultReasoningEffort,
    visible_models: rendererBuild.visibleModels,
    reasoning_efforts: rendererBuild.reasoningEfforts
  },
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
      "persistent project and conversation rail with compact project context links",
      "single conversation canvas with centered max-width thread and bottom composer",
      "model and reasoning controls stay in the composer bottom row",
      "attachments, outputs, preview, provenance, workflows, packages, and runtime live in floating user-requested environment details",
      "bottom composer is the primary interaction",
      "environment details are closed by default and do not resize the chat canvas",
      "workflow/export/interview surfaces are secondary, not dashboard cards",
      "K-Dense and Open Science remain feature references rather than the visual shell baseline"
    ]
  },
  brand_owner: "one-person-lab-app",
  functional_mvp: {
    codex_app_server_thread_turn: true,
    codex_command: "codex app-server --stdio",
    codex_protocol: "JSON-RPC newline transport with initialize, model/list, paginated thread/list, thread/read, thread/resume, thread/fork, thread/archive, thread/unarchive, turn/start, turn/steer, thread/status/changed, item/agentMessage/delta, item/completed, and turn/completed",
    thread_lifecycle: "one Desktop/WebUI adapter projects Codex App Server thread truth and routes list, read, resume, fork, archive, and unarchive",
    codex_subagent_projection: "read-only parentThreadId, agentRole, agentNickname, source kind, collabAgentToolCall, and subAgentActivity",
    private_coordination_layer: false,
    codex_model_reasoning_controls: `App product profile Auto policy injected into the shared renderer; known ${rendererBuild.defaultModel} keeps ${rendererBuild.defaultReasoningEffort}, an unknown Codex model/list isDefault entry becomes Auto with its highest advertised reasoning effort, unavailable fixed selections remain blocked, manual reasoning pins the current model and exits Auto, and turn/start receives model and effort overrides`,
    opl_state_bridge: "opl app state --profile fast --json",
    opl_action_bridge: "opl app action execute --action <action_id> --dry-run --json",
    native_bridge: "WKScriptMessageHandler window.webkit.messageHandlers.oplNativeWorkbench",
    default_sandbox: "read-only",
    conversation_persistence: "codex_app_server_thread_id_resume_capable",
    acp_app_server_reuse_status: "implemented_with_codex_app_server_thread_turn_stream"
  },
  shared_renderer_entry: rendererBuild.entry,
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
    "opl-project-inputs",
    "opl-project-attachments",
    "opl-project-chats",
    "opl-topbar-model-config",
    "opl-assistant-artifact-card",
    "opl-selected-artifact-preview",
    "opl-session-list",
    "opl-real-thread-directory",
    "opl-thread-scope-filter",
    "opl-thread-detail-popover",
    "opl-thread-lifecycle-confirmation",
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
console.log(JSON.stringify({ status: "candidate_app_bundle_built", app_bundle_path: manifest.app_bundle_path }, null, 2));
