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
| `npm run test:client-cordis` | Studio Client Cordis policy, typed event/slot lifecycle, and exact contribution action request |
| `npm run validate:client-conformance` | Fresh four-repository Host -> App -> Studio/AionUI compatibility and wire-ref readback |
| `npm run validate:candidate` | Required source markers and false-ready guards |
| `npm run validate:state-model` | App-state projection mapping |
| `npm run smoke:webui` | Local WebUI host/renderer smoke |
| `npm run smoke:visual` | Source-level visual smoke |
| `npm run package` | Current-platform Electron directory package construction |
| `npm run validate:package` | Electron package and three-platform builder configuration structure |
| `npm run dist:windows` | Unsigned Windows x64 unpacked app, NSIS, and ZIP construction with publishing disabled |
| `npm run dist:linux` | Unsigned Linux x64 unpacked app, AppImage, and DEB construction with publishing disabled |
| `npm run qualify:desktop:distribution` | Current-platform native package-set presence and executable-shape checks |
| `npm run smoke:desktop-live` | Current-platform unpacked packaged executable startup, Chromium AX tree, and App Server cleanup smoke |
| `npm run build:docker` | Local source-candidate OCI image construction only |
| `npm run smoke:docker` | Local Docker build/run, health/readiness, non-root PID 1, persistent mounts, and guarded stop |

## Cross-GUI Client Qualification

```bash
npm run validate:client-conformance -- --out out/qualification/client-conformance.json
```

The gate reads Framework, App, AionUI, and Studio remote-main refs, verifies
local tracking refs against the wire, materializes the canonical Framework
producer in a temporary directory, and runs one Host projection through both
GUI parsers and Studio Client Cordis. It also compares the App and generated
AionUI composition model plus `client_renderer_compatibility` profile, verifies
Studio derives the same RPC/event/state/brand policy, and checks the exact App
contribution action shape. The tracked evidence fixes the three external owner
repositories; each ignored receipt also records the Studio main and candidate
commit/tree observed by that exact run.

Run the AionUI focused DOM test in its own repository to exercise its real
renderer caller:

```bash
bunx cross-env VITEST_INCLUDE_DOM=1 vitest run --project dom \
  tests/unit/opl-runtime/OplUiContributionSlot.dom.test.tsx
```

These gates establish renderer compatibility for the tested cohort. They do
not adopt Studio, switch the active shell, or qualify a release artifact.

## Rendered WebUI Acceptance

```bash
node scripts/acceptance/rendered-ui.mjs
```

This CLI-first browser gate starts the shared WebUI against the repository fake
App Server, checks the wide and narrow layouts, the three on-demand context
tabs, all App-owned settings destinations, and Settings modal focus
containment/restoration. It writes screenshots and an exact source/renderer/DSH
cohort receipt under ignored `out/acceptance/`.

This is local rendered candidate evidence. It does not establish human Pixel
approval, screen-reader qualification, a packaged or installed carrier, active
shell adoption, or Release readiness.

When the App checkout mounts this repository at the expected candidate path,
the App owner can also run `npm run validate:candidate:native`. That is App
candidate-conformance evidence, not release adoption.

## Local Packaged-App Smoke

```bash
npm run smoke:desktop-live
```

This command launches the current-platform unpacked package, requires a real
window and a passing Chromium accessibility-tree smoke, and verifies that
quitting the App removes its Electron and Codex App Server processes. Its
output is candidate evidence only. It does not establish an installer flow,
clean-VM behavior, shared Runtime parity, native screen-reader behavior,
active-shell adoption, or release readiness.

## Hosted Windows And Linux Candidate Qualification

`.github/workflows/non-release-validation.yml` builds and checks exact-head
unsigned candidates on GitHub-hosted Windows x64 and Linux x64 runners:

- Windows requires the unpacked executable, NSIS installer, and ZIP, then
  launches the unpacked packaged executable;
- Linux requires the unpacked executable, AppImage, and DEB, prepares the
  packaged Chromium sandbox as `root:root` mode `4755`, and launches the
  unpacked packaged executable under Xvfb;
- both platforms require a visible One Person Lab window, a Chromium AX tree
  with no unnamed interactive controls, and bounded App Server cleanup;
- every distribution command uses `--publish never`.

This closes the first native package and packaged-startup baseline. It does not
install the NSIS, AppImage, or DEB on a clean VM; prove uninstall, update, or
rollback; exercise Windows UIA or Linux AT-SPI; run NVDA or Orca; sign or
publish artifacts; or establish platform support or release readiness.

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
