import path from "node:path";
import { buildRenderer } from "./build-renderer.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = path.join(root, "dist", "webui");
const metadata = buildRenderer({ outDir, htmlName: "index.html", jsName: "renderer.js" });
console.log(JSON.stringify({ status: "webui_build_passed", shared_renderer: true, ...metadata }, null, 2));
