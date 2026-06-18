---
title: Standards & contracts
description: Typed Zod validators and inferred types for the common digital-education standards, in @conform-ed/contracts.
sidebar:
  order: 0
---

`@conform-ed/contracts` is a single package of runtime [Zod](https://zod.dev) validators and the
TypeScript types inferred from them. Each standard lives behind its own versioned entry point, so
you import only what you need.

```bash
bun add @conform-ed/contracts zod
```

## Validating a payload

Every standard is re-exported from the package root as a namespace, and is also available from a
versioned subpath:

```ts
import { XapiV1_0_3 } from "@conform-ed/contracts/xapi/v1_0_3";

const result = XapiV1_0_3.Schemas.Statement.safeParse(payload);
if (!result.success) {
  console.error(result.error.issues);
}
```

Standards modelled from XSD/JSON-Schema entry points expose those entry points through a
`…DerivedZodTemplates` object (for example `Qti301DerivedZodTemplates.qtiAssessmentItemDocument`).

:::note
These models are deliberately _normalised_ for ergonomic TypeScript use — they are faithful to the
specification's meaning but are not always a literal 1:1 of the XML/JSON binding. The
[Coverage map](/coverage/) measures and documents exactly where conform-ed's model differs from the
literal published schema.
:::

## By standard

| Standard                   | Page                                             | Entry point                                                 |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| xAPI 1.0.3 / IEEE 2.0      | [xAPI](/contracts/xapi/)                         | `@conform-ed/contracts/xapi/v1_0_3`, `…/xapi/v2_0`          |
| cmi5 (Quartz)              | [cmi5](/contracts/cmi5/)                         | `@conform-ed/contracts/cmi5/v1_0`                           |
| LTI 1.3 (+ companions)     | [LTI 1.3](/contracts/lti/)                       | `@conform-ed/contracts/lti/v1_3`                            |
| QTI 2.1 / 2.2 / 3.0.1      | [QTI](/contracts/qti/)                           | `@conform-ed/contracts/qti/v3_0_1` (and `…/v2_1`, `…/v2_2`) |
| Common Cartridge 1.3 / 1.4 | [Common Cartridge](/contracts/common-cartridge/) | `@conform-ed/contracts/common-cartridge/v1_3`, `…/v1_4`     |
| OneRoster 1.2              | [OneRoster](/contracts/oneroster/)               | `@conform-ed/contracts/oneroster/v1_2`                      |
| CASE 1.1                   | [CASE](/contracts/case/)                         | `@conform-ed/contracts/case/v1_1`                           |
| CLR 2.0                    | [CLR](/contracts/clr/)                           | `@conform-ed/contracts/clr/v2_0`                            |
| Open Badges 3.0            | [Open Badges](/contracts/open-badges/)           | `@conform-ed/contracts/open-badges/v3_0`                    |
| Caliper 1.2                | [Caliper](/contracts/caliper/)                   | `@conform-ed/contracts/caliper/v1_2`                        |
| CAT 1.0                    | [CAT](/contracts/cat/)                           | `@conform-ed/contracts/cat/v1_0`                            |
| VC Data Model 2.0          | [VC Data Model](/contracts/vc-data-model/)       | `@conform-ed/contracts/vc-data-model/v2_0`                  |
| h5p                        | [h5p](/contracts/h5p/)                           | `@conform-ed/contracts/h5p/v1`                              |
