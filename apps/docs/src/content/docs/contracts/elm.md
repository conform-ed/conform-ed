---
title: ELM / European Digital Credentials
description: European Learning Model v3.3 contracts — VC-agnostic ELM Core plus the EDC, LOQ, AMS and PID profiles.
sidebar:
  order: 14
---

Validators for the **European Learning Model (ELM) v3.3** — the EU's single multilingual ontology
for describing learning, published by Europass / the European Commission. ELM is distributed as
**JSON-LD / RDF, not XSD** (XML/XSD was the retired v1/v2 binding), so — unlike the
XSD/JSON-Schema-derived standards — these contracts are authored against the **SHACL shapes and the
ELM ontology**, and the [Coverage map](/coverage/) measures them against the SHACL denominator.

A **European Digital Credential (EDC)** is literally a [W3C Verifiable
Credential](/contracts/vc-data-model/) (`type: ["VerifiableCredential", "EuropeanDigitalCredential"]`,
VC Data Model 1.1) sealed with an eIDAS **JAdES** e-seal — so ELM lands on the same credential rail
as [Open Badges 3.0](/contracts/open-badges/) and [CLR 2.0](/contracts/clr/).

## Specification

- [European Learning Model](https://europa.eu/europass/elm-browser/index.html) (ELM Browser 3.3.1)
- [ELM support — shapes, contexts, examples](https://code.europa.eu/qualifications-courses-and-credentials/ELM-support)
- [European Digital Credentials for Learning](https://europa.eu/europass/en/european-digital-credentials-learning)

## Import

```ts
import { ElmV3_3 } from "@conform-ed/contracts/elm/v3_3";

const result = ElmV3_3.EuropeanDigitalCredentialSchema.safeParse(credential);
```

Namespace: `ElmV3_3`. The contracts are a **profile-neutral "ELM Core"** (the shared ontology) with
each application profile layered over it:

- `EuropeanDigitalCredentialSchema` / `SealedEdcSchema` / `EuropeanDigitalPresentationSchema` — the
  EDC VC envelope, its JAdES-sealed delivery shape, and the presentation wrapper.
- The ELM Core classes (`Agent`, `Organisation`, `Person`, `Address`, the
  Claim / Specification / LearningOutcome families, …) shared by all four profiles.
- LOQ / AMS / PID profile roots over the same core.

## What's modelled

- **ELM Core** — 52 classes covering the shared ontology, reused by every profile.
- **EDC** — the only VC-shaped, sealed profile, modelled to its as-shipped shape (carries
  `issuanceDate` _and_ `validFrom`; `@context` / `issuer` are optional pre-issuance). Round-trips the
  EU sample credentials.
- **LOQ / AMS / PID** — the unsealed plain-dataset profiles (Learning Opportunities &
  Qualifications; Accreditation Metadata Schema; Person Identity), multi-rooted over the core.

The four profiles are reconciled into committed coverage maps
(`elm-{edc,loq,ams,pid}-v3.3.json`) — see the [Coverage map](/coverage/).

## Verification & rendering

ELM reuses conform-ed's credential rail beyond the contracts:

- **Structural validation** — `@conform-ed/credential-verification` `validateAgainstProfile` runs the
  real **SHACL** shapes over the JSON-LD→RDF dataset. It is **profile-agnostic**, so the EDC and the
  LOQ / AMS / PID profiles all validate through the same engine pointed at their shapes.
- **JAdES e-seal** — `verifyJadesSeal` verifies the JWS (RFC-7797, `b64:false` → the `payload` is the
  literal credential JSON), the `x5c` certificate chain (with a pinnable verification time), and the
  RFC-3161 `adoTst` timestamp. Trust anchors are host-injected.
- **Combined EDC verdict** — `verifyEdc` composes the seal, SHACL, validity-window and status checks
  into one `EdcVerdict`, so a host (wallet/displayer) makes a single call. `trustAnchored` is reported
  as a **separate honest axis** — an intact-but-unanchored EDC is `verified` with
  `trustAnchored: false` ("seal intact, EU-qualified trust not verified"), never a misleading
  "verified & trusted".
- **Reference rendering** — `@conform-ed/elm-render` `renderEdc` produces framework-light semantic
  HTML and a view-model from the credential's `displayParameter`.

## Validation notes

- ELM has no XSD/JSON-Schema bundle; the **SHACL shapes are the authoritative conformance
  denominator** (self-declared via `credentialSchema: { type: "ShaclValidator2017" }`).
- Bounded controlled vocabularies (EQF, ISCED-F, country, language) are scheme-checked; ESCO is
  intentionally opaque. The EU spec typo `patronimycName` (sic) is corrected to `patronymicName`.
- Full rationale and the deferred items are in [ADR-0019](/decisions/0019-elm-europass-digital-credentials-support/).
