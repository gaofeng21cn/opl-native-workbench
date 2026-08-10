# OPL Native Workbench

<!--
Owner: `one-person-lab-app`
Purpose: `public_candidate_entry`
State: `foreground_alternative_candidate`
Machine boundary: Human-readable candidate-shell entry. App product and adoption truth stays in one-person-lab-app contracts; runtime/package truth stays in OPL Framework; domain truth stays with domain owners. This page does not prove active-shell adoption, release readiness, owner acceptance, or production readiness.
-->

`opl-native-workbench` is the foreground alternative shell candidate for One
Person Lab App. It evaluates a lightweight OPL-owned React renderer, native
macOS Swift/AppKit + WKWebView host, lightweight OPL Workspace Node Web host,
and their shared typed bridge.

AionUI remains the active release shell. Selecting or launching Native is a
local candidate choice only; it does not change the release adapter, updater
channel, App product truth, installed App, or current platform support. AionUI
and AionCore are not candidate renderer/runtime dependencies.

Native remains a manual, non-periodic technical evaluation. It is not a required
mainline task, parity program, scheduled workstream, release blocker, or product
completion obligation. The packaged macOS host starts Codex App Server directly
from `OPL_CODEX_BIN` or an exact external Codex executable, while OPL state and
mutations remain behind Framework `opl app state/action` contracts. It does not
package or read AionUI/AionCore manifests, sessions, or data.
Codex App Server stdio is the only enabled carrier; `pi` and `hermes` are
reserved disabled interface names and add no current code path or dependency.

OPL Workspace serves the same renderer through a lightweight Node HTTP/SSE
host, starts Codex App Server directly, and keeps Codex state in its own volume.
Docker runs neither Electron nor AionCore. The architecture direction requires
future Windows/Linux work to reuse this renderer and Codex-only boundary, but
Electron versus Tauri remains deferred. Native is not responsible for that
cross-platform delivery and neither platform is currently claimed as supported.

The conversation directory is not a Native copy. It reads the canonical Codex
state DB overview with `thread/list useStateDbOnly=true`, then opens the same
thread ID with `thread/read includeTurns=true`. Native stores only UI selection,
settings, and unsent drafts locally.

## What You Can Evaluate

- a persistent project and conversation rail around one dominant chat timeline;
- Codex App Server thread, turn, streaming, and history integration;
- read-only Codex subagent lineage, role, source, and activity projection from
  native App Server thread/turn items;
- App state readback and action preview through the typed OPL bridge;
- Settings, artifact previews, professional starter forms, and package status
  projections that remain refs-only;
- one OPL-owned renderer across the packaged macOS host and OPL Workspace transport.

The candidate may display only state and actions supplied by App/Framework
contracts. Placeholder, fallback, or unavailable data remains visibly
non-authoritative and cannot become package, runtime, artifact, domain, or
readiness truth.

## Try It Locally

Launch the candidate from the One Person Lab App repository:

```bash
npm run gui -- --shell opl-native-workbench
```

Use `--rebuild` to rebuild and replace only
`/Applications/One Person Lab Native.app`. The candidate has the isolated bundle
id `cn.gflab.opl.native-workbench.candidate` and does not replace
`/Applications/One Person Lab.app`.

Candidate actions are dry-run-only by default. `--allow-actions` is an explicit
local override that still requires the candidate confirmation path. Directly
opening the bundle uses host-path fallback and does not prove parity with the
App-managed launcher.

## Authority Boundary

| Concern | Owner | Native role |
| --- | --- | --- |
| GUI product behavior, model policy, page states, and adoption | `one-person-lab-app` contracts | Implementation consumer only |
| Runtime and package state/actions | OPL Framework | Read/project exact refs; dispatch owner actions only |
| Thread identity, history, permissions, and turns | Codex App Server | Client and renderer only |
| Professional truth, quality, artifacts, and delivery | Domain owners | Refs-only presentation |
| Candidate source, bridge, renderer, packaging, and focused tests | This repository | Implementation evidence only |

The App candidate registry keeps Native as the foreground alternative under a
manual, non-periodic evaluation policy. Product expansion, mainline ownership,
adoption, and release participation require a separate App owner decision and
contract delta. Native does not maintain a private proposal,
dispatch, wait, queue, ledger, bilateral-receipt, or client-executed dynamic-tool
layer. AionUI Team's multi-executor orchestration is a separate shell capability;
it does not replace Codex-native subagents and is not implemented here.

## Current Evidence Boundary

Source validators, tests, renderer smoke, WebUI smoke, package construction, and
local packaged-app smoke can prove their exact candidate layers. They do not
prove active-shell adoption, release readiness, clean-VM readiness, shared
physical Runtime parity, domain readiness, owner acceptance, or production
readiness.

## Documentation

- [Documentation and owner map](docs/README.md)
- [Implementation and authority architecture](docs/architecture.md)
- [Current state, gaps, and next Agent prompt](docs/active/current-state-vs-ideal-gap.md)
- [Verification and evidence boundaries](docs/verification.md)
- [Historical candidate baseline](docs/history/README.md)

<details>
  <summary><strong>Developer checks</strong></summary>

```bash
npm ci
npm test
```

`npm test` covers typecheck, focused regressions, candidate/state validators,
WebUI and visual smoke, package construction, and packaged-runtime validation.
Run `npm run smoke:native-live` separately for local packaged-window evidence.
See [verification](docs/verification.md) before interpreting either result.

</details>
