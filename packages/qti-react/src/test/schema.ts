/**
 * Zod mirrors of the `assessmentTest` structural views (./types.ts) — the shared QTI
 * atoms (`timeLimits`, `itemSessionControl`, `selection`, `ordering`, `branchRule`,
 * test-level outcome processing/feedback) and the recursive structure
 * (`assessmentSection` / `testPart` / `assessmentTest`).
 *
 * The structure is exposed as a **factory parameterized by the itemRef schema** —
 * `makeAssessmentTestSchema(itemRefSchema)` — because the only thing that varies between
 * delivery (an `href`) and authoring (an `itemVersionId`) is the item reference's identity.
 * The ready `assessmentTestViewSchema` binds the delivery `href` itemRef; emergent binds
 * its authoring itemRef. React-free; see ../rp/schema.ts for the RP-level mirrors.
 */

import { z } from "zod";

import {
  outcomeDeclarationSchema,
  type OutcomeDeclarationSchema,
  type RpExpressionSchema,
  rpExpressionSchema,
} from "../rp/schema";

// ---------- Shared atoms (cascade levels: testPart → section → itemRef) ----------

/** `timeLimits` (seconds); the controller enforces these under its injected clock. */
export const timeLimitsSchema = z.object({
  minTime: z.number().nonnegative().optional(),
  maxTime: z.number().nonnegative().optional(),
  allowLateSubmission: z.boolean().optional(),
});

/** `itemSessionControl`: per-level overrides cascading testPart → section → itemRef. */
export const itemSessionControlSchema = z.object({
  maxAttempts: z.number().int().nonnegative().optional(),
  showFeedback: z.boolean().optional(),
  allowReview: z.boolean().optional(),
  showSolution: z.boolean().optional(),
  allowComment: z.boolean().optional(),
  allowSkipping: z.boolean().optional(),
  validateResponses: z.boolean().optional(),
});

/** `selection`: how many children to draw, optionally with replacement (§4.2.6). */
export const selectionSchema = z.object({
  select: z.number().int().nonnegative(),
  withReplacement: z.boolean().optional(),
});

/** `ordering`: whether the surviving children are shuffled (§4.2.7). */
export const orderingSchema = z.object({ shuffle: z.boolean().optional() });

export type TimeLimitsSchema = z.infer<typeof timeLimitsSchema>;
export type ItemSessionControlSchema = z.infer<typeof itemSessionControlSchema>;
export type SelectionSchema = z.infer<typeof selectionSchema>;
export type OrderingSchema = z.infer<typeof orderingSchema>;

/** `branchRule`: a target identifier (or EXIT_*) gated by a boolean expression. */
export const branchRuleSchema = z.object({
  target: z.string().trim().min(1),
  expression: rpExpressionSchema,
});

export type BranchRuleSchema = z.infer<typeof branchRuleSchema>;

const weightSchema = z.object({ identifier: z.string().trim().min(1), value: z.number() });

const templateDefaultSchema = z.object({
  templateIdentifier: z.string().trim().min(1),
  expression: rpExpressionSchema,
});

// ---------- Test-level outcome processing + feedback ----------

/** A gate plus its nested rules (`outcomeIf` / `outcomeElseIf`); see `OutcomeRuleNode`. */
export interface OutcomeConditionBranchNode {
  readonly expression: RpExpressionSchema;
  readonly rules: readonly OutcomeRuleNode[];
}

/**
 * The recursive outcome-rule shape (a faithful mirror of `OutcomeRuleView` with zod's
 * `T | undefined` optionals). Declared explicitly so `z.infer` stays precise through the
 * recursion (the getter form degrades nested rules to `Record<string, unknown>`).
 */
export interface OutcomeRuleNode {
  readonly kind: string;
  readonly identifier?: string | undefined;
  readonly expression?: RpExpressionSchema | undefined;
  readonly rules?: readonly OutcomeRuleNode[] | undefined;
  readonly outcomeIf?: OutcomeConditionBranchNode | undefined;
  readonly outcomeElseIfs?: readonly OutcomeConditionBranchNode[] | undefined;
  readonly outcomeElse?: { readonly rules: readonly OutcomeRuleNode[] } | undefined;
}

/** One `outcomeIf` / `outcomeElseIf` branch: a gate plus its nested rules. */
export const outcomeConditionBranchSchema: z.ZodType<OutcomeConditionBranchNode> = z.lazy(() =>
  z.object({
    expression: rpExpressionSchema,
    rules: z.array(outcomeRuleSchema),
  }),
);

/** A recursive outcome rule (mirrors `OutcomeRuleView`); `kind` stays permissive. */
export const outcomeRuleSchema: z.ZodType<OutcomeRuleNode> = z.lazy(() =>
  z.object({
    kind: z.string(),
    identifier: z.string().optional(),
    expression: rpExpressionSchema.optional(),
    rules: z.array(outcomeRuleSchema).optional(),
    outcomeIf: outcomeConditionBranchSchema.optional(),
    outcomeElseIfs: z.array(outcomeConditionBranchSchema).optional(),
    outcomeElse: z.object({ rules: z.array(outcomeRuleSchema) }).optional(),
  }),
);

export const outcomeProcessingSchema = z.object({ rules: z.array(outcomeRuleSchema) });

export type OutcomeProcessingSchema = z.infer<typeof outcomeProcessingSchema>;

/**
 * `testFeedback` — the scalar attributes are mirrored; the `content` body is accepted
 * opaquely (BodyNode is the item runtime's content model, not authored at the test level).
 */
export const testFeedbackSchema = z.object({
  access: z.enum(["atEnd", "during"]).optional(),
  outcomeIdentifier: z.string().trim().min(1),
  identifier: z.string().trim().min(1),
  showHide: z.enum(["show", "hide"]).optional(),
  content: z.array(z.unknown()).optional(),
});

export type TestFeedbackSchema = z.infer<typeof testFeedbackSchema>;

// ---------- The delivery itemRef (href identity) ----------

/** The delivery `assessmentItemRef` (`href` identity) — the ready view itemRef. */
export const assessmentItemRefViewSchema = z.object({
  kind: z.literal("assessmentItemRef"),
  identifier: z.string().trim().min(1),
  href: z.string().optional(),
  categories: z.array(z.string()).optional(),
  fixed: z.boolean().optional(),
  required: z.boolean().optional(),
  preConditions: z.array(rpExpressionSchema).optional(),
  branchRules: z.array(branchRuleSchema).optional(),
  itemSessionControl: itemSessionControlSchema.optional(),
  timeLimits: timeLimitsSchema.optional(),
  weights: z.array(weightSchema).optional(),
  templateDefaults: z.array(templateDefaultSchema).optional(),
});

// ---------- The recursive structure factory ----------

const assessmentSectionFlags = {
  title: z.string().trim().min(1).optional(),
  visible: z.boolean().optional(),
  fixed: z.boolean().optional(),
  required: z.boolean().optional(),
  keepTogether: z.boolean().optional(),
  selection: selectionSchema.optional(),
  ordering: orderingSchema.optional(),
  preConditions: z.array(rpExpressionSchema).optional(),
  branchRules: z.array(branchRuleSchema).optional(),
  itemSessionControl: itemSessionControlSchema.optional(),
  timeLimits: timeLimitsSchema.optional(),
} as const;

const testPartLevel = {
  preConditions: z.array(rpExpressionSchema).optional(),
  branchRules: z.array(branchRuleSchema).optional(),
  itemSessionControl: itemSessionControlSchema.optional(),
  timeLimits: timeLimitsSchema.optional(),
} as const;

/**
 * The recursive section shape, parameterized by the injected itemRef's inferred type.
 * Optionals carry `| undefined` and arrays are `readonly` so this matches zod's object
 * output exactly — letting the `z.lazy` section schema below be annotated `z.ZodType<…>`
 * (a getter cannot self-infer once a generic itemRef joins the `children` union).
 */
export interface AssessmentSectionNode<TItemRef> {
  readonly kind: "assessmentSection";
  readonly identifier: string;
  readonly title?: string | undefined;
  readonly visible?: boolean | undefined;
  readonly fixed?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly keepTogether?: boolean | undefined;
  readonly selection?: SelectionSchema | undefined;
  readonly ordering?: OrderingSchema | undefined;
  readonly preConditions?: readonly RpExpressionSchema[] | undefined;
  readonly branchRules?: readonly BranchRuleSchema[] | undefined;
  readonly itemSessionControl?: ItemSessionControlSchema | undefined;
  readonly timeLimits?: TimeLimitsSchema | undefined;
  readonly children: ReadonlyArray<AssessmentSectionNode<TItemRef> | TItemRef>;
}

/** A test part: navigation/submission modes plus the cascade levels and its sections. */
export interface TestPartNode<TItemRef> {
  readonly identifier: string;
  readonly navigationMode: "linear" | "nonlinear";
  readonly submissionMode: "individual" | "simultaneous";
  readonly preConditions?: readonly RpExpressionSchema[] | undefined;
  readonly branchRules?: readonly BranchRuleSchema[] | undefined;
  readonly itemSessionControl?: ItemSessionControlSchema | undefined;
  readonly timeLimits?: TimeLimitsSchema | undefined;
  readonly assessmentSections: readonly AssessmentSectionNode<TItemRef>[];
}

/** The whole `assessmentTest`: declarations/processing/feedback plus the ordered parts. */
export interface AssessmentTestNode<TItemRef> {
  readonly identifier: string;
  readonly title?: string | undefined;
  readonly outcomeDeclarations?: readonly OutcomeDeclarationSchema[] | undefined;
  readonly timeLimits?: TimeLimitsSchema | undefined;
  readonly testParts: readonly TestPartNode<TItemRef>[];
  readonly outcomeProcessing?: OutcomeProcessingSchema | undefined;
  readonly testFeedbacks?: readonly TestFeedbackSchema[] | undefined;
}

/** The schema bundle the factory returns (each level parameterized by the itemRef type). */
export interface AssessmentTestSchemas<TItemRef> {
  readonly assessmentSectionSchema: z.ZodType<AssessmentSectionNode<TItemRef>>;
  readonly testPartSchema: z.ZodType<TestPartNode<TItemRef>>;
  readonly assessmentTestSchema: z.ZodType<AssessmentTestNode<TItemRef>>;
}

/**
 * Build the recursive `assessmentTest` schema around a caller-supplied itemRef schema.
 * Sections nest sections-or-itemRefs through `children` (recursion via `z.lazy`); `z.infer`
 * follows the recursion and carries the injected itemRef's inferred type. The explicit
 * return type keeps the package's `isolatedDeclarations` build able to emit the bundle.
 */
export function makeAssessmentTestSchema<ItemRef extends z.ZodType>(
  itemRefSchema: ItemRef,
): AssessmentTestSchemas<z.infer<ItemRef>> {
  const assessmentSectionSchema: z.ZodType<AssessmentSectionNode<z.infer<ItemRef>>> = z.lazy(() =>
    z.object({
      kind: z.literal("assessmentSection"),
      identifier: z.string().trim().min(1),
      ...assessmentSectionFlags,
      children: z.array(z.union([assessmentSectionSchema, itemRefSchema])),
    }),
  );

  const testPartSchema: z.ZodType<TestPartNode<z.infer<ItemRef>>> = z.object({
    identifier: z.string().trim().min(1),
    navigationMode: z.enum(["linear", "nonlinear"]),
    submissionMode: z.enum(["individual", "simultaneous"]),
    ...testPartLevel,
    assessmentSections: z.array(assessmentSectionSchema),
  });

  const assessmentTestSchema: z.ZodType<AssessmentTestNode<z.infer<ItemRef>>> = z.object({
    identifier: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    outcomeDeclarations: z.array(outcomeDeclarationSchema).optional(),
    timeLimits: timeLimitsSchema.optional(),
    testParts: z.array(testPartSchema),
    outcomeProcessing: outcomeProcessingSchema.optional(),
    testFeedbacks: z.array(testFeedbackSchema).optional(),
  });

  return { assessmentSectionSchema, testPartSchema, assessmentTestSchema };
}

/** The ready delivery-view schema: the recursive structure over the `href` itemRef. */
export const assessmentTestViewSchema: z.ZodType<AssessmentTestNode<AssessmentItemRefViewSchema>> =
  makeAssessmentTestSchema(assessmentItemRefViewSchema).assessmentTestSchema;

export type AssessmentItemRefViewSchema = z.infer<typeof assessmentItemRefViewSchema>;
export type AssessmentTestViewSchema = z.infer<typeof assessmentTestViewSchema>;
