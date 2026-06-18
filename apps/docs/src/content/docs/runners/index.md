---
title: Conformance runners
description: Container images that exercise an xAPI LRS, a cmi5 course, or an LTI 1.3 tool/platform and emit a pass/fail report.
sidebar:
  order: 0
---

The conformance runners verify that an implementation actually conforms. Each is a protocol-focused
CLI, published as an OCI image to GHCR and runnable with Podman (or any OCI runtime).

```bash
podman run --rm ghcr.io/conform-ed/lrs-runner --help
```

## Runners

- **[LRS runner](/runners/lrs/)** — exercises an xAPI Learning Record Store against the xAPI
  conformance harness.
- **[cmi5 runner](/runners/cmi5/)** — a cmi5 runner/oracle for course structure and the cmi5
  statement flow.
- **[LTI 1.3 runner](/runners/lti13/)** — an LTI 1.3 / LTI Advantage conformance runner (core launch,
  deep linking, AGS, NRPS), able to act as tool or platform.
- **[Reference adapters](/runners/adapters/)** — the token-authenticated HTTP adapter stubs for cmi5
  and LTI 1.3.

## Distribution

Runner and adapter images are published to GHCR (`ghcr.io/conform-ed/<image>`) on each release, with
OCI labels and a machine-readable release manifest. See [Releases](/project/#versioning--releases).
