# VC Data Model 2.0 vendored denominator — provenance

The `vc:2.0` Coverage Map reconciles the W3C Verifiable Credentials Data Model 2.0 core model —
`VerifiableCredential` and `VerifiablePresentation` plus their supporting objects — against
conform-ed's `VcDataModel20` Zod contracts. VCDM 2.0 is the **foundation** the 1EdTech Open Badges
3.0 and CLR 2.0 credentials extend; modelling it directly gives that shared base its own coverage.

VCDM 2.0 is a **prose + JSON-LD** specification: the data model is normative text plus the
`https://www.w3.org/ns/credentials/v2` `@context`, with **no** normative validation schema (the
model is deliberately JSON-LD-extensible). So the denominators are hand-authored JSON Schemas
(conform-ed ADR-0017, the lowest provenance tier), walked by `walkers/curated.ts` under its
provenance gate (file-level ADR-0017 + spec URL; every property node cites its source clause).

## Source

- **Specification:** W3C Verifiable Credentials Data Model 2.0 (Recommendation) —
  <https://www.w3.org/TR/vc-data-model-2.0/>
- **Securing mechanism (proof shape):** W3C VC Data Integrity —
  <https://www.w3.org/TR/vc-data-integrity/> (the `proof` object terms).

## Curated denominators

- `curated/verifiable-credential.schema.json` — root `$ref`s `VerifiableCredential`.
- `curated/verifiable-presentation.schema.json` — root `$ref`s `VerifiablePresentation`.

Both files carry a **byte-identical `$defs` block** (`VerifiableCredential`, `VerifiablePresentation`,
`CredentialSubject`, `CredentialSchema`, `CredentialStatus`, `RefreshService`, `TermsOfUse`,
`Proof`, `Evidence`). The literal walker keys `$defs` globally by name and dedupes, so the two
documents reconcile against **one** set of `def:` keys — and the presentation's
`verifiableCredential` reuses the same `VerifiableCredential` definition the credential document
roots at.

## Reconciliation notes

Both sides use the same JSON binding (identical property names), so the join needs no
`nameNormalizer`, alias or override, and reconciles with no silent gaps. The many one-or-many
properties (`proof`, `credentialSubject`, `credentialSchema`/`Status`, `refreshService`,
`termsOfUse`, `evidence`, `verifiableCredential`) are modelled as `oneOf[single, array]` to mirror
conform-ed's `oneOrMany` union, so both forms resolve. The `issuer` / `holder` / `id` values are
URL-or-object / string-or-language-map unions with no fixed sub-shape, modelled as open leaves.

**No value-sets:** VCDM is JSON-LD-open and the core model carries no closed enumerations — the
`type` membership rule (MUST include `VerifiableCredential`/`VerifiablePresentation`) and the
`@context` first-entry rule are `refine`/literal invariants captured in the conformance catalogue,
not enumerated vocabularies a value-set could verify.

Out of scope: the cryptographic securing suites (Data Integrity cryptosuite / JOSE-COSE proof
verification) and JSON-LD `@context` term semantics — separate specifications.
