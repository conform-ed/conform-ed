---
title: h5p
description: H5P package-format JSON contracts — manifest, library, semantics, and content params.
sidebar:
  order: 13
---

Validators for the four JSON files that make up the H5P package format.

## Specification

- [H5P developer specification](https://h5p.org/documentation/developers/h5p-specification), JSON
  file descriptions, and semantics reference

## Import

```ts
import { H5pV1 } from "@conform-ed/contracts/h5p/v1";

const result = H5pV1.Schemas.PackageManifest.safeParse(manifest);
```

Namespace: `H5pV1` (schemas under `.Schemas`).

## What's modelled

| File             | Schema            | Description                                           |
| ---------------- | ----------------- | ----------------------------------------------------- |
| `h5p.json`       | `PackageManifest` | Top-level manifest in every `.h5p` archive            |
| `library.json`   | `LibraryManifest` | Library directory manifest                            |
| `semantics.json` | `Semantics`       | Editor form schema — array of typed field descriptors |
| `content.json`   | `ContentParams`   | Permissive base (`z.record`) for per-library content  |

## Validation notes

- Implemented from scratch (no external H5P library — the PHP library is GPL, the Node library is a
  full server), referencing the reference libraries for validation regex.
- `machineName` follows the PHP validator pattern; version references in dependency declarations
  omit the patch version; `runnable`/`fullscreen` are integers (`0`/`1`), not booleans.
- The recursive `semantics.json` schema uses the `z.lazy()` pattern; leaf field schemas are
  non-strict to accommodate third-party widget extension properties.
- Out of scope: ZIP extraction, file-whitelist checking, and deep content validation against
  semantics (a possible future `validateContentAgainstSemantics`).
