---
title: "Full-spec completion: every binding reads, every registered root normalizes"
description: "Architecture decision record ADR-0009."
sidebar:
  order: 9
  badge: { text: "ADR-0009", variant: note }
---

Status: accepted

The remaining QTI 3 surface landed as one breadth push (reliability and
validation hardening follow as their own phase). The inventory came from the
ground truth, not memory: a corpus root census, the registry-vs-normalizer
diff, and contracts schemas nothing produced.

## What landed

- **Every registered root normalizes.** Standalone qti-response-processing
  ("enables the exchange of best-practice response processing templates" —
  all five corpus rptemplates), qti-outcome-declaration, qti-outcome-processing,
  standalone qti-assessment-section ("The exchange of a single root
  qti-assessment-section instance is permitted"), the qtiMetadata camelCase
  binding, and Usage Data & Item Statistics — the v3 namespace plus the
  structurally identical v2.2 binding the official v3 packages carry. The
  "ASI profile" documents are unions of the per-root documents, so root
  coverage covers them.
- **Packaging.** The QTI 3 imscp manifest binding has a contracts schema and
  normalizer; all 24 corpus imsmanifest.xml files validate. Resource types
  are an open vocabulary by design — the official corpus itself mixes the
  imsqti\_\*\_xmlv3p0 tokens with mime-style values and LTI link types. Inline
  qtiMetadata maps; IEEE LOM is preserved structurally (its own
  specification, not remodelled here).
- **ASI in-document completeness.** Companion materials (§2.13.1) got an
  XSD-faithful model (calculators, SI/US rule systems, protractor increments
  with unit-typed values, digital/physical materials) and the item view
  exposes them — the platform owns the tools, the runtime owns the data.
  CAT adaptive selection (§2.8.4) normalizes engine/settings/usagedata/
  metadata refs; the adaptive engine protocol itself is an external
  specification (an adapter integration point, not a refusal). Test-level
  rubric blocks no longer drop.
- **The complete content vocabulary.** The flow allowlist is now exactly the
  ASI XSD's HTMLContentDType enumeration (anchors through bdo/bdi); the
  sanitizer passes role/aria-_/data-_ per the XSD's own attribute schematron
  (§2.13.3) while handlers, style, and javascript: URLs stay stripped. SSML
  (§2.13.2) renders transparently — annotated text passes through, ssml:sub
  is never misread as a subscript; aural semantics belong to TTS hosts.
- **Writers.** Usage data and AfA PNP serializers (sharing the XmlWriter with
  the results serializer) are exact inverses of their import normalizers,
  gated by round trips through our own parser, normalizer, and strict
  contracts schemas; the official usage-data corpus instance survives
  import → export → import unchanged.
- **Skins.** renderCatalogSupports gives skins the catalog resolution for
  nodes they own; the reference choice skin renders a choice's active
  supports beside its label (closing ADR-0008's staging postponement).

## Permanent refusals and external boundaries (the complete list)

- **Unregistered customOperator** — the one corpus delivery blocker
  (311/312); executing unknown vendor code would be a lie, not a feature.
- **CAT/test.xml and results/full-example.xml** — corrupt at the source (a
  saved GitHub HTML page; a self-closing root element). Rejection is the
  conformant read, asserted in the corpus lane.
- **The CAT engine protocol** — qti-adaptive-selection is fully normalized;
  driving an adaptive engine is the 1EdTech CAT specification's contract,
  integrated at the adapter layer when needed.
- **IEEE LOM's deep model** — preserved structurally in manifests; modelling
  LOM is its own specification family.
- **Extension containers** — RR outcomeInformation, the PNP binding's
  grpStrict.any elements: extension points, unmapped until something real
  uses them.
- **Authoring/export home for ASI documents** — the parked product decision
  (emergent ADR-0010); the engine's writers cover the bindings whose export
  direction is certified (results, usage data) plus PNP.
