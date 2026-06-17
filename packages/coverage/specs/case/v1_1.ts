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
 * Conformance catalogue — curated from the CASE 1.1 specification body and the published
 * 1EdTech CASE 1.1 Conformance & Certification guide
 * (https://www.imsglobal.org/spec/case/v1p1/cert/), which has no machine source. CASE
 * certifies two roles, used here as profiles alongside a `core` profile:
 *   - `core` — information-model invariants from the spec body that bind any conformant
 *     CASE document, irrespective of role (package/identity/version rules).
 *   - `provider` — a Service Provider that supplies CASE data: it MUST emit every required
 *     field, be capable of emitting every optional field, and (per the cert guide) MUST NOT
 *     emit extension fields in conformance-tested payloads.
 *   - `consumer` — a Service Consumer that ingests CASE data: it MUST persistently store
 *     ("handle") and recover every required field, and MUST tolerate extension fields
 *     without failing.
 *
 * Scope vs this map's denominator: L1 is the **information model** (the 13 published entity
 * JSON schemas), so the per-entity DATA-MODEL requirements are curated and cross-linked here.
 * The REST **transport** conformance — the 11 required GET endpoints, the `/ims/case/v1p1`
 * base URL, and the optional pagination / filtering / sorting / field-selection query
 * mechanisms (cert guide §Service Provider / §Service Consumer) — is a separate surface with
 * no L1 entity item in this map; it would be modelled by walking the CASE service's OpenAPI
 * paths (not done here) and is intentionally out of this catalogue. Where a requirement
 * constrains an item whose schema also embeds the rule as RFC-2119 prose, its `constrains`
 * includes that item so `normativeStatementsCited` reflects the overlap (CASE embeds only the
 * `caseVersion` MUST, cited by CASE-4).
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
    constrains: [
      "case:1.1:doc:cfassociation/associationType",
      "case:1.1:doc:cfassociation/originNodeURI",
      "case:1.1:doc:cfassociation/destinationNodeURI",
    ],
    source: "CASE 1.1 §CFAssociation — https://www.imsglobal.org/spec/case/v1p1",
  },
  {
    key: "case:1.1:conf:core/CASE-4",
    profile: "core",
    reqId: "CASE-4",
    level: "MUST",
    statement: "The caseVersion attribute, when present on a CFDocument, MUST have the value '1.1'.",
    constrains: [
      "case:1.1:doc:cfdocument/caseVersion",
      "case:1.1:def:CFDocument/caseVersion",
      "case:1.1:def:CFPckgDocument/caseVersion",
    ],
    source: "CASE 1.1 §CFDocument (caseVersion) — https://www.imsglobal.org/spec/case/v1p1",
  },
  {
    key: "case:1.1:conf:provider/CASE-PROV-1",
    profile: "provider",
    reqId: "CASE-PROV-1",
    level: "MUST",
    statement:
      "A Service Provider MUST supply every REQUIRED data field in the JSON payload of each served entity (a CFDocument's identifier/uri/title/creator/lastChangeDateTime; a CFItem's identifier/uri/fullStatement; a CFAssociation's identifier/uri/associationType and origin/destination node references).",
    constrains: [
      "case:1.1:doc:cfdocument/identifier",
      "case:1.1:doc:cfdocument/uri",
      "case:1.1:doc:cfdocument/title",
      "case:1.1:doc:cfdocument/creator",
      "case:1.1:doc:cfdocument/lastChangeDateTime",
      "case:1.1:doc:cfitem/identifier",
      "case:1.1:doc:cfitem/uri",
      "case:1.1:doc:cfitem/fullStatement",
      "case:1.1:doc:cfassociation/identifier",
      "case:1.1:doc:cfassociation/uri",
      "case:1.1:doc:cfassociation/associationType",
      "case:1.1:doc:cfassociation/originNodeURI",
      "case:1.1:doc:cfassociation/destinationNodeURI",
    ],
    source: "CASE 1.1 Cert §Service Provider (required data fields) — https://www.imsglobal.org/spec/case/v1p1/cert/",
  },
  {
    key: "case:1.1:conf:provider/CASE-PROV-2",
    profile: "provider",
    reqId: "CASE-PROV-2",
    level: "MUST",
    statement:
      "A Service Provider MUST be capable of supplying every OPTIONAL data field defined for the entities it serves (e.g. a CFItem's humanCodingScheme and CFItemType, a CFDocument's officialSourceURL).",
    constrains: [
      "case:1.1:doc:cfitem/humanCodingScheme",
      "case:1.1:doc:cfitem/CFItemType",
      "case:1.1:doc:cfdocument/officialSourceURL",
    ],
    source: "CASE 1.1 Cert §Service Provider (optional data fields) — https://www.imsglobal.org/spec/case/v1p1/cert/",
  },
  {
    key: "case:1.1:conf:provider/CASE-PROV-3",
    profile: "provider",
    reqId: "CASE-PROV-3",
    level: "MUST",
    statement:
      "A Service Provider MUST NOT include extension data fields in conformance-tested payloads (the extensions point is forbidden for Provider certification).",
    constrains: [
      "case:1.1:doc:cfdocument/extensions",
      "case:1.1:doc:cfitem/extensions",
      "case:1.1:doc:cfassociation/extensions",
    ],
    source: "CASE 1.1 Cert §Service Provider (no extension fields) — https://www.imsglobal.org/spec/case/v1p1/cert/",
  },
  {
    key: "case:1.1:conf:consumer/CASE-CONS-1",
    profile: "consumer",
    reqId: "CASE-CONS-1",
    level: "MUST",
    statement:
      "A Service Consumer MUST persistently store ('handle') every REQUIRED data field it receives and be able to recover it on retrieval.",
    constrains: [
      "case:1.1:doc:cfdocument/identifier",
      "case:1.1:doc:cfdocument/title",
      "case:1.1:doc:cfitem/identifier",
      "case:1.1:doc:cfitem/fullStatement",
      "case:1.1:doc:cfassociation/associationType",
      "case:1.1:doc:cfassociation/originNodeURI",
      "case:1.1:doc:cfassociation/destinationNodeURI",
    ],
    source: "CASE 1.1 Cert §Service Consumer (handle required fields) — https://www.imsglobal.org/spec/case/v1p1/cert/",
  },
  {
    key: "case:1.1:conf:consumer/CASE-CONS-2",
    profile: "consumer",
    reqId: "CASE-CONS-2",
    level: "MUST",
    statement: "A Service Consumer MUST tolerate the presence of extension data fields without failing the import.",
    constrains: [
      "case:1.1:doc:cfitem/extensions",
      "case:1.1:doc:cfdocument/extensions",
      "case:1.1:doc:cfassociation/extensions",
    ],
    source: "CASE 1.1 Cert §Service Consumer (tolerate extensions) — https://www.imsglobal.org/spec/case/v1p1/cert/",
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
