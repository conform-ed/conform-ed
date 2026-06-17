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
 * Conformance seed — grounded slices of QTI 2.2 normative rules across the document
 * family, each cross-linked to the source-scoped literal L1 item it constrains
 * (`identifier`/`title` arrive via attribute groups; 2.2 uses the `DType` complexType
 * suffix). Requirement ids synthesised; full extraction from the published 1EdTech QTI
 * 2.2 conformance guide is the next hand-curation increment.
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
