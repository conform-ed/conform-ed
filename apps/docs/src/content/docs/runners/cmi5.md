---
title: cmi5 runner
description: A cmi5 conformance/oracle runner with adapter integration and requirement-trace artifacts.
sidebar:
  order: 2
---

The cmi5 runner orchestrates conformance/oracle execution with explicit adapter integration for
platform-specific workflow operations (fixture provisioning, package import, launch creation, waive,
abandon).

## Artifacts

Each run emits deterministic artifacts:

- `summary.json`
- `junit.xml`
- `requirement-trace.json`
- `run-metadata.json`
- `catapult-parity-ledger.json`

## Adapter contract

cmi5 execution depends on a reference (or your own) HTTP adapter that supports launch / import /
fetch / launch-data / waive / abandon operations. A capability-gated handshake runs before execution.
See [Reference adapters](/runners/adapters/).

## Coverage highlights

The runner validates, among others:

- adapter preflight compatibility (capabilities + profile + operation contract)
- package import (happy path + invalid-base64 rejection) and package-structure matrix
- launch creation and launch-URL query contract (fetch, registration, actor, activityId, endpoint,
  launchMode, moveOn, masteryScore, launchParameters)
- fetch-token exchange, single-use fetch, and the fetch/auth security matrix (missing/invalid params,
  cross-session misuse, replay rejection, expiry windows)
- the AU runtime/xAPI statement lifecycle matrix (initialized → launched → progressed → completed →
  passed/failed → terminated) and moveOn-gated termination
- resume continuity, registration waive / session abandon, and durable state reload across restart
  simulation

## Out of scope (v0.x)

High-risk CATAPULT runtime assertions that require deep LMS/AU lifecycle orchestration; a
CATAPULT parity ledger is emitted alongside the run for traceability.
