import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const evidence = JSON.parse(fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8"));
const stateModel = evidence.active_project_line_state_model;
const liveDerivationPolicy = evidence.workbench_model_live_derivation;
const workbenchModelSource = fs.readFileSync(path.join(root, "src/workbench/workbenchModel.ts"), "utf8");
const sampleStatePath = "/tmp/opl-native-workbench-state-final.json";
const sampleState = JSON.parse(fs.readFileSync(sampleStatePath, "utf8"));

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

function getPath(rootValue, dottedPath) {
  return dottedPath.split(".").reduce((current, part) => {
    if (current && typeof current === "object" && part in current) return current[part];
    return undefined;
  }, rootValue);
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

assert(liveDerivationPolicy?.authority === "opl app state --profile fast --json", "live derivation authority mismatch");
assert(fs.existsSync(sampleStatePath), `missing sample state file ${sampleStatePath}`);
for (const projection of liveDerivationPolicy.required_projections ?? []) {
  assert(getPath(sampleState, projection) != null, `sample state missing required projection ${projection}`);
}
for (const marker of [
  "settings_control_center",
  "task_drilldowns",
  "current_owner_delta_next_action",
  "action_receipt",
  "artifact_or_blocker",
  "review_receipt"
]) {
  assert(workbenchModelSource.includes(marker), `workbench model missing live derivation marker ${marker}`);
}

const taskDrilldowns = getPath(sampleState, "app_state.operator.workbench.task_drilldowns");
assert(Array.isArray(taskDrilldowns) && taskDrilldowns.length > 0, "sample state missing operator task drilldowns");
const domainTasks = taskDrilldowns.filter((task) => task && typeof task === "object" && task.task_id === task.domain_id);
for (const domainId of liveDerivationPolicy.required_task_domains_for_starters ?? []) {
  const task = domainTasks.find((item) => item.domain_id === domainId);
  assert(task, `sample state missing starter domain task ${domainId}`);
  assert(task.action_receipt?.preview_ref, `starter domain task ${domainId} missing action preview ref`);
  assert(
    task.artifact_or_blocker?.export_bundle_refs?.length || task.artifact_or_blocker?.export_ref,
    `starter domain task ${domainId} missing export bundle refs`
  );
}

console.log(JSON.stringify({
  status: "state_model_valid",
  consumed_projection: stateModel.consumed_projection,
  forbidden_claims: stateModel.forbidden_claims,
  starter_action_ref_policy: "real_app_action_refs_required",
  live_derivation: "actions_modules_operator_settings_control_center"
}, null, 2));
