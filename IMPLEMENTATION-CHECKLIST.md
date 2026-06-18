# conform-ed Monorepo Implementation Checklist

Status: approved baseline

- Stack: Bun + Turbo + TypeScript Native (tsgo) + oxlint + oxfmt
- CI: GitHub Actions
- Release: Changesets
- Distribution for first release: OCI only (GHCR primary)
- Docs: markdown only (no docs site framework in v0.x)
- Adapters: separate Bun HTTP apps
- License: MIT
- Constraints: treat external reference repositories as read-only unless explicitly approved.

## 0. Repository Bootstrapping (ordered)

1. Create root directories:

```text
.github/
.github/workflows/
apps/
packages/
docs/
docs/architecture/
docs/development/
docs/migration/
docs/migration/lrs/
docs/project/
docs/suites/
examples/
examples/configs/
examples/podman/
examples/docker/
infra/
infra/container/
infra/container/lrs-runner/
infra/container/cmi5-runner/
infra/container/lti13-runner/
infra/container/cmi5-adapter-reference/
infra/container/lti13-adapter-reference/
infra/compose/
schemas/
schemas/v1/
scripts/
```

2. Create root files:

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `.gitignore`
- `.editorconfig`
- `.gitattributes`
- `package.json`
- `turbo.json`
- `tsconfig.base.json`
- `.oxlintrc.jsonc`
- `.oxfmtrc.jsonc`
- `mise.toml`
- `.github/dependabot.yml`

3. Create root npm/bun scripts in `package.json`:

- `build`
- `test`
- `typecheck`
- `lint`
- `format`
- `check`
- `validate`
- `validate:full`
- `release`
- `images:build`
- `images:publish:ghcr`
- `test:lrs`
- `test:cmi5`
- `test:lti13`

4. Set root package publish behavior for OCI-only v0.x:

- root package private
- workspace packages either private or with `publishConfig.access` prepared but no publish workflow path enabled

## 1. Workspace Wiring

1. Configure Bun workspaces in root `package.json`:

- `apps/*`
- `packages/*`

2. Add turbo pipeline in `turbo.json`:

- `build`
- `typecheck`
- `lint`
- `format`
- `test`

3. Add shared TS config in `tsconfig.base.json` based on established project conventions:

- `target` ESNext
- `moduleResolution` bundler
- strict mode and safety flags
- Bun types enabled in app/package configs where needed

## 2. Shared Packages (create in this order)

### 2.1 packages/contracts

Create:

- `packages/contracts/package.json`
- `packages/contracts/tsconfig.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/config.ts`
- `packages/contracts/src/summary.ts`
- `packages/contracts/src/adapter.ts`
- `packages/contracts/test/contracts.test.ts`
- `packages/contracts/README.md`

Stub scope:

- zod models for v1 config
- zod models for v1 summary output
- type exports for adapters/capabilities/errors

### 2.2 packages/cli

Create:

- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/cli/src/index.ts`
- `packages/cli/src/commands.ts`
- `packages/cli/src/run-command.ts`
- `packages/cli/src/validate-config-command.ts`
- `packages/cli/src/print-schema-command.ts`
- `packages/cli/src/list-targets-command.ts`
- `packages/cli/src/version-command.ts`
- `packages/cli/test/cli-smoke.test.ts`
- `packages/cli/README.md`

Stub scope:

- shared command dispatch
- deterministic exit codes

### 2.3 packages/core

Create:

- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts`
- `packages/core/src/runner.ts`
- `packages/core/src/healthcheck.ts`
- `packages/core/src/selection.ts`
- `packages/core/src/timeouts.ts`
- `packages/core/test/core-smoke.test.ts`
- `packages/core/README.md`

Stub scope:

- suite-independent runner orchestration interfaces

### 2.4 packages/reporting

Create:

- `packages/reporting/package.json`
- `packages/reporting/tsconfig.json`
- `packages/reporting/src/index.ts`
- `packages/reporting/src/summary-writer.ts`
- `packages/reporting/src/junit-writer.ts`
- `packages/reporting/src/artifact-layout.ts`
- `packages/reporting/test/reporting-smoke.test.ts`
- `packages/reporting/README.md`

Stub scope:

- write deterministic summary and junit placeholders

### 2.5 packages/test-utils

Create:

- `packages/test-utils/package.json`
- `packages/test-utils/tsconfig.json`
- `packages/test-utils/src/index.ts`
- `packages/test-utils/src/temp-dir.ts`
- `packages/test-utils/src/fixtures.ts`
- `packages/test-utils/README.md`

## 3. Runner Apps (create in this order)

### 3.1 apps/lrs-runner

Create:

- `apps/lrs-runner/package.json`
- `apps/lrs-runner/tsconfig.json`
- `apps/lrs-runner/src/index.ts`
- `apps/lrs-runner/src/targets.ts`
- `apps/lrs-runner/src/run.ts`
- `apps/lrs-runner/src/version.ts`
- `apps/lrs-runner/test/cli.test.ts`
- `apps/lrs-runner/README.md`

Required commands:

- `run`
- `validate-config`
- `print-schema`
- `list-targets`
- `version`

### 3.2 apps/cmi5-runner

Create:

- `apps/cmi5-runner/package.json`
- `apps/cmi5-runner/tsconfig.json`
- `apps/cmi5-runner/src/index.ts`
- `apps/cmi5-runner/src/targets.ts`
- `apps/cmi5-runner/src/run.ts`
- `apps/cmi5-runner/src/adapter-client.ts`
- `apps/cmi5-runner/src/version.ts`
- `apps/cmi5-runner/test/cli.test.ts`
- `apps/cmi5-runner/README.md`

Required commands:

- `run`
- `validate-config`
- `print-schema`
- `list-targets`
- `list-adapters`
- `version`

### 3.3 apps/lti13-runner

Create:

- `apps/lti13-runner/package.json`
- `apps/lti13-runner/tsconfig.json`
- `apps/lti13-runner/src/index.ts`
- `apps/lti13-runner/src/targets.ts`
- `apps/lti13-runner/src/run.ts`
- `apps/lti13-runner/src/adapter-client.ts`
- `apps/lti13-runner/src/version.ts`
- `apps/lti13-runner/test/cli.test.ts`
- `apps/lti13-runner/README.md`

Required commands:

- `run`
- `validate-config`
- `print-schema`
- `list-targets`
- `list-adapters`
- `version`

## 4. Adapter Reference Apps (token auth required by default)

### 4.1 apps/cmi5-adapter-reference

Create:

- `apps/cmi5-adapter-reference/package.json`
- `apps/cmi5-adapter-reference/tsconfig.json`
- `apps/cmi5-adapter-reference/src/index.ts`
- `apps/cmi5-adapter-reference/src/auth.ts`
- `apps/cmi5-adapter-reference/src/capabilities.ts`
- `apps/cmi5-adapter-reference/src/routes/health.ts`
- `apps/cmi5-adapter-reference/src/routes/capabilities.ts`
- `apps/cmi5-adapter-reference/src/routes/fixtures-provision.ts`
- `apps/cmi5-adapter-reference/src/routes/cmi5-package-import.ts`
- `apps/cmi5-adapter-reference/src/routes/cmi5-launch-create.ts`
- `apps/cmi5-adapter-reference/src/routes/cmi5-waive.ts`
- `apps/cmi5-adapter-reference/src/routes/cmi5-abandon.ts`
- `apps/cmi5-adapter-reference/test/http.test.ts`
- `apps/cmi5-adapter-reference/README.md`

### 4.2 apps/lti13-adapter-reference

Create:

- `apps/lti13-adapter-reference/package.json`
- `apps/lti13-adapter-reference/tsconfig.json`
- `apps/lti13-adapter-reference/src/index.ts`
- `apps/lti13-adapter-reference/src/auth.ts`
- `apps/lti13-adapter-reference/src/capabilities.ts`
- `apps/lti13-adapter-reference/src/routes/health.ts`
- `apps/lti13-adapter-reference/src/routes/capabilities.ts`
- `apps/lti13-adapter-reference/src/routes/lti-registration-resolve.ts`
- `apps/lti13-adapter-reference/src/routes/lti-login-initiation.ts`
- `apps/lti13-adapter-reference/src/routes/lti-launch-create.ts`
- `apps/lti13-adapter-reference/src/routes/lti-deep-link.ts`
- `apps/lti13-adapter-reference/src/routes/lti-ags-line-items.ts`
- `apps/lti13-adapter-reference/src/routes/lti-ags-scores.ts`
- `apps/lti13-adapter-reference/src/routes/lti-nrps-memberships.ts`
- `apps/lti13-adapter-reference/test/http.test.ts`
- `apps/lti13-adapter-reference/README.md`

## 5. Schemas and Examples

1. Create schema files:

- `schemas/v1/config.schema.json`
- `schemas/v1/summary.schema.json`
- `schemas/README.md`

2. Create config examples:

- `examples/configs/lrs.basic.json`
- `examples/configs/cmi5.oracle.json`
- `examples/configs/lti13.core-launch.json`

3. Create invocation examples:

- `examples/podman/run-lrs.sh`
- `examples/podman/run-cmi5.sh`
- `examples/podman/run-lti13.sh`
- `examples/docker/run-lrs.sh`
- `examples/docker/run-cmi5.sh`
- `examples/docker/run-lti13.sh`
- `examples/README.md`

4. Add schema validation test:

- `packages/contracts/test/schema-examples.test.ts`

## 6. Containers and Compose Scaffolding

1. Create per-app Containerfiles:

- `infra/container/lrs-runner/Containerfile`
- `infra/container/cmi5-runner/Containerfile`
- `infra/container/lti13-runner/Containerfile`
- `infra/container/cmi5-adapter-reference/Containerfile`
- `infra/container/lti13-adapter-reference/Containerfile`

2. Create compose examples:

- `infra/compose/podman-compose.example.yaml`
- `infra/compose/podman-compose.adapters.example.yaml`

3. Create image helper scripts:

- `scripts/build-images.ts`
- `scripts/publish-ghcr.ts`
- `scripts/print-image-tags.ts`

## 7. Documentation (markdown-only)

### 7.1 Root docs

Create:

- `docs/index.md`
- `docs/status.md`

### 7.2 Architecture docs

Create:

- `docs/architecture/monorepo-structure.md`
- `docs/architecture/runner-contract.md`
- `docs/architecture/adapter-contract.md`
- `docs/architecture/image-strategy.md`

### 7.3 Suite docs

Create:

- `docs/suites/lrs.md`
- `docs/suites/cmi5.md`
- `docs/suites/lti13.md`

### 7.4 Development docs

Create:

- `docs/development/getting-started.md`
- `docs/development/commands.md`
- `docs/development/testing.md`
- `docs/development/release.md`
- `docs/development/ci.md`

### 7.5 Project docs

Create:

- `docs/project/roadmap.md`
- `docs/project/versioning.md`
- `docs/project/support-matrix.md`

### 7.6 LRS migration docs

Create:

- `docs/migration/lrs/overview.md`
- `docs/migration/lrs/parity-strategy.md`
- `docs/migration/lrs/traceability.md`
- `docs/migration/lrs/parity-ledger.md`
- `docs/migration/lrs/source-policy.md`

Policy to include in `source-policy.md`:

- external reference repositories are read-only by default
- copy/import operations require explicit review before production use

## 8. GitHub Automation

1. Create workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/images.yml`
- `.github/workflows/schema-check.yml`

2. CI workflow requirements:

- bun install
- turbo lint
- turbo typecheck
- turbo test
- schema/example validation

3. Release requirements:

- unified single bare-semver-tag release (`bun run release <version>`)
- all publishable packages + OCI images share one version
- tag push triggers the image build/publish workflow
- npm publish (`@conform-ed/*`) runs from the release script

4. Image workflow requirements:

- build all runner and adapter images
- push to GHCR
- optional Docker Hub mirror path disabled by default

## 9. Initial Script Contracts

1. Root `validate` should run:

- formatting check
- lint
- typecheck
- test

2. Each runner should output deterministic JSON for:

- `version`
- `list-targets`
- `list-adapters` (where applicable)

3. Adapters should enforce bearer token by default:

- reject missing auth with deterministic JSON error
- allow explicit dev override only via documented env flag

## 10. Acceptance Gate (must pass)

1. `bun install` succeeds from clean clone.
2. `bun run validate` succeeds at root.
3. Runner CLI smoke tests pass for LRS/cmi5/LTI.
4. Adapter HTTP tests pass for cmi5/LTI reference services.
5. All example configs validate against `schemas/v1/config.schema.json`.
6. Generated summary stubs validate against `schemas/v1/summary.schema.json`.
7. GHCR image build workflow works end-to-end (publish contingent on credentials).
8. `README.md` quickstart works exactly as documented.

## 11. Deferred to post-v0.x

- npm package publishing
- docs site framework
- full protocol-complete conformance logic
- non-reference adapters for additional platforms

## 12. Execution Order Summary

Execute in this exact order:

1. Root foundation
2. Workspace wiring
3. Shared packages
4. Runner apps
5. Adapter apps
6. Schemas/examples
7. Containers/compose scripts
8. Docs
9. GitHub automation
10. Validation and first scaffold release tag (`v0.1.0`)
