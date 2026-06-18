---
title: "ASI export serializers: every readable binding now writes, gated by a corpus round trip"
description: "Architecture decision record ADR-0010."
sidebar:
  order: 10
  badge: { text: "ADR-0010", variant: note }
---

Status: accepted

conform-ed read the entire QTI 3 surface but wrote only the three bindings a delivery
system emits at runtime — Results Reporting, Usage Data, AfA PNP (ADR-0006, ADR-0008,
ADR-0009). Producing items, tests, sections, stimuli, and content packages is the
_authoring-system_ export direction, and nothing could do it: authored content could
flow in from any QTI source but never back out as QTI. This ADR closes that — the last
staging postponement that was not a principled refusal.

## Decision

Add serializers for the full ASI + packaging + metadata surface in `qti-xml`, each the
exact inverse of its normalizer in `normalize.ts`:

- `serialize-asi.ts` — qti-assessment-item, -test, -section, -stimulus; standalone
  qti-response-processing, qti-outcome-declaration, qti-outcome-processing; the entire
  content model (HTML flow, every interaction, catalogs, companion materials, PCI),
  expressions, and response/template/outcome rules.
- `serialize-manifest.ts` — the imscp_v1p1 manifest and the standalone
  imsqti_metadata_v3p0 qtiMetadata binding; IEEE LOM rides through as a structurally
  preserved foreign-XML node.
- `serialize-document.ts` — `serializeQtiDocument(version, key, document)`, the inverse
  dispatch of `normalizeQtiDocument`, delegating to every per-binding writer (the three
  pre-existing ones included).

The serializers consume the normalized model directly — the same plain `kind`-keyed
objects the normalizer produces and the contracts schema validates — so there is one
canonical in-memory shape, never XML-templated strings.

## Why model round trip is the gate

The export-conformance bar ("the XML instance MUST be valid with respect to the
official XSD") is held the way the results serializer already holds it: a **model round
trip**. For every official corpus document that normalizes to `valid`, the serializer's
output must re-ingest through our own parser, normalizer, and strict contracts schema to
the _identical_ normalized document (`serialize-asi-corpus.local.test.ts`, floor 376;
`serialize-asi.test.ts` pins the hard inverse cases for CI without the corpus).

This works because the normalizer is lossy in known, deliberate ways — element `@id`,
XML comments, the optional `<qti-content-body>` wrapper, the bare item-ref/section-ref
distinction — and model idempotence requires exactly _not_ reproducing what the
normalizer discards: re-normalization drops the same nothing. Two consequences worth
recording:

- **Foreign namespaces** (MathML, SSML, SVG, LOM) survive because the normalizer keeps
  only localName + namespaceUri; the writer redeclares the default `xmlns` on any node
  whose namespace differs from the ambient, which the parser resolves back to the same
  URI. 46 corpus files exercise this.
- **Bare item-ref and section-ref coalesce** to `{identifier, href}` in the model — the
  normalizer assigns no discriminator. The writer emits `qti-assessment-item-ref` for
  any childless ref; a section-ref re-normalizes to the identical model, so the gate
  holds. A round trip cannot recover a distinction the model never carried; if
  preserving it ever matters, the model must gain the discriminator first.

XSD validation against the official schemas is a stronger, separate check; it belongs to
the reliability/validation phase, not here. Model round trip across the whole vendored
corpus is the floor this phase commits to.

## Boundary with emergent (the layer this ADR does _not_ cross)

These serializers are the **whole** of what belongs in conform-ed. Packaging _policy_ is
emergent's (its ADR-0010): how item-bank UUIDs + `version_no` map to QTI identifiers,
what populates a manifest's qtiMetadata, how stored media resolve to package-relative
hrefs, and how export interacts with the answer-key-stripping delivery projections
(a full export carries response declarations; some profiles deliberately strip them).
conform-ed owns the XML producers; emergent calls them with packaging decisions.

## Consequences

- Every binding conform-ed reads, it now writes. The export floor rises with the corpus
  and never falls, mirroring the delivery meter.
- Authored content can leave as spec-valid QTI 3, unblocking interoperability export and
  external-item-bank round-tripping once emergent wires the packaging layer.
- A follow-up audit closed two smaller in-scope items: the universal `serializeQtiDocument`
  dispatch was missing AfA PNP (now exhaustive — a future binding is a compile error in
  its default), and PIF (Package Interchange Format) ingestion landed. `validateQtiPackagePath`
  streams a ZIP file from disk, materializing only its XML entries into a temporary
  directory (media is never inflated, so memory stays bounded for hundred-MB packages),
  then validates the exploded tree — which also resolves xi:include across entries — and
  cleans up. `validateQtiPackageArchive(bytes)` remains as an in-memory (XML-only) path
  for modest packages and callers that already hold the bytes. Both share one
  `PackageSource`-driven validation core.
- Reliability/validation hardening (chiefly XSD validation of emitted instances against
  the official schemas) is the next phase and is now the only conform-ed work outstanding.
