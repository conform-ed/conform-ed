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

Five `spec:version` maps, both schema-language families:

| Map                     | Family      | Items | Silent gaps | Extensions | Conf. reqs |
| ----------------------- | ----------- | ----- | ----------- | ---------- | ---------- |
| `open-badges-v3.0`      | JSON Schema | 340   | 0           | 0          | 5          |
| `clr-v2.0`              | JSON Schema | 409   | 0           | 0          | 4          |
| `case-v1.1`             | JSON Schema | 344   | 0           | 0          | 3          |
| `common-cartridge-v1.3` | XSD         | 42    | 0           | 3          | 4          |

- **Open Badges 3.0 / CLR 2.0** share the OB/VC credential machinery — both reconcile
  `0/0` (recursive `Profile`/endorsement structures matched at depth).
- **CASE 1.1** — all 13 published entity schemas (CFPackage / CFItem / CFAssociation /
  …) reconcile `0/0`.
- **Common Cartridge 1.3** — three resource-type bindings (Web Link / Discussion Topic
  / Curriculum Standards Metadata) via the **direct XSD walker** (`src/walkers/xsd.ts`).
  `0` silent gaps; the three `extension` residues are all documented normalisations
  (XSD `xs:any` → conform-ed's `extensions`; simpleContent text → `value`).

Conformance catalogs are grounded **seeds**; full extraction from the published 1EdTech
guides is the next hand-curation increment.

### Rollout (emergent ADR-0028)

- **JSON-Schema family** — OB ✓, CLR ✓, CASE ✓. **VC 2.0** has no standalone published
  per-binding JSON Schema (it is the W3C substrate already exercised through OB/CLR), so
  it is not a separate map. **Caliper 1.2** ships its schemas in the GitHub
  CaliperBootcamp repo (JSON-LD) — pending a literal-denominator provenance decision.
- **XSD family** — CC 1.3 (3 bindings) ✓ via the direct XSD walker (chosen over
  XSD→JSON-Schema converters, which proved dead, lossy — they drop `xs:documentation` —
  or non-reproducible in CI). **QTI 3.0.1 / 2.x** are _walker-ready_ (QTI's ASI XSD is
  self-contained; its 4 `xs:import`s are foreign vocabularies — MathML/SSML/XML/XInclude
  — which the walker already treats as opaque). The open item is reconciliation: the QTI
  _XML_ binding uses kebab element names (`qti-response-declaration`) while conform-ed's
  Zod models the QTI **JSON** binding (camelCase `responseDeclaration`), so a meaningful
  L2 join needs a **name-normalisation layer** (kebab-`qti-` ↔ camelCase) on the
  reconciler before a QTI map is produced — without it every name would mismatch.
- **OpenAPI family** — OneRoster 1.2 needs a third walker (`walkers/openapi.ts`).

The reconciler's automated structural join is layered with explicit `specRef` overrides
for conform-ed's documented normalisations (e.g. the CC `xs:any` → `extensions` rename)
as those are annotated upstream in `@conform-ed/contracts`.
