import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const templatePath = path.join(root, "src", "renderer-shell.html");
const appRepoRoot = path.resolve(process.env.OPL_APP_REPO_ROOT ?? path.join(root, "..", "one-person-lab-app"));
const appLogoPath = path.join(appRepoRoot, "assets", "branding", "opl-app-logo.png");
const appBannerPath = path.join(appRepoRoot, "assets", "branding", "opl-banner.png");

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

export function buildRenderer({
  outDir = path.join(root, "dist"),
  htmlName = "index.html",
  jsName = "renderer.js"
} = {}) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  copyBranding(outDir);

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
      "esm"
    ],
    { encoding: "utf8", cwd: root }
  );
  if (build.status !== 0) {
    throw new Error(`renderer build failed\n${build.stdout}\n${build.stderr}`);
  }

  const html = fs.readFileSync(templatePath, "utf8").replace(
    "</body>",
    `  <script type="module" src="./${jsName}"></script>\n</body>`
  );
  fs.writeFileSync(path.join(outDir, htmlName), html);
  const metadata = {
    status: "source_renderer_build_passed",
    renderer: "src/workbench/App.tsx",
    entry: "src/main.tsx",
    html: htmlName,
    script: jsName
  };
  fs.writeFileSync(path.join(outDir, "renderer-build.json"), JSON.stringify(metadata, null, 2));
  return metadata;
}

console.log(JSON.stringify(buildRenderer(), null, 2));
