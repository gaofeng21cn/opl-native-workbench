# Third-Party Notices

## DeepSeek Harness

OPL Studio directly reuses the following DeepSeek Harness runtime packages:

- `@deepseek-ai/dsh-client-ui-slots` `0.1.0-rc.8`
  (`sha512-mwmSDuUG2BTcmPSL/o6esCYmjiwlW+uV3+ZZKIHzCxNVZ0AFMsfPQNZLhNSC2SYYw3SuIPb2R1W9DorB++KVyQ==`)
- `@deepseek-ai/dsh-invariants` `0.1.0-rc.8`
  (`sha512-u0lYqyxOYwfsVnbsfGXZos5vFvA4cqFnBEW3/ezgljNwkYwzeUP/Y5wjPnQjP+ZzBn3CnVeIF6s2N2Vk3iA5mQ==`)
- `@deepseek-ai/cordis` `4.0.1`
  (`sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw==`)
- `use-sync-external-store` `1.2.0`
  (`sha512-eEgnFxGQ1Ife9bzYs6VLi8/4X6CObHMw9Qr9tPY43iKwsPw8xE8+EFsf/2cFZ5S3esXgpWgtSCtLNS41F+sKPA==`)

Source repository: <https://github.com/deepseek-ai/deepseek-harness>

Inspected source ref: `141eb6fef83422698aef7a981029e843e8161534`

The complete `src/` trees of eleven GUI packages are vendored byte-for-byte from
that ref under `src/vendor/deepseek-harness/packages/client/`:

- `ui-layout`
- `ui-sidebar`
- `ui-conversation`
- `ui-input-trigger`
- `ui-model-selection`
- `ui-agent-preset`
- `ui-workspace`
- `ui-settings-general`
- `ui-theme`
- `ui-primitives`
- `ui-renderer`

The snapshot contains 277 files, including the upstream `LICENSE`. Its package
roots, per-file SHA-256 inventory, source package version (`0.1.0-rc.8`), and
update boundary are recorded in
`src/composition/deepseekHarnessSourceManifest.json`; `npm run verify:dsh-gui`
checks local byte parity. OPL changes stay outside the vendor root.

The live One Person Lab composition directly renders upstream `AppFrame`,
`SidebarRoot`, `WorkspaceBrowser`, `ConversationRoot`/`EmptyHero`, `InputBar`,
`AgentPresetSeat`, `ModelSelect`, and `SettingsRoot`.
`SlotCore` and the pinned `ui-renderer` source for `createSlotRenderer()` provide
registration, disposal, and entry error isolation. OPL components import `Button`, `Pill`, `Input`, `Tooltip`,
`StateDot`, `MessageText`, and icons directly from the vendored upstream
`@deepseek-ai/dsh-client-ui-primitives` index. User-visible identity uses the
rc8 brand slots with the text `OPL` / `One Person Lab`; no OPL logo, parallel
type scale, layout, color system, primitive control, or icon is introduced. The
rc8 attachment slot is occupied by a null adapter and does not enable a
multimodal runtime. Workspace host description remains unavailable until the
App ABI supplies it; the POSIX home-path compatibility shim therefore does not
claim a visible `~` abbreviation.

DeepSeek Harness session, agent, provider, credential, connection,
plugin-manager, and control-plane authority are not adopted. The Client Cordis
graph is derived from the Framework Host graph and App-owned profile/slot
policy; it does not discover Packages or create a second registry, currentness,
state, session, or action authority.

MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## use-sync-external-store

MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
