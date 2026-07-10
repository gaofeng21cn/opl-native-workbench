import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolveAppRepoRoot } from "./resolve-app-repo-root.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const templatePath = path.join(root, "src", "renderer-shell.html");
const appRepoRoot = resolveAppRepoRoot(root);
const appLogoPath = path.join(appRepoRoot, "assets", "branding", "opl-app-logo.png");
const appBannerPath = path.join(appRepoRoot, "assets", "branding", "opl-banner.png");
const appProductProfilePath = path.join(appRepoRoot, "contracts", "app-product-profile.json");
const modelPolicySource = "one-person-lab-app/contracts/app-product-profile.json#gui.home.codex_model_display_options";
const legalReasoningEfforts = new Set(["low", "medium", "high", "xhigh", "max", "ultra"]);

function assertAsset(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing ${label}: ${filePath}`);
  }
}

function copyBranding(outDir) {
  const brandingDir = path.join(outDir, "branding");
  fs.mkdirSync(brandingDir, { recursive: true });
  assertAsset(appLogoPath, "OPL App logo");
  assertAsset(appBannerPath, "OPL App banner");
  fs.copyFileSync(appLogoPath, path.join(brandingDir, "opl-app-logo.png"));
  fs.copyFileSync(appBannerPath, path.join(brandingDir, "opl-banner.png"));
}

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`OPL App product profile ${field} must be an object`);
  }
  return value;
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`OPL App product profile ${field} must be a non-empty string`);
  }
  return value;
}

export function createCodexModelPolicy(profile) {
  const profileObject = requireObject(profile, "root");
  const defaultSession = requireObject(profileObject.default_session_profile, "default_session_profile");
  const gui = requireObject(profileObject.gui, "gui");
  const home = requireObject(gui.home, "gui.home");
  const display = requireObject(home.codex_model_display_options, "gui.home.codex_model_display_options");
  const defaultModel = requireNonEmptyString(defaultSession.model, "default_session_profile.model");
  const defaultReasoningEffort = requireNonEmptyString(
    defaultSession.reasoning_effort,
    "default_session_profile.reasoning_effort"
  );

  if (!Array.isArray(display.visible_models) || display.visible_models.length === 0) {
    throw new Error("OPL App product profile gui.home.codex_model_display_options.visible_models must be a non-empty array");
  }
  const visibleModels = display.visible_models.map((value, index) => {
    const option = requireObject(value, `gui.home.codex_model_display_options.visible_models[${index}]`);
    return {
      id: requireNonEmptyString(option.id, `gui.home.codex_model_display_options.visible_models[${index}].id`),
      label_zh: requireNonEmptyString(option.label_zh, `gui.home.codex_model_display_options.visible_models[${index}].label_zh`),
      label_en: requireNonEmptyString(option.label_en, `gui.home.codex_model_display_options.visible_models[${index}].label_en`)
    };
  });
  if (new Set(visibleModels.map((option) => option.id)).size !== visibleModels.length) {
    throw new Error("OPL App product profile visible model ids must be unique");
  }
  if (!visibleModels.some((option) => option.id === defaultModel)) {
    throw new Error("OPL App product profile default model must be included in visible_models");
  }

  if (!Array.isArray(display.user_reasoning_effort_options) || display.user_reasoning_effort_options.length === 0) {
    throw new Error("OPL App product profile user_reasoning_effort_options must be a non-empty array");
  }
  const reasoningEfforts = display.user_reasoning_effort_options.map((value, index) =>
    requireNonEmptyString(value, `gui.home.codex_model_display_options.user_reasoning_effort_options[${index}]`)
  );
  for (const effort of reasoningEfforts) {
    if (!legalReasoningEfforts.has(effort)) {
      throw new Error(`OPL App product profile contains unsupported reasoning effort: ${effort}`);
    }
  }
  if (!reasoningEfforts.includes(defaultReasoningEffort)) {
    throw new Error("OPL App product profile default reasoning effort must be included in user_reasoning_effort_options");
  }

  return {
    source: modelPolicySource,
    defaultModel,
    defaultReasoningEffort,
    visibleModels,
    reasoningEfforts
  };
}

export function readCodexModelPolicy(profilePath = appProductProfilePath) {
  assertAsset(profilePath, "OPL App product profile");
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  } catch (error) {
    throw new Error(`invalid OPL App product profile JSON at ${profilePath}: ${error instanceof Error ? error.message : error}`);
  }
  return createCodexModelPolicy(profile);
}

export function buildRenderer({
  outDir = path.join(root, "dist"),
  htmlName = "index.html",
  jsName = "renderer.js",
  format = "esm",
  scriptType = "module"
} = {}) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  copyBranding(outDir);
  const modelPolicy = readCodexModelPolicy();

  const jsPath = path.join(outDir, jsName);
  const build = spawnSync(
    "bun",
    [
      "build",
      path.join(root, "src", "main.tsx"),
      "--outfile",
      jsPath,
      "--target",
      "browser",
      "--format",
      format
    ],
    { encoding: "utf8", cwd: root }
  );
  if (build.status !== 0) {
    throw new Error(`renderer build failed\n${build.stdout}\n${build.stderr}`);
  }

  const policyScript = `<script>globalThis.__OPL_CODEX_MODEL_POLICY__=${JSON.stringify(modelPolicy).replaceAll("<", "\\u003c")};</script>`;
  const html = fs.readFileSync(templatePath, "utf8")
    .replace("<body>", `<body>\n  ${policyScript}`)
    .replace(
    "</body>",
    scriptType === "module"
      ? `  <script type="module" src="./${jsName}"></script>\n</body>`
      : `  <script src="./${jsName}"></script>\n</body>`
    );
  fs.writeFileSync(path.join(outDir, htmlName), html);
  const metadata = {
    status: "source_renderer_build_passed",
    renderer: "src/workbench/App.tsx",
    entry: "src/main.tsx",
    html: htmlName,
    script: jsName,
    format,
    scriptType,
    modelPolicySource: modelPolicy.source,
    defaultModel: modelPolicy.defaultModel,
    defaultReasoningEffort: modelPolicy.defaultReasoningEffort,
    visibleModels: modelPolicy.visibleModels.map((option) => option.id),
    reasoningEfforts: modelPolicy.reasoningEfforts
  };
  fs.writeFileSync(path.join(outDir, "renderer-build.json"), JSON.stringify(metadata, null, 2));
  return metadata;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(buildRenderer(), null, 2));
}
