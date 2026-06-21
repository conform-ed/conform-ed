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
- **`residues`.** The signals that justify the literal denominator:
  - `silentGaps` — in the published spec, never modelled (candidate gaps);
  - `extensions` — modelled but absent from the spec (conform-ed extensions);
  - `normalisations` — documented XSD→Zod renames the structural name-join cannot pair
    (`xs:any` → `extensions`, simpleContent text → `value`, `xml:base` ⇄ `xmlBase`),
    declared as `specRefOverrides` on the `SpecSource` and absorbed out of the two lists
    above so they keep only genuine signal. Each records exactly which keys it absorbed; a
    rename of a _named_ construct (`xml:base`) also flips its literal items to `modelled`.
- **`rollup`.** Computed counts (never hand-typed) per map.

## Usage

```bash
bun run coverage:generate   # regenerate every committed map under maps/
bun run coverage:check      # CI gate: fail if any committed map is stale
```

Adding a spec: vendor its source schema under `vendor/<spec>/<version>/`, declare a
`SpecSource` under `specs/`, register it in `specs/index.ts`, and regenerate.

## Status

Eleven `spec:version` maps across all three schema-language families:

Silent-gap / extension columns are the residues _after_ documented renames are absorbed;
the `Norm.` column counts the keys each map's `specRefOverrides` moved into `normalisations`.

| Map                     | Family      | Items | Modelled | Silent gaps | Extensions | Norm. | Conf. reqs |
| ----------------------- | ----------- | ----- | -------- | ----------- | ---------- | ----- | ---------- |
| `open-badges-v3.0`      | JSON Schema | 340   | 241      | 0           | 0          | 0     | 16         |
| `clr-v2.0`              | JSON Schema | 409   | 299      | 0           | 0          | 0     | 14         |
| `case-v1.1`             | JSON Schema | 344   | 264      | 0           | 0          | 0     | 9          |
| `caliper-v1.2`          | JSON Schema | 1957  | 78       | 136         | 26         | 0     | 5          |
| `common-cartridge-v1.3` | XSD         | 676   | 413      | 0           | 96         | 97    | 12         |
| `common-cartridge-v1.4` | XSD         | 143   | 84       | 0           | 23         | 15    | 13         |
| `qti-v2.1`              | XSD         | 4971  | 186      | 385         | 64         | 12    | 11         |
| `qti-v2.2`              | XSD         | 5378  | 208      | 541         | 78         | 14    | 11         |
| `qti-v3.0.1`            | XSD         | 5344  | 224      | 358         | 78         | 12    | 10         |
| `oneroster-v1.2`        | OpenAPI     | 498   | 248      | 0           | 0          | 0     | 21         |
| `lti-v1.3`              | OpenAPI+gd  | 46    | 21       | 0           | 6          | 0     | 27         |

- **Open Badges 3.0 / CLR 2.0** share the OB/VC credential machinery; **CASE 1.1** (all
  13 entity schemas) reconciles `0/0` and is fully guide-curated (core / provider / consumer).
- **Caliper 1.2** ⚠️ — the one map whose denominator is **not** a canonical 1EdTech
  release: 1EdTech ships no per-binding Caliper schema at a spec URL, so the literal
  denominator is the **CaliperBootcamp** GitHub repo (`schemas/v1_2`, pinned commit), a
  developer-education distribution accepted as the denominator deliberately (see
  `vendor/caliper/v1_2/PROVENANCE.md`; the weaker provenance is recorded in
  `meta.sources`). `walkers/caliper.ts` bundles its 110 cross-referencing draft-04 files
  into one `$defs` map so the JSON-Schema walker applies unchanged. The Envelope transport
  and the full Event property set reconcile; the silent gaps are conform-ed's deliberately
  focused entity surface (it models the entry points, not every property of all 110 types).
  Its `conformance` catalogue is guide-curated (5 requirements — Envelope, Event required
  fields, Entity required fields, and the identifier rule): the schema's only embedded RFC-2119
  prose is the `id` rule, carried identically on every one of the 99 inventoried types, so
  CAL-ID-1 constrains them all and `normativeStatementsCited` reaches the whole surface (99/99).
- **OneRoster 1.2** spans all three services in one map — Rostering (7 entities),
  Gradebook (LineItem / Result / Category / ScoreScale / AssessmentLineItem /
  AssessmentResult / LearningObjectiveSet) and Resources (Resource) — and the information
  model reconciles `0/0`. It is also the first map to carry the **transport axis**: each
  service document's OpenAPI `paths` are walked (`restServices` → `walkOpenApiPaths`) into
  88 `operation` / `parameter` / `security` items (81 operations, the six shared query
  mechanisms, OAuth2CC). These are L1-only — never reconciled, so they swell `Items` but add
  no silent gaps — and the §4 REST-binding requirements cross-link to them (see below).
- **LTI 1.3 + Advantage** ⚠️ — a **hybrid** map (emergent ADR-0033): only **AGS 2.0** has
  a machine-readable denominator, and even that is an _illustrative_ OpenAPI whose schemas
  are inlined under the path media types. The vendored derived JSON lifts the five
  1EdTech-named media-type schemas (lineitem / lineitemcontainer / score / result /
  resultcontainer) into `components.schemas` — a documented, byte-faithful relocation of
  1EdTech's own artifact (see `vendor/lti/v1_3/PROVENANCE.md`, the Caliper precedent). Those
  reconcile `0` gaps against conform-ed's AGS Zod; the 6 `Extensions` are optional fields
  conform-ed models that the illustrative OpenAPI omits (`gradesReleased`, `submission`,
  `scorePublished`, `scoringUserId`). The AGS `paths` give the transport axis (7 operations,
  6 query filters, **no** declared security scheme — AGS keeps OAuth out of band). The other
  five profiles — **Core** launch, **Security**, **NRPS**, **Deep Linking**, **Proctoring**
  — publish no schema at all (inline JSON + prose), so they are guide-only with
  `constrains: []`. `cited` is 0 throughout: even the AGS schema prose is prose-case "must",
  not RFC-2119 `MUST` (so AGS is "schema-backed" by `Modelled`, not `Norm.`/`cited`).
- **Common Cartridge 1.3 / 1.4** — via the **direct XSD walker**, with `def:`s scoped by
  source schema (`scopeXsdDefsBySource`) so same-named complexTypes from different files
  stay distinct. CC 1.3 carries eight bindings: content-packaging Manifest, Web Link,
  Discussion Topic, Authorization, Curriculum Standards Metadata, and the three IEEE-LOM
  profiles (Basic LTI Link, Resource metadata, Manifest metadata — all rooted at
  `<xs:element name="lom" type="LOM.Type">`, kept apart by source-scoping). CC 1.4 carries
  six (the same core five plus the `assignment` extension, whose `Text.Type` /
  `Attachment.Type` would otherwise collide with Discussion Topic's). Three documented
  XSD→Zod renames (`xs:any` → `extensions`; simpleContent text → `value`; `xml:base` ⇄
  `xmlBase`) are declared as `specRefOverrides` and absorbed into `normalisations`, so they
  no longer pollute the residues: CC's `silentGaps` are now empty (the `/base` items, a
  _named_ rename, flip to `modelled`) and the surviving `extensions` are the genuine signal —
  the rich IEEE-LOM optional sub-trees conform-ed models that the literal LOM profiles leave
  to imported boundaries.
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
  models the JSON binding; for 3.0.1 it also bridges the `qti-`/kebab prefix). The same
  three XSD→Zod renames are absorbed via `specRefOverrides` — except `xml:base` ⇄ `xmlBase`,
  which **2.1 / 2.2 deliberately omit**: conform-ed names no `xmlBase` in the 2.x model, so
  their `/base` items are genuine silent gaps and must stay (3.0.1 does model it, so its one
  `/base` flips to `modelled`). The surviving silent gaps are honest signal: ARIA attributes
  - content-model expression operators that conform-ed models as Zod unions rather than
    named elements.

The conformance surface has two halves. The **machine-extractable** half —
`normativeStatements`, the RFC-2119 prose the schemas embed in their own documentation —
is fully extracted and regenerated on every build: 228 MUST-level statements across the
JSON-family maps (Caliper 99, OneRoster 48, CLR 40, OB 36, CASE 3, QTI 3.0.1 2; the
XSD-family CC / QTI 2.x embed none — those norms exist only in prose guides). The
**hand-curated** half — the `conformance` catalog drawn from the published certification
**guides** — is being grown per spec. Each map's `rollup.normativeStatementsCited` reports how
much of the extracted surface the curated catalog already references, so the curation backlog
is measurable rather than guessed. **Open Badges 3.0 is the first fully guide-curated map**: 16
requirements across the three certified product roles the OB 3.0 Conformance & Certification
guide defines — `issuer` (§3), `displayer` (§4) and `host` (§5) — cross-linked to the L1 items
they constrain, lifting `normativeStatementsCited` to 9/36 (the credential-content MUSTs the
guide tests; the remaining sub-entity type-set MUSTs are enforced holistically by the
schema-validation requirement OB-ISS-8). The Badge Connect API **transport** requirements
(endpoints, OAuth, pagination) are a separate surface with no L1 item in the data-model map and
await an OpenAPI binding map. **CLR 2.0** is curated the same way (14 requirements across the
same three roles; it shares OB's credential stack, so the displayer/host shapes match,
`cited` 7/40). **OneRoster 1.2** is curated by its certified service modes plus a
cross-cutting transport profile (rostering / gradebook / resources / assessment-results /
transport, 21 requirements): the per-entity stable-identity rules (every object carries
sourcedId + status + dateLastModified) cross-link the schema's own MUSTs across every service,
so `cited` reaches 38/48. The REST-binding §4 transport conformance is now curated too, against
the walked `paths` axis — the required GET/PUT endpoints per service (`OR-5`, `OR-GB-5`,
`OR-RES-3`, `OR-AR-3`) and the cross-cutting OAuth 2.0 Client Credentials + pagination /
filtering / sorting / field-selection query mechanisms (`OR-TR-1…5`). Those transport items
embed no RFC-2119 prose, so they raise the requirement count without inflating `cited` (still
38/48). (The CSV binding and OpenAPI service discovery remain prose-only.) **CASE 1.1** is curated by its two certified roles plus a `core` profile (9
requirements): the `core` information-model invariants (a CFPackage has exactly one CFDocument,
every CFItem a UUID, every CFAssociation a typed origin/destination, and `caseVersion` = '1.1'),
then `provider` (supply every required field, be capable of every optional field, emit no
extension fields) and `consumer` (handle/recover every required field, tolerate extensions).
CASE-4 is the one curated rule that cross-links the spec's only embedded MUST — the
`caseVersion` = '1.1' rule across the CFDocument variants — lifting `cited` to 3/3; the 11
required GET endpoints and the `/ims/case/v1p1` base URL are the out-of-scope transport surface.
**Caliper 1.2** is curated on the conform-ed side (5 requirements): its schema embeds a single
RFC-2119 rule — the `id` MUST — repeated on every type, so one curated requirement (CAL-ID-1)
cites the whole 99-statement surface; there is no emergent overlay for it yet (emergent emits no
Caliper today, so a product overlay would be entirely deferred until an analytics emitter lands).
**Common Cartridge 1.3 / 1.4** are curated from the CC profile Conformance + Implementation
guides (12 and 13 requirements): the `manifest` packaging rules (identifier / schema /
schemaversion / single rooted-hierarchy organization / resource identifier+type+href) and the
per-resource-type bindings the maps carry (web-link, discussion-topic, curriculum-standards-metadata,
authorization, lti-link, and CC 1.4's assignment extension). CC is the guide-only case: the XSDs
embed no RFC-2119 `xs:documentation`, so `normativeStatements` is empty and there is no `cited`
metric — the curated catalogue is the entire conformance surface. **QTI 2.1 / 2.2 / 3.0.1** are
curated from the QTI Information-Model / Implementation guides (11 / 11 / 10 requirements), grouped
by the ASI surface each rule governs — `item` (identifier/title/time-dependent/adaptive, item-body,
response-declaration + response-processing), `response-declaration` (identifier/cardinality/base-type),
`outcome-declaration`, `test` (identifier + test-part, test-part → section), `section`, and
`response-processing` (template-or-custom-rules), plus the 2.x `results` assessmentResult rule.
Like CC these are guide-only (the XSDs embed almost no RFC-2119 prose; QTI 3.0.1's two embedded
MUSTs are niche base-type rules the structural catalogue does not reference, so `cited` stays 0).
The curated catalogue is the cert-aligned MUST checklist; the literal ASI inventory — every
element/attribute, including the deliberately-deferred content-model and expression-operator
subtrees — is the map's L1.
**LTI 1.3 + Advantage** is curated from the LTI Advantage Conformance & Certification guide,
the 1EdTech Security Framework 1.1 and the four service specs, for the **tool** role (emergent
ADR-0033 — emergent is an LTI tool, not a platform). 27 requirements across six Advantage
profiles: `core` (OIDC launch + id_token validation + required claims + roles + reject-bad),
`security` (RSA-256 JWTs, TLS, JWKS exposure, the OAuth client-credentials grant), `nrps` (the
NRPS claim, the membership container media type, member roles/status, the readonly scope), `ags`
(the eight line-item/score/result rules), `deep-linking` (the request settings, message types,
the signed content-items response, the return redirect) and `proctoring` (start/end-assessment).
Only `ags` has a literal denominator, so only its requirements cross-link `def:`/`path:`/`param:`
anchors; the other five are guide-only with `constrains: []` (1EdTech publishes no schema for the
launch claims, the membership container or the deep-linking messages — recorded honestly rather
than invented). `cited` is 0 even for AGS — the AGS OpenAPI uses prose-case "must", not RFC-2119
`MUST` — so AGS is "schema-backed" by `Modelled` (its info model reconciles `0` gaps), not `cited`.

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
  Rostering, Gradebook and Resources. `walkOpenApi` walks the information model
  (`components.schemas`, reusing the JSON-Schema walker via `#/components/schemas/` refs);
  `walkOpenApiPaths` walks the **transport surface** (`paths` operations, query parameters and
  `securitySchemes`) into the L1-only `operation` / `parameter` / `security` axis, opted in per
  map via `SpecSource.restServices`. The transport items are never reconciled against Zod (no
  data-contract counterpart), so they never enter the residues; a transport conformance
  requirement cross-links to them instead.

Where the literal and Zod bindings differ by a systematic naming convention (QTI's
XML↔JSON kebab/camel/singular-plural), a per-spec `nameNormalizer` on the `SpecSource`
canonicalises both sides for the L2 join (item keys stay literal). For the handful of
_non-systematic_ renames the name-join still cannot pair — a foreign attribute conform-ed
renames (`xml:base` ⇄ `xmlBase`), or an XSD construct the schema leaves unnamed that
conform-ed names (`xs:any` → `extensions`, simpleContent text → `value`) — each map
declares explicit `specRefOverrides` (shared in `specs/xsd-normalisations.ts`). A post-pass
(`applySpecRefOverrides`) absorbs the matching residue keys into `residues.normalisations`,
recording exactly which keys each rename covered and flipping the literal side of a named
rename to `modelled` — so the residue lists carry only genuine gaps and extensions.
