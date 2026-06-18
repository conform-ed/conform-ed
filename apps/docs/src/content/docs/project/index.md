---
title: Project
description: Versioning, releases, and how conform-ed is built and contributed to.
---

## Versioning & releases

All publishable packages and OCI images release **together** under a single bare semver tag
(`0.1.0`, not `v0.1.0`). The tag is the single source of truth for every artifact version:

- npm packages under the `@conform-ed/*` scope, published to npmjs.
- Runner and adapter images, published to `ghcr.io/conform-ed/<image>`.

conform-ed is **0.x** — the public surface is still evolving and minor versions may carry breaking
changes.

## Stack

Bun workspaces, Turbo, TypeScript Native (`tsgo`), `oxlint` + `oxfmt`, and Podman for
container-backed workflows.

## Source & decisions

The repository is at [conform-ed/conform-ed](https://github.com/conform-ed/conform-ed). Architecture
decisions are recorded as ADRs under `docs/adr/`; the development and release guides live under
`docs/development/`.

Contribution guidelines and a published decision log are being expanded in this section.
