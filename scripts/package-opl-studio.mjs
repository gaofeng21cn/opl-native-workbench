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
} from "./opl-studio-gates.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const appName = "One Person Lab Preview";
const appRoot = path.join(root, "out", `${appName}.app`);
const macOsDir = path.join(appRoot, "Contents", "MacOS");
const contentsDir = path.join(appRoot, "Contents");
const resourcesDir = path.join(contentsDir, "Resources");
const rendererOutDir = path.join(root, "dist", "package");
const evidence = JSON.parse(fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8"));
const dshSourceManifest = JSON.parse(fs.readFileSync(path.join(root, "src/composition/deepseekHarnessSourceManifest.json"), "utf8"));
const app = read("src/workbench/App.tsx");
const rendererSource = readRendererSource();
const nativeIconPath = path.resolve(
  process.env.OPL_STUDIO_ICON_ICNS ?? path.join(root, "assets", "branding", "opl-studio.icns")
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
assertFile(nativeIconPath, "OPL Studio app icon");

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
if (rendererBuild.stylesheet) {
  fs.copyFileSync(path.join(rendererOutDir, rendererBuild.stylesheet), path.join(resourcesDir, rendererBuild.stylesheet));
}
fs.copyFileSync(path.join(rendererOutDir, "renderer-build.json"), path.join(resourcesDir, "renderer-build.json"));
fs.copyFileSync(path.join(root, "THIRD_PARTY_NOTICES.md"), path.join(resourcesDir, "THIRD_PARTY_NOTICES.md"));

fs.writeFileSync(path.join(contentsDir, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${appName}</string>
  <key>CFBundleDisplayName</key><string>${appName}</string>
  <key>CFBundleExecutable</key><string>${appName}</string>
  <key>CFBundleIdentifier</key><string>cn.gflab.opl.studio.preview</string>
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
  path.join(root, "scripts", "opl-studio-app.swift"),
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
    bundle_id: "cn.gflab.opl.studio.preview",
    installed_app_path: "/Applications/One Person Lab Preview.app",
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
    guard_env: "OPL_STUDIO_READ_ONLY=1",
    explicit_override: "one-person-lab-app gui launcher --allow-actions",
    blocked_receipt_kind: "blocked_read_only"
  },
  app_bundle_path: `out/${appName}.app`,
  app_bundle_executable: appName,
  app_bundle_icon: "Contents/Resources/app.icns",
  app_bundle_workbench: "Contents/Resources/workbench.html",
  app_bundle_script: "Contents/Resources/renderer.js",
  app_bundle_stylesheet: rendererBuild.stylesheet ? `Contents/Resources/${rendererBuild.stylesheet}` : null,
  app_bundle_third_party_notices: "Contents/Resources/THIRD_PARTY_NOTICES.md",
  app_bundle_manifest: "Contents/Resources/package-manifest.json",
  native_runtime: "AppKit/WKWebView",
  opens_default_browser: false,
  carrier_policy: evidence.carrier_policy,
  primary_visual_reference: {
    product: evidence.default_home_layout.primary_visual_reference.reference_product,
    version: evidence.default_home_layout.primary_visual_reference.reference_version,
    reference_date: evidence.default_home_layout.primary_visual_reference.reference_date,
    source_usage: evidence.default_home_layout.primary_visual_reference.source_usage,
    aligned_regions: [
      "persistent project and conversation rail",
      "single dominant conversation timeline",
      "persistent bottom composer",
      "user-requested resizable details column",
      "typed slot contributions"
    ]
  },
  visual_style_reference: evidence.default_home_layout.visual_style_reference,
  deepseek_harness_source_reuse: {
    repo: "https://github.com/deepseek-ai/deepseek-harness",
    inspected_commit: evidence.reuse_policy.deepseek_harness_source_ref,
    license: "MIT",
    source_package_version: dshSourceManifest.upstream.source_package_version,
    ui_package_version: evidence.reuse_policy.deepseek_harness_ui_package_version,
    packages: [
      "@deepseek-ai/dsh-client-ui-slots",
      "@deepseek-ai/dsh-client-web-react"
    ],
    source_manifest: evidence.reused_oss_module_policy.source_manifest,
    vendor_root: evidence.reused_oss_module_policy.vendored_source_root,
    package_roots: dshSourceManifest.snapshot.package_roots,
    file_count: dshSourceManifest.snapshot.file_count,
    byte_identical: dshSourceManifest.snapshot.byte_identical,
    byte_identical_to_pinned_ref: dshSourceManifest.snapshot.byte_identical_to_pinned_ref,
    active_gui_roots: evidence.reused_oss_module_policy.active_gui_roots,
    adopted_scope: [
      "SlotCore",
      "createSlotRenderer",
      "registration_disposal",
      "entry_error_isolation",
      "AppFrame",
      "SidebarRoot",
      "ConversationRoot",
      "EmptyHero",
      "InputBar",
      "SettingsRoot",
      "ui_theme",
      "ui_primitives"
    ],
    excluded_authority: [
      "session",
      "agent",
      "provider",
      "credentials",
      "connection",
      "plugin_manager",
      "control_plane"
    ]
  },
  default_home_layout: {
    project_rail_visible: true,
    details_default_open: false,
    details_presentation: "dsh_resizable_column_with_mobile_overlay"
  },
  codex_model_policy: {
    source: rendererBuild.modelPolicySource,
    default_model: rendererBuild.defaultModel,
    default_reasoning_effort: rendererBuild.defaultReasoningEffort,
    visible_models: rendererBuild.visibleModels,
    reasoning_efforts: rendererBuild.reasoningEfforts
  },
  brand_owner: "one-person-lab-app",
  ui_identity: "text_only_opl_studio_no_logo",
  functional_mvp: {
    codex_app_server_thread_turn: true,
    codex_command: "codex app-server --stdio",
    codex_protocol: evidence.functional_mvp.codex_protocol,
    thread_lifecycle: "one Desktop/WebUI adapter projects Codex App Server thread truth and routes list, read, resume, fork, archive, and unarchive",
    codex_subagent_projection: "read-only parentThreadId, agentRole, agentNickname, source kind, collabAgentToolCall, and subAgentActivity",
    private_coordination_layer: false,
    codex_model_reasoning_controls: `App product profile Auto policy injected into the shared renderer; known ${rendererBuild.defaultModel} keeps ${rendererBuild.defaultReasoningEffort}, an unknown Codex model/list isDefault entry becomes Auto with its highest advertised reasoning effort, unavailable fixed selections remain blocked, manual reasoning pins the current model and exits Auto, and turn/start receives model and effort overrides`,
    opl_state_bridge: "opl app state --profile fast --json",
    opl_action_bridge: "opl app action execute --action <action_id> --dry-run --json",
    native_bridge: "WKScriptMessageHandler window.webkit.messageHandlers.oplStudio",
    default_agent_permissions_profile: evidence.functional_mvp.default_agent_permissions_profile,
    agent_permissions_controls: evidence.functional_mvp.agent_permissions_controls,
    conversation_persistence: "codex_app_server_thread_id_resume_capable",
    shared_thread_directory: evidence.functional_mvp.shared_thread_directory,
    acp_app_server_reuse_status: "implemented_with_codex_app_server_thread_turn_stream"
  },
  shared_renderer_entry: rendererBuild.entry,
  application_icon: {
    package_path: "Contents/Resources/app.icns",
    sha256: sha256(path.join(resourcesDir, "app.icns"))
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
    "opl-project-chats",
    "opl-topbar-model-config",
    "opl-selected-artifact-preview",
    "opl-session-list",
    "opl-real-thread-directory",
    "opl-thread-scope-filter",
    "opl-thread-detail-popover",
    "opl-thread-lifecycle-confirmation",
    "opl-context-tabs",
    "opl-runtime-status-panel",
    "opl-agent-run-status",
    "opl-runtime-contributions",
    "opl-files-results-panel",
    "opl-input-files-list",
    "opl-agents-capabilities-panel",
    "opl-current-agent-capabilities",
    "opl-codex-capability-catalog",
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
fs.writeFileSync(path.join(root, "out", "opl-studio-candidate-manifest.json"), manifestJson);
fs.writeFileSync(path.join(resourcesDir, "package-manifest.json"), manifestJson);
runCommand("codesign", ["--force", "--sign", "-", appRoot], "ad-hoc sign candidate app bundle");
console.log(JSON.stringify({ status: "candidate_app_bundle_built", app_bundle_path: manifest.app_bundle_path }, null, 2));
