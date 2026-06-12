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

## Status update (2026-06): expression and rule vocabulary complete

The staged growth reached a major milestone, scoped precisely: the
interpreter implements the full QTI 3 **expression** (operator) vocabulary of
§2.11, with semantics cited from the 3.0.1 ASI information model in the
operator tests. Notes from the final tranche:

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
  `durationGte`/`durationLt` and adaptive re-attempt logic. Test, part, and
  section durations are the controller's (ADR-0005, "Timing and time
  limits").

The **rule** vocabulary closed in a follow-up tranche: the interpreter
executes `lookupOutcomeValue` (matchTable/interpolationTable scoring,
§5.87/§5.90/§5.78) and `responseProcessingFragment`, the test controller
executes `qti-lookup-outcome-value` and `qti-outcome-processing-fragment` in
outcome processing, and `outcomeMinimum`/`outcomeMaximum` evaluate over the
consumer-supplied `itemOutcomeDeclarations` controller option. A
`lookupOutcomeValue` rule whose declaration carries no lookupTable refuses —
statically and at runtime — rather than guessing. Test-level duration
aggregation and timeLimits enforcement followed in the controller (ADR-0005,
"Timing and time limits"), closing the last named follow-up. None of this
amounts to engine-wide QTI 3 conformance: rendering coverage, test
navigation semantics, feedback, PNP, and packaging are separate workstreams,
and conformance is ultimately the certification suite's verdict, not this
corpus's.

The remaining _operator_ refusals, by contrast, are principled and permanent.
They are motivated individually below.

## Permanent refusals, motivated

The vocabulary being complete does not mean every expression always
evaluates. Three refusal categories remain by design, and they share one
shape: each targets an expression whose value depends on information the
evaluator does not — and in two of the three cases _cannot_ — possess. The
governing principle is the Capability Report's (ADR-0003): a score this
engine emits must be the spec-defined value of the spec-defined computation;
when that value is not computable, the engine says so visibly and scores
nothing, because a plausible fabricated number recorded as authoritative is
worse than a refusal anyone can see. Refusals never alter outcomes — runtime
refusal aborts to the declared outcome defaults, static refusal happens
before any candidate sees the item, and partial scoring never occurs.

### Unregistered `customOperator` classes

The spec defines no semantics to implement. `customOperator` "provides an
extension mechanism for defining operations not currently supported by this
specification" (§2.11.3.2); the `class` characteristic names sub-classes
whose "definition ... is tool specific and may be inferred from toolName and
toolVersion" (§5.37.1); `definition` is merely "a URI that identifies the
definition of the custom operator in the global namespace" (§5.37.2).
Evaluating an unknown class therefore means inventing another tool's
semantics. The tempting fallback — evaluate it to NULL, as some engines do —
is not inert in this algebra: `isNull` turns the fabricated NULL into a
definite `true`, and a `responseCondition` guarded by it falls through to its
else branch and records, say, a definite SCORE of 0 as if the item had been
scored. That is silent mis-scoring with extra steps.

Instead the operator is treated as the extension point the spec says it is:
consumers register implementations by class (`customOperators` in the
processing context), the capability gate accepts registered classes, and a
registered item becomes fully deliverable — determinism then being the
registered implementation's contract to keep. Unregistered classes are
refused statically.

Compliance, honestly: the spec is silent on what an engine lacking a class
definition should do, so refusal is not mandated — but neither is any
alternative, because there is no spec-defined value to be compliant _with_.
The defensible claim is negative: by refusing, we never emit a score the
spec does not license.

### Test-context expressions outside the test controller

`testVariables`, `outcomeMinimum`, `outcomeMaximum`, and the five `number*`
aggregates all carry the same opening clause in the information model: "This
expression, which can only be used in outcomes processing, ..." (§2.11.2).
Their values are functions of test-session state — which items were
selected, presented, responded, correct — and that state does not exist in
an item-level RP run; any item-level value would fabricate a session. So the
evaluator owns no semantics for them: the test controller injects the
lookups (`testVariables`, `testAggregate`) when executing outcome processing
over its session state, and outside that injection the expressions refuse.

This is the strongest compliance claim of the three: the refusal _is_ the
spec's own context restriction, applied verbatim. Content using these
expressions in item RP is itself non-conformant.

All eight evaluate inside outcome processing. `outcomeMinimum` and
`outcomeMaximum` read the items' declared `normal-minimum`/`normal-maximum`
from the consumer-supplied `itemOutcomeDeclarations` controller option — the
controller never sees item internals otherwise. Absent metadata is spec
behavior, not a refusal: an item with no declared maximum makes the result
NULL (§2.11.2.7), and one with no declared minimum is ignored (§2.11.2.6).

### Random operators outside seeded contexts

The spec asks only that `random` yield "a single value randomly selected
from the container" (§2.11.3.36, likewise `randomInteger`/`randomFloat`) and
says nothing about the randomness source. This ADR's hard property — same
declarations + responses ⇒ same outcomes — collides with ambient entropy:
client advisory scoring and server rescoring must agree, and a `Math.random`
draw inside RP would let the same session score differently on replay,
unauditable after the fact. The resolution is to make the draw part of the
session's inputs: every clone carries a seed (the replay key, stored with
the responses), template processing and RP draw from a seed-derived PRNG,
and scoring is a pure function again. Variation across candidates — the
evident intent of the operators — survives because each session draws a
fresh seed.

The refusal covers the remaining hole: a caller that invokes the evaluator
without a seeded source gets a refusal rather than a silent fallback to
entropy. In conform-ed's own runtime this never fires — the attempt store
always supplies a seed-derived source, and `canDeliver` does not refuse
random content. It is an invariant against integration mistakes, not a
content gate.

Compliance, honestly: the spec imposes no source or distribution
requirement, so a seeded PRNG satisfies the text as written; what the
seeding actually protects is our replayability property. An engine drawing
true entropy would be equally spec-compliant — and incapable of honest
rescoring.
