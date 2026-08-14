# Candidate Verification

Owner: `one-person-lab-app`
Purpose: `candidate_verification_boundary`
State: `active_support`
Machine boundary: Command and evidence interpretation guide. Passing commands
proves only the named source, test, build, package, or local-smoke layer; it does
not prove App adoption, release, owner acceptance, or production readiness.

## Repository-Native Gate

```bash
npm ci
npm test
```

`npm test` runs the repository's current typecheck, Electron host/updater tests,
standalone headless process tests, Gateway-account projection regression,
standard thread adapter/lifecycle/subagent tests, candidate and state
validators, WebUI and visual smoke, Electron directory packaging, and package
validation. Read `package.json` before relying on this summary because the
script is the command owner.

## Focused Commands

| Command | Evidence layer |
| --- | --- |
| `npm run typecheck` | TypeScript source consistency |
| `npm run test:desktop` | Electron isolation, IPC adapter, updater, and guarded shutdown behavior |
| `npm run test:headless` | Standalone bind/config validation, health/readiness, real child App Server startup, and bounded signal shutdown |
| `npm run test:threads` | Standard Desktop/WebUI thread lifecycle, pagination, renderer, and Codex subagent projection tests |
| `npm run test:webui-host` | Shared host core, HTTP/SSE, model/thread pagination, OPL projection, and read-only mutation guard |
| `npm run validate:candidate` | Required source markers and false-ready guards |
| `npm run validate:state-model` | App-state projection mapping |
| `npm run smoke:webui` | Local WebUI host/renderer smoke |
| `npm run smoke:visual` | Source-level visual smoke |
| `npm run package` | Current-platform Electron directory package construction |
| `npm run validate:package` | Electron package and three-platform builder configuration structure |
| `npm run build:docker` | Local source-candidate OCI image construction only |
| `npm run smoke:docker` | Local Docker build/run, health/readiness, non-root PID 1, persistent mounts, and guarded stop |

When the App checkout mounts this repository at the expected candidate path,
the App owner can also run `npm run validate:candidate:native`. That is App
candidate-conformance evidence, not release adoption.

## Local Packaged-App Smoke

```bash
npm run smoke:desktop-live
```

This command launches the current macOS directory package, requires a real
window, and verifies that quitting the App removes its Electron and Codex App
Server processes. Its output is local candidate evidence only. It does not establish
clean-VM behavior, shared Runtime parity, active-shell adoption, or release
readiness.

## Local Headless And Docker Smoke

```bash
npm run build:webui
npm run start:headless
```

Read `/healthz` for liveness and `/readyz` for Codex App Server initialization.
Stopping the process with SIGINT or SIGTERM must emit
`headless_server_stopped` inside the configured shutdown bound.

When a local Docker daemon is available:

```bash
npm run smoke:docker
```

The smoke builds an isolated candidate tag, starts it with isolated `/data` and
`/projects` volumes, verifies HTTP health and readiness, UID 1000 and Node PID 1,
then stops and removes its container, volumes, and image. This proves only the
local source candidate on the current Docker host. It does not prove an OCI
registry publication, image digest/cohort authority, multi-architecture build,
clean-host install, update/rollback, remote access safety, or release readiness.

## False-Ready Guard

The following remain false unless their owning App/runtime/domain/release gates
provide exact fresh evidence:

- `active_shell_adopted`
- `release_ready`
- `production_ready`
- `clean_vm_ready`
- `remote_ready`
- `domain_ready`
- `owner_receipt`
- `package_truth_owned`
- `runtime_authority_transfer`
- `domain_truth_owned`

The machine-readable candidate marker requirements and false-ready fields live
in `src/candidateContractEvidence.json`. This prose explains their meaning; it
does not replace that validator input.
