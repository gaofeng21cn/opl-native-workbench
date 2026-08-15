# OCI Distribution Candidate

The OCI carrier packages the same React renderer and Node host core used by the
desktop and standalone WebUI carriers. It does not contain Electron, AionUI, or
AionCore. This document describes a source candidate, not an admitted release.

## Host-Managed Lifecycle

The host manager keeps installation state outside the checkout and drives the
fixed `docker-compose.distribution.yaml` template. Registry installs and updates
must use a digest reference:

```bash
node scripts/oci/manage.mjs install \
  --image ghcr.io/OWNER/IMAGE@sha256:DIGEST
node scripts/oci/manage.mjs status
node scripts/oci/manage.mjs start
node scripts/oci/manage.mjs update \
  --image ghcr.io/OWNER/IMAGE@sha256:NEW_DIGEST
node scripts/oci/manage.mjs recreate
node scripts/oci/manage.mjs rollback
node scripts/oci/manage.mjs uninstall
```

`install` and `update` resolve and record the observed Docker image ID. Update
does not advance the state file until the new container is healthy. If startup
fails, the manager recreates the previous image and reports whether recovery
succeeded. `rollback` swaps the current and previous immutable identities.

Uninstall preserves the named `/data` and `/projects` volumes. Destructive data
removal requires the explicit `uninstall --purge-data` form. The operation lock
prevents concurrent host lifecycle writers, the installed Compose template is
checked against its recorded SHA-256 before each Docker mutation, and the state
file is replaced atomically with user-only permissions.

For a locally built candidate, `--allow-local-image` is required. The manager
then stores the image ID, never the mutable tag, and marks the receipt as local
candidate evidence. This option is not a registry release path.

## Security Boundary

The distribution template enforces UID/GID 1000, a read-only root filesystem,
`no-new-privileges`, all Linux capabilities dropped, a bounded PID count, and a
restricted temporary filesystem. Only `/data` and `/projects` are persistent.
The HTTP port is published on `127.0.0.1`; the manager exposes no option to
publish on a remote interface.

The current HTTP bridge has no remote authentication boundary. Reverse proxy,
TLS, password, Internet exposure, and multi-user authorization therefore remain
outside this candidate. Operators must not bypass the loopback binding and
expose it to an untrusted network.

## Multi-Architecture Contract

The source contract targets `linux/amd64` and `linux/arm64` from one Dockerfile.
Generate the non-executing build plan with an exact source revision:

```bash
node scripts/oci/build-plan.mjs \
  --image ghcr.io/OWNER/IMAGE:v26.8.15 \
  --source-revision 0123456789abcdef0123456789abcdef01234567 \
  --framework-ref 0123456789abcdef0123456789abcdef01234567 \
  --app-ref 0123456789abcdef0123456789abcdef01234567 \
  --output ./out/one-person-lab.oci.tar
```

The plan requests BuildKit provenance, an SBOM, both platforms, and a local OCI
layout. It deliberately does not execute a build or push an image. The
non-release workflow executes that plan into runner-local storage, checks that
the OCI index contains `linux/amd64` and `linux/arm64` plus attestation
descriptors, and runs the host manager's full lifecycle on each architecture.
It has no registry login or push step. Registry digest parity, signatures,
vulnerability policy, public publication, clean-host installation, and final
release runtime readback remain separate owner gates.

The Dockerfile pins the multi-platform Node base by digest and pins App and
Framework source inputs by Git commit. Codex and Bun are exact package versions,
but their registry artifact integrity is not independently attested by this
repository. OCI labels record the supplied source revision; a label is
provenance metadata, not signature verification.

## Validation

```bash
node --test tests/oci/*.test.mjs tests/headless/docker-contract.test.mjs
npm run smoke:docker:lifecycle
npm run smoke:docker
npm test
docker compose config
docker compose -f docker-compose.distribution.yaml config
git diff --check
```

The lifecycle smoke builds two local images, then proves install, start, update,
recreate, rollback, preserving uninstall, reinstallation, destructive uninstall,
volume persistence, health, image identity, loopback publication, and container
hardening on the current Docker host. The hosted non-release workflow adds the
two-platform OCI layout and per-architecture QEMU lifecycle, but neither path
proves a public image, registry identity, release cohort, or production
admission.
