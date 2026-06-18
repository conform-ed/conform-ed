---
title: VC Data Model
description: W3C Verifiable Credentials Data Model 2.0 primitives shared by Open Badges and CLR.
sidebar:
  order: 12
---

Validators for the shared W3C Verifiable Credentials Data Model 2.0 primitives. This is intentionally
**shared infrastructure**: [Open Badges 3.0](/contracts/open-badges/) and [CLR 2.0](/contracts/clr/)
compose on top of it.

## Specification

- [VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/) (W3C Recommendation)

## Import

```ts
import { VcDataModel20DerivedZodTemplates } from "@conform-ed/contracts/vc-data-model/v2_0";

const result = VcDataModel20DerivedZodTemplates.verifiableCredential.safeParse(credential);
```

Namespace: `VcDataModelV2_0`. Primitives are exposed via `VcDataModel20DerivedZodTemplates`
(`verifiableCredential`, `verifiablePresentation`, `credentialSubject`, `credentialSchema`,
`credentialStatus`, `refreshService`, …).

## What's modelled

- `VerifiableCredential`, `VerifiablePresentation`, `CredentialSubject`, `CredentialSchema`,
  `CredentialStatus`, `RefreshService`, `TermsOfUse`, `Proof`, `Evidence`, `Holder`.

## Validation notes

- VC 2.0 does not ship a single 1EdTech-style JSON-schema bundle, so this package implements the
  shared VC/credential primitives directly and keeps them aligned across OB 3.0 and CLR 2.0 to avoid
  duplicated logic.
