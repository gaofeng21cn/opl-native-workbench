import {
  assertNoFalseReadyFields,
  assertRendererTestIds,
  assertSourceMarkers,
  deliverySurfaceMarkers,
  deliverySurfaceTestIds,
  read,
  readJson,
  readRendererSource,
  rendererSourcePaths,
  validateNonLiveDeliveryEvidence
} from "./native-workbench-gates.mjs";

const app = read("src/workbench/App.tsx");
const rendererSource = readRendererSource();
const model = read("src/workbench/workbenchModel.ts");
const primitiveSource = read("src/ui/workbenchPrimitives.tsx");
const moduleRegistry = read("src/renderers/moduleRegistry.ts");
const evidenceSource = read("src/candidateContractEvidence.json");
const packageScript = read("scripts/package-native-workbench.mjs");
const evidence = readJson("src/candidateContractEvidence.json");

validateNonLiveDeliveryEvidence(evidence);
assertRendererTestIds(rendererSource, deliverySurfaceTestIds(evidence), "visual source");
assertSourceMarkers(rendererSource, deliverySurfaceMarkers(evidence), "visual layout");
assertNoFalseReadyFields({
  "src/workbench/App.tsx": app,
  "src/workbench/workbenchModel.ts": model,
  "src/ui/workbenchPrimitives.tsx": primitiveSource,
  "src/renderers/moduleRegistry.ts": moduleRegistry,
  "src/candidateContractEvidence.json": evidenceSource,
  "scripts/package-native-workbench.mjs": packageScript
});

console.log(JSON.stringify({
  status: "source_visual_smoke_passed",
  source_visual_gate: true,
  inspected_sources: rendererSourcePaths,
  active_shell_adopted: false,
  release_ready: false,
  live_evidence: false
}, null, 2));
