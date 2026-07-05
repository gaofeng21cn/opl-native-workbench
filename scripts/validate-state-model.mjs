import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const evidence = JSON.parse(fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8"));
const stateModel = evidence.active_project_line_state_model;
const workbenchModelSource = fs.readFileSync(path.join(root, "src/workbench/workbenchModel.ts"), "utf8");

const requiredFields = [
  "status",
  "active_run_id",
  "next_visible_step",
  "progress_delta_classification",
  "deliverable_progress_delta",
  "platform_repair_delta",
  "next_forced_delta"
];
const forbiddenClaims = [
  "domain_ready",
  "production_ready",
  "clean_vm_ready",
  "full_release_ready",
  "active_shell_adopted"
];
const fakeStarterActionIds = [
  "starter.mas.dry_run",
  "starter.mag.dry_run",
  "starter.rca.dry_run",
  "starter.bookforge.dry_run"
];
const requiredStarterActionRefs = [
  "task_action_receipt_preview",
  "task_export_bundle_preview",
  "workspace_ensure",
  "settings_sync_capabilities"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(stateModel?.authority === "opl_framework_active_project_line_projection", "state model authority mismatch");
assert(stateModel.validation_command === "npm run validate:state-model", "state model validation command mismatch");
assert(stateModel.consumed_projection === "opl app state --profile fast --json active_project_lines", "state model projection mismatch");
for (const field of requiredFields) {
  assert(stateModel.required_fields.includes(field), `missing required state field ${field}`);
}
for (const claim of forbiddenClaims) {
  assert(stateModel.forbidden_claims.includes(claim), `missing forbidden claim ${claim}`);
}

const starterPolicy = evidence.starter_action_ref_policy;
assert(starterPolicy?.authority === "opl app state --profile fast --json actions", "starter action policy authority mismatch");
assert(Array.isArray(starterPolicy.required_live_action_refs), "starter action policy missing required live refs");
assert(Array.isArray(starterPolicy.fake_starter_action_ids_rejected), "starter action policy missing fake starter rejects");
for (const actionRef of requiredStarterActionRefs) {
  assert(starterPolicy.required_live_action_refs.includes(actionRef), `missing starter live action ref ${actionRef}`);
  assert(workbenchModelSource.includes(actionRef), `workbench model missing starter action ref ${actionRef}`);
}
for (const fakeActionId of fakeStarterActionIds) {
  assert(starterPolicy.fake_starter_action_ids_rejected.includes(fakeActionId), `missing fake starter reject ${fakeActionId}`);
  const markerRequirements = JSON.stringify(evidence.source_marker_requirements ?? {});
  assert(!markerRequirements.includes(fakeActionId), `source marker requirements still accept fake starter action ${fakeActionId}`);
  const escapedFakeActionId = fakeActionId.replaceAll(".", "\\.");
  const fallbackBlock = new RegExp(
    `dryRunAction:\\s*"${escapedFakeActionId}"[\\s\\S]{0,180}available:\\s*false[\\s\\S]{0,180}status:\\s*"fallback_unavailable_fake_action_id"`,
    "m"
  );
  assert(fallbackBlock.test(workbenchModelSource), `fake starter action ${fakeActionId} must only remain as unavailable fallback`);
  const readyRoute = new RegExp(
    `(previewActionId:\\s*"${escapedFakeActionId}"|status:\\s*"[^"]*ready[^"]*"[\\s\\S]{0,220}dryRunAction:\\s*"${escapedFakeActionId}")`,
    "m"
  );
  assert(!readyRoute.test(workbenchModelSource), `fake starter action ${fakeActionId} is still presented as ready route`);
}

console.log(JSON.stringify({
  status: "state_model_valid",
  consumed_projection: stateModel.consumed_projection,
  forbidden_claims: stateModel.forbidden_claims,
  starter_action_ref_policy: "real_app_action_refs_required"
}, null, 2));
