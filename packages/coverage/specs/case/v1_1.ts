/**
 * CASE 1.1 (Competencies & Academic Standards Exchange) — {@link SpecSource}
 * (conform-ed ADR-0013; emergent ADR-0028 rollout). A JSON-Schema-family spec
 * whose 13 published per-entity schemas map 1:1 to conform-ed's `CaseV1_1.Schemas`
 * Zod roots.
 *
 * Vendored schemas under `vendor/case/v1_1/` are the literal denominator, fetched
 * verbatim from `purl.imsglobal.org/spec/case/v1p1/schema/json/` (filenames
 * `case_v1p1_<entity>-jsonschema1.json`).
 */

import { join } from "node:path";

import { CaseV1_1 } from "@conform-ed/contracts/case/v1_1";

import type { SpecBindingSource, SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "case", "v1_1", file);

const S = CaseV1_1.Schemas;

/** binding (the published entity) → its conform-ed Zod root. */
const binding = (entity: string, zod: SpecBindingSource["zod"]): SpecBindingSource => ({
  binding: entity,
  schemaPath: vendor(`case_v1p1_${entity}-jsonschema1.json`),
  language: "json-schema",
  ...(zod !== undefined ? { zod } : {}),
});

/**
 * Conformance seed — a grounded slice of CASE 1.1 normative rules, cross-linked to
 * the literal L1 items they constrain. Requirement ids are synthesised (`CASE-n`);
 * full extraction from the published 1EdTech CASE 1.1 conformance/cert guide is the
 * next hand-curation increment.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "case:1.1:conf:core/CASE-1",
    profile: "core",
    reqId: "CASE-1",
    level: "MUST",
    statement: "A CFPackage MUST contain exactly one CFDocument describing the framework.",
    constrains: ["case:1.1:doc:cfpackage/CFDocument"],
    source: "CASE 1.1 §CFPackage — https://www.imsglobal.org/spec/case/v1p1",
  },
  {
    key: "case:1.1:conf:core/CASE-2",
    profile: "core",
    reqId: "CASE-2",
    level: "MUST",
    statement: "Every CFItem MUST be identified by a globally unique identifier (a UUID).",
    constrains: ["case:1.1:doc:cfitem/identifier"],
    source: "CASE 1.1 §CFItem — https://www.imsglobal.org/spec/case/v1p1",
  },
  {
    key: "case:1.1:conf:core/CASE-3",
    profile: "core",
    reqId: "CASE-3",
    level: "MUST",
    statement: "Every CFAssociation MUST declare its associationType and both its origin and destination nodes.",
    constrains: ["case:1.1:doc:cfassociation/associationType"],
    source: "CASE 1.1 §CFAssociation — https://www.imsglobal.org/spec/case/v1p1",
  },
];

export const caseV1_1: SpecSource = {
  spec: "case",
  version: "1.1",
  bindings: [
    binding("cfassociation", S.CFAssociation),
    binding("cfassociationgrouping", S.CFAssociationGrouping),
    binding("cfassociationset", S.CFAssociationSet),
    binding("cfconceptset", S.CFConceptSet),
    binding("cfdocument", S.CFDocument),
    binding("cfdocumentset", S.CFDocumentSet),
    binding("cfitem", S.CFItem),
    binding("cfitemtypeset", S.CFItemTypeSet),
    binding("cflicense", S.CFLicense),
    binding("cfpackage", S.CFPackage),
    binding("cfrubric", S.CFRubric),
    binding("cfsubjectset", S.CFSubjectSet),
    binding("imsx_statusinfo", S.ImsxStatusInfo),
  ],
  conformance,
};
