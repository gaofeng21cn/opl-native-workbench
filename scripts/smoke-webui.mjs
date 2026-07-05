import {
  assert,
  assertRendererTestIds,
  root,
  deliverySurfaceTestIds,
  read,
  readJson,
  readRendererSource,
  validateNonLiveDeliveryEvidence
} from "./native-workbench-gates.mjs";
import { buildRenderer } from "./build-renderer.mjs";

const rendererSource = readRendererSource();
const webTransport = read("src/bridge/webTransport.ts");
const evidence = readJson("src/candidateContractEvidence.json");
validateNonLiveDeliveryEvidence(evidence);
const webuiOutDir = `${root}/dist/webui`;
buildRenderer({ outDir: webuiOutDir, htmlName: "index.html", jsName: "renderer.js" });

for (const value of ["window.oplNativeWorkbench", "/api/opl-events", "EventSource"]) {
  assert(webTransport.includes(value), `missing WebUI transport marker ${value}`);
}
const webuiRendererTestIds = [
  ...evidence.page_state_matrix_mapping.runtime_testids,
  ...deliverySurfaceTestIds(evidence)
].filter((testId) => testId.startsWith("opl-"));
assertRendererTestIds(rendererSource, webuiRendererTestIds, "WebUI renderer");
const html = read("dist/webui/index.html");
const bundle = read("dist/webui/renderer.js");
for (const marker of ['<div id="root"></div>', './renderer.js', 'branding/opl-app-logo.png']) {
  assert(html.includes(marker), `missing WebUI HTML marker ${marker}`);
}
for (const marker of ["opl-native-workbench-root", "window.oplNativeWorkbench", "/api/opl-events"]) {
  assert(bundle.includes(marker), `missing WebUI renderer marker ${marker}`);
}

console.log(JSON.stringify({
  status: "webui_smoke_passed",
  shared_renderer: true,
  bridge_shape: "window.oplNativeWorkbench",
  covered_testids: webuiRendererTestIds.length,
  active_shell_adopted: false
}, null, 2));
