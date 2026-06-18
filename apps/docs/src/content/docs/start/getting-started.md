---
title: Getting started
description: Install the conform-ed libraries and runner images, and validate your setup.
---

## Requirements

- [Bun](https://bun.sh) (the libraries are published as standard ESM/TypeScript and work with any
  modern toolchain; conform-ed itself is built with Bun).
- [Zod](https://zod.dev) v4+ as a peer dependency for the contracts package.
- [Podman](https://podman.io) (or another OCI runtime) to run the conformance runner images.

## Install a contracts package

```bash
bun add @conform-ed/contracts zod
```

```ts
import { StatementSchema } from "@conform-ed/contracts/xapi/v1_0_3";

const result = StatementSchema.safeParse(payload);
if (!result.success) {
  console.error(result.error.issues);
}
```

Each standard is a separate entry point (for example `@conform-ed/contracts/qti/v3_0_1`,
`@conform-ed/contracts/oneroster/v1_2`). See [Standards & contracts](/contracts/) for the full list.

## Install the QTI runtime

```bash
bun add @conform-ed/qti-react @conform-ed/qti-xml react zod
```

See the [QTI delivery runtime](/qti/) section for the headless API and reference skins.

## Run a conformance suite

Runner images are published to GHCR:

```bash
podman run --rm ghcr.io/conform-ed/lrs-runner --help
```

See [Conformance runners](/runners/) for configuration, profiles, and report formats.

## Verify your environment

If you have cloned the monorepo:

```bash
bun install
bun run validate
```
