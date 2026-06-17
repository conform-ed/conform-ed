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
 * Conformance catalogue — curated from the published 1EdTech OneRoster 1.2 Conformance &
 * Certification guide (https://www.imsglobal.org/spec/oneroster/v1p2/cert/), which has no
 * machine source. OneRoster certifies by operational MODE, used here as profiles: `rostering`
 * (the base service — orgs/users/classes/courses/enrollments/academic sessions), `gradebook`
 * (categories/line items/results/score scales), `resources`, and `assessment-results` (the
 * OR 1.2 addition). Every other mode requires rostering.
 *
 * Scope vs this map's denominator: L1 is the **information model** (the OpenAPI
 * `components.schemas` entity types across all three service documents), so the per-entity
 * DATA-MODEL requirements are curated and cross-linked here — every object MUST carry a stable
 * sourcedId, a status, and a dateLastModified (the last underpins delta sync), plus the
 * references that bind the graph together. The REST/CSV **transport** conformance (the
 * required GET/PUT endpoints per service, OAuth 2.0 Client Credentials, OpenAPI discovery, and
 * the mandatory pagination / filtering / sorting / field-selection query mechanisms — guide §3
 * and §4) is a separate surface with no L1 entity item in this map; it would be modelled by
 * walking the OpenAPI *paths* (not done here) and is intentionally out of this catalogue.
 * Requirement ids follow the spec's per-service scheme. Where a requirement constrains an item
 * whose schema also embeds the rule, its `constrains` includes that item so
 * `normativeStatementsCited` reflects the overlap.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "or:1.2:conf:rostering/OR-1",
    profile: "rostering",
    reqId: "OR-1",
    level: "MUST",
    statement:
      "Every rostering object MUST carry a stable sourcedId and a status (active / tobedeleted), and a dateLastModified — the watermark a delta exchange reconciles against.",
    constrains: [
      "or:1.2:def:OrgDType/sourcedId",
      "or:1.2:def:OrgDType/status",
      "or:1.2:def:OrgDType/dateLastModified",
      "or:1.2:def:UserDType/sourcedId",
      "or:1.2:def:UserDType/status",
      "or:1.2:def:UserDType/dateLastModified",
      "or:1.2:def:ClassDType/sourcedId",
      "or:1.2:def:ClassDType/status",
      "or:1.2:def:ClassDType/dateLastModified",
      "or:1.2:def:CourseDType/sourcedId",
      "or:1.2:def:CourseDType/status",
      "or:1.2:def:CourseDType/dateLastModified",
      "or:1.2:def:EnrollmentDType/sourcedId",
      "or:1.2:def:EnrollmentDType/status",
      "or:1.2:def:EnrollmentDType/dateLastModified",
      "or:1.2:def:AcademicSessionDType/sourcedId",
      "or:1.2:def:AcademicSessionDType/status",
      "or:1.2:def:AcademicSessionDType/dateLastModified",
    ],
    source:
      "OneRoster 1.2 Cert §4 (REST) / §3 (CSV) — Base entity — https://www.imsglobal.org/spec/oneroster/v1p2/cert/",
  },
  {
    key: "or:1.2:conf:rostering/OR-2",
    profile: "rostering",
    reqId: "OR-2",
    level: "MUST",
    statement:
      "A User MUST declare at least one role binding the user to an organization, each role carrying a roleType.",
    constrains: [
      "or:1.2:def:UserDType/roles",
      "or:1.2:def:RoleDType/role",
      "or:1.2:def:RoleDType/roleType",
      "or:1.2:def:RoleDType/org",
    ],
    source: "OneRoster 1.2 §User / Role — https://www.imsglobal.org/spec/oneroster/v1p2",
  },
  {
    key: "or:1.2:conf:rostering/OR-3",
    profile: "rostering",
    reqId: "OR-3",
    level: "MUST",
    statement:
      "An Enrollment MUST reference the user it enrols and the class it enrols them into, and declare the enrolment role.",
    constrains: [
      "or:1.2:def:EnrollmentDType/user",
      "or:1.2:def:EnrollmentDType/class",
      "or:1.2:def:EnrollmentDType/role",
    ],
    source: "OneRoster 1.2 §Enrollment — https://www.imsglobal.org/spec/oneroster/v1p2",
  },
  {
    key: "or:1.2:conf:rostering/OR-4",
    profile: "rostering",
    reqId: "OR-4",
    level: "MUST",
    statement: "A Class MUST reference the course it instantiates and the school (org) that offers it.",
    constrains: ["or:1.2:def:ClassDType/course", "or:1.2:def:ClassDType/school"],
    source: "OneRoster 1.2 §Class — https://www.imsglobal.org/spec/oneroster/v1p2",
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
    key: "or:1.2:conf:gradebook/OR-GB-3",
    profile: "gradebook",
    reqId: "OR-GB-3",
    level: "MUST",
    statement:
      "Every gradebook object (LineItem, Result, Category, ScoreScale) MUST carry a sourcedId, a status and a dateLastModified.",
    constrains: [
      "or:1.2:def:LineItemDType/sourcedId",
      "or:1.2:def:LineItemDType/status",
      "or:1.2:def:LineItemDType/dateLastModified",
      "or:1.2:def:ResultDType/sourcedId",
      "or:1.2:def:ResultDType/status",
      "or:1.2:def:ResultDType/dateLastModified",
      "or:1.2:def:CategoryDType/sourcedId",
      "or:1.2:def:CategoryDType/status",
      "or:1.2:def:ScoreScaleDType/sourcedId",
      "or:1.2:def:ScoreScaleDType/status",
    ],
    source: "OneRoster 1.2 Cert §4.1.2 (Gradebook entities) — https://www.imsglobal.org/spec/oneroster/v1p2/cert/",
  },
  {
    key: "or:1.2:conf:gradebook/OR-GB-4",
    profile: "gradebook",
    reqId: "OR-GB-4",
    level: "MUST",
    statement: "A Result MUST carry the score value (or its scoreStatus rationale) and the date it was recorded.",
    constrains: [
      "or:1.2:def:ResultDType/score",
      "or:1.2:def:ResultDType/scoreDate",
      "or:1.2:def:ResultDType/scoreStatus",
    ],
    source: "OneRoster 1.2 Gradebook §Result (score/scoreDate) — https://www.imsglobal.org/spec/oneroster/v1p2",
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
  {
    key: "or:1.2:conf:resources/OR-RES-2",
    profile: "resources",
    reqId: "OR-RES-2",
    level: "MUST",
    statement: "A Resource MUST carry a sourcedId, a status and a dateLastModified like every other OneRoster object.",
    constrains: [
      "or:1.2:def:ResourceDType/sourcedId",
      "or:1.2:def:ResourceDType/status",
      "or:1.2:def:ResourceDType/dateLastModified",
    ],
    source: "OneRoster 1.2 Cert §4.1.4 (Resources) — https://www.imsglobal.org/spec/oneroster/v1p2/cert/",
  },
  {
    key: "or:1.2:conf:assessment-results/OR-AR-1",
    profile: "assessment-results",
    reqId: "OR-AR-1",
    level: "MUST",
    statement:
      "Every assessment-results object (AssessmentLineItem, AssessmentResult) MUST carry a sourcedId, a status and a dateLastModified.",
    constrains: [
      "or:1.2:def:AssessmentLineItemDType/sourcedId",
      "or:1.2:def:AssessmentLineItemDType/status",
      "or:1.2:def:AssessmentLineItemDType/dateLastModified",
      "or:1.2:def:AssessmentResultDType/sourcedId",
      "or:1.2:def:AssessmentResultDType/status",
      "or:1.2:def:AssessmentResultDType/dateLastModified",
    ],
    source:
      "OneRoster 1.2 Cert §4.1.3 (Assessment Results — OR 1.2) — https://www.imsglobal.org/spec/oneroster/v1p2/cert/",
  },
  {
    key: "or:1.2:conf:assessment-results/OR-AR-2",
    profile: "assessment-results",
    reqId: "OR-AR-2",
    level: "MUST",
    statement:
      "An AssessmentResult MUST reference its AssessmentLineItem and the student it scores, and carry a score status.",
    constrains: [
      "or:1.2:def:AssessmentResultDType/assessmentLineItem",
      "or:1.2:def:AssessmentResultDType/student",
      "or:1.2:def:AssessmentResultDType/scoreStatus",
    ],
    source: "OneRoster 1.2 §AssessmentResult — https://www.imsglobal.org/spec/oneroster/v1p2",
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
