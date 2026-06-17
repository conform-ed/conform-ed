/**
 * QTI 2.2 (Question & Test Interoperability — Assessment, Section & Item) —
 * {@link SpecSource} (conform-ed ADR-0013; emergent ADR-0028 rollout). The third
 * XSD-family QTI map, alongside {@link qtiV2_1} and {@link qtiV3_0_1}.
 *
 * The vendored `imsqti_v2p2p4.xsd` (the corrected v2.2.4 schema, targetNamespace
 * `http://www.imsglobal.org/xsd/imsqti_v2p2`) is the literal denominator (the XML
 * binding). Its `xs:import`s are foreign vocabularies (XML attributes, XInclude,
 * MathML 2 & 3, APIP, HTML5, SSML), recorded by the XSD walker as opaque external
 * references (no dangling edges). Unlike 2.1, QTI 2.2 adds the **stimulus** binding.
 *
 * Like 2.1, QTI 2.2 declares every child as `<xs:element ref="…">` (modular style); the
 * walker resolves each ref to the global element's named type to continue the descent.
 * {@link normalizeQtiName} canonicalises the singular(XML)↔plural(Zod) array naming for
 * the L2 join (its leading-`qti-` strip is a no-op here — 2.x is already camelCase).
 */

import { join } from "node:path";

import {
  QtiAssessmentItemSchema,
  QtiAssessmentSectionSchema,
  QtiAssessmentStimulusSchema,
  QtiAssessmentTestSchema,
} from "@conform-ed/contracts/qti/v2_2";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";
import { normalizeQtiName } from "./v3_0_1";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "qti", "v2_2", file);

/**
 * Conformance seed — a grounded slice of QTI 2.2 item-side normative rules, each
 * cross-linked to the literal L1 item it constrains (keys are the XML-binding
 * attribute/element names; `identifier`/`title` arrive via attribute groups).
 * Requirement ids synthesised (`QTI22-ITEM-n`); full extraction from the published
 * 1EdTech QTI 2.2 conformance guide is the next hand-curation increment.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "qti:2.2:conf:item/QTI22-ITEM-1",
    profile: "item",
    reqId: "QTI22-ITEM-1",
    level: "MUST",
    statement: "An assessmentItem MUST declare a unique identifier and a human-readable title.",
    constrains: [
      "qti:2.2:def:identifier.AssessmentItem.Attr/identifier",
      "qti:2.2:def:title.AssessmentItem.Attr/title",
    ],
    source: "QTI 2.2 §assessmentItem — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
  {
    key: "qti:2.2:conf:item/QTI22-ITEM-2",
    profile: "item",
    reqId: "QTI22-ITEM-2",
    level: "MUST",
    statement: "An assessmentItem MUST contain exactly one itemBody holding the candidate-facing content.",
    constrains: ["qti:2.2:def:AssessmentItemDType/itemBody"],
    source: "QTI 2.2 §itemBody — https://www.imsglobal.org/question/qtiv2p2/imsqti_infov2p2.html",
  },
];

export const qtiV2_2: SpecSource = {
  spec: "qti",
  version: "2.2",
  nameNormalizer: normalizeQtiName,
  bindings: [
    {
      binding: "assessmentItem",
      schemaPath: vendor("imsqti_v2p2p4.xsd"),
      language: "xsd",
      zod: QtiAssessmentItemSchema,
    },
    {
      binding: "assessmentTest",
      schemaPath: vendor("imsqti_v2p2p4.xsd"),
      language: "xsd",
      zod: QtiAssessmentTestSchema,
    },
    {
      binding: "assessmentSection",
      schemaPath: vendor("imsqti_v2p2p4.xsd"),
      language: "xsd",
      zod: QtiAssessmentSectionSchema,
    },
    {
      binding: "assessmentStimulus",
      schemaPath: vendor("imsqti_v2p2p4.xsd"),
      language: "xsd",
      zod: QtiAssessmentStimulusSchema,
    },
  ],
  conformance,
};
