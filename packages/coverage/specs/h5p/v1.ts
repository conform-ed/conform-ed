/**
 * H5P v1 (package / library / semantics file formats) — {@link SpecSource} (conform-ed
 * ADR-0013; curated denominator + value-set extension from ADR-0017).
 *
 * H5P is a **prose** specification: the `.h5p` package format, the library format and the
 * semantics content-authoring meta-schema are documented on h5p.org (plus the PHP reference
 * library), with no machine-readable JSON Schema. So — the canonical ADR-0017 case — the
 * denominators are hand-authored JSON Schemas under `vendor/h5p/v1/curated/`, walked by
 * `walkers/curated.ts` under its provenance gate and reconciled against the `H5pV1` Zod
 * contracts. Three documents are modelled:
 *
 *  - `h5p.json` — the package manifest (title, libraries, embed types, copyright metadata).
 *  - `library.json` — the library manifest (versioning, assets, dependencies, embedding).
 *  - `semantics.json` — the content-authoring meta-schema: an array of field definitions. The
 *    13 H5P field types share a common base and add per-type properties; conform-ed models them
 *    as a discriminated union, and the structural join compares property *names*, so the curated
 *    denominator unions them into one `SemanticsField` shape (the faithful name-level denominator).
 *
 * Same JSON binding on both sides (identical camelCase property names), so the L2 name-join needs
 * no `nameNormalizer`, alias or override. The `license` code list (h5p.json) is verified as a
 * **value-set** against `H5pLicenseSchema` — the structural join matches property names, never
 * the enumerated license codes. The embed-type / importance / field-type enums are inlined in the
 * contract (no exported schema to verify against), so only the exported license vocabulary is
 * value-set-checked. The `.h5p` archive layout and per-library `content.json` payloads (which vary
 * by library and require semantics traversal to validate) are out of scope.
 */

import { join } from "node:path";

import {
  H5pLibraryManifestSchema,
  H5pLicenseSchema,
  H5pPackageManifestSchema,
  H5pSemanticsSchema,
} from "@conform-ed/contracts/h5p/v1";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "h5p", "v1", file);

/**
 * Conformance catalogue, curated from the H5P file-format documentation (h5p.org). H5P defines no
 * formal certification profiles for the file formats, so requirements are grouped by the document
 * they constrain — `package` (h5p.json), `library` (library.json), `semantics` (semantics.json) —
 * each anchoring to the reconciled curated item(s) it governs.
 */
const SPEC = "H5P file format documentation — https://h5p.org/documentation/developers/json-file-descriptions";

const conformance: readonly ConformanceRequirement[] = [
  {
    key: "h5p:1:conf:package/H5P-PKG-1",
    profile: "package",
    reqId: "H5P-PKG-1",
    level: "MUST",
    statement:
      "h5p.json MUST declare the content title, language, the mainLibrary, at least one embedType (iframe or div) and at least one preloadedDependency.",
    constrains: [
      "h5p:1:doc:h5p-json/title",
      "h5p:1:doc:h5p-json/language",
      "h5p:1:doc:h5p-json/mainLibrary",
      "h5p:1:doc:h5p-json/embedTypes",
      "h5p:1:doc:h5p-json/preloadedDependencies",
    ],
    source: SPEC,
  },
  {
    key: "h5p:1:conf:package/H5P-PKG-2",
    profile: "package",
    reqId: "H5P-PKG-2",
    level: "MUST",
    statement:
      "A library dependency reference MUST carry a machineName and the major/minor version (the patch is omitted by design — any patch of that major.minor is acceptable).",
    constrains: [
      "h5p:1:def:VersionRef/machineName",
      "h5p:1:def:VersionRef/majorVersion",
      "h5p:1:def:VersionRef/minorVersion",
    ],
    source: SPEC,
  },
  {
    key: "h5p:1:conf:package/H5P-PKG-3",
    profile: "package",
    reqId: "H5P-PKG-3",
    level: "MUST",
    statement:
      "When present in h5p.json, the license MUST be one of the H5P content-license codes (CC BY, CC BY-SA, …, CC0, GNU GPL, PD, ODC PDDL, CC PDM, or U for undisclosed).",
    // Anchored to the ADR-0017 value-set: every license code is safeParse'd against H5pLicenseSchema.
    constrains: ["h5p:1:doc:h5p-json/license"],
    source: SPEC,
  },
  {
    key: "h5p:1:conf:library/H5P-LIB-1",
    profile: "library",
    reqId: "H5P-LIB-1",
    level: "MUST",
    statement:
      "library.json MUST declare the title, machineName, the full major/minor/patch version, and runnable (1 = standalone content type, 0 = helper library).",
    constrains: [
      "h5p:1:doc:library-json/title",
      "h5p:1:doc:library-json/machineName",
      "h5p:1:doc:library-json/majorVersion",
      "h5p:1:doc:library-json/minorVersion",
      "h5p:1:doc:library-json/patchVersion",
      "h5p:1:doc:library-json/runnable",
    ],
    source: SPEC,
  },
  {
    key: "h5p:1:conf:library/H5P-LIB-2",
    profile: "library",
    reqId: "H5P-LIB-2",
    level: "MUST",
    statement:
      "A runnable library using the iframe embed type MUST declare its embedding dimensions (w and h) and may preload JS/CSS assets and declare editor dependencies.",
    constrains: [
      "h5p:1:doc:library-json/embedTypes",
      "h5p:1:doc:library-json/w",
      "h5p:1:doc:library-json/h",
      "h5p:1:doc:library-json/preloadedJs",
      "h5p:1:doc:library-json/editorDependencies",
    ],
    source: SPEC,
  },
  {
    key: "h5p:1:conf:semantics/H5P-SEM-1",
    profile: "semantics",
    reqId: "H5P-SEM-1",
    level: "MUST",
    statement:
      "Each semantics.json field MUST carry a name and a type drawn from the H5P field types (text, html, number, boolean, image, audio, video, file, select, library, group, list, table).",
    constrains: ["h5p:1:def:SemanticsField/name", "h5p:1:def:SemanticsField/type"],
    source: "H5P semantics — https://h5p.org/documentation/developers/semantics",
  },
  {
    key: "h5p:1:conf:semantics/H5P-SEM-2",
    profile: "semantics",
    reqId: "H5P-SEM-2",
    level: "MUST",
    statement:
      "Composite field types nest further field definitions: a group declares fields, a list declares its element field, and a table declares columns.",
    constrains: [
      "h5p:1:def:SemanticsField/fields",
      "h5p:1:def:SemanticsField/field",
      "h5p:1:def:SemanticsField/columns",
    ],
    source: "H5P semantics — https://h5p.org/documentation/developers/semantics",
  },
];

export const h5pV1: SpecSource = {
  spec: "h5p",
  version: "1",
  bindings: [
    // Curated denominators (ADR-0017): H5P publishes no machine schema for its file formats.
    {
      binding: "h5p-json",
      schemaPath: vendor("curated/h5p-json.schema.json"),
      language: "curated",
      zod: H5pPackageManifestSchema,
    },
    {
      binding: "library-json",
      schemaPath: vendor("curated/library-json.schema.json"),
      language: "curated",
      zod: H5pLibraryManifestSchema,
    },
    {
      binding: "semantics",
      schemaPath: vendor("curated/semantics.schema.json"),
      language: "curated",
      zod: H5pSemanticsSchema,
    },
  ],
  // Value-set verification (ADR-0017): every H5P content-license code is safeParse'd against the
  // exported H5pLicenseSchema (the only exported H5P vocabulary; the embed-type / importance /
  // field-type enums are inlined in the contract with no schema to verify against).
  valueSets: [{ item: "h5p:1:doc:h5p-json/license", element: H5pLicenseSchema }],
  conformance,
};
