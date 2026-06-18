---
title: xAPI
description: xAPI 1.0.3 and IEEE xAPI 2.0 statement, data, and LRS transport contracts.
sidebar:
  order: 1
---

Validators for the xAPI statement and data models, the LRS document resources, and the HTTP
transport surface — for both ADL xAPI 1.0.3 and IEEE xAPI 2.0.

## Specification

- ADL xAPI 1.0.3 (Data / Communication / About)
- IEEE 9274.1.1 xAPI 2.0 Base Standard

## Import

```ts
import { XapiV1_0_3 } from "@conform-ed/contracts/xapi/v1_0_3";
// or: import { XapiV2_0 } from "@conform-ed/contracts/xapi/v2_0";

const result = XapiV1_0_3.Schemas.Statement.safeParse(payload);
```

Namespaces: `XapiV1_0_3`, `XapiV2_0` (and `Xapi` for the combined bundle). Schemas are grouped under
`.Schemas`.

## What's modelled

- **Core data** — `Agent`/`Group` (with inverse-functional-identifier validation), `Verb`,
  `Activity`, `Result`, `Context`, `Attachment`, `Statement`, `StatementResult`, `Person`.
- **LRS document resources** — State, Agent Profile, and Activity Profile document and listing
  queries; the document response envelope and id-list responses.
- **Resource queries** — `/statements`, `/agents`, `/activities` request/query shapes.
- **Transport & concurrency** — HTTP methods, request/response headers, ETag conditional requests,
  multipart attachment transmission with binary hashing, and the standard LRS error codes.
- **Service metadata** — the About/version resource.

## Validation notes

- Structured domain objects are strict (`strictObject`) — misspelled or extra properties are caught.
- Document bodies are intentionally permissive (`z.unknown()`) since xAPI allows arbitrary content
  types.
- Agent/Group enforce at-least-one-identifier via `.refine()`; `Person` is modelled separately
  because `/agents` returns array-valued identifiers.
- xAPI 2.0 reuses the 1.0.3 model where structurally equivalent, overriding the Context/Statement
  family to add IEEE `contextAgent`, `contextGroup`, and `relevantTypes`.
