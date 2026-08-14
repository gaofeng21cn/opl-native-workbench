# Third-Party Notices

## DeepSeek Harness

OPL Studio directly reuses the following DeepSeek Harness runtime packages:

- `@deepseek-ai/dsh-client-ui-slots` `0.1.0-rc.6`
  (`sha512-F4VZA60bMRi4DAbZvNipM4E/Jl01QC0cQCPpeIEIh1/lq/y/bpc7IqujtzWESHPe3qSljTURip3hkANfsYs3UA==`)
- `@deepseek-ai/dsh-client-web-react` `0.1.0-rc.6`
  (`sha512-2PAnRsZzokVr/nCcwX87axdxzobQYp76xzX70vYSqghlDab1phsIdgDSm1JxpszN9G3ETBMTLPM9xz30iodqYQ==`)
- `@deepseek-ai/dsh-invariants` `0.1.0-rc.6`
  (`sha512-WfEfOi99a4cpOugRAHTBSTnesLieu3ist1q9PXDXFBHX++K1rAl9+sB7YrdnbB8LH0UOY532gS9xJUYU6w0SLw==`)
- `@deepseek-ai/cordis` `4.0.1`
  (`sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw==`)

Source repository: <https://github.com/deepseek-ai/deepseek-harness>

Inspected source ref: `47f943859bef60e4160492346772ded9b24f765a`

The complete `src/` trees of six GUI packages are vendored byte-for-byte from
that ref under `src/vendor/deepseek-harness/packages/client/`:

- `ui-layout`
- `ui-sidebar`
- `ui-conversation`
- `ui-settings-general`
- `ui-theme`
- `ui-primitives`

The snapshot contains 207 files, including the upstream `LICENSE`. Its package
roots, per-file SHA-256 inventory, source package version (`0.1.0-rc.5`), and
update boundary are recorded in
`src/composition/deepseekHarnessSourceManifest.json`; `npm run verify:dsh-gui`
checks local byte parity. OPL changes stay outside the vendor root.

The live OPL Studio composition directly renders upstream `AppFrame`,
`SidebarRoot`, `ConversationRoot`/`EmptyHero`, `InputBar`, and `SettingsRoot`.
`SlotCore` and `createSlotRenderer()` provide registration, disposal, and entry
error isolation. OPL components import `Button`, `Pill`, `Input`, `Tooltip`,
`StateDot`, `MessageText`, and icons directly from the vendored upstream
`@deepseek-ai/dsh-client-ui-primitives` index. OPL branding replaces the
upstream wordmark and fish through vendor-external styles and packaged assets;
no primitive control or icon is reimplemented. Imports for unavailable
attachment and runtime packages terminate in narrow OPL-owned adapters.

DeepSeek Harness session, agent, provider, credential, connection,
plugin-manager, and control-plane authority are not adopted. Cordis is used
only as the composition substrate required by the slot packages; OPL Studio
does not create a second plugin runtime or plugin manager.

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
