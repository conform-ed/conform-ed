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
 * Conformance seed — grounded slices of QTI 2.1 normative rules across the document
 * family, each cross-linked to the literal L1 item it constrains (keys are source-scoped
 * because this is a multi-file map; `identifier`/`title` arrive via attribute groups).
 * Requirement ids synthesised; full extraction from the published 1EdTech QTI 2.1
 * conformance guide is the next hand-curation increment.
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
