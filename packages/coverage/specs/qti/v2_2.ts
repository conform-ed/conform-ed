/**
 * QTI 2.2 (Question & Test Interoperability) — {@link SpecSource} (conform-ed ADR-0013;
 * emergent ADR-0028 rollout). The third XSD-family QTI map, alongside {@link qtiV2_1}
 * and {@link qtiV3_0_1}.
 *
 * Spans the QTI 2.2 document family: the ASI core (`imsqti_v2p2p4.xsd` — assessmentItem /
 * Test / Section / Stimulus), Results Reporting (`imsqti_result_v2p2`), Usage Data
 * (`imsqti_usagedata_v2p2`), item metadata (`imsqti_metadata_v2p2`), the content-package
 * manifest (`qtiv2p2_imscpv1p2_v1p0`), Curriculum Standards Metadata (`qtiv2p2_csm_v2p2`),
 * and the APIP accessibility extension (`apipv1p0_qtiextv2p2_v1p0p1`). Each schema's
 * `xs:import`s are foreign vocab (XML/XInclude/MathML2&3/APIP/HTML5/SSML), recorded as
 * opaque external references.
 *
 * Multi-file map, so `def:`s are scoped by source schema (the ASI and aux schemas reuse
 * type names for structurally-distinct types). QTI 2.x declares every child as
 * `<xs:element ref="…">` (modular style); the walker resolves each ref to the global
 * element's named type to continue the descent. {@link normalizeQtiName} canonicalises
 * the singular(XML)↔plural(Zod) array naming for the L2 join.
 */

import { join } from "node:path";

import {
  QtiApipAccessibilitySchema,
  QtiAssessmentItemSchema,
  QtiAssessmentResultSchema,
  QtiAssessmentSectionSchema,
  QtiAssessmentStimulusSchema,
  QtiAssessmentTestSchema,
  QtiCurriculumStandardsMetadataSetSchema,
  QtiManifestSchema,
  QtiMetadataSchema,
  QtiUsageDataSchema,
} from "@conform-ed/contracts/qti/v2_2";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";
import { SIMPLE_CONTENT_VALUE, XS_ANY_EXTENSIONS } from "../xsd-normalisations";
import { normalizeQtiName } from "./v3_0_1";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "qti", "v2_2", file);
const asi = "imsqti_v2p2p4"; // ASI source-token prefix for cross-file-scoped def keys

/**
 * Conformance catalogue — curated from the published 1EdTech QTI 2.2 Information Model /
 * implementation guide, in lockstep with QTI 2.1's catalogue (same ASI structure), grouped by
 * the surface each rule governs: `item`, `response-declaration`, `outcome-declaration`, `test`,
 * `section`, `response-processing`, and the Results-Reporting `results` rule. Each is
 * cross-linked to the source-scoped literal L1 item it constrains (`identifier`/`title`/… arrive
 * via attribute groups; 2.2 uses the `DType` complexType suffix). This is the cert-aligned MUST
 * checklist; the literal ASI inventory is the map's L1.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "qti:2.2:conf:item/QTI22-ITEM-1",
    profile: "item",
    reqId: "QTI22-ITEM-1",
    level: "MUST",
    statement: "An assessmentItem MUST declare a unique identifier and a human-readable title.",
    constrains: [
      `qti:2.2:def:${asi}.identifier.AssessmentItem.Attr/identifier`,
      `qti:2.2:def:${asi}.title.AssessmentItem.Attr/title`,
    ],
    source: "QTI 2.2 §assessmentItem — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:item/QTI22-ITEM-2",
    profile: "item",
    reqId: "QTI22-ITEM-2",
    level: "MUST",
    statement: "An assessmentItem MUST contain exactly one itemBody holding the candidate-facing content.",
    constrains: [`qti:2.2:def:${asi}.AssessmentItemDType/itemBody`],
    source: "QTI 2.2 §itemBody — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:item/QTI22-ITEM-3",
    profile: "item",
    reqId: "QTI22-ITEM-3",
    level: "MUST",
    statement: "An assessmentItem MUST carry the timeDependent attribute and declare whether it is adaptive.",
    constrains: [
      `qti:2.2:def:${asi}.timeDependent.AssessmentItem.Attr/timeDependent`,
      `qti:2.2:def:${asi}.adaptive.AssessmentItem.Attr/adaptive`,
    ],
    source:
      "QTI 2.2 §assessmentItem (timeDependent/adaptive) — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:item/QTI22-ITEM-4",
    profile: "item",
    reqId: "QTI22-ITEM-4",
    level: "MUST",
    statement:
      "A scored assessmentItem MUST declare its response variable(s) via responseDeclaration and carry responseProcessing to score them.",
    constrains: [
      `qti:2.2:def:${asi}.AssessmentItemDType/responseDeclaration`,
      `qti:2.2:def:${asi}.AssessmentItemDType/responseProcessing`,
    ],
    source:
      "QTI 2.2 §responseDeclaration / §responseProcessing — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:response-declaration/QTI22-RD-1",
    profile: "response-declaration",
    reqId: "QTI22-RD-1",
    level: "MUST",
    statement:
      "A responseDeclaration MUST declare an identifier, a cardinality (single / multiple / ordered / record) and a baseType.",
    constrains: [
      `qti:2.2:def:${asi}.identifier.ResponseDeclaration.Attr/identifier`,
      `qti:2.2:def:${asi}.cardinality.ResponseDeclaration.Attr/cardinality`,
      `qti:2.2:def:${asi}.baseType.ResponseDeclaration.Attr/baseType`,
    ],
    source: "QTI 2.2 §responseDeclaration — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:outcome-declaration/QTI22-OD-1",
    profile: "outcome-declaration",
    reqId: "QTI22-OD-1",
    level: "MUST",
    statement: "An outcomeDeclaration MUST declare an identifier under which its computed value is stored.",
    constrains: [`qti:2.2:def:${asi}.identifier.OutcomeDeclaration.Attr/identifier`],
    source: "QTI 2.2 §outcomeDeclaration — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:test/QTI22-TEST-1",
    profile: "test",
    reqId: "QTI22-TEST-1",
    level: "MUST",
    statement: "An assessmentTest MUST declare an identifier and contain at least one testPart.",
    constrains: [
      `qti:2.2:def:${asi}.identifier.AssessmentTest.Attr/identifier`,
      `qti:2.2:def:${asi}.AssessmentTestDType/testPart`,
    ],
    source: "QTI 2.2 §assessmentTest — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:test/QTI22-TEST-2",
    profile: "test",
    reqId: "QTI22-TEST-2",
    level: "MUST",
    statement: "A testPart MUST contain at least one assessmentSection organising the items it delivers.",
    constrains: [`qti:2.2:def:${asi}.TestPartDType/assessmentSection`],
    source: "QTI 2.2 §testPart — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:section/QTI22-SEC-1",
    profile: "section",
    reqId: "QTI22-SEC-1",
    level: "MUST",
    statement: "An assessmentSection MUST declare an identifier for the grouping it represents.",
    constrains: [`qti:2.2:def:${asi}.identifier.AssessmentSection.Attr/identifier`],
    source: "QTI 2.2 §assessmentSection — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:response-processing/QTI22-RP-1",
    profile: "response-processing",
    reqId: "QTI22-RP-1",
    level: "MUST",
    statement:
      "A responseProcessing block MUST either reference a standard processing template (via its template attribute) or carry custom processing rules.",
    constrains: [`qti:2.2:def:${asi}.template.ResponseProcessing.Attr/template`],
    source: "QTI 2.2 §responseProcessing — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:results/QTI22-RES-1",
    profile: "results",
    reqId: "QTI22-RES-1",
    level: "MUST",
    statement: "An assessmentResult MUST carry the context identifying the candidate session it reports on.",
    constrains: ["qti:2.2:def:imsqti_result_v2p2.AssessmentResult.Type/context"],
    source:
      "QTI 2.2 Results Reporting §assessmentResult — https://www.imsglobal.org/question/qtiv2p2/imsqti_resultv2p2.html",
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

export const qtiV2_2: SpecSource = {
  spec: "qti",
  version: "2.2",
  nameNormalizer: normalizeQtiName,
  // Multi-file map: scope `def:`s by source schema (ASI + result / usagedata / metadata /
  // content-package / CSM / APIP schemas reuse type names for distinct types).
  scopeXsdDefsBySource: true,
  // As QTI 2.1: only the unnamed-construct renames; the 2.x model names no `xmlBase`, so the
  // literal `/base` items stay genuine silent gaps.
  specRefOverrides: [XS_ANY_EXTENSIONS, SIMPLE_CONTENT_VALUE],
  bindings: [
    xsd("assessmentItem", "imsqti_v2p2p4", QtiAssessmentItemSchema),
    xsd("assessmentTest", "imsqti_v2p2p4", QtiAssessmentTestSchema),
    xsd("assessmentSection", "imsqti_v2p2p4", QtiAssessmentSectionSchema),
    xsd("assessmentStimulus", "imsqti_v2p2p4", QtiAssessmentStimulusSchema),
    xsd("assessmentResult", "imsqti_result_v2p2", QtiAssessmentResultSchema),
    xsd("usageData", "imsqti_usagedata_v2p2", QtiUsageDataSchema),
    xsd("qtiMetadata", "imsqti_metadata_v2p2", QtiMetadataSchema),
    xsd("manifest", "qtiv2p2_imscpv1p2_v1p0", QtiManifestSchema),
    xsd("curriculumStandardsMetadataSet", "qtiv2p2_csm_v2p2", QtiCurriculumStandardsMetadataSetSchema),
    xsd("apipAccessibility", "apipv1p0_qtiextv2p2_v1p0p1", QtiApipAccessibilitySchema),
  ],
  conformance,
};
