import fs from "node:fs";
import path from "node:path";

export const root = path.resolve(new URL("..", import.meta.url).pathname);

export const requiredDeliverySurfaceKeys = [
  "artifact_preview_tabs",
  "provenance_drawer",
  "starter_forms",
  "agent_package_lifecycle",
  "confirmation_interview_cards",
  "renderer_module_registry",
  "delivery_mode",
  "export_action"
];

export const rendererSourcePaths = [
  "src/workbench/App.tsx",
  "src/ui/workbenchPrimitives.tsx",
  "src/renderers/moduleRegistry.ts"
];

const falseReadyFields = [
  "active_shell_adopted",
  "release_ready",
  "production_ready",
  "domain_ready",
  "clean_vm_ready",
  "full_release_ready",
  "live_evidence",
  "owner_receipt",
  "package_truth_owned",
  "runtime_authority_transfer",
  "domain_truth_owned",
  "fallback_runtime_ready",
  "placeholder_action_can_execute",
  "simulated_ready_claim"
];

export function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

export function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

export function readRendererSource() {
  return rendererSourcePaths.map((relativePath) => read(relativePath)).join("\n");
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateNonLiveDeliveryEvidence(evidence) {
  assert(evidence.non_live_delivery_surface, "missing non_live_delivery_surface");
  for (const key of requiredDeliverySurfaceKeys) {
    const surface = evidence.non_live_delivery_surface[key];
    assert(surface, `missing non-live UI evidence ${key}`);
    assert(surface.capability && evidence.capabilities.includes(surface.capability), `missing capability for ${key}`);
    assert(surface.status_field, `missing status field for ${key}`);
    assert(Array.isArray(surface.renderer_testids) && surface.renderer_testids.length > 0, `missing renderer testids for ${key}`);
    assert(Array.isArray(surface.layout_markers) && surface.layout_markers.length > 0, `missing layout markers for ${key}`);
    assert(surface.live_evidence === false, `${key} must remain non-live evidence`);
  }

  const boundary = evidence.false_ready_boundary;
  assert(boundary, "missing false_ready_boundary");
  for (const field of falseReadyFields) {
    assert(field in boundary, `missing false-ready boundary field ${field}`);
    assert(boundary[field] === false, `${field} must be false`);
  }
  assert(Array.isArray(boundary.forbidden_true_fields), "missing forbidden_true_fields");
  for (const field of ["active_shell_adopted", "release_ready", "live_evidence"]) {
    assert(boundary.forbidden_true_fields.includes(field), `missing false-ready forbidden field ${field}`);
  }

  const ossPolicy = evidence.reused_oss_module_policy;
  assert(ossPolicy, "missing reused_oss_module_policy");
  assert(ossPolicy.copied_source === false, "reused OSS policy must not copy source");
  assert(ossPolicy.runtime_authority_transfer === false, "reused OSS policy must not transfer runtime authority");
  assert(ossPolicy.user_visible_protocol_copy === false, "reused OSS policy must not copy protocol UI");
}

export function deliverySurfaceTestIds(evidence) {
  return [...new Set(requiredDeliverySurfaceKeys.flatMap((key) => evidence.non_live_delivery_surface[key].renderer_testids))];
}

export function deliverySurfaceMarkers(evidence) {
  return [...new Set(requiredDeliverySurfaceKeys.flatMap((key) => evidence.non_live_delivery_surface[key].layout_markers))];
}

export function deliverySurfaceStatuses(evidence) {
  return Object.fromEntries(
    requiredDeliverySurfaceKeys.map((key) => [evidence.non_live_delivery_surface[key].status_field, "passed"])
  );
}

export function assertRendererTestIds(source, testIds, context = "renderer") {
  for (const testId of testIds) {
    assert(source.includes(`data-testid="${testId}"`), `missing ${context} test id ${testId}`);
  }
}

export function assertSourceMarkers(source, markers, context = "source") {
  for (const marker of markers) {
    assert(source.includes(marker), `missing ${context} marker ${marker}`);
  }
}

export function assertNoFalseReadyFields(namedSources) {
  for (const [name, source] of Object.entries(namedSources)) {
    for (const field of falseReadyFields) {
      const pattern = new RegExp(`["']?${field}["']?\\s*:\\s*true\\b`);
      assert(!pattern.test(source), `${name} must not set ${field}=true`);
    }
  }
}

export function assertFallbackBoundaryDowngrades(namedSources) {
  const app = namedSources["src/workbench/App.tsx"] ?? "";
  const bridge = namedSources["src/bridge/oplBridge.ts"] ?? "";
  const model = namedSources["src/workbench/workbenchModel.ts"] ?? "";

  assert(!app.includes("Context ready"), "fallback UI must not display Context ready");
  assert(!app.includes('status="connected"'), "fallback UI must not display connected status");
  assert(!app.includes(': "Ready"'), "composer idle state must not display Ready");
  for (const marker of ["App state loaded", "Preview only", "Bridge unavailable"]) {
    assert(app.includes(marker), `fallback UI missing downgrade marker ${marker}`);
  }

  assert(!bridge.includes('canExecute: receiptKind !== "confirmation_required"'), "placeholder receipt must not be executable by default");
  assert(bridge.includes("bridge_unavailable_placeholder"), "placeholder receipt must expose bridge unavailable boundary");
  assert(bridge.includes("preview_only_no_native_action_record"), "placeholder receipt must expose preview-only boundary");
  assert(!bridge.includes("Simulated Codex app-server reply from browser placeholder."), "simulated browser reply must be preview-only");

  assert(!model.includes('if (/ready|completed|complete|healthy|available/.test(text)) return "ready";'), "artifactStatus must not upgrade generic ready text");
  for (const marker of ["nonReadyBoundaryStatusPattern", "explicitReadyStatusPattern", '"app_canonical"']) {
    assert(model.includes(marker), `artifactStatus missing downgrade marker ${marker}`);
  }
}
