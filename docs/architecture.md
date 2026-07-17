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
-> Native host and WebUI transport adapters
-> shared candidate renderer
```

The dependency direction is one-way. Native implements App requirements and
renders owner projections. Candidate source, UI defaults, generated manifests,
or package output cannot redefine App product behavior, runtime/package truth,
thread truth, or domain authority.

## Renderer And Host Topology

The source uses one React renderer target with two local transports:

- packaged macOS uses a native `WKScriptMessageHandler` host;
- WebUI uses a local Node HTTP/SSE host and the same bridge shape.

The packaged candidate has an isolated name, path, bundle id, and default
read-only action policy. Sharing a renderer is structural convergence evidence,
not proof that both delivery surfaces have equivalent live behavior.

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

AionUI is the active release shell. Native is a foreground alternative that can
be selected for one local launch. Adoption requires an explicit App owner
decision and a change to the App shell adapter after all App-owned gates pass.
Candidate docs, tests, package artifacts, screenshots, or local live smoke
cannot perform that transfer.

Further product expansion is currently deferred. The re-entry gate and next
safe work route are maintained only in
[the Active Truth plan](./active/current-state-vs-ideal-gap.md).
