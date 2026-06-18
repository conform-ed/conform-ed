---
title: Open Badges
description: Open Badges 3.0 verifiable-credential contracts.
sidebar:
  order: 9
---

Validators for Open Badges 3.0 — 1EdTech's verifiable-credential model for achievements.

## Specification

- [Open Badges v3.0](https://www.imsglobal.org/spec/ob/v3p0/) — main spec, implementation guide,
  JSON-LD context, and published JSON schemas

## Import

```ts
import { OpenBadges30DerivedZodTemplates } from "@conform-ed/contracts/open-badges/v3_0";

const result = OpenBadges30DerivedZodTemplates.openBadgeCredential.safeParse(credential);
```

Namespace: `OpenBadgesV3_0`. Published entry points are exposed via
`OpenBadges30DerivedZodTemplates` (`achievementCredential`, `openBadgeCredential`,
`endorsementCredential`, `getOpenBadgeCredentialsResponse`, `profile`, `imsxStatusInfo`).

## What's modelled

- The published JSON-schema entry points: `AchievementCredential` (aliased `OpenBadgeCredential`),
  `EndorsementCredential`, `GetOpenBadgeCredentialsResponse`, `Profile`, `ImsxStatusInfo`.
- OB-specific profile/achievement structures live in the package's shared layer; VC-level primitives
  are shared from [VC Data Model](/contracts/vc-data-model/), and [CLR](/contracts/clr/) composes
  from the same graph.

## Validation notes

- Core credential identity is tightened beyond the JSON-LD-compaction-friendly published schema:
  `AchievementCredential` requires `VerifiableCredential` plus one of
  `AchievementCredential` / `OpenBadgeCredential`; `EndorsementCredential` requires
  `VerifiableCredential` plus `EndorsementCredential`; `@context` ordering enforces the expected OB
  3.0 prefixes while still allowing additional entries.
