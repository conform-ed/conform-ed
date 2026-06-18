---
title: LRS runner
description: Exercise an xAPI Learning Record Store against the xAPI conformance harness.
sidebar:
  order: 1
---

The LRS runner tests a target xAPI Learning Record Store endpoint (with optional basic auth) using
the xAPI conformance harness and emits its run result to stdout. The same entrypoint runs from the
command line, inside the OCI image, or as a Podman Compose service.

## Command surface

`run`, `validate-config`, `print-schema`, `list-targets`, `version`.

The stdout payload is the canonical run result; shell wrappers may tee it to a file, but the runner
itself stays stdout-driven.

## Inputs

- **Required:** the LRS base URL.
- **Optional:** username + password for basic auth.
- **Env vars:** `LRS_BASE_URL`, `LRS_VERSION`, `LRS_USERNAME`, `LRS_PASSWORD`.
- **Selection flags:** `--directory`, `--file`, `--grep`.

## Running it

```bash
# Direct
bun run apps/lrs-runner/src/cli.ts run \
  --base-url <url> --version <1.0.3|2.0.0> [--username <user> --password <pass>]

# OCI image
podman run --rm ghcr.io/conform-ed/lrs-runner \
  run --base-url <url> --version <1.0.3|2.0.0>
```

## Lanes (from the monorepo)

- Generic external lane: `bun run test:lrs:external -- --base-url <url> --version <1.0.3|2.0.0>`
- OCI smoke lane: `bun run test:lrs:oci-smoke -- --base-url <url> --version <1.0.3|2.0.0>`
- LRSQL lane: `bun run test:lrs:lrsql` (services: `bun run lrsql:up` / `lrsql:down` / `lrsql:wait` /
  `lrsql:auth:check`)
