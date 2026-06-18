---
title: "QTI Results Reporting: views in qti-react, the binding in qti-xml"
description: "Architecture decision record ADR-0006."
sidebar:
  order: 6
  badge: { text: "ADR-0006", variant: note }
---

Status: accepted

QTI 3 Results Reporting is its own specification with its own certification
track — "QTI 3.0 Results Reporting and QTI Usage Data & Item Statistics will
have separate certification programs" (QTI 3 conformance), with exactly two
certifications defined: Instance IMPORT and Instance EXPORT (RR §6.4). It is
not a prerequisite of Delivery certification; we implement it as full-spec
work and as the future EXPORT/IMPORT certification target. The spec text
lives vendored for verbatim citation (tmp/agents/qti3-results-reporting.html).

The split follows package ownership: `@conform-ed/qti-react` owns session
semantics, so it builds the result document — `buildAssessmentResult` (pure)
and `TestSessionStore.assessmentResult()` (wired to plan, state, item views,
and the attempt stores' template-resolved correct responses).
`@conform-ed/qti-xml` owns bindings, so it gained conform-ed's first XML
writer, `serializeQtiAssessmentResult`, plus `validateQtiXmlContent` for
in-memory instances. The shared currency is the contracts result schema
(strict, generated against the official XSD binding): qti-react's views
mirror it structurally, the serializer types against it, and the normalizer
produces it — so the export gate is a literal round trip: build → serialize
→ parse → normalize → strict schema → deep-equal.

## Considered and rejected

- **XML strings produced directly in qti-react** — faster, but it puts
  binding knowledge in the runtime package, leaves qti-xml read-only, and
  forfeits the round-trip gate through the import path.
- **Latest-state-only item results** — valid per spec (history is a MAY),
  but the chosen full per-attempt history is the richer normative reading:
  "A report may contain multiple results for the same instance of an item
  representing multiple attempts … each item result must have a different
  datestamp" — and the controller now records exactly that (RecordedAttempt:
  submit instant, outcomes, responses, duration) in persisted state.

## Mapping decisions (spec verbatim where it leads)

- **Completeness**: "all items selected for presentation should be reported
  with a corresponding itemResult" and item results "must relate only to
  items that were selected" — every plan item gets at least one itemResult;
  selection is the resolved plan.
- **sessionStatus**: one `final` itemResult per recorded attempt; unflushed
  simultaneous submissions are `pendingResponseProcessing` ("after submission
  but before response processing" — item-level RP has run in the attempt
  store, but nothing is committed until the part flushes, so outcomes are
  withheld); everything else is `initial`, which "can only be used to
  describe sessions for which the response variable numAttempts is 0".
- **Durations**: "a single float that records time in seconds" — testResult
  carries the scope clocks as responseVariables (bare `duration`,
  `PART.duration`, `SECTION.duration`, matching the official report.xml
  example); each final itemResult carries the attempt's reported item-session
  duration; initial entries carry the enforcement clock's accrued seconds
  when any exist. The corpus's ISO-8601 duration strings
  (conformance-use-case-1.xml) are preserved by import (values are strings)
  but never produced.
- **numAttempts** is reported as the built-in response variable it is;
  candidate comments (`allowComment`) ride the item's latest result as
  `candidateComment`; the clone's template-resolved correct responses back
  `correctResponse` (omitted when empty — the schema requires ≥1 value).
- **Typing**: cardinality/baseType come from the item/test declarations;
  undeclared values degrade to inference (number → float, boolean → boolean,
  completionStatus → identifier, other strings → string). baseType is
  omitted for record cardinality (schema rule); record members carry
  `fieldIdentifier` per value.
- **Instance keys**: with-replacement instances report under their instance
  key (`Q01.2`) — consistent with the §2.11.1.2 variable addressing the rest
  of the engine uses.

## Import side

Parsing, schema validation, and normalization of result documents existed;
this milestone filled the optional-property gaps for fidelity (value
field/baseType, correctResponse interpretation, the outcomeVariable
characteristics, templateVariable/contextVariable, support, and
candidateComment) and added `assessmentResultFromNormalized` as the typed
view helper. Import conformance ("MUST read, accept, store and process all
of the REQUIRED properties") is exercised by the round-trip gates; the
`outcomeInformation` extension container is the one knowingly unmapped
optional (an extension point — staging postponement, not a refusal).

## Corpus evidence

Both well-formed official result examples round-trip through our serializer
to identical normalized documents. The third, full-example.xml, is malformed
at the source — its root element is literally self-closing
(`<assessmentResult …/>`) with sibling elements after it — and stays the
asserted parse-error it always was: rejecting it is the conformant read.
