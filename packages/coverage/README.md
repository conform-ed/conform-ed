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

Nine `spec:version` maps across all three schema-language families:

| Map                     | Family      | Items | Modelled | Silent gaps | Extensions | Conf. reqs |
| ----------------------- | ----------- | ----- | -------- | ----------- | ---------- | ---------- |
| `open-badges-v3.0`      | JSON Schema | 340   | 241      | 0           | 0          | 5          |
| `clr-v2.0`              | JSON Schema | 409   | 299      | 0           | 0          | 4          |
| `case-v1.1`             | JSON Schema | 344   | 264      | 0           | 0          | 3          |
| `common-cartridge-v1.3` | XSD         | 110   | 65       | 3           | 27         | 6          |
| `common-cartridge-v1.4` | XSD         | 112   | 66       | 3           | 33         | 4          |
| `qti-v2.1`              | XSD         | 4629  | 116      | 347         | 35         | 2          |
| `qti-v2.2`              | XSD         | 4991  | 125      | 501         | 44         | 2          |
| `qti-v3.0.1`            | XSD         | 5344  | 223      | 359         | 89         | 2          |
| `oneroster-v1.2`        | OpenAPI     | 410   | 248      | 0           | 0          | 5          |

- **Open Badges 3.0 / CLR 2.0** share the OB/VC credential machinery; **CASE 1.1** (all
  13 entity schemas) reconciles `0/0`.
- **OneRoster 1.2** spans all three services in one map — Rostering (7 entities),
  Gradebook (LineItem / Result / Category / ScoreScale / AssessmentLineItem /
  AssessmentResult / LearningObjectiveSet) and Resources (Resource) — and reconciles `0/0`.
- **Common Cartridge 1.3 / 1.4** — five resource-type bindings each (content-packaging
  Manifest / Web Link / Discussion Topic / Authorization / Curriculum Standards Metadata)
  via the **direct XSD walker**. The `extension` residues are documented normalisations
  (XSD `xs:any` → `extensions`; simpleContent text → `value`; the foreign `xml:base`
  attribute → `xmlBase`, which pairs with the three `/base` silent gaps), plus the
  manifest's `metadata` LOM tree, which is opaque at the `xs:import` boundary so
  conform-ed's richer LOM model surfaces as extensions until the LOM bindings land.
- **QTI 2.1 / 2.2 / 3.0.1** — the full literal ASI information model (3–4 bindings each,
  one self-contained XSD per version; their `xs:import`s are foreign vocab —
  MathML/SSML/XML/XInclude/HTML5/APIP — left opaque, hence `0` dangling edges). QTI 2.x
  declares every child as `<xs:element ref="…">` (modular style), which the walker
  resolves to the referenced global element's named type to continue the descent; 3.0.1
  uses it for a handful (resolving them deepened 3.0.1 from 205 → 223 modelled). The L2
  join uses a singular(XML)↔plural(Zod) **name normaliser** (the XSD is the XML binding,
  conform-ed models the JSON binding; for 3.0.1 it also bridges the `qti-`/kebab prefix).
  The silent gaps are honest signal: ARIA attributes + content-model expression operators
  that conform-ed models as Zod unions rather than named elements.

Conformance catalogs are grounded **seeds**; full extraction from the published 1EdTech
guides is the next hand-curation increment.

### Rollout (emergent ADR-0028)

All three schema-language walkers are built and proven:

- **JSON Schema** (`walkers/json-schema.ts`) — OB ✓, CLR ✓, CASE ✓. **VC 2.0** has no
  standalone published per-binding JSON Schema (it is the W3C substrate already exercised
  through OB/CLR), so it is not a separate map. **Caliper 1.2** ships its schemas in the
  GitHub CaliperBootcamp repo (JSON-LD) — pending a literal-denominator provenance call.
- **XSD** (`walkers/xsd.ts`) — CC 1.3 ✓, CC 1.4 ✓, QTI 2.1 ✓, QTI 2.2 ✓, QTI 3.0.1 ✓
  (chosen over XSD→JSON-Schema converters, which proved dead, lossy — they drop
  `xs:documentation` — or non-reproducible in CI). The walker resolves
  `<xs:element ref="…">` to the referenced global element's type, so modular schemas
  (QTI 2.x) descend as fully as flattened ones.
  **Deferred — per-source def-namespacing**: the walker keys `def:`s by global type name,
  which conflates structurally-distinct same-named types defined in different files
  (CC `LOM.Type` across the three LOM profiles; `Text.Type` / `Attachment.Type` in the
  CC 1.4 `assignment` extension vs Discussion Topic). The CC LOM bindings + the
  `assignment` extension wait on namespacing literal defs per source (mirroring the Zod
  side's per-binding scoping). QTI 2.x results-reporting / metadata / content-package
  bindings are also still to come.
- **OpenAPI** (`walkers/openapi.ts`) — OneRoster 1.2 ✓ across all three services —
  Rostering, Gradebook and Resources (walks `components.schemas`, reusing the
  JSON-Schema walker via `#/components/schemas/` refs).

Where the literal and Zod bindings differ by a systematic naming convention (QTI's
XML↔JSON kebab/camel/singular-plural), a per-spec `nameNormalizer` on the `SpecSource`
canonicalises both sides for the L2 join (item keys stay literal). The structural join is
otherwise layered with explicit `specRef` overrides for documented normalisations (e.g.
the CC `xs:any` → `extensions` rename) as those are annotated upstream in
`@conform-ed/contracts`.
