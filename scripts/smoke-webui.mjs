import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const app = fs.readFileSync(path.join(root, "src/workbench/App.tsx"), "utf8");
const webTransport = fs.readFileSync(path.join(root, "src/bridge/webTransport.ts"), "utf8");
const evidence = JSON.parse(fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const value of ["window.oplNativeWorkbench", "/api/opl-events", "EventSource"]) {
  assert(webTransport.includes(value), `missing WebUI transport marker ${value}`);
}
for (const testId of evidence.page_state_matrix_mapping.runtime_testids) {
  if (testId.startsWith("opl-") && [
    "opl-workspace-rail",
    "opl-session-list",
    "opl-context-tabs",
    "opl-files-panel",
    "opl-skills-panel",
    "opl-routing-panel",
    "opl-memory-panel",
    "opl-always-on-panel",
    "opl-web-transport",
    "opl-runtime-summary",
    "opl-runtime-full-detail-button",
    "opl-runtime-action-dry-run",
    "opl-runtime-action-receipt"
  ].includes(testId)) {
    assert(app.includes(`data-testid="${testId}"`), `missing WebUI renderer test id ${testId}`);
  }
}

console.log(JSON.stringify({
  status: "webui_smoke_passed",
  shared_renderer: true,
  bridge_shape: "window.oplNativeWorkbench",
  active_shell_adopted: false
}, null, 2));
