import { z } from "zod";

import {
  QtiBaseTypeSchema,
  QtiCardinalitySchema,
  QtiCoordsSchema,
  QtiExternalScoredSchema,
  QtiIdentifierSchema,
  QtiMimeTypeSchema,
  QtiShapeSchema,
  QtiViewSchema,
  addIssue,
  createXmlNodeSchema,
  strictObject,
} from "./shared";

export const QtiValueSchema = strictObject({
  value: z.string(),
  fieldIdentifier: QtiIdentifierSchema.optional(),
  baseType: QtiBaseTypeSchema.optional(),
});

export const QtiDefaultValueSchema = strictObject({
  values: z.array(QtiValueSchema).min(1),
  interpretation: z.string().optional(),
});

export const QtiCorrectResponseSchema = strictObject({
  values: z.array(QtiValueSchema).min(1),
  interpretation: z.string().optional(),
});

export const QtiAreaMapEntrySchema = strictObject({
  shape: QtiShapeSchema,
  coords: QtiCoordsSchema,
  mappedValue: z.number(),
});

export const QtiAreaMappingSchema = strictObject({
  areaMapEntries: z.array(QtiAreaMapEntrySchema).min(1),
  lowerBound: z.number().optional(),
  upperBound: z.number().optional(),
  defaultValue: z.number().optional(),
});

export const QtiMapEntrySchema = strictObject({
  mapKey: z.string(),
  mappedValue: z.number(),
  caseSensitive: z.boolean().optional(),
});

export const QtiMappingSchema = strictObject({
  mapEntries: z.array(QtiMapEntrySchema).min(1),
  lowerBound: z.number().optional(),
  upperBound: z.number().optional(),
  defaultValue: z.number().optional(),
});

export const QtiInterpolationTableEntrySchema = strictObject({
  sourceValue: z.number(),
  includeBoundary: z.boolean().optional(),
  targetValue: z.string(),
});

export const QtiInterpolationTableSchema = strictObject({
  interpolationTableEntries: z.array(QtiInterpolationTableEntrySchema).min(1),
  defaultValue: z.string().optional(),
});

export const QtiMatchTableEntrySchema = strictObject({
  sourceValue: z.number().int(),
  targetValue: z.string(),
});

export const QtiMatchTableSchema = strictObject({
  matchTableEntries: z.array(QtiMatchTableEntrySchema).min(1),
  defaultValue: z.string().optional(),
});

export const QtiStyleSheetSchema = strictObject({
  href: z.string(),
  type: QtiMimeTypeSchema,
  media: z.string().optional(),
  title: z.string().optional(),
});

// ---------- Catalog (CatalogInfo/Catalog/Card/CardEntry, §5.26–5.29) ----------

/**
 * Card support names: "This attribute names either pre-defined supports or a
 * custom-named support" (§5.26.1) — the SupportEnum tokens (§8.38) or the XSD's
 * SupportExtString pattern `(ext:)[a-zA-Z0-9_.\-]+`.
 */
export const QtiSupportNameSchema = z.union([
  z.enum([
    "additional-directions",
    "audio-description",
    "braille",
    "glossary-on-screen",
    "high-contrast",
    "keyboard-directions",
    "keyword-translation",
    "linguistic-guidance",
    "long-description",
    "sign-language",
    "simplified-language-portions",
    "simplified-graphics",
    "spoken",
    "tactile",
    "transcript",
  ]),
  z.string().regex(/^ext:[a-zA-Z0-9_.-]+$/u),
]);

/** Generic mixed HTML flow inside catalog content (HTMLContentFlow has no QTI elements). */
const QtiHtmlContentFragmentSchema: z.ZodType = z.lazy(() =>
  z.union([z.string(), createXmlNodeSchema(QtiHtmlContentFragmentSchema)]),
);

/** FileHrefCard (§7.15): a content-file URI with its required mime-type. */
export const QtiFileHrefCardSchema = strictObject({
  href: z.string(),
  mimeType: QtiMimeTypeSchema,
});

/** HTMLContent (§5.63): the dormant alternative content in HTML format. */
export const QtiCatalogHtmlContentSchema = strictObject({
  xmlLang: z.string().optional(),
  /** data-* extension characteristics, keyed without the "data-" prefix. */
  dataAttributes: z.record(z.string(), z.string()).optional(),
  content: z.array(QtiHtmlContentFragmentSchema).optional(),
});

/**
 * CardEntry (§5.27): "an attribute (often custom attributes) on the CardEntry element
 * declares the difference between the resources, and where the attribute value aligns
 * with a specific preference/need from the candidate's PNP".
 */
export const QtiCardEntrySchema = strictObject({
  xmlLang: z.string().optional(),
  default: z.boolean().optional(),
  /** data-* discriminators (e.g. data-reading-type), keyed without the "data-" prefix. */
  dataAttributes: z.record(z.string(), z.string()).optional(),
  htmlContent: QtiCatalogHtmlContentSchema.optional(),
  fileHrefs: z.array(QtiFileHrefCardSchema).optional(),
});

/**
 * Card (§5.26): dormant content for one named support. The XSD is a choice — either
 * direct content (qti-html-content/qti-file-href) or card entries, never both.
 */
export const QtiCardSchema = strictObject({
  support: QtiSupportNameSchema,
  xmlLang: z.string().optional(),
  htmlContent: QtiCatalogHtmlContentSchema.optional(),
  fileHrefs: z.array(QtiFileHrefCardSchema).optional(),
  cardEntries: z.array(QtiCardEntrySchema).min(1).optional(),
}).superRefine((value, context) => {
  if (value.cardEntries && (value.htmlContent || value.fileHrefs)) {
    addIssue(context, ["cardEntries"], "A card holds either card entries or direct content, not both.");
  }

  // "Only one of the CardEntry instances can have a default designation." (§5.27.2)
  const defaults = (value.cardEntries ?? []).filter((entry) => entry.default === true).length;
  if (defaults > 1) {
    addIssue(context, ["cardEntries"], "Only one card entry may be designated as the default.");
  }
});

/** Catalog (§5.28): "located … from a data-catalog-idref" via its unique id. */
export const QtiCatalogSchema = strictObject({
  id: z.string().min(1),
  cards: z.array(QtiCardSchema).min(1),
});

export const QtiCatalogInfoSchema = strictObject({
  catalogs: z.array(QtiCatalogSchema).min(1),
});

export const QtiItemSessionControlSchema = strictObject({
  maxAttempts: z.number().int().optional(),
  showFeedback: z.boolean().optional(),
  allowReview: z.boolean().optional(),
  showSolution: z.boolean().optional(),
  allowComment: z.boolean().optional(),
  allowSkipping: z.boolean().optional(),
  validateResponses: z.boolean().optional(),
});

export const QtiTimeLimitsSchema = strictObject({
  minTime: z.number().nonnegative().optional(),
  maxTime: z.number().nonnegative().optional(),
  allowLateSubmission: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.minTime !== undefined && value.maxTime !== undefined && value.minTime > value.maxTime) {
    addIssue(context, ["maxTime"], "maxTime must be greater than or equal to minTime.");
  }
});

export const QtiVariableMappingSchema = strictObject({
  sourceIdentifier: QtiIdentifierSchema,
  targetIdentifier: QtiIdentifierSchema,
});

export const QtiWeightSchema = strictObject({
  identifier: QtiIdentifierSchema,
  value: z.number(),
});

function validateValuesForCardinality(
  values: readonly z.infer<typeof QtiValueSchema>[] | undefined,
  cardinality: z.infer<typeof QtiCardinalitySchema>,
  context: z.RefinementCtx,
  path: Array<string | number>,
) {
  if (!values?.length) {
    return;
  }

  if (cardinality === "record") {
    for (const [index, value] of values.entries()) {
      if (!value.fieldIdentifier) {
        addIssue(
          context,
          [...path, index, "fieldIdentifier"],
          "Record cardinality values must define fieldIdentifier.",
        );
      }
    }
    return;
  }

  for (const [index, value] of values.entries()) {
    if (value.fieldIdentifier) {
      addIssue(
        context,
        [...path, index, "fieldIdentifier"],
        "fieldIdentifier is only valid for record cardinality values.",
      );
    }
  }
}

function validateDeclarationBaseType(
  cardinality: z.infer<typeof QtiCardinalitySchema>,
  baseType: z.infer<typeof QtiBaseTypeSchema> | undefined,
  context: z.RefinementCtx,
) {
  if (cardinality === "record" && baseType) {
    addIssue(context, ["baseType"], "baseType must be omitted when cardinality is record.");
  }
}

const QtiVariableDeclarationBaseShape = {
  identifier: QtiIdentifierSchema,
  cardinality: QtiCardinalitySchema,
  baseType: QtiBaseTypeSchema.optional(),
};

export const QtiContextDeclarationSchema = strictObject({
  ...QtiVariableDeclarationBaseShape,
  defaultValue: QtiDefaultValueSchema.optional(),
}).superRefine((value, context) => {
  validateDeclarationBaseType(value.cardinality, value.baseType, context);
  validateValuesForCardinality(value.defaultValue?.values, value.cardinality, context, ["defaultValue", "values"]);
});

export const QtiTemplateDeclarationSchema = strictObject({
  ...QtiVariableDeclarationBaseShape,
  defaultValue: QtiDefaultValueSchema.optional(),
  paramVariable: z.boolean().optional(),
  mathVariable: z.boolean().optional(),
}).superRefine((value, context) => {
  validateDeclarationBaseType(value.cardinality, value.baseType, context);
  validateValuesForCardinality(value.defaultValue?.values, value.cardinality, context, ["defaultValue", "values"]);
});

export const QtiResponseDeclarationRawSchema = strictObject({
  ...QtiVariableDeclarationBaseShape,
  defaultValue: QtiDefaultValueSchema.optional(),
  correctResponse: QtiCorrectResponseSchema.optional(),
  mapping: QtiMappingSchema.optional(),
  areaMapping: QtiAreaMappingSchema.optional(),
});

export const QtiResponseDeclarationSchema = QtiResponseDeclarationRawSchema.superRefine((value, context) => {
  validateDeclarationBaseType(value.cardinality, value.baseType, context);
  validateValuesForCardinality(value.defaultValue?.values, value.cardinality, context, ["defaultValue", "values"]);
  validateValuesForCardinality(value.correctResponse?.values, value.cardinality, context, [
    "correctResponse",
    "values",
  ]);

  if (value.areaMapping && value.baseType !== "point") {
    addIssue(context, ["areaMapping"], "areaMapping is only valid for response declarations with baseType 'point'.");
  }

  if (value.mapping && (value.baseType === "file" || value.baseType === "duration" || value.cardinality === "record")) {
    addIssue(context, ["mapping"], "mapping is not valid for file, duration, or record-valued response declarations.");
  }
});

export const QtiOutcomeDeclarationRawSchema = strictObject({
  ...QtiVariableDeclarationBaseShape,
  defaultValue: QtiDefaultValueSchema.optional(),
  matchTable: QtiMatchTableSchema.optional(),
  interpolationTable: QtiInterpolationTableSchema.optional(),
  view: z.array(QtiViewSchema).optional(),
  interpretation: z.string().optional(),
  longInterpretation: z.string().optional(),
  normalMaximum: z.number().optional(),
  normalMinimum: z.number().optional(),
  masteryValue: z.number().optional(),
  externalScored: QtiExternalScoredSchema.optional(),
  variableIdentifierRef: QtiIdentifierSchema.optional(),
});

export const QtiOutcomeDeclarationSchema = QtiOutcomeDeclarationRawSchema.superRefine((value, context) => {
  validateDeclarationBaseType(value.cardinality, value.baseType, context);
  validateValuesForCardinality(value.defaultValue?.values, value.cardinality, context, ["defaultValue", "values"]);

  if (value.matchTable && value.interpolationTable) {
    addIssue(context, ["matchTable"], "Only one of matchTable or interpolationTable may be supplied.");
  }

  if (
    value.normalMinimum !== undefined &&
    value.normalMaximum !== undefined &&
    value.normalMinimum > value.normalMaximum
  ) {
    addIssue(context, ["normalMaximum"], "normalMaximum must be greater than or equal to normalMinimum.");
  }
});
// Inferred types from exported Zod validators.
export type QtiValue = z.infer<typeof QtiValueSchema>;
export type QtiDefaultValue = z.infer<typeof QtiDefaultValueSchema>;
export type QtiCorrectResponse = z.infer<typeof QtiCorrectResponseSchema>;
export type QtiAreaMapEntry = z.infer<typeof QtiAreaMapEntrySchema>;
export type QtiAreaMapping = z.infer<typeof QtiAreaMappingSchema>;
export type QtiMapEntry = z.infer<typeof QtiMapEntrySchema>;
export type QtiMapping = z.infer<typeof QtiMappingSchema>;
export type QtiInterpolationTableEntry = z.infer<typeof QtiInterpolationTableEntrySchema>;
export type QtiInterpolationTable = z.infer<typeof QtiInterpolationTableSchema>;
export type QtiMatchTableEntry = z.infer<typeof QtiMatchTableEntrySchema>;
export type QtiMatchTable = z.infer<typeof QtiMatchTableSchema>;
export type QtiStyleSheet = z.infer<typeof QtiStyleSheetSchema>;
export type QtiSupportName = z.infer<typeof QtiSupportNameSchema>;
export type QtiFileHrefCard = z.infer<typeof QtiFileHrefCardSchema>;
export type QtiCatalogHtmlContent = z.infer<typeof QtiCatalogHtmlContentSchema>;
export type QtiCardEntry = z.infer<typeof QtiCardEntrySchema>;
export type QtiCard = z.infer<typeof QtiCardSchema>;
export type QtiCatalog = z.infer<typeof QtiCatalogSchema>;
export type QtiCatalogInfo = z.infer<typeof QtiCatalogInfoSchema>;
export type QtiItemSessionControl = z.infer<typeof QtiItemSessionControlSchema>;
export type QtiTimeLimits = z.infer<typeof QtiTimeLimitsSchema>;
export type QtiVariableMapping = z.infer<typeof QtiVariableMappingSchema>;
export type QtiWeight = z.infer<typeof QtiWeightSchema>;
export type QtiContextDeclaration = z.infer<typeof QtiContextDeclarationSchema>;
export type QtiTemplateDeclaration = z.infer<typeof QtiTemplateDeclarationSchema>;
export type QtiResponseDeclarationRaw = z.infer<typeof QtiResponseDeclarationRawSchema>;
export type QtiResponseDeclaration = z.infer<typeof QtiResponseDeclarationSchema>;
export type QtiOutcomeDeclarationRaw = z.infer<typeof QtiOutcomeDeclarationRawSchema>;
export type QtiOutcomeDeclaration = z.infer<typeof QtiOutcomeDeclarationSchema>;
