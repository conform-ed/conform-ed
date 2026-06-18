# LTI 1.3 Suite

> Results are conform-ed _assessments / interop evidence_, not official
> certification, and conform-ed is not affiliated with or endorsed by 1EdTech.
> "LTI" is a trademark of 1EdTech, used nominatively. See
> [DISCLAIMER.md](../../DISCLAIMER.md).

## Scope

LTI runner scaffolds module-oriented conformance execution for:

- core launch
- deep linking
- AGS
- NRPS

## Current Status

- runner status: executable target matrix implemented (core-launch, deep-linking, AGS, NRPS)
- adapter status: reference HTTP adapter with deterministic matrix responses
- interop lane status: first orchestration entrypoint added via scripts/run-lti13-interop-lane.ts with role/profile metadata and machine-readable reports

## Milestones

1. Module capability negotiation in adapter handshake.
2. Stable target execution plumbing for module subsets.
3. First RC OCI image publication with deterministic summary outputs.

## Out of Scope for v0.x

- full production-grade LTI platform interoperability matrix.

## Lanes

- Contract lane: deterministic operation contract checks through apps/lti13-runner.
- Interop lane (initial): scripts/run-lti13-interop-lane.ts, supports target scoping, role annotation (tool/platform/both), and interop profile annotation (local-reference/oss-platform/oss-tool).

### Interop Profile Executors

- local-reference: runs adapter/runner matrix and emits lane report with a local-profile interop check.
- oss-platform: requires `--platform-openid-configuration-url` and performs external OpenID/JWKS reachability and schema checks for platform counterpart validation.
- oss-tool: requires `--tool-login-initiation-url` and `--tool-jwks-url` and performs external login-initiation/JWKS reachability and key checks for tool counterpart validation.

The interop lane pass/fail gate now includes both:

- runner matrix pass (`execution_passed` + `matrix_passed`), and
- interop profile checks pass (`interopFailed === 0`).

### Example Commands

```bash
bun run test:lti13:interop -- \
	--interop-profile oss-platform \
	--role tool \
	--platform-openid-configuration-url https://example-lms/.well-known/openid-configuration \
	--platform-issuer https://example-lms
```

Moodle preset wrapper:

```bash
bun run test:lti13:interop:oss-platform:moodle -- \
	--moodle-base-url https://moodle.example
```

By default this wrapper runs in local mode and boots a real Moodle plus PostgreSQL Podman Compose stack using the MoodleHQ moodle-docker image pattern (`moodlehq/moodle-php-apache`), initializes Moodle via CLI install, then tears it down after the lane run. Use `--mode external` to point at an already-running Moodle implementation.

```bash
bun run test:lti13:interop -- \
	--interop-profile oss-tool \
	--role platform \
	--tool-login-initiation-url https://example-tool/lti/login \
	--tool-jwks-url https://example-tool/.well-known/jwks.json
```

LTI.js preset wrapper:

```bash
bun run test:lti13:interop:oss-tool:ltijs -- \
	--tool-base-url https://ltijs.example
```

By default this wrapper runs in local mode and boots a real LTI.js plus MongoDB Podman Compose stack, then tears it down after the lane run. Use `--mode external` to point at an already-running tool implementation.

Negative-path checks (no CI wiring by default):

```bash
bun run test:lti13:interop:negative
```
