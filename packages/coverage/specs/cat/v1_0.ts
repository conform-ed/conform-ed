/**
 * CAT 1.0 (1EdTech Computerized Adaptive Testing service) — {@link SpecSource} (conform-ed
 * ADR-0013; curated denominator + value-set extension from ADR-0017).
 *
 * CAT 1.0 is a **prose** specification: the adaptive-delivery REST service is published as an
 * implementation guide (prose + JSON examples), with no machine-readable schema (no OpenAPI). So
 * — the ADR-0017 case — the denominators are hand-authored JSON Schemas under
 * `vendor/cat/v1_0/curated/`, walked by `walkers/curated.ts` under its provenance gate and
 * reconciled against the `CatV1_0` Zod contracts. The CAT **information model** is modelled as
 * five entity documents:
 *
 *  - `SectionData` — the adaptive section configuration (item pool + selection constraints) the
 *    platform sends the engine.
 *  - `ItemStage` — the next set of items the engine selects for the candidate.
 *  - `AssessmentResult` — the candidate responses + item outcomes the platform submits.
 *  - `CatEngineResultReport` — the engine's ability estimate, score, recommendation and next stage.
 *  - `SessionInfo` — the delivery session state.
 *
 * The CAT **transport surface** — the six REST operations (create/get section, create session,
 * submit results, end session, end section) — is captured by the conformance catalogue: CAT
 * publishes no OpenAPI, so (like the LTI map's service operations) each operation is a requirement
 * that `constrains` the data-model items its request/response payload carries, rather than a
 * walked transport axis. The thin request/response envelopes (e.g. SubmitResultsRequest wraps an
 * AssessmentResult, SubmitResultsResponse is a CatEngineResultReport) are those payloads.
 *
 * Same JSON binding on both sides, so the L2 name-join needs no `nameNormalizer`, alias or
 * override. The three CAT controlled vocabularies (the outcome-variable type, the cardinality and
 * the assessment-result status) are verified as **value-sets** against conform-ed's extensible
 * enums — the structural join matches property names, never the enumerated values. The engine
 * internals (item-selection algorithm, IRT calibration) are a deliberate black box and the
 * record-typed extension points (itemMetadata, customParameters, diagnosticData) are open.
 */

import { join } from "node:path";

import { CatV1_0 } from "@conform-ed/contracts/cat/v1_0";

import type { SpecBindingSource, SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "cat", "v1_0", file);

const binding = (name: string, file: string, zod: SpecBindingSource["zod"]): SpecBindingSource => ({
  binding: name,
  schemaPath: vendor(`curated/${file}`),
  language: "curated",
  ...(zod !== undefined ? { zod } : {}),
});

/**
 * Conformance catalogue, curated from the 1EdTech CAT 1.0 implementation guide. CAT defines no
 * certification profiles, so requirements are grouped by surface — `section` (the adaptive
 * section model), `delivery` (item stages, results, the engine report, session state) and
 * `operations` (the six REST operations). The operation requirements `constrains` the data-model
 * items each request/response payload carries (CAT publishes no OpenAPI to walk as a transport
 * axis, so the operations are catalogued like the LTI service operations).
 */
const SPEC = "1EdTech CAT 1.0 Implementation — https://www.imsglobal.org/spec/cat/v1p0/impl/";

const conformance: readonly ConformanceRequirement[] = [
  {
    key: "cat:1.0:conf:section/CAT-SEC-1",
    profile: "section",
    reqId: "CAT-SEC-1",
    level: "MUST",
    statement:
      "A SectionData MUST carry the section identifiers, the section resource href, an item pool of available items, and a creation timestamp.",
    constrains: [
      "cat:1.0:doc:SectionData/sectionIdentifier",
      "cat:1.0:doc:SectionData/assessmentSectionId",
      "cat:1.0:doc:SectionData/sectionHref",
      "cat:1.0:doc:SectionData/itemPool",
      "cat:1.0:def:ItemPool/itemRefs",
      "cat:1.0:def:ItemRef/href",
    ],
    source: SPEC,
  },
  {
    key: "cat:1.0:conf:section/CAT-SEC-2",
    profile: "section",
    reqId: "CAT-SEC-2",
    level: "MUST",
    statement: "Each item-selection constraint MUST declare its type; constraint parameters are constraint-specific.",
    constrains: ["cat:1.0:def:CatConstraint/type", "cat:1.0:def:CatConstraint/parameters"],
    source: SPEC,
  },
  {
    key: "cat:1.0:conf:delivery/CAT-DEL-1",
    profile: "delivery",
    reqId: "CAT-DEL-1",
    level: "MUST",
    statement: "An ItemStage MUST carry a stageId, the items to present, and the owning assessmentSectionId.",
    constrains: [
      "cat:1.0:doc:ItemStage/stageId",
      "cat:1.0:doc:ItemStage/items",
      "cat:1.0:doc:ItemStage/assessmentSectionId",
    ],
    source: SPEC,
  },
  {
    key: "cat:1.0:conf:delivery/CAT-DEL-2",
    profile: "delivery",
    reqId: "CAT-DEL-2",
    level: "MUST",
    statement:
      "An AssessmentResult MUST identify the result and section, list the items attempted (with attempt number), and state whether continuation is required; it carries the candidate response and outcome variables.",
    constrains: [
      "cat:1.0:doc:AssessmentResult/resultId",
      "cat:1.0:doc:AssessmentResult/itemsAttempted",
      "cat:1.0:def:ItemAttempt/attemptNumber",
      "cat:1.0:doc:AssessmentResult/continuationRequired",
      "cat:1.0:def:ResponseVariable/identifier",
      "cat:1.0:def:OutcomeVariable/identifier",
    ],
    source: SPEC,
  },
  {
    key: "cat:1.0:conf:delivery/CAT-DEL-3",
    profile: "delivery",
    reqId: "CAT-DEL-3",
    level: "MUST",
    statement:
      "A CatEngineResultReport MUST carry a reportId, the section, and a recommendation (continue/finish/suspend/abandon); it MAY carry the ability estimate, section score, delivered outcomes and the next item stage.",
    constrains: [
      "cat:1.0:doc:CatEngineResultReport/reportId",
      "cat:1.0:doc:CatEngineResultReport/recommendation",
      "cat:1.0:doc:CatEngineResultReport/estimatedAbility",
      "cat:1.0:doc:CatEngineResultReport/nextStage",
    ],
    source: SPEC,
  },
  {
    key: "cat:1.0:conf:delivery/CAT-DEL-4",
    profile: "delivery",
    reqId: "CAT-DEL-4",
    level: "MUST",
    statement:
      "An outcome/response variable MUST declare its cardinality (single/multiple/ordered/record) and base type; the SessionInfo status MUST be a value of the assessment-result status vocabulary.",
    // Anchored to the ADR-0017 value-set denominators.
    constrains: [
      "cat:1.0:def:OutcomeVariable/cardinality",
      "cat:1.0:def:OutcomeVariable/baseType",
      "cat:1.0:doc:SessionInfo/status",
    ],
    source: SPEC,
  },
  {
    key: "cat:1.0:conf:operations/CAT-OP-1",
    profile: "operations",
    reqId: "CAT-OP-1",
    level: "MUST",
    statement:
      "A CAT engine MUST expose section management: create an adaptive section (POST /sections, from SectionData) and retrieve it (GET /sections/:id).",
    constrains: ["cat:1.0:doc:SectionData", "cat:1.0:doc:SectionData/itemPool"],
    source: SPEC,
  },
  {
    key: "cat:1.0:conf:operations/CAT-OP-2",
    profile: "operations",
    reqId: "CAT-OP-2",
    level: "MUST",
    statement:
      "A CAT engine MUST support the adaptive cycle: create a session (POST /sessions), submit results to receive the next stage (POST /sessions/:id/results — AssessmentResult in, CatEngineResultReport out), and end the session (POST /sessions/:id/end) and section (POST /sections/:id/end).",
    constrains: [
      "cat:1.0:doc:SessionInfo/sessionId",
      "cat:1.0:doc:AssessmentResult",
      "cat:1.0:doc:CatEngineResultReport",
      "cat:1.0:doc:CatEngineResultReport/nextStage",
    ],
    source: SPEC,
  },
];

export const catV1_0: SpecSource = {
  spec: "cat",
  version: "1.0",
  bindings: [
    binding("SectionData", "section-data.schema.json", CatV1_0.Schemas.SectionData),
    binding("ItemStage", "item-stage.schema.json", CatV1_0.Schemas.ItemStage),
    binding("AssessmentResult", "assessment-result.schema.json", CatV1_0.Schemas.AssessmentResult),
    binding("CatEngineResultReport", "cat-engine-result-report.schema.json", CatV1_0.Schemas.CatEngineResultReport),
    binding("SessionInfo", "session-info.schema.json", CatV1_0.Schemas.SessionInfo),
  ],
  // Value-set verification (ADR-0017): the three CAT controlled vocabularies (the outcome-variable
  // type, the QTI cardinality, and the assessment-result status), each safeParse'd member-by-member
  // against conform-ed's extensible enum. extensibleEnum also admits ext:* values, so every
  // published member is accepted (0 gaps) — the check confirms conform-ed recognises the full
  // published vocabulary.
  valueSets: [
    { item: "cat:1.0:def:OutcomeVariable/baseType", element: CatV1_0.Shared.OutcomeVariableType },
    { item: "cat:1.0:def:OutcomeVariable/cardinality", element: CatV1_0.Shared.OutcomeCardinality },
    { item: "cat:1.0:doc:SessionInfo/status", element: CatV1_0.Shared.AssessmentResultType },
  ],
  conformance,
};
