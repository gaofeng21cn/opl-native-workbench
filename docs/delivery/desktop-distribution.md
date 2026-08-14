# macOS Desktop Distribution Evidence

`opl-studio` remains the side-by-side successor candidate. Its current bundle identity is
`cn.gflab.opl.studio.preview`; this evidence does not adopt it as the active release shell or replace the
installed AionUI-based App.

`npm run dist:mac` builds the shared Electron renderer/host, emits the Developer ID signed updater ZIP and
ULFO DMG, creates byte-identical `latest-mac.yml` and `latest-arm64-mac.yml`, and validates every feed
size/hash against the final artifacts. The extracted updater App must have the package version, a Developer
ID Application chain, TeamIdentifier, hardened runtime, and the dedicated `gaofeng21cn/opl-studio` feed.

The default qualification records Gatekeeper and stapling readback but does not convert missing Apple trust
evidence into success. `npm run qualify:desktop:mac:release` is fail-closed and requires Gatekeeper acceptance
plus stapled App and DMG tickets. Local Developer ID signing alone is a distributable candidate, not release
readiness, notarization, installed replacement, active-shell adoption, or public artifact authority.

`npm run qualify:desktop:updater:local` exercises the packaged Squirrel.Mac path against a credential-free
loopback feed. It builds an isolated base App and one-patch-newer ZIP with a qualification-only bundle id,
downloads and installs the update, reads the replaced App version, relaunches it, and reads the running updater
version through the host contract. HOME, Electron state, installation, builder output, and feed all live under
one temporary root; the command removes them after writing `out/macos-desktop-updater-qualification.json`.
This proves the local packaged update chain, not the GitHub release feed or Apple notarization.
