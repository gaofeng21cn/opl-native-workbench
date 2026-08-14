# OPL Studio Current State And Pre-Adoption Development Policy

Owner: `one-person-lab-app`
Purpose: `single_active_truth_plan`
State: `active_product_development_reference`
Machine boundary: This document owns the product implementation's current human-readable
status, remaining owner/evidence gaps, and next Agent prompt. It does not own App
product truth, Framework runtime/package truth, Codex thread truth, domain
authority, release adoption, or production readiness.

## Target State

Studio is the internal repository and development codename for the thin,
maintainable first-party implementation of the One Person Lab Native GUI. The
product UI presents only `One Person Lab`. It directly reuses the pinned
DeepSeek Harness App frame, navigation, conversation, composer, Settings,
theme, and queue source as its visual and interaction baseline, then composes
OPL-owned capabilities through typed contribution boundaries.

The implementation has one React renderer, Swift/AppKit + WKWebView on macOS,
and a Node HTTP/SSE OPL Workspace host. Both start Codex CLI App Server directly
and consume Framework state/action contracts without AionUI/AionCore, a
multi-backend abstraction, or a second thread/session store.

Native development is required against the App-owned minimum-complete product
contract. It must preserve the necessary user outcomes of the current AionUI
mainline, but inherited AionUI provider, Team, AionCore, second scheduler, and
custom assistant-catalog surfaces are not parity targets. AionUI remains the
active release shell until Native is complete, passes separate App-owner
release admission, and is explicitly adopted.

## Current State Summary

| Theme | Current state | Boundary |
| --- | --- | --- |
| App role | `first_party_native_successor_implementation` | App product profile owns the role; local selection does not imply mainline or release adoption |
| Active release shell | `aionui` | Only the App shell adapter can change this |
| Product work policy | `active_product_development_release_admission_separate` | Minimum-complete OPL outcomes are required; full AionUI parity and implicit release are not |
| Current mainline | `false` | AionUI remains the only mainline until Studio completes and passes separate release qualification |
| Product completion obligation | `true` | Minimum-complete Native gaps enter the App development backlog without blocking the current AionUI release |
| DSH GUI baseline | `pinned_source_reuse_implemented` | App frame, navigation, conversation, composer, Settings, theme, and queue are reused from the pinned MIT upstream source; OPL features enter through composition/adapters |
| Product brand | `one_person_lab_only` | `OPL Studio` remains an internal repo/codename and is not a user-facing product brand or logo |
| Renderer/hosts | `source_implemented_candidate_evidence` | Native macOS and Workspace evaluate one OPL renderer/bridge shape; packaged and Web smoke pass, but release-cohort equivalence is not proven |
| macOS host | `swift_appkit_wkwebview` | Electron is not required or packaged for the candidate |
| Workspace host | `node_http_sse` | Candidate WebUI starts Codex App Server directly; no Electron/AionCore or Desktop database |
| Cross-platform delivery | `not_candidate_obligation` | Electron/Tauri selection and Windows/Linux acceptance require a future owner decision |
| AionUI/AionCore dependency | `false` | Native starts Codex App Server directly and consumes only Framework App state/action contracts |
| Enabled carrier | `codex_app_server_stdio` | The candidate has one runtime carrier and one App Server child per native window or Web host |
| Reserved carriers | `pi`, `hermes` disabled | Interface names only; no dependency, process, fallback, or UI path is enabled |
| Thread/history | `codex_app_server_owned` | Candidate consumes thread/turn APIs and keeps only UI metadata/drafts locally |
| Shared directory | `codex_state_db_overview` | Uses `thread/list useStateDbOnly=true` and opens history by the same canonical thread ID |
| Codex subagents | `read_only_app_server_projection` | Lineage, role, nickname, source kind, tool-call, and activity items are displayed without owning scheduling |
| Private cross-thread layer | `removed_non_goal` | No proposal/dispatch/wait protocol, host queue, ledger, bilateral receipt, or dynamic-tool bridge remains |
| OPL state/actions | `app_framework_consumer` | Reads App state and dispatches owner action refs; no internal-state or package-truth ownership |
| Conversation | `chat_first_with_on_demand_detail` | Primary surface is the DSH conversation; run status, roadmap/detail contributions, files, and results open on demand instead of becoming static home cards |
| Standard Agents | `typed_dynamic_selection` | Composer separates OPL-owned `standard_agent` packages from skills/plugins/connections and requires selectable readiness plus a real Codex route |
| Active turn | `direct_steer_with_renderer_queue` | Active submissions use Codex `turn/steer`; the DSH queue is temporary renderer state and is not a second persistent scheduler or queue |
| Settings | `minimum_complete_control_plane_wired` | Account/Gateway, model, resources, working directory, storage, Agents, capabilities, instructions, services, updates, diagnostics, preferences, and About consume typed owner actions |
| Updates | `separate_app_base_packages_model` | Base and Packages use Framework managed-update actions; App update uses the native-host updater ABI and currently reports truthful carrier unavailability |
| Run detail | `identity_scoped_composition` | Agent activity, work status, runtime detail, files, and results are scoped to the active thread/work item; unknown modules degrade locally |
| Local launcher | `implemented_candidate_path` | Isolated bundle; actions dry-run-only by default |
| Validation | `repo_native_structural_gates_present` | Tests/build/package/smoke prove only their exact candidate layers |
| Adoption and readiness | `false` | No active-shell adoption, release, clean-VM, domain, owner-acceptance, or production claim |

## Current Gaps

| Gap | Class | Owner route | Stop condition |
| --- | --- | --- | --- |
| App contract currentness must be re-read before any change | `structural_currentness_gate` | App contracts and GUI docs | Stop if the candidate write set conflicts with a newer App decision or active owner lane |
| Native App update carrier is not packaged | `release_admission_p0` | App release producer plus Native host/package owner | Produce a dedicated signed/notarized Native artifact and signed feed, integrate one native updater engine, and prove check/download/apply/restart/version readback; do not consume the active AionUI `latest-mac.yml` |
| Framework producer must reach canonical SSOT | `cross_repo_integration_gate` | Framework UI contribution and managed-update producer | Fresh-replay Base check/apply, `runtime.detail`, disabled-package filtering, and standard-Agent route projection, then pass producer-consumer conformance |
| App product SSOT must absorb the final baseline | `cross_repo_integration_gate` | App contracts/docs/tests | Keep necessary-outcome parity, Agent admission, Settings destinations, update ownership, and AionUI-to-Native adoption conditions aligned with the tested candidate |
| Windows/Linux wrapper is not selected | `future_product_decision_not_candidate_gap` | Future cross-platform carrier owner | Do not add Electron/Tauri or claim support in this candidate task |
| Adoption, clean-VM, same-cohort live parity, and release proof are absent | `non_blocking_candidate_evidence_gap` | App release owner and owning runtime/release surfaces | Do not promote docs/tests/package/local smoke to readiness; absence does not block App mainline |

Remote cross-machine coordination, model-driven permission/write-set decisions,
private thread runtimes, and candidate-owned delivery ledgers are explicitly not
open product gaps. Their implementation surfaces have been removed and must not
be resurrected from history. AionUI Team remains a separate multi-executor shell
facility; Codex-native subagent display continues through App Server truth and
does not depend on Team mode.

## Next-Round Agent Prompt

### Goal

For Native product development, close the native updater release-admission
slice and the remaining cross-repository producer/consumer admission against
current App contracts while preserving the Codex-only thin-consumer boundary.
Do not reproduce AionUI-only inherited surfaces, create a speculative
multi-backend framework, or start an unrelated cross-platform delivery
workstream.

### Write Scope

- `opl-studio` source, tests, and existing docs only for the explicitly
  authorized candidate delta;
- `one-person-lab-app` contracts/docs/tests only when the App owner decision
  explicitly includes that write set;
- this Active Truth plan for current status, remaining gaps, and the next prompt.

### Non-goals And Forbidden Scope

- no active-shell switch, release-channel change, Windows/Linux support, or readiness claim without
  App owner adoption;
- no second product model, model catalog, package registry, thread/history
  store, permission control plane, runtime truth, domain truth, or artifact
  authority;
- no revival of cross-host handoff, dynamic-tool product requirements, or
  private delivery ledgers merely because experimental source exists;
- no conflation of AionUI Team executor orchestration with Codex App Server
  subagent lineage and activity projection;
- no AionUI/AionCore runtime dependency or provider/session abstraction;
- no Electron/Tauri dependency before the cross-platform carrier decision;
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

1. Land Framework Base update, `runtime.detail`, disabled-package filtering,
   and standard-Agent route projection on fresh canonical `main`.
2. Run Framework-to-Native producer-consumer conformance and verify that only
   selectable OPL standard Agents with a real Codex route enter the dedicated
   composer group.
3. Absorb the tested Native and App contract bytes to their canonical `main`
   branches and read back exact remote commits/trees.
4. Treat the Native signed updater carrier as the only remaining release-
   admission implementation slice; keep `native_updater_not_packaged` truthful
   until that carrier and post-restart version proof exist.
5. Preserve App state/action, Codex thread, package, domain, and false-ready
   boundaries, and keep AionUI active until explicit adoption.

### Verification Commands

- `npm test` in the Native repository with the current App checkout available;
- `npm run validate:candidate:native` in the App repository when its mounted
  candidate checkout points at the tested bytes;
- OPL Flow-bundled `$opl-doc` semantic governance against each changed
  repository as a risk map;
- tracked Markdown relative-link scan;
- `git diff --check`;
- `npm run smoke:native-live` only when the authorized delta affects packaged
  local-window behavior.

### Completion Gate

- the authorized delta is implemented in its owner surface and smallest
  candidate write set;
- App and Native contracts/docs agree, with AionUI still the current release shell unless an
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
