# LRS Suite

> Results are conform-ed _assessments / interop evidence_, not official
> certification, and conform-ed is not affiliated with or endorsed by ADL/ADLNet.
> "xAPI" / "Experience API" are ADL marks, used nominatively. See
> [DISCLAIMER.md](../../DISCLAIMER.md).

## Scope

The LRS runner now uses the copied upstream xAPI conformance harness to test a target API endpoint with optional basic auth and emits runner output to stdout. The same entrypoint is intended to run directly from the command line, inside an OCI image, or as part of a podman-compose service.

## Current Status

- runner command surface: `run`, `validate-config`, `print-schema`, `list-targets`, `version`
- output contract: stdout runner output from the copied upstream harness, plus artifact teeing where a wrapper needs a file
- packaging contract: OCI image plus compose-friendly entrypoint

## Inputs and Constraints

- required input: LRS base URL
- optional input: username and password for basic auth
- env vars accepted by the tester: `LRS_BASE_URL`, `LRS_VERSION`, `LRS_USERNAME`, `LRS_PASSWORD`
- optional selection flags: `--directory`, `--file`, `--grep`

## Lanes

- Runner lane: `bun run apps/lrs-runner/src/cli.ts run --base-url <url> --version <1.0.3|2.0.0> [--username <user> --password <pass>]`
- LRSQL lane: `bun run test:lrs:lrsql`
- Generic external lane: `bun run test:lrs:external -- --base-url <url> --version <1.0.3|2.0.0>`
- OCI smoke lane: `bun run test:lrs:oci-smoke -- --base-url <url> --version <1.0.3|2.0.0>`
- LRSQL services: `bun run lrsql:up`, `bun run lrsql:down`, `bun run lrsql:wait`, `bun run lrsql:auth:check`

## Notes

- The stdout payload is the canonical run result for direct execution and container usage.
- Shell lanes may tee stdout to a repo-local file for convenience, but the tester itself should remain stdout-driven.
