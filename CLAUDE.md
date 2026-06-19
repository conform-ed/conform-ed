# conform-ed — AI Agent Instructions

## Package Manager

Always use **bun** for all package operations. Never use `npm`, `yarn`, or `pnpm`.

- `bun install` — install dependencies
- `bun run <script>` — run scripts
- `bun publish --access public` — publish packages (never `npm publish`)
- `bun info <pkg>` — check package info

## Temporary Files

This rule is about the **assistant's development-time scratch**, not application runtime
behavior. Shipped code may write runtime temp files (e.g. a server extracting an uploaded
package to the OS temp dir) — that is normal and allowed; never avoid it for this rule.

For assistant scratch (scripts, logs, one-off artifacts): must go under `tmp/` (repo root).
Never create such files in source directories or at repo root.

## Publishing Packages

Packages and OCI images release together under a single **bare semver tag** — the tag is the _only_
source of truth for every artifact version. Publishable `package.json` versions are `"0.0.0"`
placeholders; **never hand-edit them**. Full detail: `docs/development/release.md` and
[ADR-0016](docs/adr/0016-unified-ts-release-versioning-tooling-standard.md).

```
git tag 0.1.0 && git push upstream 0.1.0   # CI: GH release-parity (gated) + GHCR images
bun run release:npm 0.1.0                   # mirror the GH tarballs to npm (token stays local)
```

A push to `main` (not a tag) publishes a `@dev` build to GitHub Packages — **not** a release. There
is no version-bump and no release commit.

## Package Scripts vs Direct Tool Invocation

Always prefer package scripts over direct tool invocation:

- `bun run typecheck` — not `tsgo`, `bunx tsgo`, or `tsc` directly
- `bun run lint` — not `oxlint` directly
- `bun run format` — not `oxfmt` directly
- `bun run validate` for full validation if the script exists

Package scripts encode project-specific flags, paths, and composite steps. Direct invocation silently bypasses them.
