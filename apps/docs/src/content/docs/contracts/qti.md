---
title: QTI
description: QTI 2.1, 2.2, and 3.0.1 assessment, results-reporting, and usage-data contracts.
sidebar:
  order: 4
---

Validators for the QTI assessment object family — items, sections, tests, declarations, processing,
results reporting, and usage data — for QTI 2.1, 2.2, and 3.0.1.

:::tip
These are the **data contracts**. To deliver and score QTI in the browser, see the
[QTI delivery runtime](/qti/).
:::

## Specification

- QTI 3.0.1 ASI information model + XSD binding, Results Reporting, and Usage Data
- QTI 2.1 / 2.2 information models, results reporting, usage data, content packaging, and APIP

## Import

```ts
import { Qti301DerivedZodTemplates } from "@conform-ed/contracts/qti/v3_0_1";

const result = Qti301DerivedZodTemplates.qtiAssessmentItemDocument.safeParse(doc);
```

Namespaces: `QtiV3_0_1`, `QtiV2_1`, `QtiV2_2`. Each exposes its published entry points through a
`…DerivedZodTemplates` object (`qtiAssessmentItemDocument`, `qtiTestProfileDocument`,
`qtiAssessmentResultDocument`, `qtiUsageDataDocument`, …).

## What's modelled

- **Assessment family** — `assessmentItem`, `assessmentSection`, `assessmentTest`, declarations,
  response/outcome processing, item body / feedback / interaction nodes; plus `assessmentStimulus`
  (2.2 and 3.0.1).
- **Results reporting** — `assessmentResult` document entry points across all three versions.
- **Usage data** — `usageData` document entry points.
- **Companions** — content-packaging profiles, metadata, APIP accessibility (2.x), and AfA/PNP
  (3.0.1).

## Validation notes

- The port targets a **normalized parsed-XML model**: element text becomes `value`, attributes are
  flattened to JS properties, arrays are pluralized, and embedded XML extension points are
  normalized into explicit `extensions` / `foreignAttributes`.
- HTML/XHTML/MathML body content is modelled as generic recursive content nodes rather than one Zod
  schema per markup tag, keeping the large markup vocabulary tractable while the assessment domain
  objects stay explicit.
- QTI 2.1 and 2.2 share one internal 2.x core; the version directories specialize only where the
  bundles materially differ (stimulus support, scoring-mode and curriculum-standards metadata, APIP,
  packaging resource types).
