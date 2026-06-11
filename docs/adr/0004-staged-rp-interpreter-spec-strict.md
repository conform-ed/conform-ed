# Staged response-processing interpreter, spec-strict by default

Status: accepted

Scoring moves from hand-coded standard-template functions (which ignored the
item's `responseProcessing` element entirely) to a pure, deterministic
**interpreter** over the contracts-validated `responseProcessing` tree:
`responseCondition`, `setOutcomeValue`, and the operator vocabulary, with
coverage grown milestone by milestone and unsupported operators surfaced
through the Capability Report (ADR-0003). The standard template URIs resolve
to built-in canonical trees — templates are interpreter inputs, not a parallel
path. Determinism (same declarations + responses ⇒ same outcomes) is a hard
property: scoring must be replayable and runnable fully offline.

Defaults are **spec-strict**: `match_correct` is exact; mapping
`caseSensitive` defaults follow the spec. The previous case/diacritic folding
(a language-learning kindness) becomes **Response Normalization** — an opt-in,
consumer-configured transform of candidate input applied before RP, documented
as a deviation and always disabled in conformance runs. A conformance org's
published runtime must score spec content correctly out of the box.

## Considered and rejected

- **Templates-only, defer the interpreter** — every milestone would deepen a
  scoring path that conformance forces us to replace wholesale.
- **Compile RP to generated JS** — runtime speed nobody asked for, at the cost
  of a codegen surface in an MIT package.
- **Keep lenient matching as the default** — backwards-compatible for existing
  consumers but mis-scores spec content by default; consumers keep the
  behavior via one Response Normalization config instead.
