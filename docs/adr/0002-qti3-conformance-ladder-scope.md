# QTI 3 scope: the 1EdTech Delivery conformance ladder

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

## Considered and rejected

- **All interactions first, interpreter later** — maximum visible breadth, but
  months of custom-RP items silently mis-scoring and a bigger interpreter
  cutover at the end.
- **"Literally everything" including PCI/APIP in one scope** — honest reading
  of "entire spec", but PCI is a security-sensitive runtime-within-a-runtime
  that would dominate the roadmap's tail before the ladder is climbed.
