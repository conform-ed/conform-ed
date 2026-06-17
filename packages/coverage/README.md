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
  and cross-linked to the L1 items they constrain. Sourced from the published
  certification **guides** (no machine source) — the certification catalog certifiers read.
- **`normativeStatements`.** The machine-extracted other half of the conformance surface:
  the RFC-2119 prose the schema embeds in its own documentation (`xs:documentation` /
  JSON-Schema `description`), lifted verbatim and keyed to the L1 item it annotates.
  Regenerated from the denominator on every build (never curated, so always exact), with
  `cited` flagging whether a curated `conformance` requirement already references it —
  surfacing where curation lags the schema's own declared norms. The JSON-family schemas
  embed a great deal of this; the XSD-family schemas embed almost none (their norms live
  in prose guides, so those maps are curated-only).
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

Ten `spec:version` maps across all three schema-language families:

| Map                     | Family      | Items | Modelled | Silent gaps | Extensions | Conf. reqs |
| ----------------------- | ----------- | ----- | -------- | ----------- | ---------- | ---------- |
| `open-badges-v3.0`      | JSON Schema | 340   | 241      | 0           | 0          | 5          |
| `clr-v2.0`              | JSON Schema | 409   | 299      | 0           | 0          | 4          |
| `case-v1.1`             | JSON Schema | 344   | 264      | 0           | 0          | 3          |
| `caliper-v1.2`          | JSON Schema | 1957  | 78       | 136         | 26         | 2          |
| `common-cartridge-v1.3` | XSD         | 676   | 410      | 3           | 190        | 7          |
| `common-cartridge-v1.4` | XSD         | 143   | 81       | 3           | 35         | 5          |
| `qti-v2.1`              | XSD         | 4971  | 186      | 385         | 76         | 3          |
| `qti-v2.2`              | XSD         | 5378  | 208      | 541         | 92         | 3          |
| `qti-v3.0.1`            | XSD         | 5344  | 223      | 359         | 89         | 2          |
| `oneroster-v1.2`        | OpenAPI     | 410   | 248      | 0           | 0          | 5          |

- **Open Badges 3.0 / CLR 2.0** share the OB/VC credential machinery; **CASE 1.1** (all
  13 entity schemas) reconciles `0/0`.
- **Caliper 1.2** ⚠️ — the one map whose denominator is **not** a canonical 1EdTech
  release: 1EdTech ships no per-binding Caliper schema at a spec URL, so the literal
  denominator is the **CaliperBootcamp** GitHub repo (`schemas/v1_2`, pinned commit), a
  developer-education distribution accepted as the denominator deliberately (see
  `vendor/caliper/v1_2/PROVENANCE.md`; the weaker provenance is recorded in
  `meta.sources`). `walkers/caliper.ts` bundles its 110 cross-referencing draft-04 files
  into one `$defs` map so the JSON-Schema walker applies unchanged. The Envelope transport
  and the full Event property set reconcile; the silent gaps are conform-ed's deliberately
  focused entity surface (it models the entry points, not every property of all 110 types).
- **OneRoster 1.2** spans all three services in one map — Rostering (7 entities),
  Gradebook (LineItem / Result / Category / ScoreScale / AssessmentLineItem /
  AssessmentResult / LearningObjectiveSet) and Resources (Resource) — and reconciles `0/0`.
- **Common Cartridge 1.3 / 1.4** — via the **direct XSD walker**, with `def:`s scoped by
  source schema (`scopeXsdDefsBySource`) so same-named complexTypes from different files
  stay distinct. CC 1.3 carries eight bindings: content-packaging Manifest, Web Link,
  Discussion Topic, Authorization, Curriculum Standards Metadata, and the three IEEE-LOM
  profiles (Basic LTI Link, Resource metadata, Manifest metadata — all rooted at
  `<xs:element name="lom" type="LOM.Type">`, kept apart by source-scoping). CC 1.4 carries
  six (the same core five plus the `assignment` extension, whose `Text.Type` /
  `Attachment.Type` would otherwise collide with Discussion Topic's). The `extension`
  residues are documented normalisations (XSD `xs:any` → `extensions`; simpleContent text
  → `value`; the foreign `xml:base` attribute → `xmlBase`, which pairs with the three
  `/base` silent gaps), plus the rich IEEE-LOM optional sub-trees conform-ed models that
  the literal LOM profiles leave to imported boundaries.
- **QTI 2.1 / 2.2 / 3.0.1** — the literal ASI information model plus, for 2.1 / 2.2, the
  rest of the document family (Results Reporting, Usage Data, item Metadata, the
  content-package manifest, the APIP accessibility extension, and — 2.2 only — Curriculum
  Standards Metadata), each from its own vendored schema. The 2.x maps therefore set
  `scopeXsdDefsBySource` (the ASI and aux schemas reuse type names like `Value.Type` /
  `Mapping.Type` for distinct types); 3.0.1 stays a single self-contained ASI file and
  keeps bare keys. All `xs:import`s are foreign vocab (MathML/SSML/XML/XInclude/HTML5/APIP)
  left opaque, hence `0` dangling edges. QTI 2.x declares every child as
  `<xs:element ref="…">` (modular style), which the walker resolves to the referenced
  global element's named type to continue the descent; 3.0.1 uses it for a handful
  (resolving them deepened 3.0.1 from 205 → 223 modelled). The L2 join uses a
  singular(XML)↔plural(Zod) **name normaliser** (the XSD is the XML binding, conform-ed
  models the JSON binding; for 3.0.1 it also bridges the `qti-`/kebab prefix). The silent
  gaps are honest signal: ARIA attributes + content-model expression operators that
  conform-ed models as Zod unions rather than named elements.

The conformance surface has two halves. The **machine-extractable** half —
`normativeStatements`, the RFC-2119 prose the schemas embed in their own documentation —
is fully extracted and regenerated on every build: 228 MUST-level statements across the
JSON-family maps (Caliper 99, OneRoster 48, CLR 40, OB 36, CASE 3, QTI 3.0.1 2; the
XSD-family CC / QTI 2.x embed none — those norms exist only in prose guides). The
**hand-curated** half — the `conformance` catalog drawn from the published certification
guides — remains a grounded **seed**; each map's `rollup.normativeStatementsCited` reports
how much of the extracted surface the curated catalog already references, so the curation
backlog is measurable rather than guessed.

### Rollout (emergent ADR-0028)

All three schema-language walkers are built and proven:

- **JSON Schema** (`walkers/json-schema.ts`) — OB ✓, CLR ✓, CASE ✓, and **Caliper 1.2** ✓
  via `walkers/caliper.ts`, which bundles the CaliperBootcamp multi-file distribution
  (accepted as the denominator despite its weaker, non-spec-URL provenance — see the map's
  note). **VC 2.0** has no standalone published per-binding JSON Schema (it is the W3C
  substrate already exercised through OB/CLR), so it is not a separate map.
- **XSD** (`walkers/xsd.ts`) — CC 1.3 ✓, CC 1.4 ✓, QTI 2.1 ✓, QTI 2.2 ✓, QTI 3.0.1 ✓
  (chosen over XSD→JSON-Schema converters, which proved dead, lossy — they drop
  `xs:documentation` — or non-reproducible in CI). Two walker features make modular,
  multi-file schemas tractable: it resolves `<xs:element ref="…">` to the referenced
  global element's type (so QTI 2.x descends as fully as flattened 3.0.1), and — for maps
  that set `scopeXsdDefsBySource` — it scopes every `def:` key by its source schema, so
  structurally-distinct same-named types from different files stay separate (CC's
  `LOM.Type` across the three LOM profiles; `Text.Type` / `Attachment.Type` in the CC 1.4
  `assignment` extension vs Discussion Topic). A binding may also set `rootElement` to
  walk a shared root element name (the three LOM profiles all root at `lom`) under a
  distinct `doc:` label. QTI 2.1 / 2.2 now also cover Results Reporting, Usage Data,
  Metadata, the content-package manifest, APIP and (2.2) Curriculum Standards Metadata.
- **OpenAPI** (`walkers/openapi.ts`) — OneRoster 1.2 ✓ across all three services —
  Rostering, Gradebook and Resources (walks `components.schemas`, reusing the
  JSON-Schema walker via `#/components/schemas/` refs).

Where the literal and Zod bindings differ by a systematic naming convention (QTI's
XML↔JSON kebab/camel/singular-plural), a per-spec `nameNormalizer` on the `SpecSource`
canonicalises both sides for the L2 join (item keys stay literal). The structural join is
otherwise layered with explicit `specRef` overrides for documented normalisations (e.g.
the CC `xs:any` → `extensions` rename) as those are annotated upstream in
`@conform-ed/contracts`.
