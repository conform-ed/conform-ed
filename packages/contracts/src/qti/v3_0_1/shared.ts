import { z } from "zod";

export const NonEmptyStringSchema = z.string().min(1);
export const UriReferenceSchema = NonEmptyStringSchema;
export const QtiIdentifierSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9._-]*$/u);
export const QtiIdentifierListSchema = z.array(QtiIdentifierSchema);
export const QtiStringListSchema = z.array(NonEmptyStringSchema);
export const QtiCoordsSchema = NonEmptyStringSchema;
export const QtiMimeTypeSchema = NonEmptyStringSchema;
export const QtiStringOrNumberSchema = z.union([z.string(), z.number()]);
export const QtiIntegerOrVariableSchema = z.union([z.number().int(), NonEmptyStringSchema]);
export const QtiNumberOrVariableSchema = z.union([z.number(), NonEmptyStringSchema]);

export const QtiCardinalitySchema = z.enum(["single", "multiple", "ordered", "record"]);

export const QtiBaseTypeSchema = z.enum([
  "boolean",
  "directedPair",
  "duration",
  "file",
  "float",
  "identifier",
  "integer",
  "pair",
  "point",
  "string",
  "uri",
]);

export const QtiShowHideSchema = z.enum(["show", "hide"]);
export const QtiViewSchema = z.enum(["author", "candidate", "proctor", "scorer", "testConstructor", "tutor"]);
export const QtiDirectionSchema = z.enum(["ltr", "rtl", "auto"]);
export const QtiOrientationSchema = z.enum(["horizontal", "vertical"]);
export const QtiNavigationModeSchema = z.enum(["linear", "nonlinear"]);
export const QtiSubmissionModeSchema = z.enum(["individual", "simultaneous"]);
export const QtiSuppressTtsSchema = z.enum(["computer-read-aloud", "screen-reader", "all"]);
export const QtiShapeSchema = z.enum(["circle", "default", "ellipse", "poly", "rect"]);
export const QtiExternalScoredSchema = z.enum(["externalMachine", "human"]);
export const QtiSessionStatusSchema = z.enum([
  "final",
  "initial",
  "pendingExternalScoring",
  "pendingResponseProcessing",
  "pendingSubmission",
]);
export const QtiScoreStatusSchema = z.enum(["notscored", "scored"]);
export const QtiAnsweredStatusSchema = z.enum(["notpresented", "presented", "attempted", "answered"]);
export const QtiSupportAssignmentSchema = z.enum(["assigned", "universal", "prohibited", "inherit"]);

// WAI-ARIA characteristics (ASI §2.13.3, attribute group `ARIABaseDType`). The XSD enumerates a
// closed vocabulary for these; the rest of the ARIA attributes are IDREF/string/integer and are
// modelled as plain strings on the node (the XML binding carries every attribute value as a string).
export const QtiAriaRoleSchema = z.enum([
  "article",
  "columnheader",
  "definition",
  "document",
  "group",
  "heading",
  "img",
  "list",
  "listitem",
  "math",
  "note",
  "presentation",
  "region",
  "row",
  "rowgroup",
  "rowheader",
  "separator",
  "toolbar",
  "button",
  "checkbox",
  "gridcell",
  "link",
  "log",
  "option",
  "radio",
  "slider",
  "spinbutton",
  "status",
  "tab",
  "tabpanel",
  "textbox",
  "timer",
  "listbox",
  "radiogroup",
  "tablist",
  "complementary",
  "contentinfo",
  "alert",
  "alertdialog",
  "application",
  "banner",
  "combobox",
  "dialog",
  "form",
  "grid",
  "main",
  "marquee",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "navigation",
  "progressbar",
  "scrollbar",
  "search",
  "tooltip",
  "tree",
  "treegrid",
  "treeitem",
  "searchbox",
  "switch",
  "term",
  "figure",
  "code",
  "time",
  "subscript",
  "superscript",
  "meter",
  "generic",
  "insertion",
  "deletion",
  "strong",
  "emphasis",
]);
export const QtiAriaCheckedSchema = z.enum(["true", "false", "mixed", "undefined"]);
export const QtiAriaPressedSchema = z.enum(["true", "false", "mixed", "undefined"]);
export const QtiAriaExpandedSchema = z.enum(["true", "false", "undefined"]);
export const QtiAriaSelectedSchema = z.enum(["true", "false", "undefined"]);
export const QtiAriaLiveSchema = z.enum(["off", "polite", "assertive"]);
export const QtiAriaOrientationSchema = z.enum(["vertical", "horizontal"]);
export const QtiAriaAutocompleteSchema = z.enum(["inline", "list", "both", "none"]);
export const QtiAriaInvalidSchema = z.enum(["true", "false", "grammar", "spelling"]);
export const QtiAriaSortSchema = z.enum(["ascending", "descending", "none", "other"]);
export const QtiAriaCurrentSchema = z.enum(["page", "step", "location", "date", "time", "true", "false", "undefined"]);

export const XmlForeignAttributesSchema = z.record(z.string(), z.unknown());

export const XmlExtensionNodeSchema = z
  .object({
    namespace: NonEmptyStringSchema,
    name: NonEmptyStringSchema,
    value: z.unknown().optional(),
    attributes: XmlForeignAttributesSchema.optional(),
    children: z.array(z.unknown()).optional(),
  })
  .strict();

export const XmlExtensionNodeListSchema = z.array(XmlExtensionNodeSchema);

export function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

export function looseObject<T extends z.ZodRawShape>(shape: T) {
  return strictObject({
    ...shape,
    extensions: XmlExtensionNodeListSchema.optional(),
    foreignAttributes: XmlForeignAttributesSchema.optional(),
  });
}

export function createXmlNodeSchema(childSchema: z.ZodType): z.ZodType {
  return z.lazy(() =>
    strictObject({
      kind: z.literal("xml"),
      namespace: z.string().optional(),
      name: NonEmptyStringSchema,
      value: z.string().optional(),
      attributes: XmlForeignAttributesSchema.optional(),
      children: z.array(childSchema).optional(),
    }),
  );
}

export function addIssue(context: z.RefinementCtx, path: Array<string | number>, message: string) {
  context.addIssue({
    code: "custom",
    path,
    message,
  });
}

export function collectDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }

  return [...duplicates];
}

export function asArray<T>(value: readonly T[] | T[] | undefined | null): T[] {
  return Array.isArray(value) ? [...value] : [];
}
// Inferred types from exported Zod validators.
export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;
export type UriReference = z.infer<typeof UriReferenceSchema>;
export type QtiIdentifier = z.infer<typeof QtiIdentifierSchema>;
export type QtiIdentifierList = z.infer<typeof QtiIdentifierListSchema>;
export type QtiStringList = z.infer<typeof QtiStringListSchema>;
export type QtiCoords = z.infer<typeof QtiCoordsSchema>;
export type QtiMimeType = z.infer<typeof QtiMimeTypeSchema>;
export type QtiStringOrNumber = z.infer<typeof QtiStringOrNumberSchema>;
export type QtiIntegerOrVariable = z.infer<typeof QtiIntegerOrVariableSchema>;
export type QtiNumberOrVariable = z.infer<typeof QtiNumberOrVariableSchema>;
export type QtiCardinality = z.infer<typeof QtiCardinalitySchema>;
export type QtiBaseType = z.infer<typeof QtiBaseTypeSchema>;
export type QtiShowHide = z.infer<typeof QtiShowHideSchema>;
export type QtiView = z.infer<typeof QtiViewSchema>;
export type QtiDirection = z.infer<typeof QtiDirectionSchema>;
export type QtiOrientation = z.infer<typeof QtiOrientationSchema>;
export type QtiNavigationMode = z.infer<typeof QtiNavigationModeSchema>;
export type QtiSubmissionMode = z.infer<typeof QtiSubmissionModeSchema>;
export type QtiSuppressTts = z.infer<typeof QtiSuppressTtsSchema>;
export type QtiShape = z.infer<typeof QtiShapeSchema>;
export type QtiExternalScored = z.infer<typeof QtiExternalScoredSchema>;
export type QtiSessionStatus = z.infer<typeof QtiSessionStatusSchema>;
export type QtiScoreStatus = z.infer<typeof QtiScoreStatusSchema>;
export type QtiAnsweredStatus = z.infer<typeof QtiAnsweredStatusSchema>;
export type QtiSupportAssignment = z.infer<typeof QtiSupportAssignmentSchema>;
export type XmlForeignAttributes = z.infer<typeof XmlForeignAttributesSchema>;
export type XmlExtensionNode = z.infer<typeof XmlExtensionNodeSchema>;
export type XmlExtensionNodeList = z.infer<typeof XmlExtensionNodeListSchema>;
