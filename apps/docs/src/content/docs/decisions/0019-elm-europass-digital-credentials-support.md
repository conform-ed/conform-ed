---
title: "Europass / ELM v3.3 support: VC-agnostic core, all four profiles, SHACL denominator, JAdES seal"
description: "Architecture decision record ADR-0019."
sidebar:
  order: 19
  badge: { text: "ADR-0019", variant: note }
---

Status: accepted (2026-06-26)

We are adding support for the **European Learning Model (ELM) v3.3** and **European Digital
Credentials for Learning (EDC)** to conform-ed. ELM is the EU's single multilingual ontology for
describing learning; it is published as **JSON-LD/RDF, not XSD** (XML/XSD was the retired v1/v2
binding), and an EDC credential is literally a **W3C Verifiable Credential** (`type:
["VerifiableCredential","EuropeanDigitalCredential"]`, VC Data Model 1.1) sealed with an **eIDAS
JAdES e-seal**. This lands ELM on conform-ed's existing W3C VC credential rail
([VC Data Model](/contracts/vc-data-model/), the [Open Badges 3.0](/contracts/open-badges/) /
[CLR 2.0](/contracts/clr/) profiles, and `@conform-ed/credential-verification`). Decisions below were
taken in a grilling session grounded in the live v3.3 artifacts (ELM Browser 3.3.1,
`code.europa.eu/.../ELM-support`, the SHACL shapes, and the EU sample credentials).

## Decision

### 1. VC-agnostic ELM core + per-profile constraint layers; all four profiles

Model the shared ELM ontology once as a **profile-neutral "ELM Core"** (Agent, Organisation, Person,
Address, the Claim / Specification / LearningOutcome families) under `contracts/src/elm/v3_3/core`,
then layer each application profile over it. Build **all four v3.3 profiles**:

- **EDC** — the only **VC-shaped, sealed** profile (root `EuropeanDigitalCredential`). Gets the full
  support stack: contracts + coverage + verification + seal.
- **LOQ / AMS / PID** — **unsealed plain-dataset** profiles (no VC envelope, no seal), multi-rooted.
  Get contracts + coverage **only**. Their _structural_ SHACL validation is deliberately not
  exposed now but is a **free later addition** — the verify-time SHACL validator is built
  profile-agnostic (decision 3), so validating a LOQ/AMS/PID dataset is the same engine pointed at
  its already-vendored shapes. _Seal_ verification is **not applicable**, not deferred: these
  profiles are unsealed in ELM, so there is no seal to verify; adding one would mean inventing a
  non-standard securing mechanism (a product/extension decision, not a conform-ed task). The
  VC-agnostic core keeps even that a thin envelope-layer addition, never a rewrite.

The EDC VC envelope is modelled to its **as-shipped shape** (it carries `issuanceDate` _and_
`validFrom` _and_ ELM's `issued`), reusing `vc-data-model/v2_0` primitives where they align. We do
**not** stand up a separate `vc-data-model/v1_1` base or coverage map — the VC-inherited fields are
captured by the EDC SHACL walk (the `cred:` properties), so the VC layer needs no independent
denominator.

**Sub-variants are unified, not expanded.** Vendor all six EDC shapes (`generic-full`,
`generic-no-cv`, `accredited`, `converted`, `issued-by-mandate`, `diploma-supplement`) and both
LOQ/AMS `-mdr` variants, but produce **one coverage map per profile** with each constraint tagged by
the variant(s) that require it (ADR-0013 usage-edge style); `full`-vs-`no-cv` collapses into the
CV-enforcement annotations of decision 5. Verify is **variant-aware**: SHACL-validate an EDC against
whatever shape its `credentialSchema.id` declares (all six vendored), defaulting to `generic-full`.

### 2. SHACL is the authoritative conformance denominator — build a SHACL walker

Per ADR-0013 (denominator = the literal published schema, never our Zod; "one walker per schema
_language_"), and because an EDC self-declares `ShaclValidator2017`, the denominator is the EU
**SHACL** shape graphs (`data.europa.eu/snb/model/ap/{edc-generic-full,loq-constraints,ams-constraints,pid-constraints}`,
AP version `1.1.0`). Add a **sixth coverage walker** (`coverage/src/walkers/shacl.ts`) for the
RDF/SHACL language, joining xsd / json-schema / openapi / caliper / curated. Vendor the shape graphs,
the `edc-ap` JSON-LD context, and the bounded value-sets under `coverage/vendor/elm`; cross-reference
the OWL ontology for class/property semantics. Produce one committed coverage map per profile.

### 3. Real SHACL at verify-time (single source of truth with the walker)

L2 structural verification validates an incoming EDC with an **actual SHACL engine over its
JSON-LD→RDF graph** against `edc-generic-full` — exactly what `ShaclValidator2017` declares — reusing
the verifier's existing offline `document-loader`. The **same vendored shapes** feed both the coverage
walker and runtime validation. This pulls a JS RDF+SHACL dependency into
`@conform-ed/credential-verification` but stays deterministic/offline (shapes and contexts are
vendored).

The validator is built **profile-agnostic** — a `validateAgainstProfile(jsonld, profile)` core that
takes any vendored shape graph — with EDC's `verifyEdc` as a thin orchestrator over it (SHACL +
seal + status). This is what makes LOQ/AMS/PID structural validation a free later addition (decision
1): the same engine, a different shape graph.

### 4. JAdES/eIDAS seal verified cryptographically; trust injected

Extend `@conform-ed/credential-verification` (no new package) with `jades` / `x509-chain` / `rfc3161`
modules alongside the existing `jose` / `data-integrity` / `status`. The seal verifier validates: the
detached JWS signature (RFC-7797 `b64:false`) via `x5c[0]`; the **x5c chain integrity + validity
periods**; and the **adoTst RFC-3161 timestamp token(s) cryptographically** with `sigT` consistency.
The **trust-root set and eIDAS "qualified" status are host-injected resolvers** — the same pattern as
the engine's existing key/status resolvers — keeping it offline-deterministic and out of live EU
Trusted-List infrastructure.

### 5. Controlled vocabularies: bounded EU lists enforced, ESCO opaque

Vendor and enforce membership for the small/stable EU-authority value-sets (EQF, ISCED-F, NAL
country & language, credential/assessment/proof types, …); treat large/open external schemes
(**ESCO** skills & occupations) as **opaque IRIs** (scheme-checked, not membership-checked). This is
`edc-generic-full` where tractable, `edc-generic-no-cv` behaviour only for unbounded schemes.

### 6. Mappings: capture EU-published only; no invented crosswalk

Vendor/encode only the mappings the EU actually ships (the repo's ELM↔ELMO and ELM↔Diploma-Supplement
spreadsheets). We **do not** author an ELM↔OB/CLR crosswalk — there is no official one, it is not a
conform-ed support tier, and the shared W3C VC base is the documented interop story. Any translation
tooling belongs to the product layer (emergent), not here.

### 7. CI lanes: match the established split

Per-commit (`validate`): Zod contracts + JSON-LD round-trip (parse→normalize→serialize→reparse
deep-equal) — fast. A **local/nightly conformance lane** (mirroring the QTI official-XSD lane,
ADR-0011): every vendored EU example SHACL-valid against its profile + signed examples pass JAdES
seal verification under an **injected trust anchor and a pinned verification-time** (so expiring
example certs do not rot the suite); skips when artifacts are absent. Coverage maps are committed and
regenerated on demand (ADR-0013). The lane runs **negative fixtures** too (deliberately-invalid
instances per profile, and an invalid/tampered EDC) to prove the SHACL and seal checks actually
reject — not just pass.

### Fixtures

Source any official LOQ/AMS/PID examples first (ELM Browser / QDR); otherwise **author** one canonical
minimal-but-complete valid instance per profile root (required properties + a bounded CV value + one
opaque ESCO IRI) plus a few deliberately-invalid fixtures, owned per `spec:version` in the Fixture
Dataset tradition. EDC reuses the ten EU examples as positives and adds authored negatives.

### 8. EDC Reference Renderer — framework-light, its own package

Ship a **Reference Renderer** for EDC: the credential analogue of the QTI Reference Skin — a faithful,
accessible **semantic-HTML** rendering driven by `displayParameter`/`individualDisplay` (language
selection + fallback), explicitly "not a product UI", so credentials can be exercised, demoed, and
conformance-tested without emergent. It is **framework-light** (pure functions → semantic HTML + a
serializable view-model, **no React** — credential display is static), lives in its **own package**
(`@conform-ed/elm-render`), and is viewable via a harness app/route. **PDF export and pixel/background
EU-Viewer parity are deferred** (downstream concerns, no formal render-conformance spec to gate
against). `displayParameter` is still fully modelled + SHACL-validated + coverage-mapped regardless.

### 9. Revocation/status — injected resolver, modelled generically

The EU sample credentials carry **no `credentialStatus`** (status is optional in EDC) while the
Viewer's "Revocation" check hits the issuer's live list. The verifier validates the `credentialStatus`
structure when present (reusing the existing `status.ts`, structure-agnostic) and delegates the actual
revocation lookup to a **host-injected resolver**; it reports "no status declared" when absent. Keeps
the engine offline-deterministic. The exact `credentialStatus.type` EDC emits is confirmed at build
time (examples omit it).

## Considered and rejected

- **EDC as a standalone spec / EDC-only / lean core.** Rejected in favour of the reusable core +
  all-four-profiles build: the four profiles genuinely share one ontology, and only a profile-neutral
  core models that without duplication.
- **JSON Schema or a curated denominator.** The EU JSON Schema is a newer, derived, EDC-only artifact
  and would under-count silent gaps; a curated schema reintroduces the "our own surface" problem
  ADR-0013 exists to avoid — for a spec that publishes a real authoritative schema (SHACL).
- **Validating at verify-time against the EU JSON Schema or our Zod.** Not what the credential
  declares; a credential could pass one and fail SHACL.
- **W3C Data Integrity / plain VC-JOSE for the seal.** EDC does not use them — sealing is JAdES
  (JWS-family) eIDAS e-seals with X.509 trust, a different mechanism.
- **Built-in EU Trusted-List trust anchoring + a live interop lane.** Breaks the engine's
  offline-deterministic property; trust is injected instead.
- **Signature-integrity-only or timestamps-as-claims seal checking.** Under-delivers vs the agreed
  "verify the seal cryptographically" tier.

## Consequences

- A new RDF/SHACL JS dependency enters `@conform-ed/credential-verification` and `@conform-ed/coverage`;
  the SHACL walker is reusable for any future RDF/SHACL spec.
- The eIDAS/JAdES/X.509/RFC-3161 stack is new surface inside the credential verifier; it is reusable
  for any eIDAS-sealed document and could later be extracted to its own package if a second consumer
  appears.
- Four new committed coverage maps (`elm/edc`, `elm/loq`, `elm/ams`, `elm/pid`), each unifying its
  shape variants via constraint tags; vendored SHACL shapes (all six EDC + both LOQ/AMS `-mdr`),
  JSON-LD context, and bounded value-sets must be version-pinned and refreshed per ELM release.
- A **new framework-light package** for the EDC Reference Renderer (+ a harness app/route) — the first
  credential renderer in the repo; surprising for a conformance toolkit, justified by the QTI
  Reference Skin precedent.
- LOQ/AMS/PID need **authored** canonical + negative fixtures — the `ELM-support` repo ships only EDC
  examples.
- The CONTEXT.md "ELM / European Digital Credentials" glossary section is the canonical language for
  this lane.
