# OPL Studio

<!--
Owner: `one-person-lab-app`
Purpose: `public_native_product_entry`
State: `active_product_development_release_admission_separate`
Machine boundary: Human-readable Native product entry. App product and adoption truth stays in one-person-lab-app contracts; runtime/package truth stays in OPL Framework; domain truth stays with domain owners. This page does not prove active-shell adoption, release readiness, owner acceptance, or production readiness.
-->

`opl-studio` is the internal repository and development codename for the
first-party One Person Lab App successor. The product uses a DeepSeek
Harness-derived React renderer and one shared Node host core. Electron is the
thin desktop carrier for macOS, Windows, and Linux; HTTP/SSE exposes the same
renderer and bridge for standalone WebUI, headless, and Docker forms.

AionUI remains the active release shell. Selecting or launching Studio is a
local development choice only; it does not change the release adapter, updater
channel, App product truth, installed App, or current platform support. AionUI
and AionCore are not candidate renderer/runtime dependencies.

Studio is now required product development against the App-owned minimum-complete
contract. It is not a full AionUI parity program, scheduled workstream, or release
blocker. The desktop and headless hosts start Codex App Server directly
from `OPL_CODEX_BIN` or an exact external Codex executable, while OPL state and
mutations remain behind Framework `opl app state/action` contracts. It does not
package or read AionUI/AionCore manifests, sessions, or data.
Codex App Server stdio is the only enabled carrier; `pi` and `hermes` are
reserved disabled interface names and add no current code path or dependency.

OPL Workspace serves the same renderer through the shared Node host core and a
lightweight HTTP/SSE adapter. Docker runs neither Electron nor AionCore. The
source now includes a standalone Node command and a non-root OCI carrier with
`/data` and `/projects` persistence. The source and package configuration also
include macOS, Windows, and Linux desktop targets, but every platform and the
successor OCI carrier still require their own installation, update, and release
qualification before they can be claimed as released or supported.

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
- one OPL-owned renderer and host core across Electron desktop and OPL Workspace.

The candidate may display only state and actions supplied by App/Framework
contracts. Placeholder, fallback, or unavailable data remains visibly
non-authoritative and cannot become package, runtime, artifact, domain, or
readiness truth.

## Try It Locally

Launch the candidate from the One Person Lab App repository:

```bash
npm run gui -- --shell opl-studio
```

Use `--rebuild` to rebuild and replace only
`/Applications/One Person Lab Preview.app`. The candidate has the isolated bundle
id `cn.gflab.opl.studio.preview` and does not replace
`/Applications/One Person Lab.app`.

Candidate actions are dry-run-only by default. `--allow-actions` is an explicit
local override that still requires the candidate confirmation path. Directly
opening the bundle uses host-path fallback and does not prove parity with the
App-managed launcher.

### Standalone WebUI

Build the shared renderer once, then start the Node host:

```bash
npm run build:webui
npm run start:headless
```

The default URL is `http://127.0.0.1:4178`. `OPL_HEADLESS_HOST`,
`OPL_HEADLESS_PORT`, `OPL_CODEX_BIN`, `OPL_APP_OPL_BIN`, `CODEX_HOME`, and
`OPL_STUDIO_CODEX_CWD` select the bind and external runtime inputs. `/healthz`
is process liveness; `/readyz` is successful Codex App Server initialization.
SIGINT and SIGTERM close HTTP/SSE and the child App Server within the configured
shutdown bound.

### Docker Candidate

```bash
docker compose up --build
```

Compose publishes only to host loopback by default, persists `/data` and
`/projects`, and runs the image as UID 1000. The image starts Node directly; it
contains no Electron, AionUI, or AionCore runtime. Its default OPL Framework
commit, App product-profile commit, and Codex package are candidate build inputs
that can be overridden with exact inputs. The App source is used only to build
the renderer policy and is not copied into the runtime image. These defaults are
not a release cohort or update contract. Do not expose the HTTP bridge to an
untrusted network; this candidate has no remote access control boundary.

## Authority Boundary

| Concern | Owner | Native role |
| --- | --- | --- |
| GUI product behavior, model policy, page states, and adoption | `one-person-lab-app` contracts | Implementation consumer only |
| Runtime and package state/actions | OPL Framework | Read/project exact refs; dispatch owner actions only |
| Thread identity, history, permissions, and turns | Codex App Server | Client and renderer only |
| Professional truth, quality, artifacts, and delivery | Domain owners | Refs-only presentation |
| Candidate source, bridge, renderer, packaging, and focused tests | This repository | Implementation evidence only |

The App registry keeps Studio as the foreground alternative while its first-party
product implementation is developed. Active-shell adoption and release
participation still require separate App-owner qualification. Studio does not maintain a private proposal,
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

`npm test` covers typecheck, desktop/headless focused regressions,
candidate/state validators, WebUI and visual smoke, Electron package
construction, and package validation.
Run `npm run smoke:desktop-live` separately for local packaged-window evidence.
Run `npm run smoke:docker` separately for a local OCI build/runtime smoke.
See [verification](docs/verification.md) before interpreting either result.

</details>
