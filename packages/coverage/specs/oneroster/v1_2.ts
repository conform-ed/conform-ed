/**
 * OneRoster 1.2 (Rostering service) — {@link SpecSource} (conform-ed ADR-0013;
 * emergent ADR-0028 rollout). The OpenAPI-family pilot: the literal denominator is
 * the published OpenAPI 3 document, whose information model is `components.schemas`
 * (walked by `src/walkers/openapi.ts`). The seven core rostering entities map to
 * conform-ed's Zod roots; both sides use the same JSON property names, so no
 * name-normalisation is needed.
 *
 * The vendored `onerosterv1p2rostersservice_openapi3_v1p0.json` is the literal
 * denominator, fetched from `purl.imsglobal.org/spec/or/v1p2/schema/openapi/`.
 */

import { join } from "node:path";

import {
  AcademicSessionSchema,
  ClassSchema,
  CourseSchema,
  DemographicsSchema,
  EnrollmentSchema,
  OrgSchema,
  UserSchema,
} from "@conform-ed/contracts/oneroster/v1_2";

import type { SpecBindingSource, SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const rostering = "onerosterv1p2rostersservice_openapi3_v1p0.json";
const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "oneroster", "v1_2", file);

/** binding (the OpenAPI component schema name) → its conform-ed Zod root. */
const binding = (component: string, zod: SpecBindingSource["zod"]): SpecBindingSource => ({
  binding: component,
  schemaPath: vendor(rostering),
  language: "openapi",
  ...(zod !== undefined ? { zod } : {}),
});

/**
 * Conformance seed — a grounded slice of OneRoster 1.2 rostering normative rules,
 * cross-linked to the literal L1 items they constrain. Requirement ids synthesised
 * (`OR-n`); full extraction from the published 1EdTech OneRoster 1.2 conformance &
 * certification guide is the next hand-curation increment.
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
];

export const oneRosterV1_2: SpecSource = {
  spec: "or",
  version: "1.2",
  bindings: [
    binding("UserDType", UserSchema),
    binding("OrgDType", OrgSchema),
    binding("CourseDType", CourseSchema),
    binding("ClassDType", ClassSchema),
    binding("EnrollmentDType", EnrollmentSchema),
    binding("AcademicSessionDType", AcademicSessionSchema),
    binding("DemographicsDType", DemographicsSchema),
  ],
  conformance,
};
