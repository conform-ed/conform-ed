/**
 * QTI 3.0.1 (Question & Test Interoperability — Assessment, Section & Item) —
 * {@link SpecSource} (conform-ed ADR-0013; emergent ADR-0028 rollout). The flagship
 * XSD-family spec.
 *
 * The vendored `imsqti_asiv3p0p1_v1p0.xsd` is the literal denominator (the XML
 * binding). It is self-contained for QTI's own types — its four `xs:import`s are
 * foreign vocabularies (XML attributes, XInclude, MathML, SSML), which the XSD
 * walker records as opaque external references (no dangling edges).
 *
 * Binding-name normalisation: the literal XSD is the **XML** binding (kebab,
 * `qti-`-prefixed element/attribute names — `qti-response-declaration`,
 * `response-identifier`), while conform-ed models the **JSON** binding (camelCase —
 * `responseDeclaration`, `responseIdentifier`). {@link normalizeQtiName} canonicalises
 * both sides for the L2 join (item keys stay literal).
 */

import { join } from "node:path";

import {
  QtiAssessmentItemSchema,
  QtiAssessmentSectionSchema,
  QtiAssessmentStimulusSchema,
  QtiAssessmentTestSchema,
} from "@conform-ed/contracts/qti/v3_0_1";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";
import { SIMPLE_CONTENT_VALUE, XML_BASE, XS_ANY_EXTENSIONS } from "../xsd-normalisations";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "qti", "v3_0_1", file);

/**
 * Canonicalise a property name across the QTI XML (kebab, `qti-`) and JSON (camelCase)
 * bindings for the L2 join:
 *
 *  - lower-case, drop a leading `qti-`, strip non-alphanumerics
 *    (`qti-response-declaration` and `responseDeclaration` → `responsedeclaration`);
 *  - collapse a single trailing `s`, because the XML binding uses **singular**
 *    repeatable elements (`qti-response-declaration`, maxOccurs unbounded) where the
 *    JSON binding names the **plural** array (`responseDeclarations`).
 *
 * Idempotent; applied to both sides, so it is a canonical token, not a real word
 * (e.g. `status` → `statu` on both sides — still a consistent match). The structural
 * `[]` array marker is passed through untouched.
 */
export const normalizeQtiName = (name: string): string =>
  name === "[]"
    ? name
    : name
        .toLowerCase()
        .replace(/^qti-/, "")
        .replace(/[^a-z0-9]/g, "")
        .replace(/s$/, "");

/**
 * Conformance catalogue — curated from the published 1EdTech QTI 3.0 Implementation /
 * conformance guide (https://www.imsglobal.org/spec/qti/v3p0/impl), grouped by the ASI
 * surface each rule governs: `item` (qti-assessment-item structure), `response-declaration`,
 * `outcome-declaration`, `test` (qti-assessment-test / test-part), `section`, and
 * `response-processing`. Keys are the literal XML-binding attribute/element names. This is the
 * cert-aligned MUST checklist; the literal information-model inventory (every element/attribute
 * of the ASI) is the map's L1, separate from this curated surface.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "qti:3.0.1:conf:item/QTI-ITEM-1",
    profile: "item",
    reqId: "QTI-ITEM-1",
    level: "MUST",
    statement: "A qti-assessment-item MUST declare a unique identifier and a human-readable title.",
    constrains: ["qti:3.0.1:def:AssessmentItemDType/identifier", "qti:3.0.1:def:AssessmentItemDType/title"],
    source: "QTI 3.0 §assessment-item — https://www.imsglobal.org/spec/qti/v3p0/impl#h.assessment-item",
  },
  {
    key: "qti:3.0.1:conf:item/QTI-ITEM-2",
    profile: "item",
    reqId: "QTI-ITEM-2",
    level: "MUST",
    statement: "A qti-assessment-item MUST contain exactly one qti-item-body holding the candidate-facing content.",
    constrains: ["qti:3.0.1:def:AssessmentItemDType/qti-item-body"],
    source: "QTI 3.0 §item-body — https://www.imsglobal.org/spec/qti/v3p0/impl#h.item-body",
  },
  {
    key: "qti:3.0.1:conf:item/QTI-ITEM-3",
    profile: "item",
    reqId: "QTI-ITEM-3",
    level: "MUST",
    statement: "A qti-assessment-item MUST carry the time-dependent attribute and declare whether it is adaptive.",
    constrains: ["qti:3.0.1:def:AssessmentItemDType/time-dependent", "qti:3.0.1:def:AssessmentItemDType/adaptive"],
    source: "QTI 3.0 §assessment-item (time-dependent/adaptive) — https://www.imsglobal.org/spec/qti/v3p0/impl",
  },
  {
    key: "qti:3.0.1:conf:item/QTI-ITEM-4",
    profile: "item",
    reqId: "QTI-ITEM-4",
    level: "MUST",
    statement:
      "A scored qti-assessment-item MUST declare its response variable(s) via qti-response-declaration and carry qti-response-processing to score them.",
    constrains: [
      "qti:3.0.1:def:AssessmentItemDType/qti-response-declaration",
      "qti:3.0.1:def:AssessmentItemDType/qti-response-processing",
    ],
    source: "QTI 3.0 §response-declaration / §response-processing — https://www.imsglobal.org/spec/qti/v3p0/impl",
  },
  {
    key: "qti:3.0.1:conf:response-declaration/QTI-RD-1",
    profile: "response-declaration",
    reqId: "QTI-RD-1",
    level: "MUST",
    statement:
      "A qti-response-declaration MUST declare an identifier, a cardinality (single / multiple / ordered / record) and a base-type.",
    constrains: [
      "qti:3.0.1:def:ResponseDeclarationDType/identifier",
      "qti:3.0.1:def:ResponseDeclarationDType/cardinality",
      "qti:3.0.1:def:ResponseDeclarationDType/base-type",
    ],
    source: "QTI 3.0 §response-declaration — https://www.imsglobal.org/spec/qti/v3p0/impl",
  },
  {
    key: "qti:3.0.1:conf:outcome-declaration/QTI-OD-1",
    profile: "outcome-declaration",
    reqId: "QTI-OD-1",
    level: "MUST",
    statement: "A qti-outcome-declaration MUST declare an identifier under which its computed value is stored.",
    constrains: ["qti:3.0.1:def:OutcomeDeclarationDType/identifier"],
    source: "QTI 3.0 §outcome-declaration — https://www.imsglobal.org/spec/qti/v3p0/impl",
  },
  {
    key: "qti:3.0.1:conf:test/QTI-TEST-1",
    profile: "test",
    reqId: "QTI-TEST-1",
    level: "MUST",
    statement: "A qti-assessment-test MUST declare an identifier and contain at least one qti-test-part.",
    constrains: ["qti:3.0.1:def:AssessmentTestDType/identifier", "qti:3.0.1:def:AssessmentTestDType/qti-test-part"],
    source: "QTI 3.0 §assessment-test — https://www.imsglobal.org/spec/qti/v3p0/impl",
  },
  {
    key: "qti:3.0.1:conf:test/QTI-TEST-2",
    profile: "test",
    reqId: "QTI-TEST-2",
    level: "MUST",
    statement: "A qti-test-part MUST contain at least one qti-assessment-section organising the items it delivers.",
    constrains: ["qti:3.0.1:def:TestPartDType/qti-assessment-section"],
    source: "QTI 3.0 §test-part — https://www.imsglobal.org/spec/qti/v3p0/impl",
  },
  {
    key: "qti:3.0.1:conf:section/QTI-SEC-1",
    profile: "section",
    reqId: "QTI-SEC-1",
    level: "MUST",
    statement: "A qti-assessment-section MUST declare an identifier and a title for the grouping it represents.",
    constrains: ["qti:3.0.1:def:AssessmentSectionDType/identifier"],
    source: "QTI 3.0 §assessment-section — https://www.imsglobal.org/spec/qti/v3p0/impl",
  },
  {
    key: "qti:3.0.1:conf:response-processing/QTI-RP-1",
    profile: "response-processing",
    reqId: "QTI-RP-1",
    level: "MUST",
    statement:
      "A qti-response-processing block MUST either reference a standard processing template (via its template attribute) or carry custom processing rules.",
    constrains: ["qti:3.0.1:def:ResponseProcessingDType/template"],
    source: "QTI 3.0 §response-processing — https://www.imsglobal.org/spec/qti/v3p0/impl",
  },
];

export const qtiV3_0_1: SpecSource = {
  spec: "qti",
  version: "3.0.1",
  nameNormalizer: normalizeQtiName,
  // The flattened 3.0.1 ASI models xml:base (as xmlBase), so its single `/base` item is a
  // rename, not a gap — unlike QTI 2.x, which names no xmlBase (see those specs).
  specRefOverrides: [XS_ANY_EXTENSIONS, SIMPLE_CONTENT_VALUE, XML_BASE],
  bindings: [
    {
      binding: "qti-assessment-item",
      schemaPath: vendor("imsqti_asiv3p0p1_v1p0.xsd"),
      language: "xsd",
      zod: QtiAssessmentItemSchema,
    },
    {
      binding: "qti-assessment-test",
      schemaPath: vendor("imsqti_asiv3p0p1_v1p0.xsd"),
      language: "xsd",
      zod: QtiAssessmentTestSchema,
    },
    {
      binding: "qti-assessment-section",
      schemaPath: vendor("imsqti_asiv3p0p1_v1p0.xsd"),
      language: "xsd",
      zod: QtiAssessmentSectionSchema,
    },
    {
      binding: "qti-assessment-stimulus",
      schemaPath: vendor("imsqti_asiv3p0p1_v1p0.xsd"),
      language: "xsd",
      zod: QtiAssessmentStimulusSchema,
    },
  ],
  conformance,
};
