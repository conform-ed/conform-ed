---
title: QTI delivery runtime
description: A headless, accessible engine for delivering and scoring QTI 3 assessments, plus QTI XML tooling.
---

The QTI delivery runtime is a framework-light, accessible engine for delivering and scoring
[QTI 3](https://www.imsglobal.org/spec/qti/) items and tests in the browser. It ships no product UI
and carries no styling of its own — you bring the presentation.

```bash
bun add @conform-ed/qti-react @conform-ed/qti-xml react zod
```

## Core concepts

- **Headless Core** — response state, response processing, the content-tree allowlist walk, and
  accessibility wiring, with no styling and no product dependencies (`@conform-ed/qti-react`).
- **Skins** — controlled presentational components for each interaction kind, driven by state and
  prop-getters from the Headless Core. conform-ed ships an unstyled, semantic-HTML **Reference Skin**
  set so every interaction can be exercised without a downstream product.
- **Capability Report** — the runtime's answer to "can this content be delivered, and if not, why".
  Consumers gate delivery on it; unsupported content is never silently dropped.
- **Response Processing Interpreter** — a deterministic evaluator of an item's `responseProcessing`
  tree; the QTI standard templates are built-in canonical trees.
- **Test Controller** — a deterministic engine for `assessmentTest` semantics (navigation,
  selection/ordering under a seed, preconditions, branch rules, outcome processing). It owns the
  rules; you own persistence.

## QTI XML tooling

`@conform-ed/qti-xml` parses, validates, and inventories QTI XML, and powers the official
`qtiv3-examples` **Corpus** coverage that conform-ed tracks as its public progress meter. See the
[CLI](/cli/) for command-line validation.

Detailed API guides and live interaction demos are being expanded in this section.
