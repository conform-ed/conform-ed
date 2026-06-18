---
title: Coverage map
description: A machine-readable map of how much of each published spec conform-ed models, measured against the literal schema.
---

The **Coverage map** answers a question a normalised contract cannot: _what does the published
specification contain that conform-ed never modelled?_ It is built against the **literal published
schema** (XSD / JSON Schema / OpenAPI) as the denominator — never against conform-ed's own Zod
surface — so silent omissions show up.

For each `spec:version` it produces:

- an **information-model inventory** walked from the vendored upstream schema,
- a **"modelled in conform-ed?"** reconciliation against the Zod contracts, with explicit provenance
  where a model was normalised (renamed or merged), and
- a **conformance catalog** of the normative MUSTs, tagged by certification profile, level, and role.

The residues are the point: items in the spec but not modelled (candidate gaps), items modelled but
not in the spec (extensions), and modelled-but-normalised items (documented deviations).

This section will expand with how to read a Coverage map and how it feeds certification dossiers.
See `ADR-0013` in the repository for the full design.
