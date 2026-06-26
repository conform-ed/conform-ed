# ELM v3.3 vendored artifacts — provenance

These files are version-pinned, committed upstream artifacts of the **European Learning
Model v3.3** (application-profile version `1.1.0`, distribution snapshot
`snb-model/20230928-0`). Regenerate with `bun run scripts/fetch-elm-artifacts.ts`
(`--force` to overwrite). See ADR-0019 and docs/architecture/elm-edc.md.

## Sources

- **shapes/**, **context/**, **ontology/** — archived GitHub mirror
  `european-commission-empl/European-Learning-Model`, pinned to commit
  `9d7c5d22002237c3afeb1750b7038e6fe2cdd371`. The mirror's TTL carries the canonical `data.europa.eu/snb/...`
  IRIs. (The data.europa.eu deref chain redirects to op.europa.eu, whose TLS cert fails
  hostname validation, so the mirror is the byte-stable source.)
- **examples/edc/** — `code.europa.eu/qualifications-courses-and-credentials/ELM-support`
  (the live source-of-truth repo) via its GitLab raw API, pinned to commit
  `b9dcfa8efea435181222f7a65585c8cf8d40f427`.

## Contents

- `shapes/` — SHACL shape graphs (the conformance denominator): all 6 EDC sub-variants,
  LOQ (±mdr), AMS (±mdr), PID.
- `context/edc-ap-context.jsonld` — the EDC JSON-LD context (term/IRI resolution).
- `ontology/ELM.ttl`, `ontology/ELM-external.ttl` — the ELM OWL ontology (semantics).
- `examples/edc/` — the 10 EU EDC examples (5 signed `.jsonld` + 5 unsigned `.json`).

## Not vendored here

- Bounded SKOS controlled-vocabulary value-sets (eqf, isced-f, claim-type, credential,
  evidence-type, learning-setting, skill-type, skill-reuse-level, verification-status,
  entitlement-status, accreditation) — vendored by the CV-enforcement step.
- The legacy LOQ/AMS XSDs — SHACL is our denominator (ADR-0019).
