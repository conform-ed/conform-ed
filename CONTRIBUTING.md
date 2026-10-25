# Contributing

## Prerequisites

- Bun 1.4.4
- Podman

## Development loop

```bash
bun install
bun run validate
```

Formatting scripts and CI use `bun fmt` with `.oxfmtrc.jsonc`. Run `bun run format:write`
to apply formatting. The `oxfmt` dependency remains only for the configured VS Code
format-on-save integration because Bun does not yet provide a formatter language server.

## Rules

- Keep changes TypeScript-first.
- Use `oxlint` and `bun fmt`.
- Keep adapter contracts stable and versioned.
- Do not introduce new frameworks/tools without explicit approval.
