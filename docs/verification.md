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

`npm test` runs the repository's current typecheck, native-command regression,
Gateway-account projection regression, coordination tests, candidate and state
validators, WebUI and visual smoke, package construction, and packaged-runtime
validation. Read `package.json` before relying on this summary because the
script is the command owner.

## Focused Commands

| Command | Evidence layer |
| --- | --- |
| `npm run typecheck` | TypeScript source consistency |
| `npm run test:coordination` | Local coordination protocol/security and renderer-source tests |
| `npm run validate:candidate` | Required source markers and false-ready guards |
| `npm run validate:state-model` | App-state projection mapping |
| `npm run smoke:webui` | Local WebUI host/renderer smoke |
| `npm run smoke:visual` | Source-level visual smoke |
| `npm run package` | Candidate bundle construction |
| `npm run validate:package` | Packaged-runtime structure |

When the App checkout mounts this repository at the expected candidate path,
the App owner can also run `npm run validate:candidate:native`. That is App
candidate-conformance evidence, not release adoption.

## Local Packaged-App Smoke

```bash
npm run smoke:native-live
```

This command launches a fresh local candidate bundle, requires a new process and
real window, captures that window, checks renderer markers, and verifies process
cleanup. Its output is local candidate evidence only. It does not establish
clean-VM behavior, shared Runtime parity, active-shell adoption, or release
readiness.

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
