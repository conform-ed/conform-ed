---
title: Common Cartridge
description: IMS Common Cartridge 1.3 and 1.4 manifest, resource, and packaging contracts.
sidebar:
  order: 5
---

Validators for the IMS Common Cartridge schema bundle — manifest, resources, web links, discussion
topics, LOM metadata, authorization, and the embedded QTI profile — for v1.3 and v1.4.

:::tip
To read and write cartridge **packages** (not just validate the schemas), see the
[Common Cartridge](/common-cartridge/) package.
:::

## Specification

- Common Cartridge v1.3 overview, and the v1.4 candidate-final implementation guide (core, Thin CC,
  and K-12 profiles)

## Import

```ts
import { CommonCartridgeDerivedZodTemplates } from "@conform-ed/contracts/common-cartridge/v1_3";

const result = CommonCartridgeDerivedZodTemplates.lomManifestDocument.safeParse(doc);
```

Namespaces: `CommonCartridgeV1_3`, `CommonCartridgeV1_4`. Published entry points are exposed through
the `…DerivedZodTemplates` object (`lomManifestDocument`, `lomResourceDocument`, `webLinkDocument`,
`discussionTopicDocument`, `lomCcLtiLinkDocument`, `curriculumStandardsMetadataSetDocument`, …).

## What's modelled

- **Manifest & resources** — the CP manifest, LOM manifest/resource metadata, and resource types.
- **Cartridge surfaces** — web links, discussion topics, curriculum-standards metadata,
  authorization (manifest-level `authorizations` and resource-level `protected`), and the embedded
  Common Cartridge profile of QTI 1.2.1.
- **v1.4 additions** — the multiple manifest profiles (core / Thin / K-12), imported LTI support,
  extension schemas (e.g. assignment, open video), and VDEX support — mirrored as `core/`, `thin/`,
  `k12/`, `shared/`, `extension/`, and `vdex/` modules.

## Validation notes

- Like QTI, the port targets a **normalized parsed-XML model** (element text as `value`, attributes
  flattened, ordered heterogeneous children preserved where meaning depends on order) rather than a
  literal XML tree.
- Some real constraints live in embedded Schematron or profile prose rather than the XSD; those are
  applied on top of the structural schema where modelled.
