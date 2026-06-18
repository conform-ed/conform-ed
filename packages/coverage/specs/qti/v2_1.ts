/**
 * QTI 2.1 (Question & Test Interoperability) — {@link SpecSource} (conform-ed ADR-0013;
 * emergent ADR-0028 rollout). The second XSD-family QTI map, alongside {@link qtiV3_0_1}.
 *
 * Spans the QTI 2.1 document family across several vendored schemas: the ASI core
 * (`imsqti_v2p1p2.xsd` — assessmentItem / assessmentTest / assessmentSection), Results
 * Reporting (`imsqti_result_v2p1` assessmentResult), Usage Data (`imsqti_usagedata_v2p1`),
 * item metadata (`imsqti_metadata_v2p1` qtiMetadata), the content-package manifest
 * (`qtiv2p1_imscpv1p2_v1p0`), and the APIP accessibility extension
 * (`apipv1p0_qtiextv2p1_v1p0` apipAccessibility). Each schema's `xs:import`s are foreign
 * vocab (XML/XInclude/MathML2/APIP), recorded as opaque external references.
 *
 * Multi-file map, so `def:`s are scoped by source schema: the ASI and the aux schemas
 * reuse type names (`Value.Type`, `Mapping.Type`, `CorrectResponse.Type`, …) for
 * structurally-distinct types. {@link normalizeQtiName} canonicalises the singular(XML)
 * ↔ plural(Zod) array naming for the L2 join (its leading-`qti-` strip is a no-op — 2.x
 * is already camelCase).
 */

import { join } from "node:path";

import {
  QtiApipAccessibilitySchema,
  QtiAssessmentItemSchema,
  QtiAssessmentResultSchema,
  QtiAssessmentSectionSchema,
  QtiAssessmentTestSchema,
  QtiManifestSchema,
  QtiMetadataSchema,
  QtiUsageDataSchema,
} from "@conform-ed/contracts/qti/v2_1";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";
import { SIMPLE_CONTENT_VALUE, XS_ANY_EXTENSIONS } from "../xsd-normalisations";
import { normalizeQtiName } from "./v3_0_1";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "qti", "v2_1", file);
const asi = "imsqti_v2p1p2"; // ASI source-token prefix for cross-file-scoped def keys

/**
 * Conformance catalogue — curated from the published 1EdTech QTI 2.1 Information Model /
 * implementation guide, grouped by the ASI surface each rule governs: `item`,
 * `response-declaration`, `outcome-declaration`, `test`, `section`, `response-processing`,
 * and the Results-Reporting `results` rule. Each is cross-linked to the literal L1 item it
 * constrains; keys are source-scoped (multi-file map) and the item attributes arrive via
 * attribute groups (`identifier`/`title`/`timeDependent`/… `.AssessmentItem.Attr`). This is
 * the cert-aligned MUST checklist; the literal ASI inventory is the map's L1.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "qti:2.1:conf:item/QTI21-ITEM-1",
    profile: "item",
    reqId: "QTI21-ITEM-1",
    level: "MUST",
    statement: "An assessmentItem MUST declare a unique identifier and a human-readable title.",
    constrains: [
      `qti:2.1:def:${asi}.identifier.AssessmentItem.Attr/identifier`,
      `qti:2.1:def:${asi}.title.AssessmentItem.Attr/title`,
    ],
    source: "QTI 2.1 §assessmentItem — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:item/QTI21-ITEM-2",
    profile: "item",
    reqId: "QTI21-ITEM-2",
    level: "MUST",
    statement: "An assessmentItem MUST contain exactly one itemBody holding the candidate-facing content.",
    constrains: [`qti:2.1:def:${asi}.AssessmentItem.Type/itemBody`],
    source: "QTI 2.1 §itemBody — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:item/QTI21-ITEM-3",
    profile: "item",
    reqId: "QTI21-ITEM-3",
    level: "MUST",
    statement: "An assessmentItem MUST carry the timeDependent attribute and declare whether it is adaptive.",
    constrains: [
      `qti:2.1:def:${asi}.timeDependent.AssessmentItem.Attr/timeDependent`,
      `qti:2.1:def:${asi}.adaptive.AssessmentItem.Attr/adaptive`,
    ],
    source:
      "QTI 2.1 §assessmentItem (timeDependent/adaptive) — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:item/QTI21-ITEM-4",
    profile: "item",
    reqId: "QTI21-ITEM-4",
    level: "MUST",
    statement:
      "A scored assessmentItem MUST declare its response variable(s) via responseDeclaration and carry responseProcessing to score them.",
    constrains: [
      `qti:2.1:def:${asi}.AssessmentItem.Type/responseDeclaration`,
      `qti:2.1:def:${asi}.AssessmentItem.Type/responseProcessing`,
    ],
    source:
      "QTI 2.1 §responseDeclaration / §responseProcessing — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:response-declaration/QTI21-RD-1",
    profile: "response-declaration",
    reqId: "QTI21-RD-1",
    level: "MUST",
    statement:
      "A responseDeclaration MUST declare an identifier, a cardinality (single / multiple / ordered / record) and a baseType.",
    constrains: [
      `qti:2.1:def:${asi}.identifier.ResponseDeclaration.Attr/identifier`,
      `qti:2.1:def:${asi}.cardinality.ResponseDeclaration.Attr/cardinality`,
      `qti:2.1:def:${asi}.baseType.ResponseDeclaration.Attr/baseType`,
    ],
    source: "QTI 2.1 §responseDeclaration — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:outcome-declaration/QTI21-OD-1",
    profile: "outcome-declaration",
    reqId: "QTI21-OD-1",
    level: "MUST",
    statement: "An outcomeDeclaration MUST declare an identifier under which its computed value is stored.",
    constrains: [`qti:2.1:def:${asi}.identifier.OutcomeDeclaration.Attr/identifier`],
    source: "QTI 2.1 §outcomeDeclaration — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:test/QTI21-TEST-1",
    profile: "test",
    reqId: "QTI21-TEST-1",
    level: "MUST",
    statement: "An assessmentTest MUST declare an identifier and contain at least one testPart.",
    constrains: [
      `qti:2.1:def:${asi}.identifier.AssessmentTest.Attr/identifier`,
      `qti:2.1:def:${asi}.AssessmentTest.Type/testPart`,
    ],
    source: "QTI 2.1 §assessmentTest — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:test/QTI21-TEST-2",
    profile: "test",
    reqId: "QTI21-TEST-2",
    level: "MUST",
    statement: "A testPart MUST contain at least one assessmentSection organising the items it delivers.",
    constrains: [`qti:2.1:def:${asi}.TestPart.Type/assessmentSection`],
    source: "QTI 2.1 §testPart — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:section/QTI21-SEC-1",
    profile: "section",
    reqId: "QTI21-SEC-1",
    level: "MUST",
    statement: "An assessmentSection MUST declare an identifier for the grouping it represents.",
    constrains: [`qti:2.1:def:${asi}.identifier.AssessmentSection.Attr/identifier`],
    source: "QTI 2.1 §assessmentSection — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:response-processing/QTI21-RP-1",
    profile: "response-processing",
    reqId: "QTI21-RP-1",
    level: "MUST",
    statement:
      "A responseProcessing block MUST either reference a standard processing template (via its template attribute) or carry custom processing rules.",
    constrains: [`qti:2.1:def:${asi}.template.ResponseProcessing.Attr/template`],
    source: "QTI 2.1 §responseProcessing — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:results/QTI21-RES-1",
    profile: "results",
    reqId: "QTI21-RES-1",
    level: "MUST",
    statement: "An assessmentResult MUST carry the context identifying the candidate session it reports on.",
    constrains: ["qti:2.1:def:imsqti_result_v2p1.AssessmentResult.Type/context"],
    source:
      "QTI 2.1 Results Reporting §assessmentResult — https://www.imsglobal.org/question/qtiv2p1/imsqti_resultv2p1.html",
  },
];

const xsd = (
  binding: string,
  file: string,
  zod: SpecSource["bindings"][number]["zod"],
): SpecSource["bindings"][number] => ({
  binding,
  schemaPath: vendor(`${file}.xsd`),
  language: "xsd",
  ...(zod !== undefined ? { zod } : {}),
});

export const qtiV2_1: SpecSource = {
  spec: "qti",
  version: "2.1",
  nameNormalizer: normalizeQtiName,
  // Multi-file map: scope `def:`s by source schema so the ASI and the result / usagedata /
  // metadata / content-package / APIP schemas don't conflate their shared type names.
  scopeXsdDefsBySource: true,
  // Only the unnamed-construct renames: conform-ed names no `xmlBase` in the 2.x model, so
  // the literal `xml:base` (`/base`) items are genuine silent gaps and are NOT bridged.
  specRefOverrides: [XS_ANY_EXTENSIONS, SIMPLE_CONTENT_VALUE],
  bindings: [
    xsd("assessmentItem", "imsqti_v2p1p2", QtiAssessmentItemSchema),
    xsd("assessmentTest", "imsqti_v2p1p2", QtiAssessmentTestSchema),
    xsd("assessmentSection", "imsqti_v2p1p2", QtiAssessmentSectionSchema),
    xsd("assessmentResult", "imsqti_result_v2p1", QtiAssessmentResultSchema),
    xsd("usageData", "imsqti_usagedata_v2p1", QtiUsageDataSchema),
    xsd("qtiMetadata", "imsqti_metadata_v2p1", QtiMetadataSchema),
    xsd("manifest", "qtiv2p1_imscpv1p2_v1p0", QtiManifestSchema),
    xsd("apipAccessibility", "apipv1p0_qtiextv2p1_v1p0", QtiApipAccessibilitySchema),
  ],
  conformance,
};
