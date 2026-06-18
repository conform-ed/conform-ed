---
title: CLR
description: Comprehensive Learner Record 2.0 credential contracts.
sidebar:
  order: 8
---

Validators for CLR 2.0 (Comprehensive Learner Record), built on the shared verifiable-credential
model it shares with Open Badges 3.0.

## Specification

- [CLR v2.0](https://www.imsglobal.org/spec/clr/v2p0) — JSON Schema and JSON-LD credential model

## Import

```ts
import { Clr20DerivedZodTemplates } from "@conform-ed/contracts/clr/v2_0";

const result = Clr20DerivedZodTemplates.clrCredential.safeParse(credential);
```

Namespace: `ClrV2_0`. Published entry points are exposed via `Clr20DerivedZodTemplates`
(`clrCredential`, `achievementCredential`, `endorsementCredential`, `getClrCredentialsResponse`,
`profile`, `imsxStatusInfo`).

## What's modelled

- The published JSON-schema entry points: `ClrCredential`, `AchievementCredential`,
  `EndorsementCredential`, `GetClrCredentialsResponse`, `Profile`, `ImsxStatusInfo`.
- The shared credential-model graph lives in [VC Data Model](/contracts/vc-data-model/) and the
  Open Badges shared layer; CLR composes on top of it.

## Validation notes

- The published JSON Schema is tuned for JSON-LD compaction and under-enforces some rules. The Zod
  port keeps repeated-value properties flexible (single value or array) but tightens credential
  identity: `ClrCredential` requires a `type` array containing `VerifiableCredential` and
  `ClrCredential`, and `@context` arrays are validated against the expected CLR/OB/VC ordering.
- Credential/profile/achievement objects stay open (passthrough); API envelopes
  (`GetClrCredentialsResponse`, `ImsxStatusInfo`) are strict.
