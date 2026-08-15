# OPL Studio Architecture

Owner: `one-person-lab-app`
Purpose: `candidate_implementation_boundary`
State: `active_technical_reference`
Machine boundary: Human-readable implementation and authority map. Source and
tests prove only their exact candidate behavior; App contracts, Framework
readback, Codex App Server, and domain owners retain their respective truth.

## Authority Stack

This repository is the candidate Shell in the one-product/two-Shell topology:
`one-person-lab-app` owns product and release truth, `opl-aion-shell` remains the
Stable AionUI carrier, and `opl-studio` is the DSH-derived candidate carrier.
The selected Shell, GUI ABI version, Framework compatibility and contribution
snapshot are frozen by the App release composition; candidate source or local
validation cannot promote itself.

```text
one-person-lab-app product profile + App Client Contribution ABI + slot policy
                         +
OPL Framework authoritative Host graph projection
                         |
                         v
Host-derived Client Cordis graph
                         |
                         v
renderer adapter (DSH React here; AionUI in the current shell)
                         |
                         v
shared Node host core -> Electron IPC or HTTP/SSE

Codex App Server separately owns thread/turn protocol and history.
```

The dependency direction is one-way. Native implements App requirements and
renders owner projections. Candidate source, UI defaults, generated manifests,
or package output cannot redefine App product behavior, runtime/package truth,
thread truth, or domain authority.

## Client Composition Boundary

Both the current AionUI shell and this DSH-derived Native candidate consume the
same App-owned Client Contribution ABI, product profile, slot vocabulary,
trust/scope/order rules, and disposal policy. Their renderer and package carrier
may differ; their Package graph and authority inputs may not.

The Framework Host graph remains the only Package producer, identity, and
lifecycle authority. `opl app state` projects its bounded declarative client
graph as `opl_app_ui_contributions_projection.v1`.
`readUiContributionsProjection()` normalizes that projection and
`OplStudioDshSlotHost.replaceHostDerivedProjection()` registers or disposes the
corresponding browser occupants. The local `SlotCore` is therefore the Client
Cordis face of the authoritative Host graph, not an independent Host.

The projected graph is closed and allowlisted by the App-owned
`contracts/opl-app-contributions.schema.json`: Studio mounts only the three
product-profile slots and retains commands only as typed action refs. All writes
then enter the canonical App action bridge. Unknown slots, executable component
fields, handlers, HTML, paths, URLs, and arbitrary plugin objects cannot become
Client Cordis occupants.

The renderer may register static DSH shell slots needed to draw the App, but it
must not discover Packages, establish another Package registry, or own
currentness, state, actions, sessions, or runtime truth. Cordis itself is not
forbidden in a GUI; a second independent graph or authority plane is.

DSH GUI/runtime source reuse remains Native-only. AionUI can consume the same
Host-derived Client Cordis inputs through its own thin renderer adapter without
importing DSH GUI/runtime source.

## Renderer And Host Topology

The implementation has one DeepSeek Harness-derived React renderer and one
Node host core. Transport adapters do not own product or runtime behavior:

- Electron packages the renderer and host core for macOS, Windows, and Linux,
  exposing the typed `window.oplStudio` ABI through an isolated preload and
  allowlisted IPC;
- OPL Workspace exposes the same host core through loopback HTTP/SSE for
  standalone WebUI and headless operation;
- the successor Docker candidate runs the Node host core and WebUI only. It
  does not run Electron, AionUI, or AionCore.

The packaged candidate has an isolated name, path, bundle id, and default
read-only action policy. Source support and local package output are candidate
evidence only. They do not prove a platform release, clean installation,
updater cohort, released Docker image, or cross-carrier runtime equivalence.

## Headless And OCI Process Boundary

`scripts/headless/run.mjs` is the standalone process entrypoint. It validates
bind, port, renderer-root, and shutdown-bound inputs, starts the same
`createOplHostCore` plus HTTP/SSE adapter used by the desktop architecture, and
owns SIGINT/SIGTERM shutdown. It reuses the renderer's single Host-derived
Client Cordis graph and does not introduce an independent composition graph,
thread store, action dispatcher, or renderer.

The HTTP adapter publishes two carrier-level probes:

- `/healthz` reports that the Node HTTP process is accepting requests;
- `/readyz` reports that the Codex App Server child completed initialization.

Readiness does not claim OPL package currentness, domain readiness, release
readiness, or production readiness. Framework state remains an on-demand
owner-authoritative `opl app state` read through the existing bridge.

The OCI candidate is a multi-stage build. The build stages materialize an exact
App product-profile commit, an exact OPL Framework commit, a pinned Codex npm
package, and the shared renderer. App source is a build-only product-policy
input and is absent from the runtime image. The final image contains only the
Node headless host, renderer, OPL Framework, and Codex runtime inputs. It runs as
the base image's `node` user, uses `/data` for `HOME`, `CODEX_HOME`, and OPL
state, and uses `/projects` as the workspace root. The final PID 1 is Node;
Electron, AionUI, and AionCore are absent.

Those default build arguments establish a locally reproducible candidate, not
a release freeze. App-owned release tooling must later replace them with the
accepted source cohort and digest verification before publication. Remote
exposure also remains inadmissible until an App-owned authentication and network
boundary exists; Compose therefore publishes host loopback only.

## Runtime Independence

Native does not require, start, package, or read AionUI or AionCore. The shared
host core resolves `OPL_CODEX_BIN` or an exact external Codex executable and
starts `codex app-server --stdio` directly. Every carrier consumes OPL only
through Framework state/action
contracts; AionUI/AionCore managed-resource manifests, provider abstractions,
session/database state, backend, and authentication are not Native runtime inputs.

This independence is a carrier property, not a second product or runtime
authority. Codex still owns thread/turn truth, Framework still owns OPL
state/actions and the authoritative Package Host graph, and App contracts still
own product behavior plus Client ABI/slot policy.

Codex CLI/App Server is the candidate's complete backend scope. App Server over
stdio is the only enabled carrier. `pi` and `hermes` are
reserved disabled identifiers only: they add no source implementation, package
dependency, runtime process, fallback route, or visible setting. A later carrier
must implement the existing bridge shape and receive a separate App owner
decision; it must not weaken the current Codex path.

## App And Framework Boundary

Ordinary state reads use:

```text
opl app state --profile fast --json
```

Explicit diagnostics may use the App-owned full state and operator drilldown.
Mutations route only through:

```text
opl app action execute --action <id> [--payload <json>] [--dry-run] --json
```

The candidate must not read OPL internal state files or infer installed, ready,
synced, release, or owner-accepted state. It prefers
`app_state.agent_packages` for package display and treats older `modules.items`
rows as preview-only fallback.

## Codex Thread Boundary

Codex App Server owns canonical thread identity, history, lifecycle,
permissions, model catalog, and turn state. Native consumes the App Server
thread/turn/event flow; `localStorage` is limited to UI selection, settings,
and unsent drafts.

Electron and WebUI use one standard adapter for `thread/list`, `thread/read`,
`thread/resume`, `thread/fork`, `thread/archive`, and `thread/unarchive`.
`parentThreadId`, `agentRole`, `agentNickname`, subagent source kinds,
`collabAgentToolCall`, and `subAgentActivity` are read-only Codex projections;
the candidate does not infer or own subagent scheduling.

The default directory reads the Codex state DB overview through
`thread/list { useStateDbOnly: true, sortKey: "updated_at", sortDirection:
"desc" }`. Opening a conversation performs a read-only
`thread/read { threadId, includeTurns: true }` against the same canonical thread
ID. It does not import, copy, synchronize, or rewrite Codex history. Resume is
an explicit lifecycle action and is not required merely to view history.

The retired private cross-thread layer is not an adapter or product capability.
Native has no separate proposal/dispatch/wait protocol, host queue, delivery
ledger, bilateral coordination receipt, client-executed dynamic tool set, or
cross-host handoff contract. AionUI Team is separately a shell-level
multi-executor facility for Codex CLI, Claude Code, and other executors. It is
not the Codex-native subagent capability and is outside this repository's
thread adapter.

## Model And Settings Boundary

Model defaults, visible choices, labels, reasoning options, and fallback policy
come from the App product profile plus fresh Codex `model/list` readback. Native
must not maintain a second model catalog or silently replace an unavailable
fixed selection.

Settings persistence remains candidate-local UI state. It does not grant system
write permission or ownership of App settings policy.

## Domain And Artifact Boundary

Research, grant, presentation, and book starters dispatch App-owned action refs
when available. Artifact previews render refs and supported formats. Neither
surface owns professional execution, source truth, quality judgment, artifact
authority, export acceptance, or delivery readiness.

## Adoption Boundary

AionUI is the current active release shell and only mainline. Studio is the
internal development codename for the first-party successor, but it does not
acquire mainline, full-AionUI-parity, release, or cross-platform delivery status
before its minimum-complete and release gates pass. Adoption requires an
explicit App owner decision and a change to the App shell adapter after the
relevant App-owned gates pass; only then may the AionUI mainline be retired.
Candidate docs, tests, package artifacts, screenshots, or local live smoke
cannot perform that transfer or prove release readiness. The current evaluation
policy and next safe work route are maintained only in
[the Active Truth plan](./active/current-state-vs-ideal-gap.md).
