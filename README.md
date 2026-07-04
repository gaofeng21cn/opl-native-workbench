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

The packaged macOS MVP includes a native `WKScriptMessageHandler` bridge. The
renderer can read `opl app state`, request App action dry-runs, and talk to
Codex through `codex app-server --stdio`. The bridge uses the app-server
thread/turn JSON-RPC flow (`initialize`, `thread/start`, `turn/start`,
`item/agentMessage/delta`, `turn/completed`) so multi-turn state, streaming
deltas, and thread resume use the Codex control plane instead of a shell-owned
one-shot CLI wrapper.

Settings is a first-class route in the candidate. Global controls such as
language, model/account access, workspace, and runtime connection live there;
the composer stays limited to prompt-local actions like attach and send.

## Functional MVP Closeout

Implemented candidate evidence:

- Codex chat uses the app-server thread/turn path with source markers for
  `initialize`, `thread/start`, `turn/start`, streaming deltas,
  `turn/completed`, and `thread/resume`.
- OPL state context reads stay on App state surfaces:
  `opl app state --profile fast --json`, explicit full state, and the full
  runtime drilldown exception.
- App actions use dry-run preview and visible receipt markers before any
  execution path.
- Settings is a real route for model/account access, locale, runtime
  connection, project, and candidate-about controls.
- Validators enforce the chat runtime, state context, action preview/receipt,
  settings route, and false-ready boundaries from source markers.

Partial or non-live evidence:

- Packaged `.app`, WebUI parity, source visual smoke, and source UI smoke are
  candidate evidence only.
- Artifact previews, provenance, starter forms, confirmation cards, and export
  actions are refs-only UI; they do not own artifact bodies, domain truth, or
  owner receipts.

Explicitly not ready:

- Active-shell adoption, release readiness, production readiness, domain
  readiness, clean-VM readiness, full release readiness, live evidence, owner
  receipt, runtime authority transfer, and domain truth ownership.

## Commands

```bash
npm run validate:candidate
npm run validate:state-model
npm run smoke:webui
npm run package
```

These commands are structural candidate evidence. They do not claim active-shell
adoption, release readiness, production readiness, or live user-path evidence.
