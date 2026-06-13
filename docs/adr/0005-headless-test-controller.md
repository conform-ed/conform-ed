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
used only to enforce the item's minTime/maxTime; the two sources converged
when suspend/resume landed (see the suspension status update below).

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

Both staging postponements originally recorded here have since landed: PNP
duration adjustments (§2.8.5 note) arrived with the PNP/catalog subsystem
(ADR-0008 — additional-testing-time applied to max-time enforcement), and
suspension/resume landed earlier (see the suspension status update below).
Two non-gaps for the record: test/part minTime stays surfaced but
unenforced because §7.40.1 restricts minTime applicability to sections and
items, and a millisecond clock keeps raw fractional seconds within the
spec's truncation-epsilon requirement without explicit truncation.

## Status update (2026-06): selection with replacement — keyed instances

`qti-selection with-replacement` (§5.129.2) now instantiates: "each element
becomes eligible for selection multiple times", and the select count "may
exceed the number of child elements defined only if with-replacement is true"
(§5.129.1). The motivating evidence was a silent under-delivery in the
official corpus: feedbackTest's drill sections (`with-replacement="true"
select="3"` over a single template-randomized ref — the §2.8.3
drill-and-practice pattern) resolved to one plan item instead of three.

Plan keys adopt the spec's own instance addressing (§2.11.1.2): a ref drawn
more than once gets keys `Q01.1`, `Q01.2`, … — "a number that denotes the
instance's place in the sequence of the item's instantiation is inserted
between the item variable identifier and the item variable". QTI identifiers
cannot contain periods, so instance keys never collide with bare ones, and
every session structure already keyed by plan key (attempt counts, outcomes,
timing, template defaults, rejected submissions, the session store's
key-derived clone seeds) works per instance unchanged — distinct clone seeds
per instance are exactly what makes each drill draw roll fresh template
values.

Designed policies where the spec is silent or leaves room:

- Instance numbers follow plan (delivery) order, assigned after selection and
  ordering — instantiation happens in delivery sequence, and plan order is
  the only assignment deterministic across navigation modes. Refs drawn once
  keep their bare identifier, so plans without replacement are byte-identical
  to before.
- A bare ref over multiple instances follows §2.11.1.2 verbatim: "taken from
  the last instance submitted if submission is simultaneous, otherwise it is
  undefined" — implemented as the last instance in plan order holding a
  committed result (simultaneous parts flush in plan order), and NULL under
  individual submission (undefined maps to NULL engine-wide). The same rule
  covers `REF.duration`.
- A branch target naming a multi-instance ref jumps to its next instance
  after the current item — the §2.8.3 repetition idiom; branch paths only
  move forward. No instance after the current item means the rule no-ops,
  like any unknown target.
- A _section_ drawn with replacement repeats its whole subtree ("Sub-sections
  always count as 1", §5.129.1); its items join the global instance
  numbering, but section identity — plan.sections, accrued section seconds,
  `SECTION.duration` — stays shared per identifier, because the spec defines
  no instance addressing for sections.
- Required children appear once each; the remaining draws come uniformly from
  the whole pool (required children stay eligible for further draws, per the
  {A,A,A} example). The selected multiset keeps document order — ordering
  shuffles separately, as without replacement.
- `select` above the pool size _without_ replacement keeps the existing
  silent cap (the spec forbids authoring it; capping is the graceful read).
- `itemOutcomeDeclarations` (the `outcomeMaximum`/`outcomeMinimum` feed)
  stays keyed by ref identifier: declarations are per item document and
  shared by every instance.

One ordering fix rode along: `start()` now positions the session _after_ the
opening outcome-processing run, so start-time preconditions see declared
outcome defaults — the drill pattern gates every instance on a boolean
outcome that starts false, which previously read as NULL at the initial
positioning and skipped the whole section.

## Status update (2026-06): itemSessionControl enforcement and the review/solution states

The remaining five ItemSessionControl constraints are now enforced end to end
(maxAttempts and allowSkipping already were). Spec defaults all verified
against the 3.0.1 characteristic tables: show-feedback false, allow-review
true, show-solution false, allow-comment false, validate-responses false.

**validate-responses** — "An invalid response is defined to be a response
which does not satisfy the constraints imposed by the interaction with which
it is associated. When validate-responses is turned on (true) then the
candidates are not allowed to submit the item until they have provided valid
responses for all interactions." Enforcement is layered: the new
response-validity module collects the constraint attributes the views carry
(min/max-choices, min/max-associations, min-strings, pattern-mask in the XSD
regex dialect, min-plays) and the attempt store refuses submit() while
violations exist — always visible through `AttemptSnapshot.responseViolations`
(ADR-0003, never silent); the controller independently refuses
`TestItemResult.valid === false` for direct consumers. Both are scoped
"only … with individual submission mode" per spec. Designed readings,
documented: only authored attributes are validated (rendering defaults are
interaction behavior, not constraints); an unanswered interaction is governed
by the min constraints, not the pattern; an uncompilable pattern never blocks
the candidate.

**allow-review and the review state** — "applies only after the end of the
last attempt": mid-test, revisiting an item with attempts remaining is
interaction, not review, so nothing changes; once the last attempt ends,
allow-review=false bars canMoveTo/moveTo ("the candidate can not review the
qti-item-body or their responses once they have submitted their last
attempt"). After the test ends, the new canReview/review surface navigates
presented, review-allowed items by moving only the current pointer — the
ended status and the stopped clock stay put, and canSubmitItem stays false
("can review … but cannot update or resubmit"). Designed policies: post-end
review covers presented items only; the end of the last attempt is judged on
the attempt count (adaptive items, which bypass maxAttempts via their
consumer-driven flag, are the consumer's to manage).

**show-feedback** — "affects the visibility of feedback after the end of the
last attempt … This includes both Modal Feedback and Integrated Feedback even
if the candidate has access to the review state." The renderer gained an
`ItemRenderMode` ("interact" | "review" | "solution") plus the effective
show-feedback value: outside interact, false suppresses modal feedback
entirely and re-evaluates integrated feedback against declared outcome
defaults — the spec's resolution of the hide-feedback ambiguity ("the absence
of feedback is defined to be the version of the qti-item-body displayed to
the candidate at the start of each attempt"). For adaptive items the setting
is ignored in review and final outcome values are used, exactly as §
prescribes. Correctness chrome (interaction statuses, option marks) is
treated as feedback and withheld with it — a designed reading: the spec's
feedback notion predates our skin-level score chrome, and showing "incorrect"
marks while hiding feedback would leak what the constraint hides.

**show-solution** — "controls whether or not the system may provide the
candidate with a way of entering the solution state". The mechanism is the
renderer's solution mode: the clone's resolved correct responses
(`AttemptSnapshot.correctResponses`, template setCorrectResponse overrides
applied) display read-only. The gate — whether to offer the entry point — is
the consumer's, read from the plan item's effective session control.

**allow-comment** — "controls whether or not the candidate is allowed to
provide a comment on the item during the session" (default false). New
canComment/setItemComment record per-item-key comments in session state,
session-time only (designed policy: the test session, not the item session —
a comment is metadata, not a response, so it stays open while the test runs
and closes with it).

## Status update (2026-06): suspension and resume

The spec's duration rule is suspension-aware and is now honored verbatim: the
item-session duration "records the accumulated time (in seconds) of all
Candidate Sessions for all Attempts. In other words the time between the
beginning and the end of the item session minus any time the session was in
the suspended state."

Two layers of suspension exist, both clock-only (suspension never alters
responses, outcomes, or attempt counts):

- **Item sessions suspend on navigation** — the spec describes this directly:
  "candidates may change their responses for an item and then leave it in the
  suspended state by navigating to a different item in the same part of the
  test." The attempt store now keeps an active-time clock
  (suspend()/resume(), idempotent), and the test session store drives it:
  navigating away suspends the departed item's clock, returning resumes it,
  and a store created for a not-yet-current item starts suspended. With this,
  the consumer-reported `ITEM.duration` and the controller's enforcement
  clock (time-as-current) converge, as the timing section promised.
- **The whole test session suspends** via the controller's new
  suspend()/resume() and a third session status, "suspended" (a designed
  delivery-engine surface — the spec defines item-session suspension but no
  test-level protocol). suspend() folds the clock first, so an
  already-exceeded time limit still applies — suspension cannot rescue an
  expired session — then stops every scope clock; while suspended, every
  transition is identity (comments included) except end(), which works
  without folding the gap. resume() re-stamps the clock without folding, so
  the gap never accrues to any scope. A suspended state persists as plain
  JSON and resumes under a fresh controller instance — the close-the-laptop,
  resume-tomorrow case this milestone exists for.

Designed policies, flagged: test-level suspension stops all scope clocks
(test, part, section, item) symmetrically; pre-suspension persisted states
are unaffected (they never carry the new status); the simultaneous-mode note
that "each item session passes between the interacting and suspended states
only" is satisfied by the same navigation-driven clock orchestration.
