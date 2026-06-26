# ELM / European Digital Credentials (v3.3)

European Learning Model v3.3 support. Decisions: [ADR-0019](../adr/0019-elm-europass-digital-credentials-support.md);
design + build plan: [docs/architecture/elm-edc.md](../architecture/elm-edc.md); glossary:
[CONTEXT.md](../../CONTEXT.md). An EDC is a W3C Verifiable Credential (VC 1.1) sealed with a
JAdES e-seal; LOQ/AMS/PID are unsealed plain ELM datasets. SHACL is the authoritative
conformance denominator.

## What's implemented

| Capability              | Where                                              | Notes                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vendored v3.3 artifacts | `coverage/vendor/elm/`                             | 11 SHACL shapes (6 EDC variants + LOQ/AMS ±mdr + PID), edc-ap context, ELM ontology, 10 EU examples; pinned (`PROVENANCE.md`), refresh via `bun run scripts/fetch-elm-artifacts.ts` |
| Contracts (Zod)         | `@conform-ed/contracts/elm/v3_3`                   | VC-agnostic ELM Core (52 classes) + EDC envelope + LOQ/AMS/PID roots; round-trips the EU corpus                                                                                     |
| Coverage maps           | `coverage/maps/elm-{edc,loq,ams,pid}-v3.3.json`    | SHACL walker (`coverage/src/walkers/shacl.ts`) + class-based reconciliation; variant tags + hybrid CV; `bun run coverage:check` gates drift                                         |
| Structural verify       | `credential-verification` `validateAgainstProfile` | real SHACL over JSON-LD→RDF; **profile-agnostic** (EDC + LOQ/AMS/PID)                                                                                                               |
| JAdES e-seal            | `credential-verification` `verifyJadesSeal`        | JWS (RFC-7797) + x5c chain (pinnable time) + RFC-3161 `adoTst`; trust anchor host-injected                                                                                          |
| Status / revocation     | `credential-verification` `evaluateRevocation`     | generic, injected resolver (EDC carries no `credentialStatus` in the EU samples)                                                                                                    |
| EDC verify (combined)   | `credential-verification` `verifyEdc`              | one call composing seal + SHACL + validity window + status into an `EdcVerdict`; `trustAnchored` is a separate honest axis that never downgrades the rollup (ADR-0019 §3)           |
| Reference Renderer      | `@conform-ed/elm-render`                           | framework-light semantic HTML + view-model from `displayParameter`                                                                                                                  |

## Application profiles

- **EDC** — European Digital Credentials for Learning. The only VC-shaped, sealed profile. Full
  stack: contracts → coverage → SHACL verify → JAdES seal → reference render. 6 sub-variants
  (`generic-full`/`-no-cv`/`accredited`/`converted`/`issued-by-mandate`/`diploma-supplement`)
  are unified into one coverage map with variant tags.
- **LOQ / AMS / PID** — unsealed plain datasets (Learning Opportunities & Qualifications;
  Accreditation Metadata Schema; Person Identity). Contracts + coverage; structural SHACL
  validation works via the profile-agnostic validator (authored fixtures in
  `credential-verification/test/fixtures/elm/`). No seal/status (they are not credentials).

## Tests / gates

- Per-commit: contracts round-trip (`packages/contracts/test/elm-v3_3.test.ts`), coverage map +
  walker (`coverage/test/{shacl,elm-v3_3}.test.ts`), SHACL verify + JAdES seal + status + dataset
  fixtures + the combined `verifyEdc` orchestrator
  (`credential-verification/test/elm-{shacl,jades,verify-edc,status,dataset-fixtures}.test.ts`),
  renderer (`elm-render/test/render-edc.test.ts`). All artifacts are committed and the checks are
  fast, so — unlike the QTI official-XSD lane (ADR-0011) — they run per-commit rather than on a
  separate nightly lane.

## Known gaps (recorded in the coverage maps)

- MDR-variant fields (`publisher`, `status`) and `QualificationReference` are unmodelled in the
  Zod (genuine `residues.silentGaps`); the EU spec typo `patronimycName` (sic) is corrected to
  `patronymicName` in the model.
- Bounded controlled vocabularies are scheme-checked (not yet membership-enforced); ESCO is
  intentionally opaque (ADR-0019 §5).
- EU Trusted-List / accreditation trust anchoring and a live interop lane are out of scope (trust
  is host-injected); PDF/pixel-parity rendering is deferred.
