# @conform-ed/coverage

Generates the per-`spec:version` **Coverage Map** defined in
[ADR-0013](../../docs/adr/0013-spec-coverage-map.md): a machine-readable record of
how completely conform-ed models each targeted specification, measured against the
**literal published schema** (the denominator) — not against conform-ed's own Zod.

It is the open, reusable half of the spec-tracking mechanism; the closed product
(emergent) consumes the published maps and overlays its own implementation status
on top (emergent ADR-0028).

## What a Coverage Map contains

For one `spec:version` (`maps/<slug>.json`):

- **L1 — information-model inventory.** Every element/attribute/enum of the literal
  schema, walked from the vendored source under `vendor/`. Each item is keyed by the
  schema's own canonical address — `spec:version:doc:<binding>/<path>` for document
  roots, `spec:version:def:<Name>/<path>` for shared definitions. Definitions are
  keyed once; repeated appearances are `edges`.
- **L2 — `modelled`.** Each item's reconciliation verdict against conform-ed's Zod
  model: `yes` / `partial` / `no`, computed by a lockstep structural alignment of the
  literal and Zod trees (see `src/reconcile.ts`).
- **C — `conformance`.** Hand-curated normative requirement statements, profile-tagged
  and cross-linked to the L1 items they constrain.
- **`residues`.** The three signals that justify the literal denominator:
  - `silentGaps` — in the published spec, never modelled (candidate gaps);
  - `extensions` — modelled but absent from the spec (conform-ed extensions).
- **`rollup`.** Computed counts (never hand-typed) per map.

## Usage

```bash
bun run coverage:generate   # regenerate every committed map under maps/
bun run coverage:check      # CI gate: fail if any committed map is stale
```

Adding a spec: vendor its source schema under `vendor/<spec>/<version>/`, declare a
`SpecSource` under `specs/`, register it in `specs/index.ts`, and regenerate.

## Status

- **Open Badges 3.0** — pilot, complete. 5 bindings, 340 items; conform-ed's
  `validated` port reconciles with **0 silent gaps / 0 extensions** (39 items
  `partial`, all recursive `Profile`/endorsement structures matched at varying
  depths). Conformance catalog is a grounded **seed** (5 issuer-profile MUSTs);
  full extraction from the published 1EdTech conformance guide is the next increment.

### Rollout (emergent ADR-0028)

JSON-Schema family first (OB → CLR / CASE / Caliper / VC), then the XSD family
(QTI 3.0.1 / CC / QTI 2.x) via a **direct XSD walker** built on `fast-xml-parser`
(already a `@conform-ed/qti-xml` dep) — XSD→JSON-Schema converters proved too
unreliable on the 1EdTech bundles, so we walk the XSD itself; it emits the same
`CoverageItem`/`UsageEdge` model, so the reconciler is reused unchanged. Then OpenAPI
(OneRoster). The reconciler's automated structural join is layered with explicit
`specRef` overrides for conform-ed's documented normalisations as those are annotated
upstream in `@conform-ed/contracts`.
