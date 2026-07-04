import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const evidence = JSON.parse(fs.readFileSync(path.join(root, "src/candidateContractEvidence.json"), "utf8"));
const stateModel = evidence.active_project_line_state_model;

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

console.log(JSON.stringify({
  status: "state_model_valid",
  consumed_projection: stateModel.consumed_projection,
  forbidden_claims: stateModel.forbidden_claims
}, null, 2));
