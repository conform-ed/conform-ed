---
title: CASE
description: CASE 1.1 competency and academic-standards framework contracts.
sidebar:
  order: 7
---

Validators for CASE 1.1 (Competency and Academic Standards Exchange) — frameworks, items,
associations, and the supporting collection and status models.

## Specification

- [CASE v1.1](https://www.imsglobal.org/spec/case/v1p1) — base spec, JSON Schema, and OpenAPI 3
  definitions

## Import

```ts
import { CaseV1_1 } from "@conform-ed/contracts/case/v1_1";

const result = CaseV1_1.Schemas.CFPackage.safeParse(pkg);
```

Namespace: `CaseV1_1` (schemas under `.Schemas`).

## What's modelled

- **Core entities** — `CFPackage` (framework container), `CFItem` (competency/standard),
  `CFAssociation` (relationships), `CFRubric`, `CFDocument`, `CFLicense`.
- **Collections** — `CFAssociationSet`, `CFConceptSet`, `CFItemTypeSet`, `CFSubjectSet`,
  `CFDocumentSet`.
- **Integration** — IMSX status models and the OpenAPI 3 REST operation bindings (CRUD + retrieval).

## Validation notes

- Source modules mirror the published JSON-schema artifact names, with shared validators in
  `shared.ts`.
- CASE is consumed and produced for real by conform-ed's CASE provider/consumer; see the
  [Coverage map](/coverage/) for its conformance status.
