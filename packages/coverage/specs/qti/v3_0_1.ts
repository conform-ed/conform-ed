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
  QtiAriaAutocompleteSchema,
  QtiAriaCheckedSchema,
  QtiAriaCurrentSchema,
  QtiAriaExpandedSchema,
  QtiAriaInvalidSchema,
  QtiAriaLiveSchema,
  QtiAriaOrientationSchema,
  QtiAriaPressedSchema,
  QtiAriaRoleSchema,
  QtiAriaSelectedSchema,
  QtiAriaSortSchema,
  QtiAssessmentItemSchema,
  QtiAssessmentSectionSchema,
  QtiAssessmentStimulusSchema,
  QtiAssessmentTestSchema,
  QtiBaseTypeSchema,
  QtiCardinalitySchema,
  QtiDirectionSchema,
  QtiExternalScoredSchema,
  QtiNavigationModeSchema,
  QtiShapeSchema,
  QtiShowHideSchema,
  QtiSubmissionModeSchema,
  QtiSuppressTtsSchema,
} from "@conform-ed/contracts/qti/v3_0_1";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";
import { SIMPLE_CONTENT_VALUE, XML_BASE, XML_LANG, XS_ANY_EXTENSIONS } from "../xsd-normalisations";

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
 * The QTI expression grammar (ADR-0017 structural alias). The ASI XSD names every operator
 * as its own element under the expression-group types (`BranchRuleDType`, `LogicSingleDType`,
 * and recursively as operands), while conform-ed models the whole grammar as a single
 * `kind`-discriminated union reached via the Zod `expression` / `expressions` operand
 * properties (`processing-internal.ts`: `QtiExpressionSchema`, the unary/binary/one-to-many/
 * container enums plus the named operators). The structural name-join therefore never pairs
 * them; these aliases bridge each operator element to the union operand and descend.
 */
const expressionOperatorElements = [
  "qti-and",
  "qti-any-n",
  "qti-base-value",
  "qti-container-size",
  "qti-contains",
  "qti-correct",
  "qti-custom-operator",
  "qti-default",
  "qti-delete",
  "qti-divide",
  "qti-duration-gte",
  "qti-duration-lt",
  "qti-equal",
  "qti-equal-rounded",
  "qti-field-value",
  "qti-gcd",
  "qti-gt",
  "qti-gte",
  "qti-index",
  "qti-inside",
  "qti-integer-divide",
  "qti-integer-modulus",
  "qti-integer-to-float",
  "qti-is-null",
  "qti-lcm",
  "qti-lt",
  "qti-lte",
  "qti-map-response",
  "qti-map-response-point",
  "qti-match",
  "qti-math-constant",
  "qti-math-operator",
  "qti-max",
  "qti-member",
  "qti-min",
  "qti-multiple",
  "qti-not",
  "qti-null",
  "qti-number-correct",
  "qti-number-incorrect",
  "qti-number-presented",
  "qti-number-responded",
  "qti-number-selected",
  "qti-or",
  "qti-ordered",
  "qti-outcome-maximum",
  "qti-outcome-minimum",
  "qti-pattern-match",
  "qti-power",
  "qti-product",
  "qti-random",
  "qti-random-float",
  "qti-random-integer",
  "qti-repeat",
  "qti-round",
  "qti-round-to",
  "qti-stats-operator",
  "qti-string-match",
  "qti-substring",
  "qti-subtract",
  "qti-sum",
  "qti-test-variables",
  "qti-truncate",
  "qti-variable",
] as const;

/**
 * The response/outcome/template processing-rule elements, modelled by conform-ed as the
 * `kind`-discriminated rule union reached via the Zod `rules` property (plus the `include`
 * XInclude element, modelled as `QtiIncludeSchema`).
 */
const processingRuleElements = [
  "include",
  "qti-exit-response",
  "qti-exit-template",
  "qti-exit-test",
  "qti-lookup-outcome-value",
  "qti-outcome-condition",
  "qti-outcome-processing-fragment",
  "qti-response-condition",
  "qti-response-processing-fragment",
  "qti-set-correct-response",
  "qti-set-default-value",
  "qti-set-outcome-value",
  "qti-set-template-value",
  "qti-template-condition",
  "qti-template-constraint",
] as const;

/**
 * Flow/inline XHTML (+ embedded MathML/SSML) content elements. conform-ed represents these via
 * a single generic opaque XML content node (`createXmlNodeSchema`: `{kind:"xml", name, attributes,
 * children}`) — a lossless round-trip, NOT a per-element schema — reached via the Zod `content`
 * array and the XML node's own `children`. Modelled differently (opaquely), not absent.
 */
const htmlFlowContentElements = [
  "a",
  "abbr",
  "acronym",
  "address",
  "article",
  "aside",
  "audio",
  "b",
  "bdi",
  "bdo",
  "big",
  "blockquote",
  "br",
  "break",
  "cite",
  "code",
  "details",
  "dfn",
  "div",
  "dl",
  "em",
  "emphasis",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "kbd",
  "label",
  "mark",
  "math",
  "nav",
  "object",
  "ol",
  "p",
  "phoneme",
  "picture",
  "pre",
  "prosody",
  "q",
  "ruby",
  "s",
  "samp",
  "say-as",
  "section",
  "small",
  "span",
  "speak",
  "strong",
  "sub",
  "sup",
  "table",
  "tt",
  "ul",
  "var",
  "video",
  "voice",
] as const;

/**
 * Interaction + feedback/template/rubric block elements that appear in item/stimulus body content.
 * conform-ed models all of them as typed members of the `QtiContentFragment` union (every
 * interaction emergent authors), reached via the Zod `content` array — and `qti-content-body`,
 * the wrapper modal/test feedback + test rubric blocks carry as their `content` array.
 */
const bodyInteractionAndBlockElements = [
  "qti-associate-interaction",
  "qti-choice-interaction",
  "qti-content-body",
  "qti-custom-interaction",
  "qti-drawing-interaction",
  "qti-extended-text-interaction",
  "qti-feedback-block",
  "qti-gap-match-interaction",
  "qti-graphic-associate-interaction",
  "qti-graphic-gap-match-interaction",
  "qti-graphic-order-interaction",
  "qti-hotspot-interaction",
  "qti-hottext-interaction",
  "qti-match-interaction",
  "qti-media-interaction",
  "qti-order-interaction",
  "qti-portable-custom-interaction",
  "qti-position-object-stage",
  "qti-rubric-block",
  "qti-select-point-interaction",
  "qti-slider-interaction",
  "qti-template-block",
  "qti-upload-interaction",
] as const;

/** Nested section structure: conform-ed models the section/item ref children as a typed `children` union. */
const sectionChildElements = [
  "qti-assessment-item-ref",
  "qti-assessment-section",
  "qti-assessment-section-ref",
] as const;

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
  {
    key: "qti:3.0.1:conf:accessibility/QTI-A11Y-1",
    profile: "accessibility",
    reqId: "QTI-A11Y-1",
    level: "MUST",
    statement:
      "WAI-ARIA roles and states authored on a qti-assessment-item's content and interactions (the ARIABaseDType attribute group) MUST be preserved through serialization and delivered to assistive technology unchanged.",
    constrains: [
      "qti:3.0.1:def:ARIABaseDType/role",
      "qti:3.0.1:def:ARIABaseDType/aria-label",
      "qti:3.0.1:def:ARIABaseDType/aria-describedby",
    ],
    source: "QTI 3.0 §2.13.3 WAI-ARIA characteristics — https://www.imsglobal.org/spec/qti/v3p0/impl#h.wai-aria",
  },
];

export const qtiV3_0_1: SpecSource = {
  spec: "qti",
  version: "3.0.1",
  nameNormalizer: normalizeQtiName,
  // The flattened 3.0.1 ASI models xml:base (as xmlBase), so its single `/base` item is a
  // rename, not a gap — unlike QTI 2.x, which names no xmlBase (see those specs).
  // The XSD→Zod renames absorbed out of the residues (ADR-0013/0017). The three shared overrides
  // (xs:any/value/xml:base) plus QTI-specific ones that reclassify the per-element XSD vocabulary
  // conform-ed models under a different SHAPE — the `kind`-discriminated expression/rule unions, the
  // QtiContentFragment content union, the generic opaque XML content node, and the map/table entry
  // arrays. These match the residues by LEAF segment post-reconcile (non-descending): they resolve
  // exactly the reached gap surface the map measures, without re-opening the recursive grammar.
  specRefOverrides: [
    XS_ANY_EXTENSIONS,
    SIMPLE_CONTENT_VALUE,
    XML_BASE,
    XML_LANG,
    {
      note: "QTI expression operators (qti-and, qti-sum, qti-map-response, …) → conform-ed's `kind`-discriminated expression union (the unary/binary/one-to-many/container enums + named operators) reached via the Zod `expression`/`expressions` operands.",
      modelledSegments: ["expression", "expressions"],
      literalSegments: expressionOperatorElements,
    },
    {
      note: "QTI response/outcome/template processing-rule elements → conform-ed's `kind`-discriminated rule union (Zod `rules`); `include` → QtiIncludeSchema.",
      modelledSegments: ["rules"],
      literalSegments: processingRuleElements,
    },
    {
      note: "QTI interaction + feedback/template/rubric block elements → typed members of conform-ed's QtiContentFragment union (Zod `content`); every interaction emergent authors.",
      modelledSegments: ["content"],
      literalSegments: bodyInteractionAndBlockElements,
    },
    {
      note: "XHTML flow/inline (+ embedded MathML/SSML) content → conform-ed's generic opaque XML content node (createXmlNodeSchema: {kind:'xml', name, attributes, children}) — a lossless round-trip reached via Zod `content`/`children`, NOT a per-element schema.",
      modelledSegments: ["children"],
      literalSegments: htmlFlowContentElements,
    },
    {
      note: "Nested section structure (qti-assessment-section/-ref, item-ref) → conform-ed's typed section `children` union.",
      literalSegments: sectionChildElements,
    },
    {
      note: "QTI map/table entry elements (XML singular `-entry` ↔ JSON `*Entries` array; the y→ies plural the name-normaliser misses) → conform-ed's typed entry arrays.",
      modelledSegments: [
        "mapEntries",
        "areaMapEntries",
        "matchTableEntries",
        "interpolationTableEntries",
        "cardEntries",
      ],
      literalSegments: [
        "qti-map-entry",
        "qti-area-map-entry",
        "qti-match-table-entry",
        "qti-interpolation-table-entry",
        "qti-card-entry",
      ],
    },
  ],
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
  // Value-set verification (ADR-0017): the QTI ASI binding enumerates many closed controlled
  // vocabularies as XSD attribute types; the structural name-join cannot check their members, so
  // each QTI-defined vocabulary is safeParse'd member-by-member against conform-ed's z.enum. One
  // representative item is pinned per vocabulary (e.g. base-type recurs on 8 items, all identical).
  // The HTML/ARIA attribute vocabularies (role, aria-*, crossorigin, …) are not QTI-defined and
  // are modelled inline, so they are not value-set-checked here.
  valueSets: [
    { item: "qti:3.0.1:def:BaseValueDType/base-type", element: QtiBaseTypeSchema },
    { item: "qti:3.0.1:def:ContextDeclarationDType/cardinality", element: QtiCardinalitySchema },
    { item: "qti:3.0.1:def:TestPartDType/navigation-mode", element: QtiNavigationModeSchema },
    { item: "qti:3.0.1:def:TestPartDType/submission-mode", element: QtiSubmissionModeSchema },
    { item: "qti:3.0.1:def:AssociableHotspotDType/show-hide", element: QtiShowHideSchema },
    { item: "qti:3.0.1:def:AreaMapEntryDType/shape", element: QtiShapeSchema },
    { item: "qti:3.0.1:def:OutcomeDeclarationDType/external-scored", element: QtiExternalScoredSchema },
    { item: "qti:3.0.1:def:BasePromptInteractionDType/data-qti-suppress-tts", element: QtiSuppressTtsSchema },
    { item: "qti:3.0.1:def:BasePromptInteractionDType/dir", element: QtiDirectionSchema },
    // WAI-ARIA characteristics with a closed XSD vocabulary (ADR-0039). The remaining ARIA
    // attributes are IDREF/string/integer and are modelled as plain strings (no value-set).
    { item: "qti:3.0.1:def:ARIABaseDType/role", element: QtiAriaRoleSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-checked", element: QtiAriaCheckedSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-expanded", element: QtiAriaExpandedSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-pressed", element: QtiAriaPressedSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-selected", element: QtiAriaSelectedSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-live", element: QtiAriaLiveSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-orientation", element: QtiAriaOrientationSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-autocomplete", element: QtiAriaAutocompleteSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-invalid", element: QtiAriaInvalidSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-sort", element: QtiAriaSortSchema },
    { item: "qti:3.0.1:def:ARIABaseDType/aria-current", element: QtiAriaCurrentSchema },
  ],
  conformance,
};
