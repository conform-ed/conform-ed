# Release Process

All publishable packages **and** the OCI runner images are released together under a single
bare semver tag. Never publish a package or push an image tag individually — the tag is the single
source of truth for every artifact version.

## Versioning

- Tags are **bare semver**: `0.1.0`, `0.1.0-rc.1` — **no `v` prefix**.
- Every publishable package is bumped to the same version on each release.
- npm packages (`@conform-ed/*`) publish to npmjs; OCI images publish to GHCR
  (`ghcr.io/conform-ed/<image>`).

## Release Steps

Use the unified release script:

```bash
bun run release <version>
# Example:  bun run release 0.1.0
# Dry-run:  DRY_RUN=1 bun run release 0.1.0
```

The script:

1. Validates the version and that the working tree is clean.
2. Builds every package (`bun run build`) so each publishable `dist/` is fresh.
3. Bumps `version` in every publishable package's `package.json` and updates the lockfile.
4. Commits `chore: release <version>` and creates the bare semver git tag.
5. Pushes the branch and tag — the **tag push triggers the `Images` workflow**, which builds and
   pushes the OCI images to GHCR and runs pull-based smoke verification.
6. Runs `bun publish --access public` for all npm packages in parallel.

Before releasing, ensure the branch is green: `bun run validate`, and that you are authenticated to
npm. The npm publish runs locally (it uses your credentials); the OCI build/publish runs in CI off
the tag.

## OCI image surface

The `Images` workflow publishes the runner images to GHCR with OCI labels (`title`, `version`,
`revision`, `source`, `created`), emits a machine-readable release manifest, and smoke-verifies that
each published tag is pullable and correctly labelled.

## Rollback Guidance

- Each publish keeps immutable SHA-tagged images.
- Never force-reuse a version tag.
- Roll back by pointing at the previous SHA tag.
