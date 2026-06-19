# Release Process

All publishable packages **and** the OCI runner images are released together under a single bare
semver tag — the tag is the single source of truth for every artifact version. This implements the
unified standard; see [ADR-0016](../adr/0016-unified-ts-release-versioning-tooling-standard.md).

## Versioning

- Tags are **bare semver**: `0.1.0`, `0.1.0-rc.1` — **no `v` prefix**.
- Publishable `package.json` versions are `"0.0.0"` placeholders that are **never hand-edited**. The
  real version is derived from the tag at publish time; `git describe --tags` shows it locally.
- There is no version-bump step and no release commit.

## Release Steps

```bash
# 1. Tag a reviewed commit on main and push the single tag. CI validates (validate:full), then
#    publishes release-parity to GitHub Packages AND builds + pushes the OCI images to GHCR.
git tag 0.1.0 && git push upstream 0.1.0

# 2. Once the GitHub Packages publish is green, mirror the packages to public npm
#    (your npm token stays on your machine; this never runs in CI).
bun run release:npm 0.1.0
```

`release:npm` downloads the exact tarballs GitHub Packages built for the tag and `bun publish`es them
byte-identical to npm — no rebuild. Be logged in to npm (`bun pm whoami`); GitHub read uses
`gh auth token` (needs `read:packages`). Preview with `DRY_RUN=1 bun run release:npm 0.1.0`.

> Push **one tag at a time** — GitHub suppresses workflow events when more than three tags are pushed
> at once, which would silently skip the publish and the image builds.

## OCI image surface

The `Images` workflow (tag-triggered) publishes the runner images to GHCR with OCI labels (`title`,
`version`, `revision`, `source`, `created`), emits a machine-readable release manifest, and
smoke-verifies that each published tag is pullable and correctly labelled. The interop/container test
lanes (lrs/cmi5/lti13) keep their own cadence (ADR-0015) and are not part of the release gate.

## Rollback Guidance

- Each publish keeps immutable SHA-tagged images.
- Never force-reuse a version tag.
- Roll back by pointing at the previous SHA tag.
