# OPL Native Workbench Documentation

Owner: `one-person-lab-app`
Purpose: `docs_index`
State: `active_index`
Machine boundary: Human-readable navigation and ownership map. App contracts,
Framework state/action output, Codex App Server, source/tests, and explicit owner
decisions remain the corresponding machine and product truth.

This repository is an implementation carrier for one App shell candidate. It
does not own App product requirements, OPL runtime/package truth, Codex thread
truth, domain verdicts, release adoption, or production readiness.

## Current Owners

| Theme | Single Source of Truth |
| --- | --- |
| Public candidate entry | [Root README](../README.md) |
| Candidate implementation boundary | [Architecture](./architecture.md) |
| Current state, open gaps, and next prompt | [Single Active Truth plan](./active/current-state-vs-ideal-gap.md) |
| Validation meaning | [Verification](./verification.md) |
| Superseded implementation and visual baseline | [History](./history/README.md) |
| App product, candidate role, and adoption | `one-person-lab-app` contracts and GUI docs |
| Runtime/package state and actions | OPL Framework contracts and fresh `opl app ... --json` output |

Canonical filenames are mapped without creating duplicate truth:

- the root README carries the `project` role;
- the Active Truth plan carries the `status` role;
- `AGENTS.md` and `architecture.md` carry repo invariants;
- App-owned contracts carry product/adoption decisions, so this repository does
  not create a second `decisions.md`.

## App Authority Inputs

- [`app-shell-candidates.json`](https://github.com/gaofeng21cn/one-person-lab-app/blob/main/contracts/app-shell-candidates.json): Native is the foreground alternative candidate; AionUI remains active.
- [`app-shell-adapter.json`](https://github.com/gaofeng21cn/one-person-lab-app/blob/main/contracts/app-shell-adapter.json): only this contract can change the active release shell.
- [`opl-native-workbench-plan.md`](https://github.com/gaofeng21cn/one-person-lab-app/blob/main/docs/product/gui/opl-native-workbench-plan.md): further Native product work requires explicit re-entry.
- [`app-gui-product-contract.json`](https://github.com/gaofeng21cn/one-person-lab-app/blob/main/contracts/app-gui-product-contract.json): product behavior and allowed state/action surfaces.

These links are owner inputs, not copied truth. Read their current `main` bytes
before changing candidate behavior or status language.

## Current Portfolio Coverage

Every tracked `README*` and `docs/**/*.md` file is assigned below; no active
document is unclassified.

| Lifecycle | Covered files |
| --- | --- |
| Public entry | `README.md` |
| Navigation and architecture | `docs/README.md`, `docs/architecture.md` |
| Active Truth | `docs/active/current-state-vs-ideal-gap.md` |
| Verification support | `docs/verification.md` |
| History/provenance | `docs/history/README.md`, `docs/history/2026-07-candidate-baseline.md` |

## Growth Rule

Do not add candidate roadmaps, product specs, model lists, package catalogs, or
thread-state documents here. Update an existing owner or route a product
decision to App. New candidate docs require one durable purpose, lifecycle
state, and authority boundary.
