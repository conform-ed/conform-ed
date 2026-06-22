# H5P v1 vendored denominator — provenance

The `h5p:1` Coverage Map reconciles the three H5P file formats — `h5p.json` (the package
manifest), `library.json` (the library manifest) and `semantics.json` (the content-authoring
meta-schema) — against conform-ed's `H5pV1` Zod contracts. H5P is a **prose** specification:
the formats are documented on h5p.org (and embodied in the PHP/Node reference libraries), with
**no** machine-readable JSON Schema. So the denominators are hand-authored JSON Schemas
(conform-ed ADR-0017, the lowest provenance tier), walked by `walkers/curated.ts` under its
provenance gate (file-level ADR-0017 + spec URL; every property node cites its source clause).

## Sources (the file-format documentation)

- **h5p.json / library.json:** H5P JSON file descriptions —
  <https://h5p.org/documentation/developers/json-file-descriptions>
- **semantics.json:** H5P semantics — <https://h5p.org/documentation/developers/semantics>
- **Field/version validation rules** cross-checked against the H5P PHP reference library
  (`H5PValidator`) — <https://github.com/h5p/h5p-php-library> (GPL-3.0; consulted, not vendored
  or depended on).

## Curated denominators

- `curated/h5p-json.schema.json` — the package manifest, with `$def`s for the shared
  `VersionRef` (dependency reference), `Author` and `ChangelogEntry`.
- `curated/library-json.schema.json` — the library manifest, with `$def`s for `VersionRef`,
  `FilePath` (preloaded asset), `CoreApi` and `MetadataSettings`.
- `curated/semantics.schema.json` — an array of `SemanticsField`. The 13 H5P field types
  (text/html/number/boolean/image/audio/video/file/select/library/group/list/table) share a
  common base and add per-type properties; conform-ed models them as a discriminated union.
  Because the L2 join compares property **names**, the denominator unions the per-type
  properties into one `SemanticsField` shape (the faithful name-level denominator), with `$def`s
  for the nested `ShowWhen` / `ShowWhenRule`, `Regexp`, `SelectOption` and `ListWidget` objects.
  The `group.fields`, `list.field` and `table.columns` recursion is expressed as `$ref`s back to
  `SemanticsField` (walked once, cycle-guarded).

## Reconciliation notes

Both sides use the same JSON binding (identical camelCase names), so the join needs no
`nameNormalizer`, alias or override, and reconciles with no silent gaps. The h5p.json `license`
code list is additionally verified as a **value-set** against `H5pLicenseSchema` (12 codes, all
modelled). The embed-type, importance and field-type enums are inlined in the contract with no
exported schema, so only the exported license vocabulary is value-set-checked.

Out of scope: the `.h5p` archive layout (file placement, the `content/` directory) and the
per-library `content.json` payloads — those vary by library and require semantics traversal to
validate (conform-ed models `content.json` only as a permissive base).
