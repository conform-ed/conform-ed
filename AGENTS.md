# conform-ed Agent Instructions

## Release, versioning & tooling standard

This repo follows the **Cross-repo TypeScript release & versioning standard** (defined in the global
agent guide, `~/.claude/CLAUDE.md`; full rationale in
[docs/adr/0016](docs/adr/0016-unified-ts-release-versioning-tooling-standard.md)). The essentials:

- **Scripts are check-default.** `bun run format` / `bun run lint` **check** (non-mutating); use
  `format:write` / `lint:fix` to change files. `bun run validate` (format, typecheck, lint, then unit
  `test` via turbo) is the pre-commit gate, auto-installed via the `prepare` script. `test` is the
  per-package unit suites; the interop/container lanes (`test:lrs`, `test:cmi5`, `test:lti13`, ...)
  keep their own cadence (ADR-0015) and never run in the commit path.
- **Versions are tag-derived, never hand-edited.** Every publishable `package.json` carries
  `"version": "0.0.0"` as a placeholder — the most recent semver tag is the only version input, and
  CI derives the real dev/release version at publish time. There is no version-bump script and no
  release commit.
- **Publishing.** A push to `main` publishes a `@dev` build to GitHub Packages; a semver tag
  publishes release-parity at `@latest` and builds the GHCR images (both gated on `validate:full`).
  The public npm mirror is a separate, human-gated step on your machine: `bun run release:npm <tag>`
  (see `docs/development/release.md`).
- **Orchestrator.** This repo uses `turbo` for per-package `build` / `typecheck` / `test` / `lint` /
  `format`. The ADR is copied raw under `docs/adr/` (oxfmt skips that path) so the cross-repo copies
  stay byte-identical.

See `CLAUDE.md` for the full conform-ed working rules.
