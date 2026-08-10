# OPL Native Workbench Architecture

Owner: `one-person-lab-app`
Purpose: `candidate_implementation_boundary`
State: `active_technical_reference`
Machine boundary: Human-readable implementation and authority map. Source and
tests prove only their exact candidate behavior; App contracts, Framework
readback, Codex App Server, and domain owners retain their respective truth.

## Authority Stack

```text
one-person-lab-app product and candidate contracts
-> OPL Framework app state/action JSON
-> Codex App Server thread/turn protocol
-> native macOS and OPL Workspace transport adapters
-> shared candidate renderer
```

The dependency direction is one-way. Native implements App requirements and
renders owner projections. Candidate source, UI defaults, generated manifests,
or package output cannot redefine App product behavior, runtime/package truth,
thread truth, or domain authority.

## Renderer And Host Topology

The source evaluates one OPL-owned React renderer with two candidate hosts:

- packaged macOS uses Swift/AppKit + WKWebView and a native
  `WKScriptMessageHandler` bridge to local processes;
- OPL Workspace uses a lightweight Node HTTP/SSE host and the same typed bridge
  shape, with Codex state persisted in its container volume.

The packaged candidate has an isolated name, path, bundle id, and default
read-only action policy. Sharing a renderer is structural convergence evidence,
not proof that both delivery surfaces have equivalent live behavior.

Docker runs neither Electron nor AionCore and does not mount a Desktop-private
database. The product direction requires future Windows/Linux carriers to reuse
the renderer and bridge, but Native does not own that delivery. Electron and
Tauri remain unselected until artifact size, signing, update, and installed
acceptance are measured. No source marker here proves Windows/Linux support.

## Runtime Independence

Native does not require, start, package, or read AionUI or AionCore. The packaged macOS
host resolves `OPL_CODEX_BIN` or an exact external Codex executable and starts
`codex app-server --stdio` directly. The Node WebUI host also talks directly to
Codex App Server. Both hosts consume OPL only through Framework state/action
contracts; AionUI/AionCore managed-resource manifests, provider abstractions,
session/database state, backend, and authentication are not Native runtime inputs.

This independence is a carrier property, not a second product or runtime
authority. Codex still owns thread/turn truth, Framework still owns OPL
state/actions, and App contracts still own product behavior.

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

Desktop and WebUI use one standard adapter for `thread/list`, `thread/read`,
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

AionUI is the current active release shell. Native remains a manual,
non-periodic foreground alternative used to evaluate the approved lightweight
architecture without acquiring mainline, parity, release, or cross-platform
delivery obligations. Adoption requires an explicit App owner decision and a
change to the App shell adapter after the relevant App-owned gates pass.
Candidate docs, tests, package artifacts, screenshots, or local live smoke
cannot perform that transfer or prove release readiness. The current evaluation
policy and next safe work route are maintained only in
[the Active Truth plan](./active/current-state-vs-ideal-gap.md).
