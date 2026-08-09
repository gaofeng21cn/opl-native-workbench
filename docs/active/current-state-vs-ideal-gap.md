# OPL Native Workbench Current State And Manual Evaluation Policy

Owner: `one-person-lab-app`
Purpose: `single_active_truth_plan`
State: `active_technical_evaluation_reference`
Machine boundary: This document owns the candidate's current human-readable
status, remaining owner/evidence gaps, and next Agent prompt. It does not own App
product truth, Framework runtime/package truth, Codex thread truth, domain
authority, release adoption, or production readiness.

## Target State

Native remains a thin, maintainable foreground alternative shell that can
implement App-owned GUI contracts through the same Framework state/action and
Codex App Server boundaries without becoming another product, runtime, package,
thread, or domain authority.

Native is available for bounded manual experiments, improvements, and focused
tests when useful. It is not a required mainline task, parity program, scheduled
workstream, release blocker, or product-completion obligation. AionUI remains
the active release shell. Product expansion or adoption requires a separate App
owner decision and corresponding App contract delta.

## Current State Summary

| Theme | Current state | Boundary |
| --- | --- | --- |
| App role | `foreground_alternative_candidate` | App candidate registry owns the role; local selection does not imply adoption |
| Active release shell | `aionui` | Only the App shell adapter can change this |
| Candidate work policy | `manual_on_demand_non_periodic_technical_evaluation` | Bounded evaluation may proceed manually; there is no parity, schedule, or completion obligation |
| Mainline obligation | `false` | Native gaps do not enter required App backlog or release gates |
| Renderer/hosts | `source_implemented_candidate_evidence` | Native and WebUI target one renderer/bridge shape; live equivalence is not proven |
| AionCore dependency | `false` | Native starts Codex App Server directly and consumes only Framework App state/action contracts |
| Enabled carrier | `codex_app_server_stdio` | The candidate has one runtime carrier and one App Server child per window |
| Reserved carriers | `pi`, `hermes` disabled | Interface names only; no dependency, process, fallback, or UI path is enabled |
| Thread/history | `codex_app_server_owned` | Candidate consumes thread/turn APIs and keeps only UI metadata/drafts locally |
| Shared directory | `codex_state_db_overview` | Uses `thread/list useStateDbOnly=true` and opens history by the same canonical thread ID |
| Codex subagents | `read_only_app_server_projection` | Lineage, role, nickname, source kind, tool-call, and activity items are displayed without owning scheduling |
| Private cross-thread layer | `removed_non_goal` | No proposal/dispatch/wait protocol, host queue, ledger, bilateral receipt, or dynamic-tool bridge remains |
| OPL state/actions | `app_framework_consumer` | Reads App state and dispatches owner action refs; no internal-state or package-truth ownership |
| Local launcher | `implemented_candidate_path` | Isolated bundle; actions dry-run-only by default |
| Validation | `repo_native_structural_gates_present` | Tests/build/package/smoke prove only their exact layers |
| Adoption and readiness | `false` | No active-shell adoption, release, clean-VM, domain, owner-acceptance, or production claim |

## Current Gaps

| Gap | Class | Owner route | Stop condition |
| --- | --- | --- | --- |
| App contract currentness must be re-read before any change | `structural_currentness_gate` | App contracts and GUI docs | Stop if the candidate write set conflicts with a newer App decision or active owner lane |
| Selected manual evaluation needs bounded acceptance | `evaluation_scope_gate` | Current manual task | Test only the selected hypothesis; do not turn all known conformance gaps into a required backlog |
| Adoption, clean-VM, same-cohort live parity, and release proof are absent | `non_blocking_candidate_evidence_gap` | App release owner and owning runtime/release surfaces | Do not promote docs/tests/package/local smoke to readiness; absence does not block App mainline |

Remote cross-machine coordination, model-driven permission/write-set decisions,
private thread runtimes, and candidate-owned delivery ledgers are explicitly not
open product gaps. Their implementation surfaces have been removed and must not
be resurrected from history. AionUI Team remains a separate multi-executor shell
facility; Codex-native subagent display continues through App Server truth and
does not depend on Team mode.

## Next-Round Agent Prompt

### Goal

For a manual Native evaluation or improvement, reconcile only the smallest
selected hypothesis to current App contracts while preserving the thin consumer
boundary. Do not create a general parity program or expand the task merely to
close unrelated known gaps.

### Write Scope

- `opl-native-workbench` source, tests, and existing docs only for the explicitly
  authorized candidate delta;
- `one-person-lab-app` contracts/docs/tests only when the App owner decision
  explicitly includes that write set;
- this Active Truth plan for current status, remaining gaps, and the next prompt.

### Non-goals And Forbidden Scope

- no active-shell switch, release-channel change, or readiness claim without
  App owner adoption;
- no second product model, model catalog, package registry, thread/history
  store, permission control plane, runtime truth, domain truth, or artifact
  authority;
- no revival of cross-host handoff, dynamic-tool product requirements, or
  private delivery ledgers merely because experimental source exists;
- no conflation of AionUI Team executor orchestration with Codex App Server
  subagent lineage and activity projection;
- no AionUI, Hermes, AGUI, K-Dense, Open Science, or Codex source/brand vendoring.

### Live Truth Inputs

- fresh branch/head, dirty, worktree, ahead/behind, remote, and owner/write-set
  gates for Native and any App write set;
- App `contracts/app-shell-candidates.json`, `app-shell-adapter.json`,
  `app-gui-product-contract.json`, product profile, page-state matrix, and
  Native candidate plan from current `main`;
- Framework `opl app state --profile fast --json` and action-contract shapes;
- Codex App Server protocol/model-list behavior required by the authorized
  delta;
- current Native source, `src/candidateContractEvidence.json`, tests, package
  scripts, and verification guide.

### Required Actions

1. Confirm the manual task names a bounded technical hypothesis and focused
   acceptance surface; product expansion or adoption additionally requires an
   App owner decision and App contract delta.
2. Classify the requested delta as App product truth, Framework contract,
   candidate implementation, or evidence-only work.
3. Update the owner surface first, then the smallest candidate implementation
   and focused tests.
4. Preserve App state/action, Codex thread, package, domain, and false-ready
   boundaries.
5. Remove or rewrite any closed gap here and keep historical implementation
   detail out of active docs.

### Verification Commands

- `npm test` in the Native repository with the current App checkout available;
- `npm run validate:candidate:native` in the App repository when its mounted
  candidate checkout points at the tested bytes;
- OPL Doc doctor against each changed repository as a risk map;
- tracked Markdown relative-link scan;
- `git diff --check`;
- `npm run smoke:native-live` only when the authorized delta affects packaged
  local-window behavior.

### Completion Gate

- the authorized delta is implemented in its owner surface and smallest
  candidate write set;
- App and Native contracts/docs agree, with AionUI still active unless an
  explicit adoption change passed its own gates;
- no source/test/docs evidence is promoted to runtime, release, domain, owner,
  or production readiness;
- final changed bytes are verified after absorption to each root `main`, and
  task worktrees/branches are removed.

### Foldback Target

- candidate role/adoption returns to App contracts and GUI docs;
- stable implementation boundary returns to `docs/architecture.md`;
- command meaning returns to `docs/verification.md`;
- current status, remaining owner/evidence gaps, and the next prompt return only
  to this file.
