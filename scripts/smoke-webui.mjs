import {
  assert,
  assertRendererTestIds,
  deliverySurfaceTestIds,
  read,
  readJson,
  readRendererSource,
  validateNonLiveDeliveryEvidence
} from "./native-workbench-gates.mjs";

const rendererSource = readRendererSource();
const webTransport = read("src/bridge/webTransport.ts");
const evidence = readJson("src/candidateContractEvidence.json");
validateNonLiveDeliveryEvidence(evidence);

for (const value of ["window.oplNativeWorkbench", "/api/opl-events", "EventSource"]) {
  assert(webTransport.includes(value), `missing WebUI transport marker ${value}`);
}
const webuiRendererTestIds = [
  ...evidence.page_state_matrix_mapping.runtime_testids,
  ...deliverySurfaceTestIds(evidence)
].filter((testId) => testId.startsWith("opl-"));
assertRendererTestIds(rendererSource, webuiRendererTestIds, "WebUI renderer");

console.log(JSON.stringify({
  status: "webui_smoke_passed",
  shared_renderer: true,
  bridge_shape: "window.oplNativeWorkbench",
  covered_testids: webuiRendererTestIds.length,
  active_shell_adopted: false
}, null, 2));
