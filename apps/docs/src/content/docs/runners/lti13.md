---
title: LTI 1.3 runner
description: An LTI 1.3 / LTI Advantage conformance runner with a contract lane and an interop lane.
sidebar:
  order: 3
---

The LTI 1.3 runner executes module-oriented conformance checks for **core launch**, **deep
linking**, **AGS**, and **NRPS**, against the reference adapter or a real counterpart.

## Targets

- **core-launch** — registration resolve, login initiation, launch creation
- **deep-linking** — deep-link creation
- **ags** — line items and scores
- **nrps** — memberships

## Lanes

- **Contract lane** — deterministic operation-contract checks through the runner + reference adapter.
- **Interop lane** — `scripts/run-lti13-interop-lane.ts`, with target scoping, role annotation
  (`tool` / `platform` / `both`), and an interop profile.

### Interop profiles

- **local-reference** — runs the adapter/runner matrix and emits a lane report.
- **oss-platform** — needs `--platform-openid-configuration-url`; checks external OpenID/JWKS
  reachability and schema for a platform counterpart.
- **oss-tool** — needs `--tool-login-initiation-url` and `--tool-jwks-url`; checks login-initiation /
  JWKS reachability and keys for a tool counterpart.

The interop gate requires both the runner matrix pass (`execution_passed` + `matrix_passed`) and the
interop profile checks (`interopFailed === 0`).

### Examples

```bash
# Validate this runner (as a tool) against a platform's OpenID configuration
bun run test:lti13:interop -- \
  --interop-profile oss-platform --role tool \
  --platform-openid-configuration-url https://example-lms/.well-known/openid-configuration \
  --platform-issuer https://example-lms
```

Preset wrappers boot a real counterpart via Podman Compose, then tear it down (use `--mode external`
to point at an already-running implementation):

```bash
bun run test:lti13:interop:oss-platform:moodle -- --moodle-base-url https://moodle.example
bun run test:lti13:interop:oss-tool:ltijs    -- --tool-base-url https://ltijs.example
```

## Out of scope (v0.x)

A full production-grade LTI platform interoperability matrix.
