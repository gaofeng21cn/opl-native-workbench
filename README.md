# OPL Native Workbench

`opl-native-workbench` is an independent One Person Lab App shell candidate.
It is mounted by the App repository as `shells/opl-native-workbench` and
selected only through `OPL_APP_SHELL_ADAPTER_CONTRACT`.

The shell keeps App truth in the App repository:

- Reads: `opl app state --profile fast --json` and explicit full-state
  commands.
- Mutations: `opl app action execute --action <id> ... --json`.
- Domain/runtime truth: owned by OPL Framework and domain repos, not by this
  renderer.
- Release adoption: forbidden until the App owner deliberately changes
  `contracts/app-shell-adapter.json` and release gates pass.

The current candidate keeps the visual contract intentionally close to Codex
App: persistent left sidebar for navigation/history, one centered chat canvas,
bottom composer as the primary action, and an on-demand workspace inspector for
files, previews, provenance, workflow starters, and export receipts. K-Dense and
Open Science are used as layout/interaction references only; their runtime,
provider, backend, and authority surfaces are not copied.
The current visual refresh also has an image-generated reference mockup at
`assets/mockups/codex-open-science-reference-2026-07-05.png`, used only as a
design anchor for spacing, hierarchy, and panel balance.

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
language, model/account access, workspace, and runtime connection live there;
the composer stays limited to prompt-local actions like attach and send.
`runtimeProfile` now drives actual `opl app state` readback shape, and the
Settings page exposes runtime readback status instead of a pure placeholder.

## Functional MVP Closeout

| Area | Status | Evidence | Boundary |
| --- | --- | --- | --- |
| Codex chat runtime | Implemented candidate evidence | App-server thread/turn markers for `initialize`, `thread/start`, `turn/start`, streaming deltas, `turn/completed`, and `thread/resume` | Does not replace the Codex control plane |
| Chat history and session resume | Implemented candidate evidence | Local persisted session list, reusable `threadId`, and sidebar reopen path | Local candidate persistence only |
| OPL state context | Implemented candidate evidence | `opl app state --profile fast --json`, explicit full state, and full runtime drilldown exception markers | Reads App/Framework truth only |
| App action flow | Implemented candidate evidence | Dry-run action preview, visible receipt markers, and confirmation card markers | No execution without explicit confirmation |
| Execute / rollback preview loop | Implemented candidate evidence | Explicit confirmed execute plus rollback-preview request path | Candidate receipt shell only; no owner receipt authority |
| Settings route | Implemented candidate evidence | Settings page markers for model/account access, locale, runtime connection, project, and candidate-about controls | UI candidate only |
| Settings persistence model | Implemented candidate evidence | `src/workbench/settingsModel.ts` defines sections, keys, defaults, `SETTINGS_STORAGE_KEY`, and localStorage read/write helpers | localStorage only; no system write permission |
| Runtime readback helpers | Implemented candidate evidence | Bridge-normalized state/drilldown/action envelopes plus typed event surface | Structural/runtime readback helper only |
| Artifact preview MVP | Implemented candidate evidence | Rich preview markers for markdown, math, Mermaid, code, PDF, and receipt-like refs | Refs-only preview; no artifact authority |
| Professional starters MVP | Implemented candidate evidence | Research, grant, presentation, and book starter forms now edit fields and route to live dry-run actions when available | No domain execution authority |
| Validator gates | Implemented candidate evidence | `npm run validate:candidate` and `npm run smoke:visual` check source markers and false-ready boundaries | Structural gates only |
| Packaged `.app` and WebUI parity | Partial / non-live evidence | Candidate package, WebUI, source visual, and source UI smoke surfaces | Not clean-VM or same-cohort live user-path evidence |
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

`npm run smoke:native-live` is narrower: after `npm run package`, it opens the
local `out/One Person Lab Native Workbench Candidate.app` with macOS `open -n`,
waits for the packaged app process, and writes `out/native-live-smoke.json`.
It also attempts a local screenshot at `out/native-live-smoke.png`; screenshot
permission or window-id gaps are recorded as skipped/fallback evidence and do
not fail the smoke. This is only local candidate packaged-app live evidence. It
does not claim active-shell adoption, release readiness, clean-VM readiness, or
App/domain authority transfer.
