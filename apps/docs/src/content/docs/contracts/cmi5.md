---
title: cmi5
description: cmi5 Quartz course-structure XML and the keyword extension.
sidebar:
  order: 2
---

Validators for the cmi5 **Quartz** course-structure XML surface and its keyword extension.

## Specification

- cmi5 (Quartz) course structure and keyword extension

## Import

```ts
import { Cmi5V1_0 } from "@conform-ed/contracts/cmi5/v1_0";

const result = Cmi5V1_0.Schemas.Course.safeParse(payload);
```

Namespace: `Cmi5V1_0` (schemas under `.Schemas`).

## What's modelled

- `CourseStructureDocument` — the combined course-structure document plus keyword extension.
- `CourseStructure` — course, objectives, and the recursive AU/block tree (`Course`, `Au`,
  `Block`, `Objective`, …).
- `KeywordExtension` — the keyword dictionary used by the extension examples.

## Validation notes

- This bundle covers the **XML data model** from the spec artifacts. Runtime xAPI launch/state/
  statement behaviour lives in the cmi5 [conformance runner](/runners/), not in the contracts.
- The recursive AU/block tree is modelled with the `z.lazy()` pattern.
