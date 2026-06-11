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
