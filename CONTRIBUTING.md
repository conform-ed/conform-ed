# Contributing

## Prerequisites

- Bun 1.3.14
- Podman

## Development loop

```bash
bun install
bun run validate
```

## Releasing

See [RELEASING.md](./RELEASING.md) — `bun run release <version>` publishes to npm and (via the
pushed tag) to GitHub Packages. Note the gotchas: push release tags one at a time, and bump the
version before tagging.

## Rules

- Keep changes TypeScript-first.
- Use `oxlint` and `oxfmt`.
- Keep adapter contracts stable and versioned.
- Do not introduce new frameworks/tools without explicit approval.
