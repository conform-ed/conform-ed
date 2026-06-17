/**
 * OneRoster 1.2 — {@link SpecSource} (conform-ed ADR-0013; emergent ADR-0028 rollout).
 * The OpenAPI-family map: the literal denominator is the trio of published OpenAPI 3
 * service documents, whose information model is each doc's `components.schemas` (walked
 * by `src/walkers/openapi.ts`). One `or:1.2` map spans all three OneRoster services —
 * Rostering, Gradebook and Resources — with bindings + conformance tagged by profile.
 *
 * Each service entity's component schema maps to conform-ed's matching Zod root; both
 * sides use the same JSON property names, so no name-normalisation is needed. Shared
 * base components (`imsx_StatusInfoDType`, `MetadataDType`, the `*GUIDRefDType`s)
 * recur across the three docs; `dedupeInventory` keeps the first occurrence (the bodies
 * are identical), exactly as for QTI's shared-file ASI roots.
 *
 * The vendored docs are the literal denominators, fetched from
 * `purl.imsglobal.org/spec/or/v1p2/schema/openapi/`.
 */

import { join } from "node:path";

import {
  AcademicSessionSchema,
  AssessmentLineItemSchema,
  AssessmentResultSchema,
  CategorySchema,
  ClassSchema,
  CourseSchema,
  DemographicsSchema,
  EnrollmentSchema,
  LearningObjectiveSetSchema,
  LineItemSchema,
  OrgSchema,
  ResourceSchema,
  ResultSchema,
  ScoreScaleSchema,
  UserSchema,
} from "@conform-ed/contracts/oneroster/v1_2";

import type { SpecBindingSource, SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const rostering = "onerosterv1p2rostersservice_openapi3_v1p0.json";
const gradebook = "onerosterv1p2gradebookservice_openapi3_v1p0.json";
const resources = "onerosterv1p2resourcesservice_openapi3_v1p0.json";
const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "oneroster", "v1_2", file);

/** binding (the OpenAPI component schema name) in `service` → its conform-ed Zod root. */
const binding = (component: string, service: string, zod: SpecBindingSource["zod"]): SpecBindingSource => ({
  binding: component,
  schemaPath: vendor(service),
  language: "openapi",
  ...(zod !== undefined ? { zod } : {}),
});

/**
 * Conformance seed — a grounded slice of OneRoster 1.2 normative rules across the three
 * services, cross-linked to the literal L1 items they constrain. Requirement ids
 * synthesised (`OR-n`); full extraction from the published 1EdTech OneRoster 1.2
 * conformance & certification guide is the next hand-curation increment.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "or:1.2:conf:rostering/OR-1",
    profile: "rostering",
    reqId: "OR-1",
    level: "MUST",
    statement: "Every OneRoster object MUST carry a sourcedId (its stable GUID) and a status (active / tobedeleted).",
    constrains: ["or:1.2:def:UserDType/sourcedId", "or:1.2:def:UserDType/status"],
    source: "OneRoster 1.2 §Base / GUIDRef — https://www.imsglobal.org/spec/oneroster/v1p2",
  },
  {
    key: "or:1.2:conf:rostering/OR-2",
    profile: "rostering",
    reqId: "OR-2",
    level: "MUST",
    statement: "A User MUST declare at least one role binding the user to an organization.",
    constrains: ["or:1.2:def:UserDType/roles"],
    source: "OneRoster 1.2 §User / Role — https://www.imsglobal.org/spec/oneroster/v1p2",
  },
  {
    key: "or:1.2:conf:gradebook/OR-GB-1",
    profile: "gradebook",
    reqId: "OR-GB-1",
    level: "MUST",
    statement: "A LineItem MUST reference the class it scores and the academic session it falls within.",
    constrains: ["or:1.2:def:LineItemDType/class", "or:1.2:def:LineItemDType/academicSession"],
    source: "OneRoster 1.2 Gradebook §LineItem — https://www.imsglobal.org/spec/oneroster/v1p2",
  },
  {
    key: "or:1.2:conf:gradebook/OR-GB-2",
    profile: "gradebook",
    reqId: "OR-GB-2",
    level: "MUST",
    statement:
      "A Result MUST reference the LineItem it scores and the student it belongs to, and carry a score status.",
    constrains: [
      "or:1.2:def:ResultDType/lineItem",
      "or:1.2:def:ResultDType/student",
      "or:1.2:def:ResultDType/scoreStatus",
    ],
    source: "OneRoster 1.2 Gradebook §Result — https://www.imsglobal.org/spec/oneroster/v1p2",
  },
  {
    key: "or:1.2:conf:resources/OR-RES-1",
    profile: "resources",
    reqId: "OR-RES-1",
    level: "MUST",
    statement: "A Resource MUST carry a title and a vendorResourceId identifying it within the providing vendor.",
    constrains: ["or:1.2:def:ResourceDType/title", "or:1.2:def:ResourceDType/vendorResourceId"],
    source: "OneRoster 1.2 Resources §Resource — https://www.imsglobal.org/spec/oneroster/v1p2",
  },
];

export const oneRosterV1_2: SpecSource = {
  spec: "or",
  version: "1.2",
  bindings: [
    // Rostering service
    binding("UserDType", rostering, UserSchema),
    binding("OrgDType", rostering, OrgSchema),
    binding("CourseDType", rostering, CourseSchema),
    binding("ClassDType", rostering, ClassSchema),
    binding("EnrollmentDType", rostering, EnrollmentSchema),
    binding("AcademicSessionDType", rostering, AcademicSessionSchema),
    binding("DemographicsDType", rostering, DemographicsSchema),
    // Gradebook service
    binding("LineItemDType", gradebook, LineItemSchema),
    binding("ResultDType", gradebook, ResultSchema),
    binding("CategoryDType", gradebook, CategorySchema),
    binding("ScoreScaleDType", gradebook, ScoreScaleSchema),
    binding("AssessmentLineItemDType", gradebook, AssessmentLineItemSchema),
    binding("AssessmentResultDType", gradebook, AssessmentResultSchema),
    binding("LearningObjectiveSetDType", gradebook, LearningObjectiveSetSchema),
    // Resources service
    binding("ResourceDType", resources, ResourceSchema),
  ],
  conformance,
};
