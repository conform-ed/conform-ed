# Monorepo Structure

## Goals

The repository structure optimizes for three outcomes:

1. Shared contracts across LRS, cmi5, and LTI 1.3.
2. Independent runner and adapter release cadence.
3. Low-friction contribution workflow using a single Bun + Turbo workspace.

## Top-Level Layout

- `apps/`: runnable services and CLIs.
- `packages/`: shared libraries and contracts.
- `schemas/`: versioned JSON Schema artifacts.
- `examples/`: executable sample configs and invocation wrappers.
- `infra/`: container and compose scaffolding.
- `docs/`: architecture, suite, migration, and operational docs.
- `scripts/`: release/image helper scripts.

## Application Layer

- `apps/lrs-runner`: LRS conformance runner CLI.
- `apps/cmi5-runner`: cmi5 runner/oracle CLI.
- `apps/lti13-runner`: LTI 1.3 runner CLI.
- `apps/cmi5-adapter-reference`: token-authenticated HTTP adapter stub.
- `apps/lti13-adapter-reference`: token-authenticated HTTP adapter stub.

The runner apps are protocol-focused entrypoints. The adapter apps are intentionally separate so third-party platforms can replace them without changing runner code.

## Shared Package Layer

- `packages/contracts`: runtime schemas/types for config, summary, and adapter payloads.
- `packages/cli`: shared command dispatch primitives.
- `packages/core`: orchestration utilities.
- `packages/reporting`: summary/JUnit artifact helpers.
- `packages/test-utils`: shared test helpers.

## Build and Task Graph

- Bun workspaces define package relationships.
- Turbo orchestrates `format`, `lint`, `typecheck`, `test`, and `build` tasks.
- Type checking is done through `tsc` (TypeScript 7).
- Linting/formatting are done through `oxlint` and `oxfmt`.

## Dependency Rules

1. Apps can depend on packages.
2. Packages should not depend on apps.
3. Contracts package should remain side-effect free.
4. Keep adapter code isolated from core contract libraries.

## Distribution Model

v0.x distribution is OCI-only.

- Primary registry: GHCR.
- Optional mirror path: Docker Hub (disabled by default).
- npm package publishing deferred.
