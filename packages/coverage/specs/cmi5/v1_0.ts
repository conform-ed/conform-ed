/**
 * cmi5 v1.0 (Quartz) — {@link SpecSource} (conform-ed ADR-0013; structural-alias + value-set
 * extensions from ADR-0017). Reconciles the cmi5 **course-structure** information model — the
 * one part cmi5 ships as a normative XSD — against the `Cmi5V1_0` Zod contracts.
 *
 * conform-ed normalises the XSD *shape*, so the L2 join needs two structural aliases, one
 * transparent wrapper, and one leaf override — after which it reconciles with no silent gaps
 * (see `vendor/cmi5/v1_0/PROVENANCE.md`):
 *
 *  - `<au>` / `<block>` (a repeated `xs:choice`) → conform-ed's `children: (Au | Block)[]`
 *    union array; `<langstring>` (repeated) → a `langstrings` array — both bridged by a
 *    {@link SpecSource.structuralAliases} entry so their subtrees reconcile.
 *  - `<objectives>` wraps a repeated `<objective>` that conform-ed flattens to a direct array
 *    → a {@link SpecSource.transparentLiteralWrappers} entry descends through it.
 *  - a `<langstring>`'s `simpleContent` text → conform-ed `value` — a `specRefOverride`.
 *
 * The one residue extension is the AU `keywords` array (the separate cmi5 keyword extension,
 * not the core XSD — conform-ed is the richer contract). The cmi5 runtime surface (xAPI launch
 * flow, the nine defined-statement verbs, LMS launch data) is out of scope: it is prose + an
 * xAPI profile with no schema, and conform-ed models only the course structure.
 */

import { join } from "node:path";

import { Cmi5CourseStructureSchema, Cmi5LaunchMethodSchema, Cmi5MoveOnSchema } from "@conform-ed/contracts/cmi5/v1_0";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "cmi5", "v1_0", file);

/**
 * Course-structure conformance catalogue, curated from the normative cmi5 CourseStructure.xsd
 * (the schema is the requirement) and the cmi5 Quartz specification. cmi5 defines no
 * certification profiles for the course structure, so all sit under one `course-structure`
 * profile; each anchors to the reconciled XSD item it constrains.
 */
const SPEC =
  "cmi5 CourseStructure.xsd / cmi5 Quartz spec — https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md";

const conformance: readonly ConformanceRequirement[] = [
  {
    key: "cmi5:1.0:conf:course-structure/CMI5-CS-1",
    profile: "course-structure",
    reqId: "CMI5-CS-1",
    level: "MUST",
    statement: "A course-structure document has exactly one <course>, identified by an id (an IRI).",
    constrains: ["cmi5:1.0:def:courseType/course", "cmi5:1.0:def:courseType/course/id"],
    source: SPEC,
  },
  {
    key: "cmi5:1.0:conf:course-structure/CMI5-CS-2",
    profile: "course-structure",
    reqId: "CMI5-CS-2",
    level: "MUST",
    statement: "Each assignable unit (AU) MUST carry an id (an IRI, unique within the course) and a launchable url.",
    constrains: ["cmi5:1.0:def:auType/id", "cmi5:1.0:def:auType/url"],
    source: SPEC,
  },
  {
    key: "cmi5:1.0:conf:course-structure/CMI5-CS-3",
    profile: "course-structure",
    reqId: "CMI5-CS-3",
    level: "MUST",
    statement:
      "An AU's moveOn MUST be one of NotApplicable, Passed, Completed, CompletedAndPassed or CompletedOrPassed (default NotApplicable).",
    constrains: ["cmi5:1.0:def:auType/moveOn"],
    source: SPEC,
  },
  {
    key: "cmi5:1.0:conf:course-structure/CMI5-CS-4",
    profile: "course-structure",
    reqId: "CMI5-CS-4",
    level: "MUST",
    statement: "masteryScore, when present, MUST be a decimal between 0 and 1 inclusive.",
    constrains: ["cmi5:1.0:def:auType/masteryScore"],
    source: SPEC,
  },
  {
    key: "cmi5:1.0:conf:course-structure/CMI5-CS-5",
    profile: "course-structure",
    reqId: "CMI5-CS-5",
    level: "MUST",
    statement: "An AU's launchMethod MUST be AnyWindow or OwnWindow (default AnyWindow).",
    constrains: ["cmi5:1.0:def:auType/launchMethod"],
    source: SPEC,
  },
  {
    key: "cmi5:1.0:conf:course-structure/CMI5-CS-6",
    profile: "course-structure",
    reqId: "CMI5-CS-6",
    level: "MUST",
    statement: "A block groups AUs and nested blocks, MUST carry an id, and references objectives by idref.",
    constrains: ["cmi5:1.0:def:blockType/id", "cmi5:1.0:def:blockType/objectives"],
    source: SPEC,
  },
];

export const cmi5V1_0: SpecSource = {
  spec: "cmi5",
  version: "1.0",
  bindings: [
    {
      binding: "courseStructure",
      schemaPath: vendor("CourseStructure.xsd"),
      language: "xsd",
      zod: Cmi5CourseStructureSchema,
    },
  ],
  structuralAliases: [
    { zodProperty: "children", literalElements: ["au", "block"] },
    { zodProperty: "langstrings", literalElements: ["langstring"] },
  ],
  // conform-ed flattens the XSD's <objectives><objective>… repetition into a direct array.
  transparentLiteralWrappers: ["objective"],
  specRefOverrides: [{ note: "cmi5 <langstring> simpleContent text → conform-ed `value`", modelledSegment: "value" }],
  valueSets: [
    { item: "cmi5:1.0:def:auType/moveOn", element: Cmi5MoveOnSchema },
    { item: "cmi5:1.0:def:auType/launchMethod", element: Cmi5LaunchMethodSchema },
  ],
  conformance,
};
