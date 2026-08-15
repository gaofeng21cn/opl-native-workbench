# One Person Lab App Candidate Client Architecture

Owner: `one-person-lab-app`
Purpose: `candidate_client_architecture_rationale`
State: `active_technical_whitepaper`
Machine boundary: This paper explains the Studio candidate design. App
contracts, Framework output, Codex App Server, candidate source/tests, and an
explicit App adoption decision remain their respective authorities.

## One Product, Replaceable Renderers

One Person Lab App is one product with one product profile and one release
authority. AionUI is the current release renderer; `opl-studio` is the
DSH-derived candidate. Their carriers and visual implementations may differ,
but they cannot fork product state, Package identity, action semantics, or
release truth.

Studio directly reuses the pinned MIT-licensed DeepSeek Harness GUI modules.
Typography, spacing, layout, colors, component states, and ordinary interaction
stay upstream-owned. OPL adds text identity, real product data, and thin bridge
adapters outside the vendored source. This keeps the candidate visually stable
and makes future DSH updates a bounded source-reuse operation instead of a
second design-system maintenance stream.

## Host-Derived Client Composition

The composition path is deliberately one-way:

```text
OPL Packages
  -> Framework Host composition and allowlisted projection
  -> App product profile, Client ABI, slots, and action policy
  -> Host-derived Client Cordis
  -> AionUI or DSH renderer
```

Framework is the only Host composition authority. App owns the product profile,
GUI ABI, active shell, and release composition. A GUI Client receives only the
allowlisted projection. It cannot discover or install Packages, maintain a
registry or currentness plane, obtain release-operation, or own task, Package,
product, state, or action truth.

Studio implements the App Client face with one `@deepseek-ai/cordis` context,
the `opl.app.client-contributions` service, the
`opl/app-client-contributions/updated` event, and the three App-declared slots.
DSH `SlotCore` supplies renderer registration, ordering, disposal, and entry
error isolation. This is a Client projection of the Framework Host graph, not a
second Host.

## Dynamic Brand Capabilities

The candidate does not encode a fixed list of OPL brands or standard Agents.
Available combinations come from the current App/Framework projection and its
allowlist. A local label fallback may improve presentation, but it cannot add a
Package or capability to the graph. This lets the family evolve without a GUI
release for every brand combination while keeping admission centrally bounded.

## Shared State And Action Semantics

Both renderers normalize the same `opl_app_ui_contributions_projection.v1`
input, use the same identity and ordering rules, and mount only
`settings.section`, `runtime.detail`, and `composer.palette`. Projected commands
map to the canonical `package_contribution_execute` App action with the exact
`package_id`, `ref`, `input`, and `confirmed` payload. Commands marked for
confirmation open the renderer's existing confirmation surface; successful
execution is followed by fresh App state readback.

The candidate conformance gate binds these claims to exact Framework, App,
AionUI, and Studio Git objects. It loads the real Framework producer, compares
both parsers, product compositions, and the App-owned Client compatibility
profile, then exercises Studio Client Cordis event, slot, action, and state
behavior. The receipt stays outside Git because it is run evidence, not product
truth.

## Admission Boundary

Client compatibility raises the candidate baseline but does not make Studio the
active shell. Signing, notarization, clean installation, updater cohorts,
cross-platform and OCI qualification, security admission, rollback, and an
explicit App-owner cutover remain separate. Until those gates pass, AionUI
stays the release shell and all Studio readiness fields remain false.
