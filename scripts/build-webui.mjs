import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = path.join(root, "dist", "webui");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), "<div id=\"root\"></div>\n");
console.log(JSON.stringify({ status: "webui_build_passed", shared_renderer: true }, null, 2));
