import path from "node:path";
import { buildRenderer } from "./build-renderer.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = path.join(root, "dist", "desktop");
const metadata = buildRenderer({ outDir, htmlName: "index.html", jsName: "renderer.js" });
console.log(JSON.stringify({ status: "desktop_renderer_build_passed", shared_renderer: true, ...metadata }, null, 2));
