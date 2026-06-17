/**
 * QTI 2.1 (Question & Test Interoperability — Assessment, Section & Item) —
 * {@link SpecSource} (conform-ed ADR-0013; emergent ADR-0028 rollout). The second
 * XSD-family QTI map, alongside {@link qtiV3_0_1}.
 *
 * The vendored `imsqti_v2p1p2.xsd` (the corrected v2.1.2 schema, targetNamespace
 * `http://www.imsglobal.org/xsd/imsqti_v2p1`) is the literal denominator (the XML
 * binding). Like 3.0.1 it is self-contained for QTI's own types — its `xs:import`s are
 * foreign vocabularies (XML attributes, XInclude, MathML2, APIP), which the XSD walker
 * records as opaque external references (no dangling edges).
 *
 * Binding-name normalisation: QTI 2.x XML is already camelCase (`assessmentItem`,
 * `responseDeclaration` — no `qti-` kebab prefix, that arrived in 3.0), while conform-ed
 * models the same family with **pluralised** array fields. {@link normalizeQtiName}
 * canonicalises both sides for the L2 join (its leading-`qti-` strip is a harmless no-op
 * here; the trailing-`s` collapse bridges singular repeatable elements ↔ plural arrays).
 * Item keys stay literal.
 */

import { join } from "node:path";

import {
  QtiAssessmentItemSchema,
  QtiAssessmentSectionSchema,
  QtiAssessmentTestSchema,
} from "@conform-ed/contracts/qti/v2_1";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";
import { normalizeQtiName } from "./v3_0_1";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "qti", "v2_1", file);

/**
 * Conformance seed — a grounded slice of QTI 2.1 item-side normative rules, each
 * cross-linked to the literal L1 item it constrains (keys are the XML-binding
 * attribute/element names). Requirement ids synthesised (`QTI21-ITEM-n`); full
 * extraction from the published 1EdTech QTI 2.1 conformance guide is the next
 * hand-curation increment.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "qti:2.1:conf:item/QTI21-ITEM-1",
    profile: "item",
    reqId: "QTI21-ITEM-1",
    level: "MUST",
    statement: "An assessmentItem MUST declare a unique identifier and a human-readable title.",
    constrains: [
      "qti:2.1:def:identifier.AssessmentItem.Attr/identifier",
      "qti:2.1:def:title.AssessmentItem.Attr/title",
    ],
    source: "QTI 2.1 §assessmentItem — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
  {
    key: "qti:2.1:conf:item/QTI21-ITEM-2",
    profile: "item",
    reqId: "QTI21-ITEM-2",
    level: "MUST",
    statement: "An assessmentItem MUST contain exactly one itemBody holding the candidate-facing content.",
    constrains: ["qti:2.1:def:AssessmentItem.Type/itemBody"],
    source: "QTI 2.1 §itemBody — https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html",
  },
];

export const qtiV2_1: SpecSource = {
  spec: "qti",
  version: "2.1",
  nameNormalizer: normalizeQtiName,
  bindings: [
    {
      binding: "assessmentItem",
      schemaPath: vendor("imsqti_v2p1p2.xsd"),
      language: "xsd",
      zod: QtiAssessmentItemSchema,
    },
    {
      binding: "assessmentTest",
      schemaPath: vendor("imsqti_v2p1p2.xsd"),
      language: "xsd",
      zod: QtiAssessmentTestSchema,
    },
    {
      binding: "assessmentSection",
      schemaPath: vendor("imsqti_v2p1p2.xsd"),
      language: "xsd",
      zod: QtiAssessmentSectionSchema,
    },
  ],
  conformance,
};
