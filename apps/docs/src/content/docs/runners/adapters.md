---
title: Reference adapters
description: Token-authenticated HTTP adapter stubs for cmi5 and LTI 1.3.
sidebar:
  order: 4
---

The cmi5 and LTI 1.3 runners talk to a platform through an **adapter** — a small HTTP service that
exposes the platform-specific workflow operations the runner drives. conform-ed ships
token-authenticated reference adapters so the runners work out of the box, and so a third-party
platform can replace them without changing runner code.

- **`cmi5-adapter-reference`** — stub operations for the cmi5 workflow (fixture provisioning, package
  import, launch creation, launch-data/fetch, waive, abandon).
- **`lti13-adapter-reference`** — deterministic matrix responses for the LTI 1.3 target operations.

Both are published as OCI images (`ghcr.io/conform-ed/<name>`). They are intentionally separate from
the runners: to certify your own platform, implement the same token-authenticated operation contract
and point the runner at it (the cmi5 runner runs a capability-gated handshake first).
