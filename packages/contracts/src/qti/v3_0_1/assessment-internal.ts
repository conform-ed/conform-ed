import { z } from "zod";

import {
  QtiBranchRuleSchema,
  QtiIncludeSchema,
  QtiOutcomeProcessingSchema,
  QtiPreConditionSchema,
  QtiResponseProcessingSchema,
  QtiTemplateDefaultSchema,
  QtiTemplateProcessingSchema,
} from "./processing-internal";
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
  QtiDirectionSchema,
  QtiIdentifierListSchema,
  QtiIdentifierSchema,
  QtiNavigationModeSchema,
  QtiOrientationSchema,
  QtiShapeSchema,
  QtiShowHideSchema,
  QtiStringListSchema,
  QtiMimeTypeSchema,
  QtiSuppressTtsSchema,
  QtiSubmissionModeSchema,
  QtiViewSchema,
  XmlForeignAttributesSchema,
  addIssue,
  asArray,
  collectDuplicates,
  createXmlNodeSchema,
  strictObject,
} from "./shared";
import {
  QtiCatalogInfoSchema,
  QtiContextDeclarationSchema,
  QtiItemSessionControlSchema,
  QtiOutcomeDeclarationSchema,
  QtiResponseDeclarationSchema,
  QtiStyleSheetSchema,
  QtiTemplateDeclarationSchema,
  QtiTimeLimitsSchema,
  QtiVariableMappingSchema,
  QtiWeightSchema,
} from "./variables-internal";

/**
 * The WAI-ARIA characteristics (ASI §2.13.3, XSD attribute group `ARIABaseDType`) every QTI
 * content node may carry. Modelled as named fields (kebab-cased to mirror the XML/ARIA binding
 * exactly, so the parser/serializer round-trip the literal attribute names) — value-set enums for
 * the closed vocabularies, plain strings for the IDREF/string/integer ones. Authored ARIA on a QTI
 * element is preserved through emit and rendered to the delivery DOM (ADR-0039).
 */
const QtiAriaAttributesShape = {
  role: QtiAriaRoleSchema.optional(),
  "aria-activedescendant": z.string().optional(),
  "aria-atomic": z.string().optional(),
  "aria-autocomplete": QtiAriaAutocompleteSchema.optional(),
  "aria-busy": z.string().optional(),
  "aria-checked": QtiAriaCheckedSchema.optional(),
  "aria-colcount": z.string().optional(),
  "aria-colindex": z.string().optional(),
  "aria-colspan": z.string().optional(),
  "aria-controls": z.string().optional(),
  "aria-current": QtiAriaCurrentSchema.optional(),
  "aria-describedby": z.string().optional(),
  "aria-details": z.string().optional(),
  "aria-disabled": z.string().optional(),
  "aria-errormessage": z.string().optional(),
  "aria-expanded": QtiAriaExpandedSchema.optional(),
  "aria-flowto": z.string().optional(),
  "aria-haspopup": z.string().optional(),
  "aria-hidden": z.string().optional(),
  "aria-invalid": QtiAriaInvalidSchema.optional(),
  "aria-keyshortcuts": z.string().optional(),
  "aria-label": z.string().optional(),
  "aria-labelledby": z.string().optional(),
  "aria-level": z.string().optional(),
  "aria-live": QtiAriaLiveSchema.optional(),
  "aria-modal": z.string().optional(),
  "aria-multiline": z.string().optional(),
  "aria-multiselectable": z.string().optional(),
  "aria-orientation": QtiAriaOrientationSchema.optional(),
  "aria-owns": z.string().optional(),
  "aria-placeholder": z.string().optional(),
  "aria-posinset": z.string().optional(),
  "aria-pressed": QtiAriaPressedSchema.optional(),
  "aria-readonly": z.string().optional(),
  "aria-relevant": z.string().optional(),
  "aria-required": z.string().optional(),
  "aria-roledescription": z.string().optional(),
  "aria-rowcount": z.string().optional(),
  "aria-rowindex": z.string().optional(),
  "aria-rowspan": z.string().optional(),
  "aria-selected": QtiAriaSelectedSchema.optional(),
  "aria-setsize": z.string().optional(),
  "aria-sort": QtiAriaSortSchema.optional(),
  "aria-valuemax": z.string().optional(),
  "aria-valuemin": z.string().optional(),
  "aria-valuenow": z.string().optional(),
  "aria-valuetext": z.string().optional(),
};

const QtiCommonNodeShape = {
  id: QtiIdentifierSchema.optional(),
  class: QtiStringListSchema.optional(),
  lang: z.string().optional(),
  xmlLang: z.string().optional(),
  label: z.string().optional(),
  dir: QtiDirectionSchema.optional(),
  xmlBase: z.string().optional(),
  dataCatalogIdref: z.string().optional(),
  dataQtiSuppressTts: QtiSuppressTtsSchema.optional(),
  dataSsml: z.string().optional(),
  ...QtiAriaAttributesShape,
  foreignAttributes: XmlForeignAttributesSchema.optional(),
};

const QtiChoiceUseSchema = z.enum(["instructions", "scoring", "navigation"]);
const QtiTextFormatSchema = z.enum(["plain", "preformatted", "xhtml"]);

const interactionKinds = new Set<string>([
  "choiceInteraction",
  "inlineChoiceInteraction",
  "textEntryInteraction",
  "extendedTextInteraction",
  "matchInteraction",
  "gapMatchInteraction",
  "mediaInteraction",
  "uploadInteraction",
  "orderInteraction",
  "hotTextInteraction",
  "hotspotInteraction",
  "associateInteraction",
  "graphicAssociateInteraction",
  "graphicGapMatchInteraction",
  "graphicOrderInteraction",
  "selectPointInteraction",
  "positionObjectInteraction",
  "sliderInteraction",
  "portableCustomInteraction",
  "customInteraction",
  "drawingInteraction",
  "endAttemptInteraction",
]);

export const QtiXmlContentNodeSchema: z.ZodType = z.lazy(() => createXmlNodeSchema(QtiContentFragmentSchema));

export const QtiPromptSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("prompt"),
    ...QtiCommonNodeShape,
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiLabelElementSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("labelElement"),
    ...QtiCommonNodeShape,
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiPrintedVariableSchema = strictObject({
  kind: z.literal("printedVariable"),
  id: QtiIdentifierSchema.optional(),
  class: QtiStringListSchema.optional(),
  xmlLang: z.string().optional(),
  label: z.string().optional(),
  xmlBase: z.string().optional(),
  identifier: QtiIdentifierSchema,
  format: z.string().optional(),
  base: z.union([z.number().int(), z.string()]).optional(),
  index: z.union([z.number().int(), z.string()]).optional(),
  powerForm: z.boolean().optional(),
  field: z.string().optional(),
  delimiter: z.string().optional(),
  mappingIndicator: z.string().optional(),
});

export const QtiInteractionModuleSchema = strictObject({
  kind: z.literal("interactionModule"),
  id: QtiIdentifierSchema,
  primaryPath: z.string().optional(),
  fallbackPath: z.string().optional(),
});

export const QtiInteractionModulesSchema = strictObject({
  kind: z.literal("interactionModules"),
  primaryConfiguration: z.string().optional(),
  secondaryConfiguration: z.string().optional(),
  modules: z.array(QtiInteractionModuleSchema).min(1),
});

export const QtiInteractionMarkupSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("interactionMarkup"),
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiFeedbackInlineSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("feedbackInline"),
    ...QtiCommonNodeShape,
    outcomeIdentifier: QtiIdentifierSchema,
    identifier: QtiIdentifierSchema,
    showHide: QtiShowHideSchema.optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiFeedbackBlockSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("feedbackBlock"),
    ...QtiCommonNodeShape,
    outcomeIdentifier: QtiIdentifierSchema,
    identifier: QtiIdentifierSchema,
    showHide: QtiShowHideSchema.optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
  }),
);

export const QtiTemplateInlineSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("templateInline"),
    ...QtiCommonNodeShape,
    templateIdentifier: QtiIdentifierSchema,
    identifier: QtiIdentifierSchema,
    showHide: QtiShowHideSchema.optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiTemplateBlockFeedbackBlockSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("templateBlockFeedbackBlock"),
    ...QtiCommonNodeShape,
    outcomeIdentifier: QtiIdentifierSchema,
    identifier: QtiIdentifierSchema,
    showHide: QtiShowHideSchema.optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
  }),
);

export const QtiTemplateBlockSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("templateBlock"),
    ...QtiCommonNodeShape,
    templateIdentifier: QtiIdentifierSchema,
    identifier: QtiIdentifierSchema,
    showHide: QtiShowHideSchema.optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
  }),
);

export const QtiRubricBlockSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("rubricBlock"),
    ...QtiCommonNodeShape,
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
    use: QtiChoiceUseSchema.optional(),
    view: z.array(QtiViewSchema).min(1),
  }),
);

export const QtiTestRubricBlockSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("testRubricBlock"),
    ...QtiCommonNodeShape,
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
    printedVariable: QtiPrintedVariableSchema.optional(),
    use: QtiChoiceUseSchema.optional(),
    view: z.array(QtiViewSchema).min(1),
  }),
);

export const QtiModalFeedbackSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("modalFeedback"),
    outcomeIdentifier: QtiIdentifierSchema,
    showHide: QtiShowHideSchema,
    identifier: QtiIdentifierSchema,
    title: z.string().optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiTestFeedbackSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("testFeedback"),
    access: z.enum(["atEnd", "during"]),
    outcomeIdentifier: QtiIdentifierSchema,
    showHide: QtiShowHideSchema,
    identifier: QtiIdentifierSchema,
    title: z.string().optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiGapSchema = strictObject({
  kind: z.literal("gap"),
  ...QtiCommonNodeShape,
  identifier: QtiIdentifierSchema,
  templateIdentifier: QtiIdentifierSchema.optional(),
  showHide: QtiShowHideSchema.optional(),
  matchGroup: QtiIdentifierListSchema.optional(),
  required: z.boolean().optional(),
});

export const QtiGapTextSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("gapText"),
    ...QtiCommonNodeShape,
    identifier: QtiIdentifierSchema,
    templateIdentifier: QtiIdentifierSchema.optional(),
    showHide: QtiShowHideSchema.optional(),
    matchGroup: QtiIdentifierListSchema.optional(),
    matchMax: z.number().int(),
    matchMin: z.number().int().optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiGapImgSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("gapImg"),
    ...QtiCommonNodeShape,
    identifier: QtiIdentifierSchema,
    templateIdentifier: QtiIdentifierSchema.optional(),
    showHide: QtiShowHideSchema.optional(),
    matchGroup: QtiIdentifierListSchema.optional(),
    matchMax: z.number().int(),
    matchMin: z.number().int().optional(),
    objectLabel: z.string().optional(),
    top: z.string().optional(),
    left: z.string().optional(),
    media: QtiXmlContentNodeSchema,
  }),
);

export const QtiHotTextSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("hotText"),
    ...QtiCommonNodeShape,
    identifier: QtiIdentifierSchema,
    templateIdentifier: QtiIdentifierSchema.optional(),
    showHide: QtiShowHideSchema.optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiHotspotChoiceSchema = strictObject({
  kind: z.literal("hotspotChoice"),
  ...QtiCommonNodeShape,
  identifier: QtiIdentifierSchema,
  templateIdentifier: QtiIdentifierSchema.optional(),
  showHide: QtiShowHideSchema.optional(),
  shape: QtiShapeSchema,
  coords: z.string(),
  hotspotLabel: z.string().optional(),
});

export const QtiAssociableHotspotSchema = strictObject({
  kind: z.literal("associableHotspot"),
  ...QtiCommonNodeShape,
  identifier: QtiIdentifierSchema,
  templateIdentifier: QtiIdentifierSchema.optional(),
  showHide: QtiShowHideSchema.optional(),
  matchGroup: QtiIdentifierListSchema.optional(),
  matchMax: z.number().int().optional(),
  shape: QtiShapeSchema,
  coords: z.string(),
  hotspotLabel: z.string().optional(),
});

export const QtiSimpleChoiceSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("simpleChoice"),
    ...QtiCommonNodeShape,
    identifier: QtiIdentifierSchema,
    fixed: z.boolean().optional(),
    templateIdentifier: QtiIdentifierSchema.optional(),
    showHide: QtiShowHideSchema.optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiSimpleAssociableChoiceSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("simpleAssociableChoice"),
    ...QtiCommonNodeShape,
    identifier: QtiIdentifierSchema,
    fixed: z.boolean().optional(),
    templateIdentifier: QtiIdentifierSchema.optional(),
    showHide: QtiShowHideSchema.optional(),
    matchGroup: QtiIdentifierListSchema.optional(),
    matchMax: z.number().int(),
    matchMin: z.number().int().optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

export const QtiInlineChoiceSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("inlineChoice"),
    ...QtiCommonNodeShape,
    identifier: QtiIdentifierSchema,
    fixed: z.boolean().optional(),
    templateIdentifier: QtiIdentifierSchema.optional(),
    showHide: QtiShowHideSchema.optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
  }),
);

const QtiRenderableNodeSchema = z.union([QtiXmlContentNodeSchema, QtiIncludeSchema]);

export const QtiChoiceInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("choiceInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    simpleChoices: z.array(QtiSimpleChoiceSchema).min(1),
    shuffle: z.boolean().optional(),
    maxChoices: z.number().int().optional(),
    minChoices: z.number().int().optional(),
    orientation: QtiOrientationSchema.optional(),
    dataMinSelectionsMessage: z.string().optional(),
    dataMaxSelectionsMessage: z.string().optional(),
  }),
);

export const QtiInlineChoiceInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("inlineChoiceInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    labelElement: QtiLabelElementSchema.optional(),
    inlineChoices: z.array(QtiInlineChoiceSchema).min(1),
    shuffle: z.boolean().optional(),
    required: z.boolean().optional(),
    minChoices: z.number().int().optional(),
    dataMinSelectionsMessage: z.string().optional(),
    dataPrompt: z.string().optional(),
  }),
);

export const QtiTextEntryInteractionSchema = strictObject({
  kind: z.literal("textEntryInteraction"),
  ...QtiCommonNodeShape,
  responseIdentifier: QtiIdentifierSchema,
  base: z.number().int().optional(),
  stringIdentifier: QtiIdentifierSchema.optional(),
  expectedLength: z.number().int().optional(),
  patternMask: z.string().optional(),
  placeholderText: z.string().optional(),
  format: z.string().optional(),
  dataPatternmaskMessage: z.string().optional(),
});

export const QtiExtendedTextInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("extendedTextInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    base: z.number().int().optional(),
    stringIdentifier: QtiIdentifierSchema.optional(),
    expectedLength: z.number().int().optional(),
    patternMask: z.string().optional(),
    placeholderText: z.string().optional(),
    maxStrings: z.number().int().optional(),
    minStrings: z.number().int().optional(),
    expectedLines: z.number().int().optional(),
    format: QtiTextFormatSchema.optional(),
    dataPatternmaskMessage: z.string().optional(),
  }),
);

export const QtiSimpleMatchSetSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("simpleMatchSet"),
    id: QtiIdentifierSchema.optional(),
    simpleAssociableChoices: z.array(QtiSimpleAssociableChoiceSchema).optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiMatchInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("matchInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    simpleMatchSets: z.array(QtiSimpleMatchSetSchema).length(2),
    shuffle: z.boolean().optional(),
    maxAssociations: z.number().int().optional(),
    minAssociations: z.number().int().optional(),
    dataMinSelectionsMessage: z.string().optional(),
    dataMaxSelectionsMessage: z.string().optional(),
    dataFirstColumnHeader: z.string().optional(),
  }),
);

export const QtiGapChoiceSchema = z.union([QtiGapTextSchema, QtiGapImgSchema]);

export const QtiGapMatchInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("gapMatchInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    gapChoices: z.array(QtiGapChoiceSchema).min(1),
    content: z.array(QtiContentFragmentSchema).min(1),
    shuffle: z.boolean().optional(),
    minAssociations: z.number().int().optional(),
    maxAssociations: z.number().int().optional(),
    dataMinSelectionsMessage: z.string().optional(),
    dataMaxSelectionsMessage: z.string().optional(),
    dataChoicesContainerWidth: z.number().int().optional(),
  }),
);

export const QtiMediaInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("mediaInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    media: QtiRenderableNodeSchema,
    autostart: z.boolean(),
    minPlays: z.number().int().optional(),
    maxPlays: z.number().int().optional(),
    loop: z.boolean().optional(),
    coords: z.string().optional(),
  }),
);

export const QtiUploadInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("uploadInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    acceptedTypes: z.array(z.string()).optional(),
  }),
);

export const QtiOrderInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("orderInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    simpleChoices: z.array(QtiSimpleChoiceSchema).min(1),
    shuffle: z.boolean().optional(),
    minChoices: z.number().int().optional(),
    maxChoices: z.number().int().optional(),
    orientation: QtiOrientationSchema.optional(),
    dataMinSelectionsMessage: z.string().optional(),
    dataMaxSelectionsMessage: z.string().optional(),
    dataChoicesContainerWidth: z.number().int().optional(),
  }),
);

export const QtiHotTextInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("hotTextInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    content: z.array(QtiContentFragmentSchema).min(1),
    maxChoices: z.number().int().optional(),
    minChoices: z.number().int().optional(),
    dataMinSelectionsMessage: z.string().optional(),
    dataMaxSelectionsMessage: z.string().optional(),
  }),
);

export const QtiHotspotInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("hotspotInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    image: QtiRenderableNodeSchema,
    hotspotChoices: z.array(QtiHotspotChoiceSchema).min(1),
    minChoices: z.number().int().optional(),
    maxChoices: z.number().int().optional(),
    dataMinSelectionsMessage: z.string().optional(),
    dataMaxSelectionsMessage: z.string().optional(),
  }),
);

export const QtiAssociateInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("associateInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    simpleAssociableChoices: z.array(QtiSimpleAssociableChoiceSchema).min(1),
    shuffle: z.boolean().optional(),
    maxAssociations: z.number().int().optional(),
    minAssociations: z.number().int().optional(),
  }),
);

export const QtiGraphicAssociateInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("graphicAssociateInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    image: QtiRenderableNodeSchema,
    associableHotspots: z.array(QtiAssociableHotspotSchema).min(1),
    minAssociations: z.number().int().optional(),
    maxAssociations: z.number().int().optional(),
  }),
);

export const QtiGraphicGapMatchInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("graphicGapMatchInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    image: QtiRenderableNodeSchema,
    gapChoices: z.array(QtiGapChoiceSchema).min(1),
    associableHotspots: z.array(QtiAssociableHotspotSchema).min(1),
    minAssociations: z.number().int().optional(),
    maxAssociations: z.number().int().optional(),
    dataMinSelectionsMessage: z.string().optional(),
    dataMaxSelectionsMessage: z.string().optional(),
    dataChoicesContainerWidth: z.number().int().optional(),
  }),
);

export const QtiGraphicOrderInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("graphicOrderInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    image: QtiRenderableNodeSchema,
    hotspotChoices: z.array(QtiHotspotChoiceSchema).min(1),
    minChoices: z.number().int().optional(),
    maxChoices: z.number().int().optional(),
  }),
);

export const QtiSelectPointInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("selectPointInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    image: QtiRenderableNodeSchema,
    minChoices: z.number().int().optional(),
    maxChoices: z.number().int().optional(),
  }),
);

export const QtiSliderInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("sliderInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    lowerBound: z.number().nonnegative(),
    upperBound: z.number().nonnegative(),
    step: z.number().nonnegative().optional(),
    stepLabel: z.boolean().optional(),
    orientation: QtiOrientationSchema.optional(),
    reverse: z.boolean().optional(),
  }),
);

export const QtiPositionObjectInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("positionObjectInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    image: QtiRenderableNodeSchema,
    centerPoint: z.array(z.number().int()).optional(),
    minChoices: z.number().int().optional(),
    maxChoices: z.number().int().optional(),
  }),
);

export const QtiPortableCustomInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("portableCustomInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    interactionModules: QtiInteractionModulesSchema.optional(),
    interactionMarkup: QtiInteractionMarkupSchema,
    templateVariables: z.array(QtiIdentifierSchema).optional(),
    contextVariables: z.array(QtiIdentifierSchema).optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
    customInteractionTypeIdentifier: z.string(),
    module: z.string().optional(),
    /** PCI configuration properties: the element's data-* attributes, prefix stripped. */
    properties: z.record(z.string(), z.string()).optional(),
  }),
);

export const QtiCustomInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("customInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    content: z.array(QtiContentFragmentSchema).optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiDrawingInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("drawingInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema,
    prompt: QtiPromptSchema.optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    attributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiEndAttemptInteractionSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("endAttemptInteraction"),
    ...QtiCommonNodeShape,
    responseIdentifier: QtiIdentifierSchema.optional(),
    // The XSD-required button label (`title` on qti-end-attempt-interaction).
    title: z.string().optional(),
    content: z.array(QtiContentFragmentSchema).optional(),
    attributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiPositionObjectStageSchema: z.ZodType = z.lazy(() =>
  strictObject({
    kind: z.literal("positionObjectStage"),
    id: QtiIdentifierSchema.optional(),
    image: QtiRenderableNodeSchema,
    positionObjectInteractions: z.array(QtiPositionObjectInteractionSchema).min(1),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiContentFragmentSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.string(),
    QtiXmlContentNodeSchema,
    QtiIncludeSchema,
    QtiPrintedVariableSchema,
    QtiFeedbackInlineSchema,
    QtiFeedbackBlockSchema,
    QtiTemplateInlineSchema,
    QtiTemplateBlockSchema,
    QtiTemplateBlockFeedbackBlockSchema,
    QtiRubricBlockSchema,
    QtiTestRubricBlockSchema,
    QtiHotTextSchema,
    QtiGapSchema,
    QtiGapTextSchema,
    QtiGapImgSchema,
    QtiSimpleChoiceSchema,
    QtiSimpleAssociableChoiceSchema,
    QtiInlineChoiceSchema,
    QtiPositionObjectStageSchema,
    QtiChoiceInteractionSchema,
    QtiInlineChoiceInteractionSchema,
    QtiTextEntryInteractionSchema,
    QtiExtendedTextInteractionSchema,
    QtiMatchInteractionSchema,
    QtiGapMatchInteractionSchema,
    QtiMediaInteractionSchema,
    QtiUploadInteractionSchema,
    QtiOrderInteractionSchema,
    QtiHotTextInteractionSchema,
    QtiHotspotInteractionSchema,
    QtiAssociateInteractionSchema,
    QtiGraphicAssociateInteractionSchema,
    QtiGraphicGapMatchInteractionSchema,
    QtiGraphicOrderInteractionSchema,
    QtiSelectPointInteractionSchema,
    QtiSliderInteractionSchema,
    QtiPositionObjectInteractionSchema,
    QtiPortableCustomInteractionSchema,
    QtiCustomInteractionSchema,
    QtiDrawingInteractionSchema,
    QtiEndAttemptInteractionSchema,
  ]),
);

export const QtiItemBodySchema: z.ZodType = z.lazy(() =>
  strictObject({
    // qti-item-body (ASI ItemBodyDType) carries exactly id/class/xml:lang/label/dir/
    // data-catalog-idref — NOT the ARIA group, so it models those attributes directly rather
    // than spreading the full common node shape (which would over-model ARIA it does not allow).
    id: QtiIdentifierSchema.optional(),
    class: QtiStringListSchema.optional(),
    xmlLang: z.string().optional(),
    label: z.string().optional(),
    dir: QtiDirectionSchema.optional(),
    dataCatalogIdref: z.string().optional(),
    content: z.array(QtiContentFragmentSchema).min(1),
  }),
);

export const QtiStimulusBodySchema: z.ZodType = z.lazy(() =>
  strictObject({
    ...QtiCommonNodeShape,
    content: z.array(QtiContentFragmentSchema).min(1),
  }),
);

// ---------- Companion materials (§2.13.1: "content props that provide key information") ----------

/** ItemFileInfo: a content-file reference with its optional icon (digital materials, calculator info). */
export const QtiItemFileInfoSchema = strictObject({
  mimeType: QtiMimeTypeSchema.optional(),
  label: z.string().optional(),
  fileHref: z.string().min(1),
  resourceIcon: z.string().optional(),
});

/** A measured increment: decimal value plus its required unit (linear or radial). */
export const QtiMeasurementValueSchema = strictObject({
  value: z.number(),
  unit: z.enum([
    "Millimeter",
    "Centimeter",
    "Meter",
    "Kilometer",
    "Inch",
    "Foot",
    "Yard",
    "Mile",
    "Radian",
    "Degree",
    "Minute",
    "Second",
  ]),
});

export const QtiCompanionCalculatorSchema = strictObject({
  calculatorType: z.enum(["basic", "standard", "scientific", "graphing"]),
  description: z.string(),
  calculatorInfo: QtiItemFileInfoSchema.optional(),
});

export const QtiCompanionRuleSystemSchema = strictObject({
  minimumLength: z.number().int(),
  minorIncrement: QtiMeasurementValueSchema.optional(),
  majorIncrement: QtiMeasurementValueSchema,
});

export const QtiCompanionRuleSchema = strictObject({
  description: z.string(),
  ruleSystemSi: QtiCompanionRuleSystemSchema.optional(),
  ruleSystemUs: QtiCompanionRuleSystemSchema.optional(),
});

export const QtiCompanionProtractorIncrementSchema = strictObject({
  minorIncrement: QtiMeasurementValueSchema.optional(),
  majorIncrement: QtiMeasurementValueSchema,
});

export const QtiCompanionProtractorSchema = strictObject({
  description: z.string(),
  incrementSi: QtiCompanionProtractorIncrementSchema.optional(),
  incrementUs: QtiCompanionProtractorIncrementSchema.optional(),
});

export const QtiCompanionMaterialsInfoSchema = strictObject({
  calculators: z.array(QtiCompanionCalculatorSchema).optional(),
  rules: z.array(QtiCompanionRuleSchema).optional(),
  protractors: z.array(QtiCompanionProtractorSchema).optional(),
  digitalMaterials: z.array(QtiItemFileInfoSchema).optional(),
  physicalMaterials: z.array(z.string()).optional(),
  extensions: z.array(z.unknown()).optional(),
});

export const QtiAdaptiveHrefSchema = strictObject({
  identifier: QtiIdentifierSchema,
  href: z.string(),
});

export const QtiAdaptiveSelectionSchema = strictObject({
  adaptiveEngineRef: QtiAdaptiveHrefSchema,
  adaptiveSettingsRef: QtiAdaptiveHrefSchema.optional(),
  usagedataRef: QtiAdaptiveHrefSchema.optional(),
  metadataRef: QtiAdaptiveHrefSchema.optional(),
});

export const QtiSelectionSchema = strictObject({
  select: z.number().int(),
  withReplacement: z.boolean().optional(),
  extensions: z.array(z.unknown()).optional(),
  foreignAttributes: XmlForeignAttributesSchema.optional(),
});

export const QtiOrderingSchema = strictObject({
  shuffle: z.boolean().optional(),
  extensions: z.array(z.unknown()).optional(),
  foreignAttributes: XmlForeignAttributesSchema.optional(),
});

export const QtiAssessmentItemRefSchema = strictObject({
  identifier: QtiIdentifierSchema,
  required: z.boolean().optional(),
  fixed: z.boolean().optional(),
  class: QtiStringListSchema.optional(),
  href: z.string(),
  category: QtiIdentifierListSchema.optional(),
  preConditions: z.array(QtiPreConditionSchema).optional(),
  branchRules: z.array(QtiBranchRuleSchema).optional(),
  itemSessionControl: QtiItemSessionControlSchema.optional(),
  timeLimits: QtiTimeLimitsSchema.optional(),
  variableMappings: z.array(QtiVariableMappingSchema).optional(),
  weights: z.array(QtiWeightSchema).optional(),
  templateDefaults: z.array(QtiTemplateDefaultSchema).optional(),
  foreignAttributes: XmlForeignAttributesSchema.optional(),
});

export const QtiAssessmentSectionRefSchema = strictObject({
  identifier: QtiIdentifierSchema,
  class: QtiStringListSchema.optional(),
  href: z.string(),
  foreignAttributes: XmlForeignAttributesSchema.optional(),
});

export const QtiAssessmentStimulusRefSchema = strictObject({
  identifier: QtiIdentifierSchema,
  href: z.string(),
  title: z.string().optional(),
  foreignAttributes: XmlForeignAttributesSchema.optional(),
});

/**
 * The ASI node fields the cross-validators read. Nodes arrive pre-validation
 * (these refinements run during parsing), so every field stays `unknown` until
 * narrowed; the declared names are the QTI vocabulary the checks are defined
 * over -- anything else on a node flows through the index signature.
 */
type AsiNodeView = {
  kind?: unknown;
  identifier?: unknown;
  responseIdentifier?: unknown;
  content?: unknown;
  simpleChoices?: unknown;
  inlineChoices?: unknown;
  gapChoices?: unknown;
  hotspotChoices?: unknown;
  minChoices?: unknown;
  maxChoices?: unknown;
  minStrings?: unknown;
  maxStrings?: unknown;
  minAssociations?: unknown;
  maxAssociations?: unknown;
  minPlays?: unknown;
  maxPlays?: unknown;
  lowerBound?: unknown;
  upperBound?: unknown;
  [key: string]: unknown;
};

function walkUnknown(value: unknown, visit: (node: AsiNodeView) => void) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkUnknown(entry, visit);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const node = value as AsiNodeView;
  visit(node);

  for (const [key, child] of Object.entries(node)) {
    if (key === "foreignAttributes" || key === "ariaAttributes" || key === "attributes" || key === "extensions") {
      continue;
    }
    walkUnknown(child, visit);
  }
}

function containsInteraction(value: unknown): boolean {
  let found = false;

  walkUnknown(value, (node) => {
    const kind = typeof node.kind === "string" ? node.kind : null;
    if (kind && interactionKinds.has(kind)) {
      found = true;
    }
  });

  return found;
}

function collectInteractionNodes(value: unknown): AsiNodeView[] {
  const interactions: AsiNodeView[] = [];

  walkUnknown(value, (node) => {
    const kind = typeof node.kind === "string" ? node.kind : null;
    if (kind && interactionKinds.has(kind)) {
      interactions.push(node);
    }
  });

  return interactions;
}

function collectNodesByKind(value: unknown, kinds: readonly string[]): AsiNodeView[] {
  const matches: AsiNodeView[] = [];
  const kindSet = new Set(kinds);

  walkUnknown(value, (node) => {
    const kind = typeof node.kind === "string" ? node.kind : null;
    if (kind && kindSet.has(kind)) {
      matches.push(node);
    }
  });

  return matches;
}

type QtiSectionValidationValue = {
  adaptiveSelection?: unknown;
  selection?: { select: number; withReplacement?: boolean };
  ordering?: unknown;
  children?: Array<{ identifier?: string }>;
};

type QtiModalFeedbackValidationValue = {
  outcomeIdentifier: string;
  content?: unknown;
};

type QtiItemValidationValue = {
  contextDeclarations?: Array<{ identifier: string }>;
  responseDeclarations?: Array<z.infer<typeof QtiResponseDeclarationSchema>>;
  outcomeDeclarations?: Array<z.infer<typeof QtiOutcomeDeclarationSchema>>;
  templateDeclarations?: Array<z.infer<typeof QtiTemplateDeclarationSchema>>;
  itemBody?: { content?: unknown };
  modalFeedbacks?: Array<QtiModalFeedbackValidationValue>;
  responseProcessing?: unknown;
  templateProcessing?: unknown;
};

type QtiTestPartValidationValue = {
  identifier: string;
};

type QtiTestFeedbackValidationValue = {
  outcomeIdentifier: string;
  content?: unknown;
};

type QtiTestValidationValue = {
  contextDeclarations?: Array<{ identifier: string }>;
  outcomeDeclarations?: Array<z.infer<typeof QtiOutcomeDeclarationSchema>>;
  testParts?: Array<QtiTestPartValidationValue>;
  testFeedbacks?: Array<QtiTestFeedbackValidationValue>;
  outcomeProcessing?: unknown;
};

function validateOutcomeDeclarationConventions(
  declarations: readonly z.infer<typeof QtiOutcomeDeclarationSchema>[],
  context: z.RefinementCtx,
  path: Array<string | number>,
) {
  for (const [index, declaration] of declarations.entries()) {
    // The information model recommends float, but the XSD does not enforce it and the
    // official corpus ships integer SCOREs — require single numeric, nothing stricter.
    if (
      ["SCORE", "MAXSCORE"].includes(declaration.identifier) &&
      (!["float", "integer"].includes(declaration.baseType ?? "") || declaration.cardinality !== "single")
    ) {
      addIssue(
        context,
        [...path, index],
        `${declaration.identifier} should be a single numeric outcome (baseType 'float' or 'integer').`,
      );
    }

    if (
      declaration.identifier === "PASSED" &&
      (declaration.baseType !== "boolean" || declaration.cardinality !== "single")
    ) {
      addIssue(context, [...path, index], "PASSED should have baseType 'boolean' and cardinality 'single'.");
    }
  }
}

function addDuplicateSummaryIssue(
  context: z.RefinementCtx,
  path: Array<string | number>,
  label: string,
  values: string[],
) {
  const duplicates = collectDuplicates(values);
  if (!duplicates.length) {
    return;
  }

  addIssue(context, path, `${label} must be unique. Duplicates: ${duplicates.join(", ")}.`);
}

function validateResponseBinding(
  interaction: AsiNodeView,
  responsesById: Map<string, z.infer<typeof QtiResponseDeclarationSchema>>,
  context: z.RefinementCtx,
  path: Array<string | number>,
) {
  const kind = interaction.kind as string;
  const responseIdentifier = typeof interaction.responseIdentifier === "string" ? interaction.responseIdentifier : null;

  if (!responseIdentifier) {
    return;
  }

  const declaration = responsesById.get(responseIdentifier);
  if (!declaration) {
    addIssue(context, path, `${kind} references undeclared response identifier '${responseIdentifier}'.`);
    return;
  }

  const requireBaseAndCardinality = (baseTypes: readonly string[], cardinalities: readonly string[]) => {
    if (!baseTypes.includes(declaration.baseType ?? "")) {
      addIssue(
        context,
        path,
        `${kind} requires response '${responseIdentifier}' to use baseType ${baseTypes.join(" or ")}.`,
      );
    }

    if (!cardinalities.includes(declaration.cardinality)) {
      addIssue(
        context,
        path,
        `${kind} requires response '${responseIdentifier}' to use cardinality ${cardinalities.join(" or ")}.`,
      );
    }
  };

  switch (kind) {
    case "choiceInteraction": {
      requireBaseAndCardinality(["identifier"], ["single", "multiple"]);
      addDuplicateSummaryIssue(
        context,
        path,
        "simpleChoice identifiers",
        asArray(interaction.simpleChoices as Array<{ identifier?: string }>).flatMap((choice) =>
          typeof choice.identifier === "string" ? [choice.identifier] : [],
        ),
      );
      const minChoices = minOf(interaction.minChoices);
      const maxChoices = boundedMax(interaction.maxChoices);
      if (minChoices !== undefined && maxChoices !== undefined && minChoices > maxChoices) {
        addIssue(context, path, "choiceInteraction minChoices must not exceed maxChoices.");
      }
      break;
    }

    case "inlineChoiceInteraction": {
      requireBaseAndCardinality(["identifier"], ["single"]);
      addDuplicateSummaryIssue(
        context,
        path,
        "inlineChoice identifiers",
        asArray(interaction.inlineChoices as Array<{ identifier?: string }>).flatMap((choice) =>
          typeof choice.identifier === "string" ? [choice.identifier] : [],
        ),
      );
      break;
    }

    case "textEntryInteraction": {
      if (declaration.cardinality === "record") {
        break;
      }
      requireBaseAndCardinality(["string", "integer", "float"], ["single"]);
      break;
    }

    case "extendedTextInteraction": {
      if (declaration.cardinality === "record") {
        break;
      }
      requireBaseAndCardinality(["string", "integer", "float"], ["single", "multiple", "ordered"]);
      const minStrings = minOf(interaction.minStrings);
      const maxStrings = boundedMax(interaction.maxStrings);
      if (minStrings !== undefined && maxStrings !== undefined && minStrings > maxStrings) {
        addIssue(context, path, "extendedTextInteraction minStrings must not exceed maxStrings.");
      }
      break;
    }

    case "matchInteraction": {
      requireBaseAndCardinality(["directedPair"], ["single", "multiple"]);
      const minAssociations = minOf(interaction.minAssociations);
      const maxAssociations = boundedMax(interaction.maxAssociations);
      if (minAssociations !== undefined && maxAssociations !== undefined && minAssociations > maxAssociations) {
        addIssue(context, path, "matchInteraction minAssociations must not exceed maxAssociations.");
      }
      break;
    }

    case "gapMatchInteraction": {
      requireBaseAndCardinality(["directedPair"], ["single", "multiple"]);
      addDuplicateSummaryIssue(
        context,
        path,
        "gap choice identifiers",
        asArray(interaction.gapChoices as Array<{ identifier?: string }>).flatMap((choice) =>
          typeof choice.identifier === "string" ? [choice.identifier] : [],
        ),
      );
      const minAssociations = minOf(interaction.minAssociations);
      const maxAssociations = boundedMax(interaction.maxAssociations);
      if (minAssociations !== undefined && maxAssociations !== undefined && minAssociations > maxAssociations) {
        addIssue(context, path, "gapMatchInteraction minAssociations must not exceed maxAssociations.");
      }
      break;
    }

    case "mediaInteraction": {
      requireBaseAndCardinality(["integer"], ["single"]);
      const minPlays = minOf(interaction.minPlays);
      const maxPlays = boundedMax(interaction.maxPlays);
      if (minPlays !== undefined && maxPlays !== undefined && minPlays > maxPlays) {
        addIssue(context, path, "mediaInteraction minPlays must not exceed maxPlays.");
      }
      break;
    }

    case "uploadInteraction": {
      requireBaseAndCardinality(["file"], ["single"]);
      break;
    }

    case "orderInteraction": {
      requireBaseAndCardinality(["identifier"], ["ordered"]);
      addDuplicateSummaryIssue(
        context,
        path,
        "order interaction choice identifiers",
        asArray(interaction.simpleChoices as Array<{ identifier?: string }>).flatMap((choice) =>
          typeof choice.identifier === "string" ? [choice.identifier] : [],
        ),
      );
      break;
    }

    case "hotTextInteraction": {
      requireBaseAndCardinality(["identifier"], ["single", "multiple"]);
      addDuplicateSummaryIssue(
        context,
        path,
        "hotText identifiers",
        collectNodesByKind(interaction.content, ["hotText"]).flatMap((node) =>
          typeof node.identifier === "string" ? [node.identifier] : [],
        ),
      );
      break;
    }

    case "hotspotInteraction": {
      requireBaseAndCardinality(["identifier"], ["single", "multiple"]);
      addDuplicateSummaryIssue(
        context,
        path,
        "hotspotChoice identifiers",
        asArray(interaction.hotspotChoices as Array<{ identifier?: string }>).flatMap((choice) =>
          typeof choice.identifier === "string" ? [choice.identifier] : [],
        ),
      );
      const minChoices = minOf(interaction.minChoices);
      const maxChoices = boundedMax(interaction.maxChoices);
      if (minChoices !== undefined && maxChoices !== undefined && minChoices > maxChoices) {
        addIssue(context, path, "hotspotInteraction minChoices must not exceed maxChoices.");
      }
      break;
    }

    case "associateInteraction":
    case "graphicAssociateInteraction": {
      requireBaseAndCardinality(["pair"], ["single", "multiple"]);
      const minAssociations = minOf(interaction.minAssociations);
      const maxAssociations = boundedMax(interaction.maxAssociations);
      if (minAssociations !== undefined && maxAssociations !== undefined && minAssociations > maxAssociations) {
        addIssue(context, path, `${kind} minAssociations must not exceed maxAssociations.`);
      }
      break;
    }

    case "graphicGapMatchInteraction": {
      requireBaseAndCardinality(["directedPair"], ["multiple"]);
      break;
    }

    case "graphicOrderInteraction": {
      requireBaseAndCardinality(["identifier"], ["ordered"]);
      break;
    }

    case "selectPointInteraction":
    case "positionObjectInteraction": {
      requireBaseAndCardinality(["point"], ["single", "multiple"]);
      const minChoices = minOf(interaction.minChoices);
      const maxChoices = boundedMax(interaction.maxChoices);
      if (minChoices !== undefined && maxChoices !== undefined && minChoices > maxChoices) {
        addIssue(context, path, `${kind} minChoices must not exceed maxChoices.`);
      }
      break;
    }

    case "sliderInteraction": {
      requireBaseAndCardinality(["integer", "float"], ["single"]);
      const lowerBound = typeof interaction.lowerBound === "number" ? interaction.lowerBound : undefined;
      const upperBound = typeof interaction.upperBound === "number" ? interaction.upperBound : undefined;
      if (lowerBound !== undefined && upperBound !== undefined && lowerBound > upperBound) {
        addIssue(context, path, "sliderInteraction lowerBound must not exceed upperBound.");
      }
      break;
    }
  }
}

/**
 * Built-in session outcomes every QTI item declares implicitly. `completion_status`
 * is the snake_case authoring of the same built-in that the official corpus ships
 * (the runtime treats it as an alias when reading adaptive completion).
 */
const builtInOutcomeIdentifiers = new Set(["completionStatus", "completion_status"]);

function validateOutcomeReferences(
  value: unknown,
  declaredOutcomes: Map<string, unknown>,
  context: z.RefinementCtx,
  path: Array<string | number>,
) {
  for (const rule of collectNodesByKind(value, ["setOutcomeValue", "lookupOutcomeValue"])) {
    const identifier = typeof rule.identifier === "string" ? rule.identifier : undefined;
    if (identifier && !declaredOutcomes.has(identifier) && !builtInOutcomeIdentifiers.has(identifier)) {
      addIssue(context, path, `Processing rule references undeclared outcome identifier '${identifier}'.`);
    }
  }
}

/** QTI max-* attributes use 0 to mean "unbounded"; bound checks must ignore it. */
function boundedMax(value: unknown): number | undefined {
  return typeof value === "number" && value > 0 ? value : undefined;
}

function minOf(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function validateTemplateAndResponseReferences(
  value: unknown,
  declaredTemplates: Map<string, unknown>,
  declaredResponses: Map<string, unknown>,
  context: z.RefinementCtx,
  path: Array<string | number>,
) {
  for (const rule of collectNodesByKind(value, ["setTemplateValue"])) {
    const identifier = typeof rule.identifier === "string" ? rule.identifier : undefined;
    if (identifier && !declaredTemplates.has(identifier)) {
      addIssue(context, path, `Template processing references undeclared template identifier '${identifier}'.`);
    }
  }

  for (const rule of collectNodesByKind(value, ["setDefaultValue", "setCorrectResponse"])) {
    const identifier = typeof rule.identifier === "string" ? rule.identifier : undefined;
    if (identifier && !declaredResponses.has(identifier)) {
      addIssue(context, path, `Template processing references undeclared response identifier '${identifier}'.`);
    }
  }
}

export const QtiAssessmentSectionRawSchema: z.ZodType = z.lazy(() =>
  strictObject({
    identifier: QtiIdentifierSchema,
    required: z.boolean().optional(),
    fixed: z.boolean().optional(),
    title: z.string(),
    class: QtiStringListSchema.optional(),
    visible: z.boolean(),
    keepTogether: z.boolean().optional(),
    preConditions: z.array(QtiPreConditionSchema).optional(),
    branchRules: z.array(QtiBranchRuleSchema).optional(),
    itemSessionControl: QtiItemSessionControlSchema.optional(),
    timeLimits: QtiTimeLimitsSchema.optional(),
    adaptiveSelection: QtiAdaptiveSelectionSchema.optional(),
    selection: QtiSelectionSchema.optional(),
    ordering: QtiOrderingSchema.optional(),
    rubricBlocks: z.array(QtiTestRubricBlockSchema).optional(),
    children: z
      .array(
        z.union([
          QtiIncludeSchema,
          QtiAssessmentItemRefSchema,
          QtiAssessmentSectionSchema,
          QtiAssessmentSectionRefSchema,
        ]),
      )
      .optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiAssessmentSectionSchema: z.ZodType = QtiAssessmentSectionRawSchema.superRefine(
  (value: unknown, context) => {
    const section = value as QtiSectionValidationValue;

    if (section.adaptiveSelection && (section.selection || section.ordering)) {
      addIssue(context, [], "adaptiveSelection cannot be combined with selection or ordering.");
    }

    const childIdentifiers = asArray(section.children).flatMap((child) =>
      typeof child.identifier === "string" ? [child.identifier] : [],
    );

    addDuplicateSummaryIssue(context, ["children"], "assessment section child identifiers", childIdentifiers);

    if (
      section.selection &&
      section.selection.withReplacement !== true &&
      section.children?.length &&
      section.selection.select > section.children.length
    ) {
      addIssue(
        context,
        ["selection", "select"],
        "selection.select cannot exceed the number of available children when withReplacement is false.",
      );
    }
  },
);

export const QtiTestPartSchema: z.ZodType = z.lazy(() =>
  strictObject({
    identifier: QtiIdentifierSchema,
    title: z.string().optional(),
    class: QtiStringListSchema.optional(),
    navigationMode: QtiNavigationModeSchema,
    submissionMode: QtiSubmissionModeSchema,
    preConditions: z.array(QtiPreConditionSchema).optional(),
    branchRules: z.array(QtiBranchRuleSchema).optional(),
    itemSessionControl: QtiItemSessionControlSchema.optional(),
    timeLimits: QtiTimeLimitsSchema.optional(),
    rubricBlocks: z.array(QtiTestRubricBlockSchema).optional(),
    children: z.array(z.union([QtiAssessmentSectionSchema, QtiAssessmentSectionRefSchema])).min(1),
    testFeedbacks: z.array(QtiTestFeedbackSchema).optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiAssessmentStimulusSchema: z.ZodType = z.lazy(() =>
  strictObject({
    identifier: QtiIdentifierSchema,
    title: z.string(),
    label: z.string().optional(),
    xmlLang: z.string().optional(),
    toolName: z.string().optional(),
    toolVersion: z.string().optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    stimulusBody: QtiStimulusBodySchema,
    catalogInfo: QtiCatalogInfoSchema.optional(),
  }),
);

export const QtiAssessmentItemRawSchema: z.ZodType = z.lazy(() =>
  strictObject({
    identifier: QtiIdentifierSchema,
    title: z.string(),
    label: z.string().optional(),
    xmlLang: z.string().optional(),
    toolName: z.string().optional(),
    toolVersion: z.string().optional(),
    adaptive: z.boolean().optional(),
    timeDependent: z.boolean(),
    contextDeclarations: z.array(QtiContextDeclarationSchema).optional(),
    responseDeclarations: z.array(QtiResponseDeclarationSchema).optional(),
    outcomeDeclarations: z.array(QtiOutcomeDeclarationSchema).optional(),
    templateDeclarations: z.array(QtiTemplateDeclarationSchema).optional(),
    templateProcessing: QtiTemplateProcessingSchema.optional(),
    assessmentStimulusRefs: z.array(QtiAssessmentStimulusRefSchema).optional(),
    companionMaterialsInfo: QtiCompanionMaterialsInfoSchema.optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    itemBody: QtiItemBodySchema.optional(),
    catalogInfo: QtiCatalogInfoSchema.optional(),
    responseProcessing: QtiResponseProcessingSchema.optional(),
    modalFeedbacks: z.array(QtiModalFeedbackSchema).optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiAssessmentItemSchema: z.ZodType = QtiAssessmentItemRawSchema.superRefine((value: unknown, context) => {
  const item = value as QtiItemValidationValue;
  const contextDeclarations = asArray(item.contextDeclarations);
  const responseDeclarationsList = asArray(item.responseDeclarations);
  const outcomeDeclarationsList = asArray(item.outcomeDeclarations);
  const templateDeclarationsList = asArray(item.templateDeclarations);
  const modalFeedbacks = asArray(item.modalFeedbacks);

  const variableDeclarations = [
    ...contextDeclarations,
    ...responseDeclarationsList,
    ...outcomeDeclarationsList,
    ...templateDeclarationsList,
  ];

  addDuplicateSummaryIssue(
    context,
    [],
    "assessment item variable declaration identifiers",
    variableDeclarations.map((declaration) => declaration.identifier),
  );

  validateOutcomeDeclarationConventions(outcomeDeclarationsList, context, ["outcomeDeclarations"]);

  const responseDeclarations = new Map(
    responseDeclarationsList.map((declaration) => [declaration.identifier, declaration]),
  );
  const outcomeDeclarations = new Map(
    outcomeDeclarationsList.map((declaration) => [declaration.identifier, declaration]),
  );
  const templateDeclarations = new Map(
    templateDeclarationsList.map((declaration) => [declaration.identifier, declaration]),
  );

  const interactions = collectInteractionNodes(item.itemBody?.content);
  const responseBindings = new Map<string, string[]>();

  for (const interaction of interactions) {
    const responseIdentifier =
      typeof interaction.responseIdentifier === "string" ? interaction.responseIdentifier : undefined;
    if (responseIdentifier) {
      const boundKinds = responseBindings.get(responseIdentifier) ?? [];
      boundKinds.push(String(interaction.kind));
      responseBindings.set(responseIdentifier, boundKinds);
    }

    validateResponseBinding(interaction, responseDeclarations, context, ["itemBody"]);
  }

  for (const [identifier, kinds] of responseBindings) {
    if (kinds.length > 1) {
      addIssue(
        context,
        ["itemBody"],
        `Response identifier '${identifier}' is bound by multiple interactions: ${kinds.join(", ")}.`,
      );
    }
  }

  for (const [index, feedback] of modalFeedbacks.entries()) {
    if (!outcomeDeclarations.has(feedback.outcomeIdentifier)) {
      addIssue(
        context,
        ["modalFeedbacks", index, "outcomeIdentifier"],
        `modalFeedback references undeclared outcome identifier '${feedback.outcomeIdentifier}'.`,
      );
    }

    if (containsInteraction(feedback.content)) {
      addIssue(context, ["modalFeedbacks", index, "content"], "modalFeedback content must not contain interactions.");
    }
  }

  validateOutcomeReferences(item.responseProcessing, outcomeDeclarations, context, ["responseProcessing"]);
  validateTemplateAndResponseReferences(item.templateProcessing, templateDeclarations, responseDeclarations, context, [
    "templateProcessing",
  ]);
});

export const QtiAssessmentTestRawSchema: z.ZodType = z.lazy(() =>
  strictObject({
    identifier: QtiIdentifierSchema,
    title: z.string(),
    class: QtiStringListSchema.optional(),
    toolName: z.string().optional(),
    toolVersion: z.string().optional(),
    contextDeclarations: z.array(QtiContextDeclarationSchema).optional(),
    outcomeDeclarations: z.array(QtiOutcomeDeclarationSchema).optional(),
    timeLimits: QtiTimeLimitsSchema.optional(),
    stylesheets: z.array(QtiStyleSheetSchema).optional(),
    rubricBlocks: z.array(QtiTestRubricBlockSchema).optional(),
    testParts: z.array(QtiTestPartSchema).min(1),
    outcomeProcessing: QtiOutcomeProcessingSchema.optional(),
    testFeedbacks: z.array(QtiTestFeedbackSchema).optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  }),
);

export const QtiAssessmentTestSchema: z.ZodType = QtiAssessmentTestRawSchema.superRefine((value: unknown, context) => {
  const testValue = value as QtiTestValidationValue;
  const contextDeclarations = asArray(testValue.contextDeclarations);
  const outcomeDeclarationsList = asArray(testValue.outcomeDeclarations);
  const testParts = asArray(testValue.testParts);
  const testFeedbacks = asArray(testValue.testFeedbacks);

  addDuplicateSummaryIssue(context, [], "assessment test variable declaration identifiers", [
    ...contextDeclarations.map((declaration) => declaration.identifier),
    ...outcomeDeclarationsList.map((declaration) => declaration.identifier),
  ]);

  addDuplicateSummaryIssue(
    context,
    ["testParts"],
    "test part identifiers",
    testParts.map((testPart) => testPart.identifier),
  );

  validateOutcomeDeclarationConventions(outcomeDeclarationsList, context, ["outcomeDeclarations"]);

  const outcomes = new Map(outcomeDeclarationsList.map((declaration) => [declaration.identifier, declaration]));

  for (const [index, feedback] of testFeedbacks.entries()) {
    if (!outcomes.has(feedback.outcomeIdentifier)) {
      addIssue(
        context,
        ["testFeedbacks", index, "outcomeIdentifier"],
        `testFeedback references undeclared outcome identifier '${feedback.outcomeIdentifier}'.`,
      );
    }

    if (containsInteraction(feedback.content)) {
      addIssue(context, ["testFeedbacks", index, "content"], "testFeedback content must not contain interactions.");
    }
  }

  validateOutcomeReferences(testValue.outcomeProcessing, outcomes, context, ["outcomeProcessing"]);
});
// Inferred types from exported Zod validators.
export type QtiPrintedVariable = z.infer<typeof QtiPrintedVariableSchema>;
export type QtiInteractionModule = z.infer<typeof QtiInteractionModuleSchema>;
export type QtiInteractionModules = z.infer<typeof QtiInteractionModulesSchema>;
export type QtiGap = z.infer<typeof QtiGapSchema>;
export type QtiHotspotChoice = z.infer<typeof QtiHotspotChoiceSchema>;
export type QtiAssociableHotspot = z.infer<typeof QtiAssociableHotspotSchema>;
export type QtiTextEntryInteraction = z.infer<typeof QtiTextEntryInteractionSchema>;
export type QtiGapChoice = z.infer<typeof QtiGapChoiceSchema>;
export type QtiCompanionMaterialsInfo = z.infer<typeof QtiCompanionMaterialsInfoSchema>;
export type QtiAdaptiveHref = z.infer<typeof QtiAdaptiveHrefSchema>;
export type QtiAdaptiveSelection = z.infer<typeof QtiAdaptiveSelectionSchema>;
export type QtiItemFileInfo = z.infer<typeof QtiItemFileInfoSchema>;
export type QtiMeasurementValue = z.infer<typeof QtiMeasurementValueSchema>;
export type QtiCompanionCalculator = z.infer<typeof QtiCompanionCalculatorSchema>;
export type QtiCompanionRuleSystem = z.infer<typeof QtiCompanionRuleSystemSchema>;
export type QtiCompanionRule = z.infer<typeof QtiCompanionRuleSchema>;
export type QtiCompanionProtractorIncrement = z.infer<typeof QtiCompanionProtractorIncrementSchema>;
export type QtiCompanionProtractor = z.infer<typeof QtiCompanionProtractorSchema>;
export type QtiSelection = z.infer<typeof QtiSelectionSchema>;
export type QtiOrdering = z.infer<typeof QtiOrderingSchema>;
export type QtiAssessmentItemRef = z.infer<typeof QtiAssessmentItemRefSchema>;
export type QtiAssessmentSectionRef = z.infer<typeof QtiAssessmentSectionRefSchema>;
export type QtiAssessmentStimulusRef = z.infer<typeof QtiAssessmentStimulusRefSchema>;
