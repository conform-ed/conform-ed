---
title: "Official-XSD conformance hardening lane"
description: "Architecture decision record ADR-0011."
sidebar:
  order: 11
  badge: { text: "ADR-0011", variant: note }
---

Status: accepted

The per-commit gates validate against the zod contracts and a model round trip
(serialize → parse → normalize → strict schema → deep-equal). That proves our pipeline
is self-consistent, but not that our output conforms to the **official** 1EdTech
schemas — "the XML instance MUST be valid with respect to the official XSD" was asserted
only transitively. This adds the real check.

## Decision

A local/nightly lane (`packages/qti-xml/test/xsd-conformance.local.test.ts`) validates
QTI 3 instances against the official ASI XSD using libxml2 via `xmllint-wasm`. It asserts
two things:

1. The overwhelming majority of corpus ASI documents we call "valid" also pass the
   official XSD (proving the schema setup is sound) — 348/350 today; the two exceptions
   are third-party corpus quirks.
2. **Every instance our serializer emits is XSD-valid**, for inputs that were themselves
   XSD-valid. This is the export-conformance upgrade, and a failure here is a serializer
   bug, not a corpus quirk.

It is a **local lane, not a per-commit gate**, matching the corpus convention: the
schema set is ~60 MB and lives under `tmp/` (gitignored), produced by
`scripts/fetch-qti-schemas.ts` (`bun run qti:schemas:fetch`). The lane skips when the
schemas are absent.

## Two libxml2-forced accommodations

libxml2 cannot compile two of the schemas the ASI XSD imports, so both embedded
annotation namespaces are resolved by **lax `anyType` stubs**. QTI structure is still
validated strictly against the official ASI XSD; only the annotation namespaces are lax:

- **SSML 1.1** declares its elements via `xs:redefine` of a no-namespace schema —
  libxml2 has long-standing incomplete `redefine` support, so the synthesis-namespace
  elements never register. SSML is TTS annotation that renders transparently; the ASI
  XSD references 12 SSML elements, stubbed as `anyType`.
- **MathML 3** uses content models libxml2's compiler rejects ("failed to compile the
  content model"), and the ASI XSD references only the `<math>` root. `<math>` is stubbed
  as `anyType`.

Absolute purl-URL `schemaLocation`s are rewritten to bare basenames so imports resolve
from the preloaded set offline, and the UTF-16 vendored `XInclude.xsd` is re-encoded to
UTF-8 (libxml2 read its BOM as content).

## Serializer bugs this lane caught (and fixed)

Model round trip could not see these because the normalizer is deliberately lossy in the
same direction; the official XSD is stricter:

- **`qti-content-body` is mandatory** in block containers (feedback-block, modal-feedback,
  rubric-block, test-rubric-block, template-block, test-feedback). The normalizer unwraps
  it, so emitting flow directly round-tripped fine but violated the XSD. Now wrapped (the
  inline feedback/template variants stay unwrapped, matching their content models).
- **PCI child order**: the XSD sequence is qti-interaction-modules → qti-interaction-markup
  → … → qti-catalog-info (catalog-info last). The serializer emitted catalog-info first.
- **`qti-position-object-interaction`** must carry its own `object`/`img`/`picture` child
  (the image appears on both the stage and each interaction); the serializer emitted it
  only on the stage.

This drove emitted-instance XSD validity from 257/348 to 348/348.

## Consequences

- Export conformance is now checked against the official schema, not just our own
  pipeline. Emitted-instance XSD validity is a floor the lane holds at 100% (for
  XSD-valid inputs).
- `xmllint-wasm` is a devDependency of `@conform-ed/qti-xml`; the schema set is fetched,
  never committed.
- Deeper validation of embedded MathML/SSML internals is out of reach for libxml2 and is
  not a QTI conformance concern; if it is ever wanted, it needs a different XSD engine.
- Manifest/metadata/result/usage-data have their own (small) schemas; extending the lane
  to them is a natural follow-up but lower-value (those bindings are simple and already
  round-trip-gated).
