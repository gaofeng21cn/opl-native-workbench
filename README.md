# OPL Native Workbench

<!--
Owner: `one-person-lab-app`
Purpose: `public_candidate_entry`
State: `foreground_alternative_candidate`
Machine boundary: Human-readable candidate-shell entry. App product and adoption truth stays in one-person-lab-app contracts; runtime/package truth stays in OPL Framework; domain truth stays with domain owners. This page does not prove active-shell adoption, release readiness, owner acceptance, or production readiness.
-->

`opl-native-workbench` is the foreground alternative shell candidate for One
Person Lab App. It offers a chat-first native macOS and WebUI implementation for
local evaluation while consuming the same App-owned product contracts and
Framework state/action surfaces as other shell implementations.

AionUI remains the active release shell. Selecting or launching Native is a
local candidate choice only; it does not change the release adapter, updater
channel, App product truth, or ownership boundaries.

## What You Can Evaluate

- a persistent project and conversation rail around one dominant chat timeline;
- Codex App Server thread, turn, streaming, and history integration;
- read-only Codex subagent lineage, role, source, and activity projection from
  native App Server thread/turn items;
- App state readback and action preview through the typed OPL bridge;
- Settings, artifact previews, professional starter forms, and package status
  projections that remain refs-only;
- one renderer target across the packaged macOS candidate and WebUI transport.

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

The App candidate registry keeps Native as the foreground alternative, but the
App candidate boundary currently defers further product expansion until an
explicit re-entry decision names scope, maintenance owner, App contract delta,
and release relationship. Native does not maintain a private proposal,
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
