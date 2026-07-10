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

function readCodexModelPolicy() {
  assertAsset(appProductProfilePath, "OPL App product profile");
  const profile = JSON.parse(fs.readFileSync(appProductProfilePath, "utf8"));
  const display = profile.gui?.home?.codex_model_display_options;
  const policy = {
    source: "one-person-lab-app/contracts/app-product-profile.json#gui.home.codex_model_display_options",
    defaultModel: profile.default_session_profile?.model,
    defaultReasoningEffort: profile.default_session_profile?.reasoning_effort,
    visibleModels: display?.visible_models,
    reasoningEfforts: display?.user_reasoning_effort_options
  };
  if (policy.defaultModel !== "gpt-5.6-sol" || policy.defaultReasoningEffort !== "ultra") {
    throw new Error("OPL App product profile must default to gpt-5.6-sol with ultra reasoning");
  }
  const expectedModels = "gpt-5.6-sol,gpt-5.6-terra,gpt-5.6-luna,gpt-5.5,gpt-5.4,gpt-5.4-mini,gpt-5.2";
  if (!Array.isArray(policy.visibleModels) || policy.visibleModels.map((option) => option.id).join(",") !== expectedModels) {
    throw new Error("OPL App product profile must provide the ordered seven-model Codex allowlist");
  }
  if (!Array.isArray(policy.reasoningEfforts) || policy.reasoningEfforts.join(",") !== "low,medium,high,xhigh,ultra") {
    throw new Error("OPL App product profile must provide low, medium, high, xhigh, and ultra reasoning");
  }
  return policy;
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
