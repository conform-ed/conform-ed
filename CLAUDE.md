# conform-ed — AI Agent Instructions

## Package Manager

Always use **bun** for all package operations. Never use `npm`, `yarn`, or `pnpm`.

- `bun install` — install dependencies
- `bun run <script>` — run scripts
- `bun publish --access public` — publish packages (never `npm publish`)
- `bun info <pkg>` — check package info

## Temporary Files

Temporary files, scratch scripts, logs, and one-off artifacts must go under `tmp/` (repo root).
Never create temporary files in source directories or at repo root.

## Publishing Packages

All packages and OCI images are released together using a single semver tag. Never publish
individually or out-of-step. Use the unified release script:

```
bun run release <version>
# Example: bun run release 0.0.8
# Dry-run:  DRY_RUN=1 bun run release 0.0.8
```

The script:

1. Validates the version and checks the working tree is clean.
2. Bumps `version` in every publishable package's `package.json`.
3. Commits `chore: release <version>` and creates a bare semver git tag (`0.0.8`, not `v0.0.8`).
4. Pushes the branch and tag — this triggers GitHub Actions to build and push OCI images.
5. Runs `bun publish --access public` for all npm packages in parallel.

**Never** publish an npm package or push an OCI image tag without going through this script.
The bare semver tag is the single source of truth for all artifact versions.

## Type Checking

Use `bun run typecheck` — not `tsc` or `bunx tsgo --noEmit` directly.
