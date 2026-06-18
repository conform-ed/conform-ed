---
title: LTI 1.3
description: LTI 1.3 core launch plus the Deep Linking, AGS, NRPS, and Proctoring service families.
sidebar:
  order: 3
---

Validators for LTI 1.3 / LTI Advantage, split by spec family with normalized camelCase field names.

## Specification

- LTI 1.3 core launch, Deep Linking 2.0, Assignment & Grade Services 2.0, Names & Role Provisioning
  Services 2.0, Proctoring 1.0

## Import

```ts
import { LtiV1_3 } from "@conform-ed/contracts/lti/v1_3";

const result = LtiV1_3.Schemas.CoreLaunchRequest.safeParse(claims);
```

Namespaces: `LtiV1_3`, `LtiDeepLinkingV2_0`, `LtiAgsV2_0`, `LtiNrpsV2_0`, `LtiProctoringV1_0` (and
`Lti` for the bundle). Core schemas are under `.Schemas`.

## What's modelled

- **`LtiV1_3`** — normalized LTI 1.3 core launch claims (`CoreLaunchRequest`, `ResourceLink`,
  `Context`, `LaunchPresentation`, `Lis`, …).
- **`LtiDeepLinkingV2_0`** — deep-linking request settings and response content items.
- **`LtiAgsV2_0`** — line item, score, and result payloads for the grade-services endpoints.
- **`LtiNrpsV2_0`** — the names-and-roles claim plus the membership container.
- **`LtiProctoringV1_0`** — proctoring launch messages and assessment-control payloads.

## Validation notes

- Field names are normalized to camelCase so the schemas are easy to use from the
  [LTI 1.3 runner](/runners/) and adapter reference app.
