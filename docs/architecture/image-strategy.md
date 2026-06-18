# Image Strategy

## Distribution Policy

v0.x release channel is OCI-only.

- primary registry: GHCR
- Docker Hub mirror: optional and disabled by default

## Image Set

Published images:

- `lrs-runner`
- `cmi5-runner`
- `lti13-runner`
- `cmi5-adapter-reference`
- `lti13-adapter-reference`

## Tag Strategy

Build/publish scripts support:

- `VERSION_TAG` for release labels (for example `v0.1.0-rc.1`)
- `sha-<short_sha>` traceability tags
- optional `latest` tag through explicit opt-in

## OCI Metadata Labels

Images should include labels aligned with OCI recommendations:

- `org.opencontainers.image.title`
- `org.opencontainers.image.version`
- `org.opencontainers.image.revision`
- `org.opencontainers.image.source`
- `org.opencontainers.image.created`

## Build Runtime

Build scripts assume Podman CLI.

GitHub Actions image workflow installs and uses Podman, then authenticates to GHCR before pushing tags.

## Release Candidate Flow

For first release candidates:

1. derive `VERSION_TAG` from git tag when available.
2. otherwise derive `VERSION_TAG` from workflow run metadata as RC tag.
3. build with OCI labels and push GHCR tags.

## Reproducibility Notes

- Pin Bun runtime version in Containerfiles.
- Keep container build context deterministic.
- Keep image publishing scripts idempotent for reruns on the same commit.

## Third-Party Counterpart Images (interop lanes)

conform-ed's GHCR publishes **only conform-ed's own artifacts** (the runners and
adapters above). Third-party Counterparts used by `oss-*` interop lanes
(e.g. Moodle, MongoDB, `go-oneroster`, LRSQL — see ADR-0015) are **referenced
from their upstream registry by pinned digest and pulled at runtime — never
mirrored, rebuilt, or republished** into conform-ed's registry.

This keeps conform-ed's redistribution surface to its own MIT-licensed code and
avoids triggering the copyleft / source-available terms of those images (Moodle
GPLv3, MongoDB SSPL, …), which permit pull-and-run for testing but not mirroring
or managed-service offerings.

## Counterpart Catalogue Entry Fields

Each `(suite, role)` Counterpart Catalogue entry (ADR-0015) records, at minimum:

- `counterpart` — name and project URL
- `role` — the role it fills (the side _opposite_ the system under test)
- `specVersion` — the spec version it implements (may differ from the SUT's)
- `license` — the counterpart's license
- `image` — upstream image reference **pinned by digest**
- `seeding` — how the Fixture Dataset is loaded (spec-shaped PUT, backend import, …)
- `provenance` — certification status / maturity note
  (e.g. "alpha; IMS-certified OneRoster 1.1 rostering consumer")
