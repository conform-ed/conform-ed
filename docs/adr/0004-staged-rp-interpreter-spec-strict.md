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

## Status update (2026-06): operator vocabulary complete

The staged growth reached its terminal milestone: the interpreter implements
the full QTI 3 expression vocabulary, with semantics cited from the 3.0.1 ASI
information model (§2.11) in the operator tests. Notes from the final tranche:

- `and`/`or`/`anyN` use the spec's three-valued logic (an undecided NULL
  operand makes the result NULL; a decisive operand wins outright).
- Numeric attributes of type IntOrIdentifier/FloatOrVariableRef (`index` n,
  `repeat` number-repeats, `roundTo`/`equalRounded` figures, `equal`
  tolerances, `anyN`/random bounds) resolve variable references at runtime;
  an unresolvable reference makes the operator NULL, never a refusal.
- `patternMatch` evaluates the XSD regex dialect (Appendix F of XML Schema)
  through the `xspattern` dependency — exact semantics, no translation subset.
  Invalid literal patterns are refused at the capability gate.
- The built-in session variables `duration` (elapsed seconds under an
  injectable store clock) and `numAttempts` (current attempt inclusive) back
  `durationGte`/`durationLt` and adaptive re-attempt logic. Item level only;
  test-level duration aggregation is future controller work.

The remaining refusals are the principled, permanent ones: unregistered
`customOperator` classes, test-context operators outside the test controller,
and random operators outside seeded contexts.
