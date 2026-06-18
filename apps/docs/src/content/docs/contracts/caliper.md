---
title: Caliper
description: Caliper Analytics 1.2 envelope, event, and entity contracts.
sidebar:
  order: 10
---

Validators for Caliper Analytics 1.2 — the envelope, the full event and entity vocabularies, and
the supporting metric/action/status vocabularies.

## Specification

- [Caliper v1.2](https://www.imsglobal.org/spec/caliper/v1p2/impl/) — normative text and
  implementation guide, with the [CaliperBootcamp](https://github.com/1EdTech/CaliperBootcamp) v1.2
  schema corpus used as the machine-readable compatibility source

## Import

```ts
import { Caliper12DerivedZodTemplates } from "@conform-ed/contracts/caliper/v1_2";

const result = Caliper12DerivedZodTemplates.envelope.safeParse(payload);
```

Namespace: `CaliperV1_2`. Entry points are exposed via `Caliper12DerivedZodTemplates` (`envelope`,
`event`, `assessmentEvent`, `person`, `softwareApplication`, `session`, …).

## What's modelled

- The Caliper **envelope**, base event/entity contracts, and all Bootcamp v1.2 event and entity
  entry points.
- Full published Action/Profile/Metric/Status vocabularies, plus `SystemIdentifier`,
  `CaliperData`, and Selector helper schemas.
- An explicit source-precedence record (`CALIPER_REQUIREMENT_SOURCE_PRECEDENCE`) and
  `CaliperV1P2ConformanceMetadata` exposing the extracted textual rules.

## Validation notes

- Event ids require URN UUID form (`urn:uuid:…`); datetimes require ISO 8601 UTC with millisecond
  precision; the envelope is strict and requires `sensor`, `sendTime`, `dataVersion`, and non-empty
  `data`.
- Actor/action/object subset constraints are enforced for the textual-spec-covered events
  (Assessment, Grade, Navigation, Session, …). Bootcamp-only events (Feedback, Outcome, Survey, …)
  are structurally validated but without that subset enforcement.
- Both `v1p1` and `v1p2` context URIs are accepted; per-entity property-table enforcement is not yet
  exhaustive (see the [Coverage map](/coverage/)).
