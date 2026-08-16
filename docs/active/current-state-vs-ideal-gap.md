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
| Docker carrier | `successor_oci_hosted_qualification_wired` | Dockerfile/Compose reuse the shared Node host core and renderer with pinned inputs and persistent volumes; the non-release lane builds a local-only amd64/arm64 OCI layout with SBOM/provenance and runs install/update/recreate/rollback/uninstall on both architectures. Registry identity, signing, public distribution, clean-host and release admission remain open |
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
| Standard Agents | `typed_dynamic_selection` | Composer separates OPL-owned `standard_agent` packages from skills/plugins/connections and requires selectable readiness plus a real Codex route |
| Active turn | `direct_steer_with_renderer_queue` | Active submissions use Codex `turn/steer`; the DSH queue is temporary renderer state and is not a second persistent scheduler or queue |
| Settings | `minimum_complete_control_plane_wired` | Account/Gateway, model, resources, working directory, storage, Agents, capabilities, instructions, services, updates, diagnostics, preferences, and About consume typed owner actions |
| Updates | `separate_app_base_packages_model` | Base and Packages execute projected Framework actions through dry-run, confirmation, receipt, and fresh readback. Electron and fixed host-managed headless/OCI command plans share one App updater ABI; distribution command injection and signed feeds remain open |
| Run detail | `identity_scoped_composition` | Agent activity, work status, runtime detail, files, and results are scoped to the active thread/work item; unknown modules degrade locally |
| Local launcher | `implemented_candidate_path` | Isolated bundle; actions dry-run-only by default |
| Minimum product baseline | `eight_source_outcomes_complete` | Thread/turn lifecycle, run detail, files/results, settings/diagnostics, dynamic Agents, capabilities/contributions, three-object maintenance, and service recovery are source-complete; later evidence axes remain independent |
| Validation | `source_local_and_hosted_installer_native_accessibility_gates_green` | Focused/full tests, local macOS package/live Electron, hosted macOS/Linux Headless user-service lifecycles with owner-state readback, hosted Windows/Linux unsigned package install/update/rollback/uninstall plus exact running-version, state-preservation, Chromium AX, native UIA/AT-SPI, and cleanup readback, Docker, and desktop/mobile browser checks prove only their exact candidate bytes and named carriers |
| Adoption and readiness | `false` | No active-shell adoption, release, clean-VM, domain, owner-acceptance, or production claim |

## Current Gaps

| Gap | Class | Owner route | Stop condition |
| --- | --- | --- | --- |
| App contract currentness must be re-read before any change | `structural_currentness_gate` | App contracts and GUI docs | Stop if the candidate write set conflicts with a newer App decision or active owner lane |
| Desktop App updater feed is not qualified | `release_admission_p0` | App release producer plus desktop package owner | Electron updater state/operations are implemented; produce signed artifacts and a dedicated signed feed, then prove check/download/apply/restart/version readback without consuming AionUI update metadata |
| Headless service distribution is incomplete | `delivery_p0` | App install owner plus shared-host owner | Preserve the hosted macOS/Linux user-service lifecycle and fresh App-state baseline, then admit supported installers, authenticated remote access, signed update sources, and release cohorts separately |
| Successor OCI carrier release admission is incomplete | `delivery_p0` | App release/install owner plus host-core owner | Preserve the hosted non-public multi-arch layout and manager lifecycle proof, then qualify immutable registry identity, signatures, vulnerability policy, clean-host installation and release without Electron or AionCore |
| Windows/Linux dedicated clean-VM and screen-reader qualification remain incomplete | `delivery_p1` | Platform package owners | Hosted-runner NSIS and DEB lifecycle plus process-bound UIA/AT-SPI trees are proven; next qualify dedicated clean VMs, NVDA/Orca user experience, and supported-user-path behavior. AppImage is a closed non-admission decision, not an open delivery promise |
| Exact-cohort Pixel and accessibility acceptance are absent | `evidence_p1` | App GUI acceptance owner | Capture the tested Desktop and WebUI cohorts across target viewports, keyboard and screen-reader paths; source screenshots do not close installed Pixel |
| Security, Release, and cutover proof are absent | `non_blocking_candidate_evidence_gap` | App release owner and owning runtime/release surfaces | Qualify signed artifacts, dedicated clean-VM installs, OCI supply chain, update/rollback, and release cohorts independently; switch AionUI only through a final explicit adoption decision |

Remote cross-machine coordination, model-driven permission/write-set decisions,
private thread runtimes, and candidate-owned delivery ledgers are explicitly not
open product gaps. Their implementation surfaces have been removed and must not
be resurrected from history. AionUI Team remains a separate multi-executor shell
facility; Codex-native subagent display continues through App Server truth and
does not depend on Team mode.

## Next-Round Agent Prompt

### Goal

For successor product development, turn the source-complete minimum product
into supported Desktop, Headless, and Docker delivery cohorts while preserving
the Codex-only thin-consumer boundary.
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

1. Complete the macOS Desktop cohort with signed distributable artifacts, a
   dedicated update feed, and installed check/apply/restart/version readback.
2. Preserve the hosted macOS/Linux Headless user-service lifecycles, then bind
   qualified paths to supported installers, authenticated remote access, signed
   update sources, and separate App release admission.
3. Complete Docker/OCI distribution, host-managed image recreate/rollback,
   multi-arch, supply-chain, and remote-access security qualification.
4. Extend the hosted Windows/Linux NSIS/DEB lifecycle and UIA/AT-SPI baseline to
   dedicated clean-VM, NVDA/Orca, and exact-cohort Desktop/WebUI Pixel and
   accessibility acceptance.
5. Keep AionUI active until Source, Pixel, Install, Security, and Release are
   all admitted; perform the adapter/release cutover only as one explicit final
   App-owner decision.

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
