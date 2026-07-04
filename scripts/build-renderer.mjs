import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = path.join(root, "dist");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "renderer-build.json"),
  JSON.stringify({ status: "source_renderer_build_passed", renderer: "src/workbench/App.tsx" }, null, 2)
);
console.log(JSON.stringify({ status: "source_renderer_build_passed" }, null, 2));
