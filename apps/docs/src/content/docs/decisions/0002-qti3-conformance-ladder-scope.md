---
title: "QTI 3 scope: the 1EdTech Delivery conformance ladder"
description: "Architecture decision record ADR-0002."
sidebar:
  order: 2
  badge: { text: "ADR-0002", variant: note }
---

Status: accepted

"Implement QTI 3" is scoped externally, not self-defined: the target is the
1EdTech QTI 3 **Delivery** conformance certification ladder — all standard
interactions, the full response-processing language, feedback, template
processing, adaptive items, and `assessmentTest` delivery. **PCI** (portable
custom interactions) and **APIP/catalog** accessibility content are explicitly
deferred to their own future decisions: each is a separate subsystem (a JS
sandbox runtime; a parallel content channel), not "more of the same", and
neither blocks the ladder's lower rungs.

Ordering follows "interpreter early": one breadth milestone of DOM-only
interactions that fit the current scoring (extendedText, order, match,
associate, gapMatch, hottext), then the Response Processing Interpreter core
plus feedback **before** any further interactions, so everything afterwards
lands on the real scoring engine — then media/upload/slider, the graphic
interaction family, template processing/adaptive, and finally the Test
Controller. Progress is measured as **Corpus coverage**: the share of the
official `qtiv3-examples` Corpus that is deliverable per the Capability
Report and correctly scored.

## Corpus acquisition and the terminal state

The Corpus is never committed: `bun run qti:corpus:fetch` materializes
`tmp/qti-examples` at a pinned upstream commit (the floors assert exact counts,
so the pin is load-bearing). Day-to-day validation skips the corpus lanes when
the checkout is absent; the scheduled/manual `qti-corpus.yml` workflow runs the
standard validation plus `test:qti-corpus` against the pin. Nothing committed
may depend on pre-existing `tmp/` content — committed code either skips or
fetches.

The meter's terminal state is **311/312 items delivered plus 1 asserted
refusal — 312/312 handled correctly**. SineRule-001 binds its template maths to
the GPL Maxima _product_ through the third-party MathAssess profile
(`customOperator` class `org.qtitools.mathassess.CasProcess`,
`ma:syntax="text/x-maxima"`). QTI 3 leaves `customOperator`
implementation-defined and no conformance target requires any particular
class, so the loud refusal of an unregistered class **is** the conformant
behavior; the floor test asserts that exact refusal as a positive outcome.
Real implementations register through `QtiRuntimeConfig.customOperators`.

## Considered and rejected

- **All interactions first, interpreter later** — maximum visible breadth, but
  months of custom-RP items silently mis-scoring and a bigger interpreter
  cutover at the end.
- **"Literally everything" including PCI/APIP in one scope** — honest reading
  of "entire spec", but PCI is a security-sensitive runtime-within-a-runtime
  that would dominate the roadmap's tail before the ladder is climbed.
