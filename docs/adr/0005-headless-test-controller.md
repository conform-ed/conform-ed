# assessmentTest semantics live here, as a headless test controller

Status: accepted

Test-level QTI — testParts, navigation modes, section selection/ordering under
a seed, preconditions, branch rules, time limits, outcome processing, test
feedback — is pure spec semantics, and it belongs in `@conform-ed/qti-react`
as a deterministic **Test Controller**: given an `assessmentTest` view, a
seed, and the current session state, it answers what is visible, what is
allowed, what comes next, and how outcomes aggregate. It owns no storage:
consumers feed it their persisted session state and store what it returns
(conform-ed's reference harness keeps it in memory). Same shape as the item
runtime: rules in the MIT core, persistence and product policy outside. This
is the only path to test-level conformance certification.

## Considered and rejected

- **Sequencing implemented downstream in each consumer's session model** —
  duplicates pure spec logic into closed products and caps the conformance
  ladder at item level.
- **A separate `@conform-ed/qti-test` package** — cleaner on paper, but the
  controller shares types, the Capability Report, and the RP/outcome
  interpreter with the item runtime; a package boundary there is ceremony
  before a second consumer exists.

## Status update (2026-06): timing and time limits

The controller now owns the session clock — it was previously clock-free,
with timeLimits as pass-through data for consumer timers. The clock is
injectable (`TestControllerOptions.now`, default `Date.now`), and every
recorded duration lives in consumer-persisted session state: each public
transition (and the new `tick()`) first folds elapsed wall time into the
active scopes — the test, and while an item is current, its part, every
ancestor section, and the item itself — so scoring and enforcement stay pure
functions of recorded state (ADR-0004 determinism). Spec basis (3.0.1
§2.8.5): test/part/section durations are built-in `duration` variables
"within each respective scope", referenced in outcome processing bare (the
test) or as `PART.duration`/`SECTION.duration`; they include "any other time
spent navigating that part of the test", which is why the controller — not a
sum of item durations — must track them. `ITEM.duration` is different: the
item session owns it (the attempt store's `durationSeconds`), the consumer
reports it with the submit result, and the controller's own per-item clock is
used only to enforce the item's minTime/maxTime; the two sources converge
when a suspend/resume API lands.

Enforcement honesty: the spec defines almost no expiry behavior. The only
normative sentence is "The allow-late-submission attribute regulates whether
a candidate's response that is beyond the max-time should still be accepted"
(§7.40.3, default false). Everything else below is designed delivery-engine
policy — consistent with, but not mandated by, the spec:

- Expiry is `accrued > maxTime` (exactly maxTime is in time); minTime is
  satisfied at `accrued >= minTime` — both boundaries candidate-favorable.
- An expired test ends, flushing pending simultaneous results first: that
  flush is the part submission happening at the boundary, not beyond it. An
  expired part/section/item closes — its items become non-navigable, and a
  current item inside it advances to the first still-reachable item, ending
  the test when none remains.
- A late submission must be permitted by every exceeded enclosing scope's own
  allow-late-submission flag (the spec is silent on stacked expiries). A
  refusal is recorded in `state.rejectedSubmissions` with the innermost
  barring scope — auditable, never silent (ADR-0003) — and the expiry then
  applies; an accepted late response commits before it.
- minTime gates `next()` only in linear parts and only for items and sections
  ("Minimum times are applicable to qti-assessment-sections and
  qti-assessment-items only when linear navigation mode is in effect",
  §7.40.1). It never gates `end()`: the spec says nothing about preventing a
  candidate from ending the session.

Out of scope, recorded: suspension/resume (until it exists, durations include
all wall time between transitions — the spec's "minus any time the session
was in the suspended state" is unimplementable); PNP duration adjustments
(§2.8.5 note); test/part minTime (surfaced on the plan, unenforced per
§7.40.1); explicit truncation-epsilon reporting (a millisecond clock keeps
raw fractional seconds conformant).
