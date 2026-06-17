# Caliper 1.2 vendored schemas — provenance ⚠️

**Source:** <https://github.com/IMSGlobal/CaliperBootcamp> — `schemas/v1_2/*.json`
**Pinned commit:** `0a2d118cb399be50650aa9a376ed96bd9bb2d670` (2025-06-04)

## Provenance caveat (read this)

Unlike the other Coverage Map denominators (Open Badges / CLR / CASE JSON Schemas, the
CC / QTI `.xsd`s, the OneRoster OpenAPI docs), 1EdTech does **not** publish the Caliper
1.2 information model as a canonical schema distribution at a stable `purl.imsglobal.org`
spec URL. The only machine-readable Caliper model 1EdTech ships lives in the
**CaliperBootcamp** GitHub repository — developer-education / sample material, not a
formal normative schema release.

We nonetheless accept it as the **literal denominator** for the `caliper-v1.2` Coverage
Map, on Anton's call (these files self-identify as the Caliper model via
`"metaFormat": "http://purl.imsglobal.org/caliper/"` and are the only versionable
machine-readable artifact available). The map's `meta.sources[].id` records the repo +
commit so the weaker provenance is explicit in the published artifact.

If 1EdTech later publishes a canonical Caliper schema distribution, re-vendor from there
and re-pin.

## Schema shape (for the walker)

Draft-04 JSON Schema, one file per type, keyed by an `id` field equal to the filename.
Cross-references use a bootcamp-specific convention the standard walkers don't speak:

- `"$ref": "Person"` — a bare filename, i.e. the whole `Person.json` schema.
- `"$ref": "CaliperTypeDefinitions#/extensions"` — a JSON-pointer into another file's
  top-level key (shared property definitions live in `CaliperTypeDefinitions.json`).

`src/walkers/caliper.ts` bundles these 110 files into a single `$defs` map and rewrites
the refs (`"X"` → `#/$defs/X`, `"X#/k"` → `#/$defs/X.k`, hoisting the fragment target)
so the ordinary JSON-Schema walker + reconciler apply unchanged. The rewrite is purely
mechanical address translation — no information is added or dropped, so the literal files
remain the denominator.
