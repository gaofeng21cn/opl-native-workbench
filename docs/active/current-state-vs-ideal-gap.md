# OPL Studio Current State And Pre-Adoption Development Policy

Studio is the DSH-derived candidate Shell for the single OPL App product. The
current release Shell remains AionUI until the App-owned adapter and release
gates switch. All candidate evidence in this document is scoped to Studio bytes
and must not be read as active-shell, App-release, or production evidence.

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
DeepSeek Harness App frame, workspace browser, conversation, composer, Agent
preset, model selection, Settings, theme, and queue source as its visual and
interaction baseline. DSH-owned typography, spacing, layout, colors, state, and
interaction stay unchanged; OPL adds only product identity, real data, App
policy, and typed contribution adapters outside the vendor root.

The implementation has one React renderer and one shared Node host core.
Electron packages them for macOS, Windows, and Linux, while a thin HTTP/SSE
adapter exposes standalone WebUI and headless operation. Every carrier starts
Codex CLI App Server directly and consumes Framework state/action contracts
without AionUI/AionCore, a multi-backend abstraction, or a second thread/session
store. The successor Docker carrier uses the same WebUI/host core and never runs
Electron.

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
| DSH GUI baseline | `pinned_source_reuse_implemented` | App frame, navigation, workspace/session tree, conversation, composer, Agent preset, model selection, Settings, theme, and queue are reused byte-identically from the pinned MIT upstream source; OPL keeps no parallel visual system |
| Product brand | `one_person_lab_only` | `OPL Studio` remains an internal repo/codename and is not a user-facing product brand or logo |
| Renderer/hosts | `shared_renderer_and_node_host_core_implemented` | Electron IPC and HTTP/SSE adapt one host core and one renderer; release-cohort equivalence is not proven |
| Desktop host | `electron_hosted_installer_native_api_accessibility_baseline` | macOS directory packaging is proven locally; hosted Windows x64 and Linux x64 build two unsigned package cohorts and prove install/update/rollback/uninstall of NSIS and DEB with exact running-version, state-preservation, and process-bound UIA/AT-SPI tree readback. DEB is the only admitted Linux native carrier; AppImage is rejected because its sandbox requirements conflict with direct portable execution on Ubuntu 24.04. Dedicated clean-VM, NVDA/Orca experience, signing, release, and platform support remain unqualified |
| Headless/WebUI host | `posix_user_service_qualification_wired` | Candidate WebUI starts Codex App Server directly. Formal install/status/stop/start/restart/update/rollback/uninstall commands manage only the current user's launchd or systemd service. The hosted jobs bind exact pinned runtime paths, readiness and App-state readback, then prove native service-definition and payload removal. Supported installers, remote access, signing and release remain open; no Electron/AionCore or Desktop database is used |
| Docker carrier | `successor_oci_hosted_qualification_wired` | Dockerfile/Compose reuse the shared Node host core and renderer with pinned inputs and persistent volumes; the manual additional-carrier qualification builds local-only OCI layouts with SBOM/provenance and runs install/update/recreate/rollback/uninstall on matching native amd64 and arm64 runners. Registry index identity, signing, public distribution, clean-host and release admission remain open |
| AionUI/AionCore dependency | `false` | Native starts Codex App Server directly and consumes only Framework App state/action contracts |
| Enabled carrier | `codex_app_server_stdio` | The candidate has one runtime carrier and one App Server child per native window or Web host |
| Reserved carriers | `pi`, `hermes` disabled | Interface names only; no dependency, process, fallback, or UI path is enabled |
| Thread/history | `codex_app_server_owned` | Candidate consumes thread/turn APIs and keeps only UI metadata/drafts locally |
| Shared directory | `codex_visible_default_overview` | Uses the default `thread/list` source set and opens history by the same canonical thread ID |
| Codex subagents | `read_only_app_server_projection` | Lineage, role, nickname, source kind, tool-call, and activity items are displayed without owning scheduling |
| Private cross-thread layer | `removed_non_goal` | No proposal/dispatch/wait protocol, host queue, ledger, bilateral receipt, or dynamic-tool bridge remains |
| Client composition | `host_derived_client_cordis` | AionUI and Native consume the same App Client Contribution ABI, product profile, and slot policy. Native's Client Cordis occupants derive only from the Framework Host projection; no shell discovers Packages or owns another graph |
| OPL state/actions | `canonical_producer_consumer_conformance` | Framework Cordis composition, Package graph, and public App state/action producer are canonical; Native has one bounded consumer bridge and no second registry, currentness, session, state, or action authority |
| Conversation | `chat_first_with_on_demand_detail` | Primary surface is the DSH conversation; run status, roadmap/detail contributions, files, and results open on demand instead of becoming static home cards |
| Standard Agents | `explicit_owner_readiness_enforced` | Composer separates OPL-owned `standard_agent` packages from skills/plugins/connections and preserves real Codex routes. Unknown diagnostics remain selectable, while explicit `launch_allowed=false`, `operational_ready=false`, physical absence, or non-callability reject selection |
| Active turn | `canonical_reopen_and_steer` | Active submissions use Codex `turn/steer`, and the DSH queue remains renderer-only state. Launch confirms the terminal turn through `thread/read(includeTurns=true)`; reopening a thread restores only the canonical `activeTurnId` before steer is enabled |
| Settings | `canonical_functional_surface` | Account/Gateway, model, workspace, storage, capabilities, instructions, services, updates, diagnostics, preferences, first-run checks, Runtime Overview, and the macOS tray are canonical. The current full functional cohort still requires one rebuilt local Preview and user acceptance |
| Updates | `desktop_and_headless_callers_present_owner_projection_incomplete` | Electron Desktop and standalone Headless updater callers exist. Framework fast App state still needs the App/Base/Packages managed-update and Flow dependency projection required for an immediate owner-currentness view; Docker host-side update remains deliberately deferred rather than exposing the container runtime socket |
| Run detail | `real_producer_consumer_e2e` | MAS has a canonical read-only producer backed by a real workspace and trajectory. Studio passes the selected resolved six-field identity into `runtime.detail`, does not invoke the producer when identity is unresolved, rejects mismatched producer identity, and renders the allowlisted result as eight structured sections |
| Service recovery | `app_state_derived_action_closed_loop` | Runtime Overview derives one causal root and one safe action from the same App state/action projection. Mutating and read-only actions are revalidated against a fresh App state immediately before execution, respect the mutation guard, and always refresh App state afterward |
| Local launcher | `implemented_candidate_path` | Isolated bundle; actions dry-run-only by default |
| Minimum product baseline | `active_functional_closure` | Distribution qualification paths are independently green. The remaining user-facing baseline is managed-update/Flow producer currentness, generic capability/managed-companion consumption from `opl-glt.58`, and a rebuilt local Preview acceptance pass |
| Validation | `distribution_and_core_functional_gates_green_preview_pending` | Default PR/main CI remains source-only, and carrier qualification remains manual. Source and hosted checks cover Settings, Runtime Overview, Agent/turn correctness, identity-scoped Runtime Detail, and service recovery; they do not replace the next locally installed Preview interaction and user acceptance |
| Adoption and readiness | `false` | No active-shell adoption, release, clean-VM, domain, owner-acceptance, or production claim |

## Sidebar Information Architecture

The left sidebar follows one action grammar:

- `New task` and `Run status` are sibling primary actions. Both use the DSH
  `New Session` button geometry and interaction tokens (height, border, radius,
  typography, spacing, hover, focus, and collapsed rail treatment). The runtime
  button may expose the normal selected-page state, but it is not a second
  visual control type.
- There is no separate `Conversations` navigation item. Starting a task opens
  the conversation surface; existing conversations are opened from the same
  workspace/history area.
- Temporary/projectless sessions are shown as a flat `Recent` list after real
  workspaces. They are not represented as a fake `No project` workspace and do
  not create a second workspace hierarchy.
- The DSH vendor tree remains byte-identical. These rules are implemented only
  by the Studio composition adapter and its thin data projection.

Runtime status is a first-level view backed by the App-projected runtime model.
It must not expose internal diagnostic enums or invent a separate runtime state
source.

## Current Gaps

| Gap | Class | Owner route | Stop condition |
| --- | --- | --- | --- |
| Managed update and Flow currentness are incomplete in fast state | `functional_p0` | Framework/App-state producer owner, then Studio consumer | Project the already authoritative App/Base/Packages update status and typed Flow dependency catalog through the existing fast App state. Studio already parses managed-update state and must consume the Host projection without a second registry or updater authority |
| Canonical capability and managed-companion contributions still need user-path consumption | `functional_p1` | `opl-glt.58` producer/consumer owner plus Studio integrator | Consume Channel Access, WeChat, Computer Use, Fleet, Browser Automation, and future managed companions through typed slots/actions and a generic directory; do not hard-code a fixed brand capability list |
| Current Preview has not passed this functional cohort | `acceptance_p0` | Studio product controller and user | After all functional bytes are canonical, rebuild and install the macOS Preview, run local interaction/readback checks, and leave it open for user acceptance |

Signing, notarization, public update feeds, public OCI publication, dedicated
clean-VM certification, and the final AionUI cutover remain separate deferred
delivery/adoption work. They are not prerequisites for the current local
functional baseline and must not be moved back into default development CI.

Remote cross-machine coordination, model-driven permission/write-set decisions,
private thread runtimes, and candidate-owned delivery ledgers are explicitly not
open product gaps. Their implementation surfaces have been removed and must not
be resurrected from history. AionUI Team remains a separate multi-executor shell
facility; Codex-native subagent display continues through App Server truth and
does not depend on Team mode.

## Next-Round Agent Prompt

### Goal

For successor product development, finish the minimum user-facing functional
baseline and produce a current locally installed macOS Preview for acceptance,
while preserving the Codex-only thin-consumer boundary. Distribution and
release qualification stay independent and deferred in this round.
Do not reproduce AionUI-only inherited surfaces, create a speculative
multi-backend framework, or duplicate the renderer/host core for another
carrier.

### Write Scope

- `opl-studio` source, tests, and existing docs only for the explicitly
  authorized candidate delta;
- `one-person-lab-app` contracts/docs/tests only when the App owner decision
  explicitly includes that write set;
- this Active Truth plan for current status, remaining gaps, and the next prompt.

### Non-goals And Forbidden Scope

- no active-shell switch, release-channel change, platform support, or readiness claim without
  App owner adoption;
- no second product model, model catalog, package registry, thread/history
  store, permission control plane, runtime truth, domain truth, or artifact
  authority;
- no independent Client Cordis graph or Package discovery; the single GUI-side
  graph must derive from the Framework Host projection and App slot policy;
- no revival of cross-host handoff, dynamic-tool product requirements, or
  private delivery ledgers merely because experimental source exists;
- no conflation of AionUI Team executor orchestration with Codex App Server
  subagent lineage and activity projection;
- no AionUI/AionCore runtime dependency or provider/session abstraction;
- no second desktop runtime or Electron inside headless/Docker;
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

1. Project Host-derived managed-update and typed Flow dependency currentness
   through fast App state, then consume the existing Studio parser and Settings UI.
2. Consume Host-derived managed-companion,
   Channel Access, WeChat, Computer Use, and Fleet projections without adding a
   Studio registry, Package discovery path, or action authority.
3. Run the full local candidate gates, rebuild the macOS Preview, and complete local interaction/readback
   before asking for user acceptance.

### Verification Commands

- `npm test` in the Native repository with the current App checkout available;
- `npm run validate:candidate:studio` in the App repository when its mounted
  candidate checkout points at the tested bytes;
- OPL Flow-bundled `$opl-doc` semantic governance against each changed
  repository as a risk map;
- tracked Markdown relative-link scan;
- `git diff --check`;
- `npm run smoke:desktop-live` only when the authorized delta affects packaged
  local-window behavior.
- `npm run smoke:docker` when the authorized delta affects the OCI carrier.

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
