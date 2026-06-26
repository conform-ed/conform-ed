# ELM / European Digital Credentials — Design & Implementation Plan

Companion to [ADR-0019](../adr/0019-elm-europass-digital-credentials-support.md) (the decisions and
rationale) and the **ELM / European Digital Credentials** section of [CONTEXT.md](../../CONTEXT.md)
(the canonical language). This document is the concrete _how_: module layout, interfaces, data flows,
and the sequenced build plan with per-phase exit gates.

Status: planned (2026-06-26)

---

## 1. Scope

Add **European Learning Model (ELM) v3.3** support to conform-ed:

- **All four application profiles.** `EDC` (sealed W3C VC) gets the full stack: contracts → coverage
  → verification → seal → reference rendering. `LOQ`, `AMS`, `PID` (unsealed plain datasets) get
  contracts → coverage only.
- **SHACL is the authoritative denominator** (new coverage walker; also the verify-time validator).
- **JAdES/eIDAS seal** verified cryptographically (signature + X.509 chain + RFC-3161 timestamps),
  with the trust-root decision **host-injected**.
- **EDC Reference Renderer** — framework-light, semantic HTML, its own package.

Out of scope: live EU Trusted-List/Accreditation-DB anchoring, a live interop lane against the EU
Issuer/Viewer, an invented ELM↔OB/CLR crosswalk, PDF/pixel-parity rendering, the legacy XML/XSD v1/v2
binding.

## 2. Pinned facts (so a builder need not re-research)

- **Version:** ELM **v3.3** (browser 3.3.1); distribution snapshot `snb-model/20230928-0`;
  application-profile version `1.1.0`. Wire format is **JSON-LD** (XML/XSD was the retired v1/v2
  binding).
- **An EDC _is_ a W3C VC.** `type: ["VerifiableCredential","EuropeanDigitalCredential"]`, VC Data
  Model **1.1** (`https://www.w3.org/2018/credentials#`). The envelope ships a field superset:
  `issuanceDate` (1.1) + `validFrom` (2.0) + ELM's `issued`. `credentialStatus`/`termsOfUse` are
  optional and absent from the EU samples.
- **Self-declared schema:** `credentialSchema: { id: "…/ap/edc-generic-full", type:
"ShaclValidator2017" }`.
- **Seal:** JAdES — a `signatures` array of detached JWS (`b64:false`, RFC-7797), protected header
  `alg:RS256`, `typ:jose+json`, `x5c` (full chain), `x5t#S256`, `kid`, `sigT`, plus `adoTst`
  (RFC-3161 timestamp tokens). Not VC Data Integrity, not plain VC-JOSE.
- **Profiles & roots:** `EDC` → `EuropeanDigitalCredential` (6 sub-variants: `generic-full`,
  `generic-no-cv`, `accredited`, `converted`, `issued-by-mandate`, `diploma-supplement`); `LOQ` →
  `LearningOpportunity`/`Qualification`/the Specification classes (`loq-constraints`,
  `loq-constraints-mdr`); `AMS` → `Accreditation` (`ams-constraints`, `ams-constraints-mdr`); `PID` →
  `Person` (`pid-constraints`). Only EDC is a VC and only EDC is sealed.
- **Artifact IRIs:** `http://data.europa.eu/snb/model/ap/<id>` (307→Europass LOD→302→`.rdf`);
  JSON-LD context `http://data.europa.eu/snb/model/context/edc-ap`; ontology
  `http://data.europa.eu/snb/model/elm`.
- **Corpus:** 5 signed `.jsonld` + 5 unsigned EDC samples at
  `code.europa.eu/qualifications-courses-and-credentials/ELM-support` (MicroCredential, CertOfPart,
  JointDegree, MastersDegree, TranscriptOfRecords); mapping spreadsheets ELM↔ELMO, ELM↔DS.

## 3. Package & module map

```text
packages/
  contracts/src/elm/v3_3/
    core/                       ELM Core — VC-agnostic ontology model (Zod)
      agent.ts                    Agent, Organisation, Person, Address, Identifier, ContactPoint…
      claim.ts                    Claim + LearningAchievement/Activity/Assessment/Entitlement
      specification.ts            Specification family + Qualification, LearningOutcome
      accreditation.ts            Accreditation, AwardingProcess/Body
      concept.ts                  skos:Concept / ConceptScheme (CV references)
      shared.ts                   Note, MediaObject, WebResource, locn:* …
      index.ts
    edc.ts                      EDC envelope (VC layer over core) + 6 sub-variant discriminator
    loq.ts  ams.ts  pid.ts      Plain-dataset profile layers over core
    index.ts
    elm-v3_3-zod-templates.md   provenance/normalisation notes (per repo convention)

  coverage/
    src/walkers/shacl.ts        NEW — RDF/SHACL language walker (L1 inventory)
    vendor/elm/                 version-pinned upstream artifacts (committed)
      shapes/   edc-generic-full.ttl, …(6 EDC), loq*, ams*, pid-constraints
      context/  edc-ap-context.jsonld
      vocab/    bounded SKOS value-sets (EQF, ISCED-F, NAL country/lang, types…)
      PROVENANCE.md
    specs/elm/                  derived spec inventory inputs (per existing layout)
    maps/  elm-edc-v3.3.json  elm-loq-v3.3.json  elm-ams-v3.3.json  elm-pid-v3.3.json
    scripts/fetch-elm-artifacts.ts

  credential-verification/src/
    jades.ts                    NEW — JAdES JSON-serialization parse + detached b64:false JWS verify
    x509-chain.ts               NEW — x5c parse, chain build/validity, injected trust anchor
    rfc3161.ts                  NEW — adoTst TimeStampToken (CMS) parse + TSA-signature verify
    shacl-validate.ts           NEW — JSON-LD→RDF→SHACL (shared shapes), variant-aware
    verify.ts                   extended: EDC orchestration (structure→SHACL→seal→status)
    resolvers.ts result.ts      extended: trust-anchor + verification-time + edc result axes

  elm-render/                   NEW package — EDC Reference Renderer (framework-light)
    src/render-edc.ts           renderEdc(credential, opts) → { html, viewModel }
    src/view-model.ts           displayParameter/individualDisplay → normalized view-model
    src/language.ts             language selection + fallback
    package.json (version 0.0.0, check-default scripts — ADR-0016 standard)

apps/
  elm-harness/                  OR a route in an existing harness — renders the renderer for demo

test fixtures (per package):
  …/elm/edc/*.jsonld (10 EU + authored negatives)
  …/elm/{loq,ams,pid}/*.jsonld (authored canonical + negatives)
```

## 4. Component design

### 4.1 ELM Core + profile contracts (`contracts/src/elm/v3_3`)

- **Core is profile-neutral Zod.** Model the shared ontology classes once; profiles compose them.
  Follow the OB/CLR precedent: import VC primitives from `vc-data-model/v2_0` where they align.
- **Normalisation is allowed and recorded.** Where the Zod renames/merges literal ELM properties,
  carry `.meta({ specRef: ["elm:3.3:…"] })` inline (ADR-0013 L2 provenance). Document deviations in
  `elm-v3_3-zod-templates.md`.
- **EDC envelope** = VC layer over core: the `["VerifiableCredential","EuropeanDigitalCredential"]`
  type, the date-field superset (`issuanceDate`+`validFrom`+`issued`), `credentialSchema`,
  `credentialProfiles`, `displayParameter`, `credentialSubject: Person`, `evidence?`,
  `credentialStatus?`, `termsOfUse?`, `signatures?` (JAdES). A discriminator selects the sub-variant
  (from `credentialSchema.id`); validation strictness is the SHACL's job, not Zod's.
- **LOQ/AMS/PID** = plain multi-rooted dataset layers over core (no VC fields, no `signatures`).
- **No separate VC 1.1 base** (ADR-0019 §1): VC-inherited fields are covered by the EDC SHACL walk.

### 4.2 SHACL coverage walker (`coverage/src/walkers/shacl.ts`)

L1 information-model inventory from the **literal SHACL** (never our Zod):

1. Parse the shape graph (TTL via an N3/Turtle parser; `.rdf` via an RDF/XML parser) into an RDF
   dataset.
2. Enumerate `sh:NodeShape` carrying `sh:targetClass`; for each, walk `sh:property` →
   `sh:path`, and the constraint facets: `sh:datatype` / `sh:class` / `sh:node`, `sh:minCount` /
   `sh:maxCount`, `sh:in` / `sh:hasValue` (CV constraints), `sh:or`/`sh:xone` unions.
3. Emit **L1 keys** `elm:3.3:<profile>:<Class>/<path>[/<path>…]` (profile ∈ edc/loq/ams/pid).
   De-dup shared types (Agent, Organisation, …) once; record reuse as **usage edges** (ADR-0013).
4. **Variant tags:** each constraint records which shape graph(s) contain it (`generic-full`,
   `accredited`, `…`, `mdr`) → one map per profile, not per variant.
5. CV leaf constraints record the referenced ConceptScheme and the **enforcement level** (bounded →
   membership; ESCO → opaque), feeding decision §5 of the ADR.

Deterministic: same shapes → identical keys. Reconcile against the Zod (`reconcile.ts`) to produce
the three residue sets (silent gaps / extensions / normalised deviations).

### 4.3 Verify pipeline (`credential-verification`)

```
verifyEdc(credential, resolvers, opts) →
  1. structural parse           Zod (parse gate; identifies the declared variant)
  2. SHACL validity             shacl-validate.ts: JSON-LD →(document-loader, offline)→ RDF
                                  → SHACL engine vs the variant from credentialSchema.id
  3. seal (if signatures[])     jades.ts → x509-chain.ts → rfc3161.ts
  4. status (if credentialStatus) status.ts structural + injected revocation resolver
  → multi-axis EdcVerificationResult
```

Resolver seams (all host-injected, deterministic): `trustAnchors` (which roots/TSA roots are
trusted, + optional `isQualified`), `revocationResolver`, `verificationTime` (pin to validate
historical certs), the existing offline `documentLoader`.

**Profile-agnostic validator core.** `shacl-validate.ts` exposes a generic
`validateAgainstProfile(jsonld, profile)` over any vendored shape graph; `verifyEdc` is a thin
orchestrator (SHACL + seal + status) layered on it. Step 2 of the pipeline is therefore reusable as-is
for LOQ/AMS/PID — their structural validation is the same engine pointed at `loq`/`ams`/`pid` shapes,
deliberately not surfaced now but free to expose later (ADR-0019 §1/§3). Seal/status do not apply to
those unsealed profiles.

### 4.4 JAdES seal (`jades.ts` + `x509-chain.ts` + `rfc3161.ts`)

- **jades.ts** — parse the `signatures` array (JAdES JSON serialization); reconstruct the **detached
  `b64:false`** signing input (RFC-7797: `ASCII(protected) || "." || payload-bytes`, payload =
  canonical credential serialization minus `signatures`); verify the JWS with the public key from
  `x5c[0]`; assert `sigT` consistency and required JAdES header params.
- **x509-chain.ts** — parse `x5c`, build leaf→root chain, verify each link's signature + validity
  period (against `opts.verificationTime`), basic-constraints/key-usage; **trust anchor is injected**
  (`opts.trustAnchors`), as is the `isQualified` verdict.
- **rfc3161.ts** — parse each `adoTst` TimeStampToken (CMS SignedData), verify the TSA signature and
  that the imprint covers the signature value; TSA trust injected. (ADR-0019 §4: timestamps are
  cryptographically validated, not just parsed.)

Recommended libraries (confirm at build): JWS via `jose` (panva; supports `x5c`, `b64` crit);
X.509 via `@peculiar/x509`; ASN.1/CMS/TSP via `pkijs`+`asn1js` or `@peculiar/asn1-*`. JSON-LD via
`jsonld`; SHACL via `shacl-engine` (or `rdf-validate-shacl`) over `@rdfjs/dataset`; Turtle via
`@rdfjs/parser-n3`, RDF/XML via `rdfxml-streaming-parser`.

### 4.5 EDC Reference Renderer (`packages/elm-render`)

- **Framework-light, no React.** `renderEdc(credential, { lang }) → { html, viewModel }`.
- `view-model.ts` resolves `displayParameter`/`individualDisplay` (per-language `displayDetail`,
  page/media) + `language.ts` selection with fallback into a serializable view-model; the HTML
  renderer is a pure function over that view-model (semantic, accessible, unstyled).
- Downstream products (emergent) consume the view-model and wrap in their own framework. PDF/pixel
  parity deferred. Demoed via the harness.
- New publishable package → follows the unified release standard (ADR-0016): `version: "0.0.0"`,
  check-default scripts, `prepare` hook.

## 5. Data flows

**Coverage generation (on demand, committed output):** vendored shapes → `shacl.ts` walker → L1 →
`reconcile.ts` vs Zod → `maps/elm-*-v3.3.json` (diff-reviewed).

**Verify (nightly lane + library API):** credential → Zod → SHACL (offline document-loader) → JAdES
(injected trust + pinned time) → status (injected) → result.

**Render (library API + harness):** credential.displayParameter → view-model (lang select) → semantic
HTML.

## 6. Implementation plan (ordered, with exit gates)

Critical path: **P0 → P2 → P4 → P5 → P8**. P1→P3 and P7 parallelise off P0/P2.

### P0 — Vendoring & provenance _(blocks all)_

- `scripts/fetch-elm-artifacts.ts`: fetch + pin the 6 EDC shapes, `loq`/`loq-mdr`, `ams`/`ams-mdr`,
  `pid-constraints`, the `edc-ap` JSON-LD context, the bounded SKOS value-sets, and the 10 EU EDC
  examples (→ fixtures). Write `coverage/vendor/elm/PROVENANCE.md` (IRIs, snapshot, fetch date, AP
  version 1.1.0).
- **Gate:** artifacts committed + provenance recorded; re-run reproduces byte-identical files.

### P1 — SHACL walker _(needs P0)_

- Implement `coverage/src/walkers/shacl.ts` (§4.2). Unit-test on `edc-generic-full` + one LOQ shape.
- **Gate:** deterministic L1 keys for all four profiles; usage-edge de-dup; variant tags present;
  CV enforcement levels recorded; re-run identical.

### P2 — ELM Core + profile contracts _(needs P0)_

- Build `core/*` then `edc.ts`/`loq.ts`/`ams.ts`/`pid.ts` (§4.1); `specRef` meta on normalised
  fields; `elm-v3_3-zod-templates.md`.
- **Gate:** the 10 EU EDC examples parse; JSON-LD round-trip (parse→normalize→serialize→reparse
  deep-equal) holds for EDC; types exported; per-commit round-trip tests green.

### P3 — Coverage maps _(needs P1 + P2)_

- Wire walker + reconcile; emit the 4 committed maps with variant tags + residues.
- **Gate:** 4 maps committed; residue sets (silent gaps / extensions / deviations) reviewed and
  sane; map regeneration is a documented on-demand step (ADR-0013).

### P4 — Verify: structure + SHACL _(needs P2 + P0)_

- `shacl-validate.ts` (JSON-LD→RDF→SHACL, variant-aware via `credentialSchema.id`); extend
  `verify.ts`/`result.ts` with the EDC structural+SHACL axes; reuse the offline document-loader.
- **Gate:** all 10 EU examples SHACL-valid against their declared variant; authored negative EDC
  fixtures rejected with correct constraint reports.

### P5 — JAdES seal _(needs P4)_

- `jades.ts` + `x509-chain.ts` + `rfc3161.ts` (§4.4); wire into `verifyEdc` with injected
  `trustAnchors` + `verificationTime`.
- **Gate:** the 5 signed examples pass under the injected EU test root + pinned verification-time;
  a tampered-payload fixture fails the signature; an out-of-validity time fails the chain; an invalid
  `adoTst` fails the timestamp axis.

### P6 — Status _(needs P4; small)_

- Generic `credentialStatus` structural validation (reuse `status.ts`) + injected
  `revocationResolver`; confirm the real `credentialStatus.type` EDC emits and add a fixture.
- **Gate:** present→validated + delegated; absent→"no status declared"; resolver-driven revoked case
  reported.

### P7 — EDC Reference Renderer _(needs P2; parallel)_

- `packages/elm-render` (§4.5) + harness app/route; new-package release wiring (ADR-0016).
- **Gate:** renders all 5 EU samples to semantic accessible HTML; language fallback exercised;
  a11y/structure assertions; view-model stable; package `validate` green.

### P8 — Fixtures, nightly lane, docs _(needs P4/P5)_

- Author canonical + negative LOQ/AMS/PID fixtures (official-first); wire the **local/nightly
  conformance lane** (SHACL-validate all examples + seal-verify signed, pinned time; skips when
  artifacts absent) mirroring the QTI XSD lane; update `docs/status.md`,
  `docs/project/support-matrix.md`, `docs/BACKLOG.md`, add `docs/suites/elm.md`.
- **Gate:** nightly lane green; per-commit `validate` stays fast (no RDF/SHACL/crypto in it); docs
  updated; ADR-0019 status confirmed.

## 7. Testing strategy

- **Per-commit (`validate`):** Zod parse + JSON-LD round-trip + renderer unit tests + the walker's
  deterministic-keys unit tests. Fast — no RDF/SHACL engine, no crypto.
- **Local/nightly conformance lane:** SHACL validity (positives pass, negatives rejected) + JAdES
  seal verification (signed positives pass under injected trust + **pinned verification-time**;
  tamper/expiry/bad-timestamp negatives fail). Skips when vendored artifacts absent (ADR-0011 style).
- **Negative fixtures are mandatory** — they prove the validators reject, not merely pass.

## 8. New dependencies (to confirm at build)

| Concern                        | Candidate                                                       | Where                             |
| ------------------------------ | --------------------------------------------------------------- | --------------------------------- |
| JSON-LD expand/normalize       | `jsonld`                                                        | credential-verification, coverage |
| RDF dataset / Turtle / RDF-XML | `@rdfjs/dataset`, `@rdfjs/parser-n3`, `rdfxml-streaming-parser` | coverage, credential-verification |
| SHACL validation               | `shacl-engine` (or `rdf-validate-shacl`)                        | credential-verification, coverage |
| JWS / `b64:false` / `x5c`      | `jose` (panva)                                                  | credential-verification           |
| X.509 parse + chain            | `@peculiar/x509`                                                | credential-verification           |
| ASN.1 / CMS / RFC-3161 TSP     | `pkijs` + `asn1js` (or `@peculiar/asn1-*`)                      | credential-verification           |

All must keep verification **offline-deterministic** (vendored shapes/contexts; injected trust/time).

## 9. Risks & open items

- **JSON-LD canonicalization for JAdES** — the detached `b64:false` payload must be reconstructed
  byte-exactly as the EU Issuer signed it; verify against the real signed samples early (P5 is the
  proof).
- **RDF/SHACL JS maturity** — `shacl-engine` perf/coverage over real EDC shapes; validate on
  `edc-generic-full` in P1/P4 before committing.
- **Cert-rot** — example certs expire; the pinned `verificationTime` seam is the mitigation (P5 gate).
- **`credentialStatus.type`** — absent from EU samples; confirm the emitted type in P6.
- **ESCO opaqueness** — bounded-vs-opaque CV split is a deliberate `generic-full`/`no-cv` blend
  (ADR-0019 §5); record it in the coverage map so it is not mistaken for full CV conformance.
- **LOQ/AMS/PID fixtures** — authored, not official; mark provenance clearly.

## 10. Definition of done

Four committed coverage maps with variant tags + reviewed residues; EDC verify (structure + SHACL +
JAdES seal + status) green on the EU corpus under injected trust and pinned time, with negatives
rejected; the EDC Reference Renderer renders the EU samples; LOQ/AMS/PID parse + coverage-mapped +
SHACL-validate authored fixtures; per-commit `validate` fast, nightly conformance lane green; CONTEXT,
ADR-0019, support-matrix, status, BACKLOG, and a new `docs/suites/elm.md` all updated.
