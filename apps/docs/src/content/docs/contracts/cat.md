---
title: CAT
description: Computer Adaptive Testing 1.0 REST service contracts.
sidebar:
  order: 11
---

Validators for the CAT 1.0 (Computer Adaptive Testing) core REST service contract and its shared
payload types.

## Specification

- [CAT v1.0](https://www.imsglobal.org/spec/cat/v1p0/impl/) — implementation guide and errata

## Import

```ts
import { CatV1_0 } from "@conform-ed/contracts/cat/v1_0";

const result = CatV1_0.Schemas.CreateSectionRequest.safeParse(payload);
```

Namespace: `CatV1_0` (schemas under `.Schemas`).

## What's modelled

- **Payload types** — `SectionData` (section configuration), `ItemStage` (item staging),
  `AssessmentResult` (candidate submission), `CatEngineResultReport` (engine return).
- **Operations** — request/response envelopes for `createSection`, `getSection`, `createSession`,
  `submitResults`, `endSession`, `endSection`, each exposing `method`, `path`, `requestPayload`,
  `successResponsePayload`, and `errorResponsePayload`.

## Validation notes

- Payloads are strict objects; UUIDs use RFC 4122 validation; date-times accept both `Z` and numeric
  UTC offsets; enums allow `ext:*` extension tokens; errors normalize to
  `{ error, message, statusCode, details? }`.
- Engine-specific custom payload fragments are intentionally open (`z.record(z.string(),
z.unknown())`) where the spec does not standardize vendor structures.
