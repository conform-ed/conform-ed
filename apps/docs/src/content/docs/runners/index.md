---
title: Conformance runners
description: Container images that exercise an xAPI LRS, a cmi5 course, or an LTI 1.3 tool/platform and emit a pass/fail report.
---

The conformance runners verify that an implementation actually conforms. Each is a protocol-focused
CLI, published as an OCI image to GHCR and runnable with Podman (or any OCI runtime).

```bash
podman run --rm ghcr.io/conform-ed/lrs-runner --help
```

## Runners

- **`lrs-runner`** — exercises an xAPI Learning Record Store against the xAPI conformance harness and
  emits runner output for the target endpoint (with optional basic auth).
- **`cmi5-runner`** — a cmi5 runner/oracle for course structure and the cmi5 statement flow.
- **`lti13-runner`** — an LTI 1.3 / LTI Advantage conformance runner (core launch, deep linking,
  AGS, NRPS, proctoring), able to act as tool or platform against interop profiles.

## Reference adapters

`cmi5-adapter-reference` and `lti13-adapter-reference` are intentionally separate, token-authenticated
HTTP adapter stubs, so a third-party platform can replace them without changing runner code.

Configuration, interop profiles, and report formats (stdout, JUnit, summary artifacts) are being
expanded in this section.
