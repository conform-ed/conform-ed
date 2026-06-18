---
title: OneRoster
description: OneRoster 1.2 rostering, gradebook, and resource services, plus REST and CSV bindings.
sidebar:
  order: 6
---

Validators for OneRoster 1.2 across the rostering, gradebook, and resource services, including the
REST binding operation payloads and the CSV binding.

## Specification

- OneRoster 1.2 — rostering, gradebook, and resource information models and REST/CSV bindings
- Modelled directly from the published OpenAPI 3 sources for each service

## Import

```ts
import { OneRoster12DerivedZodTemplates } from "@conform-ed/contracts/oneroster/v1_2";

const result = OneRoster12DerivedZodTemplates.course.safeParse(payload);
```

Namespace: `OneRosterV1_2`. Entry points are exposed flat and via `OneRoster12DerivedZodTemplates`
(`academicSession`, `class`, `course`, `user`, …).

## What's modelled

- **Rostering, gradebook, and resource** service schemas (split per service, mirroring the OneRoster
  service split, with shared primitives in `shared`).
- **REST binding** — endpoint-specific operation payload contracts for all published operations.
- **CSV binding** — raw row/document schemas (string cells) keyed by the published column headers,
  plus a package-level aggregate.

## Validation notes

- Objects marked `additionalProperties: false` in the published OpenAPI become strict Zod objects;
  open models (`MetadataDType`, `CredentialDType`) stay open.
- Extensible vocabularies accept the defined enum values plus `ext:*` custom tokens where the spec
  allows extension.
- Date/date-time and URI fields use explicit ISO/URL validators.
- CSV manifest keys with trailing `*` markers accept both starred and unstarred variants and require
  at least one to be present.
