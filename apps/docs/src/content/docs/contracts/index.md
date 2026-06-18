---
title: Standards & contracts
description: Typed Zod validators and inferred types for the common digital-education standards, in @conform-ed/contracts.
---

`@conform-ed/contracts` is a single package of runtime [Zod](https://zod.dev) validators and the
TypeScript types inferred from them. Each standard lives behind its own versioned entry point, so
you import only what you need.

```bash
bun add @conform-ed/contracts zod
```

```ts
import { StatementSchema } from "@conform-ed/contracts/xapi/v1_0_3";
```

:::note
These models are deliberately _normalised_ for ergonomic TypeScript use — they are faithful to the
specification's meaning but are not always a literal 1:1 of the XML/JSON binding. The
[Coverage map](/coverage/) measures and documents exactly where conform-ed's model differs from the
literal published schema.
:::

## By standard

| Standard                                         | Entry point                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| xAPI 1.0.3 / IEEE 2.0                            | `@conform-ed/contracts/xapi/v1_0_3`, `…/xapi/v2_0`                                                                           |
| cmi5 (Quartz)                                    | `@conform-ed/contracts/cmi5/v1_0`                                                                                            |
| LTI 1.3 + AGS / Deep Linking / NRPS / Proctoring | `@conform-ed/contracts/lti/v1_3` (+ `…/lti/ags/v2_0`, `…/lti/deep-linking/v2_0`, `…/lti/nrps/v2_0`, `…/lti/proctoring/v1_0`) |
| QTI 2.1 / 2.2 / 3.0.1                            | `@conform-ed/contracts/qti/v2_1`, `…/qti/v2_2`, `…/qti/v3_0_1`                                                               |
| Common Cartridge 1.3 / 1.4                       | `@conform-ed/contracts/common-cartridge/v1_3`, `…/v1_4`                                                                      |
| OneRoster 1.2                                    | `@conform-ed/contracts/oneroster/v1_2`                                                                                       |
| CASE 1.1                                         | `@conform-ed/contracts/case/v1_1`                                                                                            |
| CLR 2.0                                          | `@conform-ed/contracts/clr/v2_0`                                                                                             |
| Open Badges 3.0                                  | `@conform-ed/contracts/open-badges/v3_0`                                                                                     |
| Caliper 1.2                                      | `@conform-ed/contracts/caliper/v1_2`                                                                                         |
| CAT 1.0                                          | `@conform-ed/contracts/cat/v1_0`                                                                                             |
| VC Data Model 2.0                                | `@conform-ed/contracts/vc-data-model/v2_0`                                                                                   |
| h5p                                              | `@conform-ed/contracts/h5p/v1`                                                                                               |

Per-standard usage guides are being expanded; the `packages/contracts/*-zod-templates.md` files in
the repository carry import patterns and worked examples in the meantime.
