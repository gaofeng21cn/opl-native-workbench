# OPL Native Workbench

`opl-native-workbench` is an independent One Person Lab App shell candidate.
It is mounted by the App repository as `shells/opl-native-workbench` and
selected only through `OPL_APP_SHELL_ADAPTER_CONTRACT`.

Public role: this repo is the foreground/developer backup candidate for the OPL
App GUI. It may preview a chat-first workbench, WebUI convergence, local
history, and environment-detail UX, but it must consume App/root state instead of
owning product, runtime, package, or domain truth. Simulated, fallback, or
unavailable data must stay visibly non-authoritative and cannot be displayed as
active shell adoption, release readiness, runtime truth, package truth, owner
receipt, or domain readiness.

The shell keeps App truth in the App repository:

- Reads: `opl app state --profile fast --json` and explicit full-state
  commands.
- Mutations: `opl app action execute --action <id> ... --json`.
- Domain/runtime truth: owned by OPL Framework and domain repos, not by this
  renderer.
- Release adoption: forbidden until the App owner deliberately changes
  `contracts/app-shell-adapter.json` and release gates pass.

The primary visual and interaction reference is ChatGPT Codex macOS
26.707.31123, inspected on 2026-07-10. The candidate aligns to its persistent
project/conversation rail, dominant single conversation timeline, compact
header, model and reasoning controls in the composer, and floating
user-requested environment details. This is reference-only: no ChatGPT/Codex
source, brand asset, or product authority is copied. K-Dense and Open Science
remain feature references for delivery and scientific preview behavior only.

## Current UI structure

The candidate now documents one stable user-facing information architecture:

- Left rail: global task/agent entries, projects, compact project context links,
  and project conversations use one quiet hierarchy. The rail is visible by
  default on desktop and can be collapsed explicitly.
- Center: one dominant chat timeline. The header contains conversation-local
  navigation only; model and reasoning controls stay in the composer bottom
  row beside attach, capability, and send controls.
- Right side: environment details are closed by default and open as a floating
  panel without resizing the chat canvas. Sources, previews, provenance,
  workflows, packages, and runtime remain secondary surfaces.
- Settings: the account row at the lower left opens a separate Settings route.
  Language remains under General rather than inside the composer or context
  panel.

This README and the generated package manifest describe candidate alignment
evidence only. Neither claims App adoption, release readiness, or live operator
validation.

The packaged macOS MVP includes a native `WKScriptMessageHandler` bridge. The
renderer can read `opl app state`, request App action dry-runs, and talk to
Codex through `codex app-server --stdio`. The bridge uses the app-server
thread/turn JSON-RPC flow (`initialize`, `thread/start`, `turn/start`,
`item/agentMessage/delta`, `turn/completed`) so multi-turn state, streaming
deltas, and thread resume use the Codex control plane instead of a shell-owned
one-shot CLI wrapper.

The current candidate also keeps a local chat-session ledger in `localStorage`.
The left sidebar is no longer static mock data: it can reopen recent chats,
reuse the saved `threadId`, and show the latest locally-persisted draft even
before active-shell adoption.

Settings is a first-class route in the candidate. Global controls such as
language, model defaults, workspace, and runtime connection live there. The
composer exposes the current model and reasoning effort as conversation controls,
matching Codex placement; those values are persisted in Settings and passed
through the existing Codex app-server `turn/start` `model` and `effort` fields.
The model policy is injected from
`one-person-lab-app/contracts/app-product-profile.json#codex.auto_model_policy`:
each build consumes the App-owned known-model preferences, known reasoning
overrides, catalog fallback, and persistence policy rather than maintaining a
second candidate catalog. The source module keeps only a minimal single-model
offline fallback for an uninjected preview. At runtime the native bridge calls
Codex app-server `model/list`. Auto keeps the known `gpt-5.6-sol` override at
`xhigh`; when Codex advertises a newer unknown `isDefault` model, Auto follows
that model and uses its last advertised supported reasoning effort. A missing
catalog falls back to the App-owned model and reasoning pair. Choosing another
model or reasoning effort pins the resolved choice and exits Auto before
sending. If a previously fixed alternative is no longer
advertised, sending remains blocked until the user chooses Auto or another
available model; the Workbench never silently substitutes a different model.
`runtimeProfile` now drives actual `opl app state` readback shape, and the
Settings page exposes runtime readback status instead of a pure placeholder.

Agent Package lifecycle is also a candidate display surface only. The
Workbench prefers `opl app state --profile fast --json#app_state.agent_packages`
directory/status-index refs, shows package lock, receipt, rollback, exposure,
and action refs when App/root provides them, and marks discover/install/update/
repair/uninstall/exposure actions as available only when an App/root action ref
exists. Older `modules.items` payloads may appear as preview-only fallback rows;
they must not be displayed as package installed, ready, synced, or release
truth.

## Renderer convergence boundary

The current target is convergence, not a finished parity claim:

- Source, packaged macOS candidate, and WebUI should converge on the same
  renderer surface and the same bridge/event shape.
- WebUI reuses the candidate renderer and adapts transport through
  `window.oplNativeWorkbench` plus the Web transport/SSE bridge; packaged macOS
  reuses the same renderer through the native bridge.
- This repository can therefore describe one renderer target and one candidate
  interaction model, but the evidence level still differs by surface.

Current evidence remains intentionally bounded:

- Source renderer and candidate validators are structural/source evidence.
- WebUI parity is shared-renderer and smoke evidence only.
- Packaged `.app` evidence is candidate packaging/smoke evidence only.
- None of the above claims active-shell adoption, release readiness,
  production readiness, clean-VM readiness, domain readiness, owner receipt, or
  live user-path completion.

## Functional MVP Closeout

| Area | Status | Evidence | Boundary |
| --- | --- | --- | --- |
| Codex chat runtime | Implemented candidate evidence | App-server thread/turn markers for `initialize`, `thread/start`, `turn/start`, model/effort overrides, streaming deltas, `turn/completed`, and `thread/resume` | Does not replace the Codex control plane |
| Chat history and session resume | Implemented candidate evidence | Local persisted session list, reusable `threadId`, and sidebar reopen path | Local candidate persistence only |
| OPL state context | Implemented candidate evidence | `opl app state --profile fast --json`, explicit full state, and full runtime drilldown exception markers | Reads App/Framework truth only |
| App action flow | Implemented candidate evidence | Dry-run action preview, visible receipt markers, and confirmation card markers | No execution without explicit confirmation |
| Execute / rollback preview loop | Implemented candidate evidence | Explicit confirmed execute plus rollback-preview request path | Candidate receipt shell only; no owner receipt authority |
| Settings route | Implemented candidate evidence | Settings page markers for model/account access, locale, runtime connection, project, and candidate-about controls | UI candidate only |
| Settings persistence model | Implemented candidate evidence | `src/workbench/settingsModel.ts` defines sections, keys, defaults, `SETTINGS_STORAGE_KEY`, and localStorage read/write helpers | localStorage only; no system write permission |
| Runtime readback helpers | Implemented candidate evidence | Bridge-normalized state/drilldown/action envelopes plus typed event surface | Structural/runtime readback helper only |
| Browser fallback boundary | Implemented candidate evidence | Browser placeholder receipts are preview-only, non-executable, and surfaced as bridge unavailable without `preview_ready` execution semantics | Fallback/simulated data cannot promote App/root readiness |
| Artifact preview MVP | Implemented candidate evidence | Rich preview markers for markdown, math, Mermaid, code, PDF, and receipt-like refs | Refs-only preview; no artifact authority |
| Professional starters MVP | Implemented candidate evidence | Research, grant, presentation, and book starter forms now edit fields and route to live dry-run actions when available | No domain execution authority |
| Agent Package lifecycle | Implemented candidate evidence | Packages inspector reads App/root package lifecycle refs and action availability | No package executor, package truth, installed/ready/synced claim, or active-shell adoption |
| Validator gates | Implemented candidate evidence | `npm run validate:candidate` and `npm run smoke:visual` check source markers and false-ready boundaries | Structural gates only |
| Packaged `.app`, WebUI, and source convergence | Partial / non-live evidence | Shared renderer target plus candidate package, WebUI, source visual, and source UI smoke surfaces | Not clean-VM or same-cohort live user-path evidence |
| Release and Live readiness | Not ready | False-ready fields stay false in candidate evidence and manifests | No active-shell adoption, release readiness, production readiness, domain readiness, live evidence, owner receipt, runtime authority transfer, or domain truth ownership |

## Commands

```bash
npm run validate:candidate
npm run validate:state-model
npm run smoke:webui
npm run package
```

These commands are structural candidate evidence. They do not claim active-shell
adoption, release readiness, production readiness, or live user-path evidence.

```bash
npm run smoke:native-live
```

`npm run smoke:native-live` is narrower: after `npm run package`, it opens a
fresh local `out/One Person Lab Native Workbench Candidate.app`, requires a new
PID and real window, captures that PID's exact window, verifies renderer markers
(`Codex` and `5.6 Sol`), and verifies process cleanup before writing
`out/native-live-smoke.json` and `out/native-live-smoke.png`. Missing window,
renderer, screenshot, or cleanup evidence fails closed. This is only local
candidate packaged-app live evidence. It does not claim active-shell adoption,
release readiness, clean-VM readiness, or App/domain authority transfer.
