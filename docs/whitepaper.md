# One Person Lab Studio Application Host Architecture

Owner: `one-person-lab-app`
Purpose: `application_host_architecture_rationale`
State: `active_technical_whitepaper`
Machine boundary: This paper explains the Studio candidate design. App
contracts, Framework output, Codex App Server, candidate source/tests, and an
explicit App adoption decision remain their respective authorities.

## One Product, Replaceable Renderers

One Person Lab App is one product with one product profile and one release
authority. AionUI is the current Stable renderer; `opl-studio` is the
DSH/Cordis Application Host implementation intended for the Studio carrier.
Their carriers and visual implementations may differ,
but they cannot fork product state, Package identity, action semantics, or
release truth.

Studio directly reuses the pinned MIT-licensed DeepSeek Harness Application
Host packages and GUI modules.
Typography, spacing, layout, colors, component states, and ordinary interaction
stay upstream-owned. OPL adds text identity, real product data, and thin bridge
adapters outside the vendored source. This keeps the candidate visually stable
and makes future DSH updates a bounded source-reuse operation instead of a
second design-system maintenance stream. The same pinned cohort provides the
profile loader, Cordis plugin lifecycle, native tool registry, WebServer,
frontend modules, and plugin inventory.

## Two Hosts, Separate Owners

Studio and Framework are separate Cordis Hosts because they own different
process-local responsibilities:

```text
Studio Host: App plugins + GUI + Codex lifecycle + DSH tool exposure
Framework Host: OPL runtime + Package composition + projections
Bridge: opl app state/action + authentication + channel callback
```

Neither Host shares internal registries or writes the other's state. Studio
does not load `dsh-base`; `opl-codex-native` remains the only thread/turn owner,
while Framework remains the runtime/Package owner.

DSH plugins that register tools in `ctx.tools` become callable by Codex through
Studio's authenticated loopback MCP. This is the direct compatibility surface.
Plugins that depend on DSH session, LLM provider, Agent loop, or credential
services are outside that surface and need an explicit OPL adapter.

## Host-Derived Client Composition

The composition path is deliberately one-way:

```text
OPL Packages
  -> Framework Host composition and allowlisted projection
  -> App product profile, Client ABI, slots, and action policy
  -> Host-derived Client Cordis
  -> AionUI or DSH renderer
```

Framework is the only OPL runtime and Package composition authority. App owns the product profile,
GUI ABI, active shell, and release composition. A GUI Client receives only the
allowlisted projection. It cannot discover or install Packages, maintain a
registry or currentness plane, obtain release-operation, or own task, Package,
product, state, or action truth.

Studio implements the App Client face with one `@deepseek-ai/cordis` context,
the `opl.app.client-contributions` service, the
`opl/app-client-contributions/updated` event, and the three App-declared slots.
DSH `SlotCore` supplies renderer registration, ordering, disposal, and entry
error isolation. This browser Client projection is not another Framework Host;
the server-side Studio Application Host is a separate, explicitly owned process
scope described above.

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
