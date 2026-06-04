import { z } from "zod";

// Conditional visibility rule for a field — renders/hides based on another field's value.
const showWhenRuleSchema = z.object({
  field: z.string(),
  equals: z.union([z.string(), z.boolean(), z.number(), z.array(z.string())]),
});

const showWhenSchema = z.object({
  type: z.enum(["and", "or"]).optional(),
  rules: z.array(showWhenRuleSchema),
});

// Shared optional base properties present on all field types.
const baseFieldShape = {
  name: z.string().min(1),
  label: z.string().optional(),
  description: z.string().optional(),
  importance: z.enum(["high", "medium", "low"]).optional(),
  optional: z.boolean().optional(),
  common: z.boolean().optional(),
  default: z.unknown().optional(),
  widget: z.string().optional(),
  showWhen: showWhenSchema.optional(),
  // When field is hidden by showWhen, reset value to null
  nullWhenHidden: z.boolean().optional(),
  // Override default copy/paste behaviour in editor
  copy: z.boolean().optional(),
};

// TypeScript-side recursive types must be declared manually to avoid circular inference.
export interface H5pFieldBase {
  name: string;
  label?: string;
  description?: string;
  importance?: "high" | "medium" | "low";
  optional?: boolean;
  common?: boolean;
  default?: unknown;
  widget?: string;
  showWhen?: { type?: "and" | "or"; rules: Array<{ field: string; equals: unknown }> };
  nullWhenHidden?: boolean;
  copy?: boolean;
}

export interface H5pTextField extends H5pFieldBase {
  type: "text";
  maxLength?: number;
  minLength?: number;
  regexp?: { pattern: string; modifiers?: string; description?: string };
  placeholder?: string;
  enterMode?: string;
  tags?: string[];
  font?: unknown;
}
export interface H5pHtmlField extends H5pFieldBase {
  type: "html";
  tags?: string[];
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  font?: unknown;
}
export interface H5pNumberField extends H5pFieldBase {
  type: "number";
  min?: number;
  max?: number;
  steps?: number;
  decimals?: number;
}
export interface H5pBooleanField extends H5pFieldBase {
  type: "boolean";
}
export interface H5pImageField extends H5pFieldBase {
  type: "image";
  allowedMimeTypes?: string[];
  disableCopyright?: boolean;
}
export interface H5pAudioField extends H5pFieldBase {
  type: "audio";
  allowedMimeTypes?: string[];
  disableConversion?: boolean;
}
export interface H5pVideoField extends H5pFieldBase {
  type: "video";
  allowedMimeTypes?: string[];
  disableConversion?: boolean;
}
export interface H5pFileField extends H5pFieldBase {
  type: "file";
  allowedMimeTypes?: string[];
}
export interface H5pSelectField extends H5pFieldBase {
  type: "select";
  options: Array<{ value: string; label: string }>;
  multiple?: boolean;
}
export interface H5pLibraryField extends H5pFieldBase {
  type: "library";
  options?: string[];
}
export interface H5pGroupField extends H5pFieldBase {
  type: "group";
  fields: H5pSemanticsField[];
  isSubContent?: boolean;
  expanded?: boolean;
}
export interface H5pListField extends H5pFieldBase {
  type: "list";
  field: H5pSemanticsField;
  min?: number;
  max?: number;
  entity?: string;
  widgets?: Array<{ name: string; label?: string }>;
}
export interface H5pTableField extends H5pFieldBase {
  type: "table";
  columns: H5pSemanticsField[];
  rows?: number;
}

export type H5pSemanticsField =
  | H5pTextField
  | H5pHtmlField
  | H5pNumberField
  | H5pBooleanField
  | H5pImageField
  | H5pAudioField
  | H5pVideoField
  | H5pFileField
  | H5pSelectField
  | H5pLibraryField
  | H5pGroupField
  | H5pListField
  | H5pTableField;

// --- Zod schemas ---

// Leaf field schemas (no recursion)
const textFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("text"),
  maxLength: z.number().int().positive().optional(),
  minLength: z.number().int().nonnegative().optional(),
  regexp: z
    .object({ pattern: z.string(), modifiers: z.string().optional(), description: z.string().optional() })
    .optional(),
  placeholder: z.string().optional(),
  enterMode: z.string().optional(),
  tags: z.array(z.string()).optional(),
  font: z.unknown().optional(),
});

const htmlFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("html"),
  tags: z.array(z.string()).optional(),
  maxLength: z.number().int().positive().optional(),
  minLength: z.number().int().nonnegative().optional(),
  placeholder: z.string().optional(),
  font: z.unknown().optional(),
});

const numberFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
  steps: z.number().positive().optional(),
  decimals: z.number().int().nonnegative().optional(),
});

const booleanFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("boolean"),
});

const imageFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("image"),
  allowedMimeTypes: z.array(z.string()).optional(),
  disableCopyright: z.boolean().optional(),
});

const audioFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("audio"),
  allowedMimeTypes: z.array(z.string()).optional(),
  disableConversion: z.boolean().optional(),
});

const videoFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("video"),
  allowedMimeTypes: z.array(z.string()).optional(),
  disableConversion: z.boolean().optional(),
});

const fileFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("file"),
  allowedMimeTypes: z.array(z.string()).optional(),
});

const selectFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("select"),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
  multiple: z.boolean().optional(),
});

const libraryFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("library"),
  options: z.array(z.string()).optional(),
});

// Recursive field schemas — use z.lazy so they can reference the outer union.
// Using let-then-assign pattern (same as cmi5 Block/Au schemas).
let h5pSemanticsFieldSchemaInternal: z.ZodType<H5pSemanticsField>;

const groupFieldSchema: z.ZodType<H5pGroupField> = z.object({
  ...baseFieldShape,
  type: z.literal("group"),
  fields: z.lazy(() => z.array(h5pSemanticsFieldSchemaInternal)),
  isSubContent: z.boolean().optional(),
  expanded: z.boolean().optional(),
}) as z.ZodType<H5pGroupField>;

const listFieldSchema: z.ZodType<H5pListField> = z.object({
  ...baseFieldShape,
  type: z.literal("list"),
  field: z.lazy(() => h5pSemanticsFieldSchemaInternal),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive().optional(),
  entity: z.string().optional(),
  widgets: z.array(z.object({ name: z.string(), label: z.string().optional() })).optional(),
}) as z.ZodType<H5pListField>;

const tableFieldSchema: z.ZodType<H5pTableField> = z.object({
  ...baseFieldShape,
  type: z.literal("table"),
  columns: z.lazy(() => z.array(h5pSemanticsFieldSchemaInternal)),
  rows: z.number().int().positive().optional(),
}) as z.ZodType<H5pTableField>;

h5pSemanticsFieldSchemaInternal = z.union([
  textFieldSchema,
  htmlFieldSchema,
  numberFieldSchema,
  booleanFieldSchema,
  imageFieldSchema,
  audioFieldSchema,
  videoFieldSchema,
  fileFieldSchema,
  selectFieldSchema,
  libraryFieldSchema,
  groupFieldSchema,
  listFieldSchema,
  tableFieldSchema,
]) as z.ZodType<H5pSemanticsField>;

// The schema for a single semantics field (any type).
export const H5pSemanticsFieldSchema: z.ZodType<H5pSemanticsField> = h5pSemanticsFieldSchemaInternal;

// The top-level semantics.json document — an array of field definitions.
export const H5pSemanticsSchema = z.array(H5pSemanticsFieldSchema);
export type H5pSemantics = z.infer<typeof H5pSemanticsSchema>;
