# CAT 1.0 vendored denominator — provenance

The `cat:1.0` Coverage Map reconciles the 1EdTech Computerized Adaptive Testing (CAT) 1.0 service
information model — the entities a platform and a CAT engine exchange to delegate adaptive item
selection — against conform-ed's `CatV1_0` Zod contracts. CAT 1.0 is a **prose** specification:
it is published as an implementation guide (prose + JSON examples), with **no** machine-readable
schema (no XSD, no JSON Schema, no OpenAPI). So the denominators are hand-authored JSON Schemas
(conform-ed ADR-0017, the lowest provenance tier), walked by `walkers/curated.ts` under its
provenance gate (file-level ADR-0017 + spec URL; every property node cites its source clause).

## Source

- **Specification:** 1EdTech CAT 1.0 Implementation —
  <https://www.imsglobal.org/spec/cat/v1p0/impl/> (errata:
  <https://www.imsglobal.org/spec/cat/v1p0/errata/>).

## Curated denominators (the five entity documents)

- `curated/section-data.schema.json` — `SectionData` (+ `ItemPool`, `ItemRef`, `CatConstraint`).
- `curated/item-stage.schema.json` — `ItemStage` (+ `ItemRef`).
- `curated/assessment-result.schema.json` — `AssessmentResult` (+ `ItemAttempt`, `ItemRef`,
  `ResponseVariable`, `OutcomeVariable`).
- `curated/cat-engine-result-report.schema.json` — `CatEngineResultReport` (+ `OutcomeVariable`,
  `ItemStage`, `ItemRef`).
- `curated/session-info.schema.json` — `SessionInfo`.

Shared sub-objects (`ItemRef`, `OutcomeVariable`, `ItemStage`) appear in more than one file with
identical content; the literal walker keys `$defs` globally and dedupes, so they reconcile against
one set of `def:` keys.

## Reconciliation notes

Both sides use the same JSON binding (identical camelCase names), so the join needs no
`nameNormalizer`, alias or override, and reconciles with no silent gaps. The record-typed
extension points (`itemMetadata`, `demographics`, `customParameters`, `customProperties`,
`diagnosticData`, constraint `parameters`) are open maps with no named members.

The three CAT controlled vocabularies are verified as **value-sets** against conform-ed's
extensible enums (which also admit `ext:*` vendor values, so every published member is accepted):
the outcome-variable type (`OutcomeVariable.baseType`, 11), the QTI cardinality
(`OutcomeVariable.cardinality`, 4) and the assessment-result status (`SessionInfo.status`, 6).
The `recommendation` enum (continue/finish/suspend/abandon) is modelled inline in the contract
with no exported schema, so it is carried as denominator metadata but not value-set-verified.

## Transport surface

CAT publishes no OpenAPI, so the six REST operations (create/get section, create session, submit
results, end session, end section) are catalogued as conformance requirements that `constrain` the
data-model items each request/response payload carries — the same approach the LTI map takes for
its service operations. The thin request/response envelopes (`SubmitResultsRequest` wraps an
`AssessmentResult`; `SubmitResultsResponse` is a `CatEngineResultReport`; etc.) are those payloads.

Out of scope: the CAT engine internals (the item-selection algorithm, IRT calibration) — a
deliberate black box in the specification.
