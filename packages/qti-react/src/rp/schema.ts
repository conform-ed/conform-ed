/**
 * Zod mirrors of the Response-Processing view types (./types.ts). conform-ed owns the
 * QTI view *types*; this is the validation surface that sits beside them — reusable for
 * import/parse validation and kept honest against the types it mirrors. React-free.
 *
 * The expression union is deliberately permissive (`kind: z.string()`), exactly like
 * `RpExpressionView`: kinds the interpreter does not implement still validate structurally
 * and surface as `unsupported-rp` issues at evaluation time rather than being rejected here.
 *
 * The recursive schema is annotated against an explicit interface (`RpExpressionNode`); under
 * `exactOptionalPropertyTypes` zod emits `T | undefined` optionals, so `z.infer` is a
 * superset of the hand-written views (every view value parses — verified in the schema
 * tests against real view samples). Callers that need the exact view shape map explicitly.
 */

import { z } from "zod";

import type { RpScalar } from "./types";

/** string | number | boolean — the QTI scalar value space (NULL is modelled by absence). */
export const rpScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

/**
 * The inferred shape of `rpExpressionSchema` — a faithful, recursive mirror of
 * `RpExpressionView` with zod's `T | undefined` optionals. Declared explicitly (and the
 * schema is annotated with it) because zod's getter-based recursion degrades the recursive
 * `expressions` field to `Record<string, unknown>` under `z.infer`; the `z.lazy` + interface
 * form keeps the type precise (the expression-builder authoring relies on it).
 */
export interface RpExpressionNode {
  readonly kind: string;
  readonly identifier?: string | undefined;
  readonly baseType?: string | undefined;
  readonly value?: RpScalar | undefined;
  readonly expressions?: readonly RpExpressionNode[] | undefined;
  readonly min?: number | string | undefined;
  readonly max?: number | string | undefined;
  readonly step?: number | string | undefined;
  readonly toleranceMode?: "exact" | "absolute" | "relative" | undefined;
  readonly tolerance?: readonly (number | string)[] | undefined;
  readonly includeLowerBound?: boolean | undefined;
  readonly includeUpperBound?: boolean | undefined;
  readonly n?: number | string | undefined;
  readonly name?: string | undefined;
  readonly roundingMode?: "decimalPlaces" | "significantFigures" | undefined;
  readonly figures?: number | string | undefined;
  readonly numberRepeats?: number | string | undefined;
  readonly pattern?: string | undefined;
  readonly caseSensitive?: boolean | undefined;
  readonly substring?: boolean | undefined;
  readonly shape?: string | undefined;
  readonly coords?: string | undefined;
  readonly variableIdentifier?: string | undefined;
  readonly outcomeIdentifier?: string | undefined;
  readonly weightIdentifier?: string | undefined;
  readonly sectionIdentifier?: string | undefined;
  readonly includeCategory?: string | readonly string[] | undefined;
  readonly excludeCategory?: string | readonly string[] | undefined;
  readonly class?: string | undefined;
  readonly definition?: string | undefined;
  readonly fieldIdentifier?: string | undefined;
}

/**
 * A numeric attribute that may also be a variable reference (§2.11.3.6 / §7.13): the
 * random/aggregate bounds, `index`/`anyN` positions, rounding `figures`, `repeat` counts.
 */
const numberOrRef = z.union([z.number(), z.string()]);

/** `includeCategory` / `excludeCategory` accept a single category or a list. */
const categoryFilter = z.union([z.string(), z.array(z.string())]);

export const cardinalitySchema = z.enum(["single", "multiple", "ordered", "record"]);

/** The recursive expression schema (`z.lazy` recursion; annotated for a precise `z.infer`). */
export const rpExpressionSchema: z.ZodType<RpExpressionNode> = z.lazy(() =>
  z.object({
    kind: z.string(),
    identifier: z.string().optional(),
    baseType: z.string().optional(),
    value: rpScalarSchema.optional(),
    expressions: z.array(rpExpressionSchema).optional(),
    min: numberOrRef.optional(),
    max: numberOrRef.optional(),
    step: numberOrRef.optional(),
    toleranceMode: z.enum(["exact", "absolute", "relative"]).optional(),
    tolerance: z.array(numberOrRef).optional(),
    includeLowerBound: z.boolean().optional(),
    includeUpperBound: z.boolean().optional(),
    n: numberOrRef.optional(),
    name: z.string().optional(),
    roundingMode: z.enum(["decimalPlaces", "significantFigures"]).optional(),
    figures: numberOrRef.optional(),
    numberRepeats: numberOrRef.optional(),
    pattern: z.string().optional(),
    caseSensitive: z.boolean().optional(),
    substring: z.boolean().optional(),
    shape: z.string().optional(),
    coords: z.string().optional(),
    variableIdentifier: z.string().optional(),
    outcomeIdentifier: z.string().optional(),
    weightIdentifier: z.string().optional(),
    sectionIdentifier: z.string().optional(),
    includeCategory: categoryFilter.optional(),
    excludeCategory: categoryFilter.optional(),
    class: z.string().optional(),
    definition: z.string().optional(),
    fieldIdentifier: z.string().optional(),
  }),
);

// ---------- Outcome declarations (lookup tables) ----------

export const matchTableSchema = z.object({
  defaultValue: rpScalarSchema.optional(),
  matchTableEntries: z.array(z.object({ sourceValue: z.number(), targetValue: rpScalarSchema })),
});

export const interpolationTableSchema = z.object({
  defaultValue: rpScalarSchema.optional(),
  interpolationTableEntries: z.array(
    z.object({
      sourceValue: z.number(),
      targetValue: rpScalarSchema,
      includeBoundary: z.boolean().optional(),
    }),
  ),
});

export const outcomeDeclarationSchema = z.object({
  identifier: z.string(),
  cardinality: cardinalitySchema,
  baseType: z.string().optional(),
  defaultValue: z.object({ values: z.array(z.object({ value: rpScalarSchema })) }).optional(),
  matchTable: matchTableSchema.optional(),
  interpolationTable: interpolationTableSchema.optional(),
  normalMaximum: z.number().optional(),
  normalMinimum: z.number().optional(),
});

export type RpScalarSchema = z.infer<typeof rpScalarSchema>;
export type RpExpressionSchema = z.infer<typeof rpExpressionSchema>;
export type OutcomeDeclarationSchema = z.infer<typeof outcomeDeclarationSchema>;
