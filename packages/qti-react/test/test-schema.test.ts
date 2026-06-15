import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { outcomeDeclarationSchema, rpExpressionSchema } from "../src/rp/schema";
import type { AssessmentTestView } from "../src/test";
import {
  assessmentItemRefViewSchema,
  assessmentTestViewSchema,
  branchRuleSchema,
  itemSessionControlSchema,
  makeAssessmentTestSchema,
  orderingSchema,
  selectionSchema,
  timeLimitsSchema,
} from "../src/test/schema";

describe("shared atoms", () => {
  test("timeLimits accepts seconds + late-submission flag, rejects negatives", () => {
    expect(timeLimitsSchema.parse({ minTime: 30, maxTime: 600, allowLateSubmission: true })).toEqual({
      minTime: 30,
      maxTime: 600,
      allowLateSubmission: true,
    });
    expect(timeLimitsSchema.safeParse({}).success).toBe(true);
    expect(timeLimitsSchema.safeParse({ maxTime: -1 }).success).toBe(false);
  });

  test("itemSessionControl maxAttempts must be a non-negative integer", () => {
    expect(itemSessionControlSchema.safeParse({ maxAttempts: 0, allowSkipping: false }).success).toBe(true);
    expect(itemSessionControlSchema.safeParse({ maxAttempts: 1.5 }).success).toBe(false);
    expect(itemSessionControlSchema.safeParse({ maxAttempts: -2 }).success).toBe(false);
  });

  test("selection requires select; ordering shuffle is optional", () => {
    expect(selectionSchema.parse({ select: 2, withReplacement: true })).toEqual({ select: 2, withReplacement: true });
    expect(selectionSchema.safeParse({ withReplacement: true }).success).toBe(false);
    expect(orderingSchema.parse({ shuffle: true })).toEqual({ shuffle: true });
    expect(orderingSchema.safeParse({}).success).toBe(true);
  });
});

describe("recursive rpExpression", () => {
  test("parses a nested logical/comparison tree", () => {
    const expr = {
      kind: "and",
      expressions: [
        {
          kind: "gte",
          expressions: [
            { kind: "testVariables", variableIdentifier: "SCORE" },
            { kind: "baseValue", baseType: "float", value: 0.5 },
          ],
        },
        { kind: "not", expressions: [{ kind: "isNull", expressions: [{ kind: "variable", identifier: "RESPONSE" }] }] },
      ],
    };
    const parsed = rpExpressionSchema.parse(expr);
    expect(parsed).toEqual(expr);
  });

  test("keeps `kind` permissive (unimplemented operators still validate)", () => {
    expect(rpExpressionSchema.safeParse({ kind: "someVendorOperator", class: "x.y.z" }).success).toBe(true);
  });

  test("rejects a non-string kind", () => {
    expect(rpExpressionSchema.safeParse({ kind: 7 }).success).toBe(false);
  });

  test("branchRule pairs a target with a boolean expression", () => {
    const rule = {
      target: "EXIT_TESTPART",
      expression: { kind: "isNull", expressions: [{ kind: "variable", identifier: "RESPONSE" }] },
    };
    expect(branchRuleSchema.parse(rule)).toEqual(rule);
    expect(branchRuleSchema.safeParse({ target: "", expression: { kind: "isNull" } }).success).toBe(false);
  });
});

describe("outcomeDeclaration with lookup tables", () => {
  test("parses a matchTable-backed declaration", () => {
    const decl = {
      identifier: "GRADE",
      cardinality: "single" as const,
      baseType: "identifier",
      matchTable: {
        defaultValue: "F",
        matchTableEntries: [
          { sourceValue: 0, targetValue: "F" },
          { sourceValue: 50, targetValue: "P" },
        ],
      },
    };
    expect(outcomeDeclarationSchema.parse(decl)).toEqual(decl);
  });
});

describe("makeAssessmentTestSchema (authoring itemRef parameterization)", () => {
  // Mirror emergent's authoring delta: the itemRef carries an itemVersionId, not an href.
  const authoringItemRefSchema = z.object({
    kind: z.literal("assessmentItemRef"),
    identifier: z.string().trim().min(1),
    itemVersionId: z.uuid(),
  });
  const { assessmentTestSchema } = makeAssessmentTestSchema(authoringItemRefSchema);

  test("validates a nested structure carrying the injected itemRef shape", () => {
    const structure = {
      identifier: "AUTHORED",
      title: "Authored test",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear" as const,
          submissionMode: "individual" as const,
          assessmentSections: [
            {
              kind: "assessmentSection" as const,
              identifier: "S1",
              timeLimits: { maxTime: 1200 },
              selection: { select: 1 },
              children: [
                {
                  kind: "assessmentSection" as const,
                  identifier: "S1a",
                  children: [
                    {
                      kind: "assessmentItemRef" as const,
                      identifier: "Q1",
                      itemVersionId: "11111111-1111-4111-8111-111111111111",
                    },
                  ],
                },
                {
                  kind: "assessmentItemRef" as const,
                  identifier: "Q2",
                  itemVersionId: "22222222-2222-4222-8222-222222222222",
                },
              ],
            },
          ],
        },
      ],
    };
    expect(assessmentTestSchema.parse(structure)).toEqual(structure);
  });

  test("rejects an itemRef missing the injected itemVersionId", () => {
    const bad = {
      identifier: "AUTHORED",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              children: [{ kind: "assessmentItemRef", identifier: "Q1" }],
            },
          ],
        },
      ],
    };
    expect(assessmentTestSchema.safeParse(bad).success).toBe(false);
  });
});

describe("assessmentTestViewSchema (the ready href itemRef)", () => {
  test("the delivery itemRef carries href + the full knob set", () => {
    const ref = {
      kind: "assessmentItemRef" as const,
      identifier: "Q1",
      href: "items/q1.xml",
      categories: ["algebra"],
      fixed: true,
      required: true,
      itemSessionControl: { maxAttempts: 2 },
      timeLimits: { maxTime: 90 },
      weights: [{ identifier: "w1", value: 2 }],
      preConditions: [{ kind: "variable", identifier: "RESPONSE" }],
    };
    expect(assessmentItemRefViewSchema.parse(ref)).toEqual(ref);
  });

  // A rich, real delivery view: outcomeDeclarations + outcomeProcessing (nested sum /
  // testVariables) + testFeedbacks (opaque content) + nested sections + per-level knobs.
  const richView = {
    identifier: "T1",
    title: "Rich test",
    outcomeDeclarations: [{ identifier: "TOTAL", cardinality: "single", baseType: "float" }],
    timeLimits: { maxTime: 3600 },
    outcomeProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "TOTAL",
          expression: { kind: "sum", expressions: [{ kind: "testVariables", variableIdentifier: "SCORE" }] },
        },
      ],
    },
    testFeedbacks: [
      {
        access: "atEnd",
        outcomeIdentifier: "PASSED",
        identifier: "true",
        showHide: "show",
        content: [{ kind: "xml", name: "p", value: "Well done!" }],
      },
    ],
    testParts: [
      {
        identifier: "P1",
        navigationMode: "nonlinear",
        submissionMode: "simultaneous",
        itemSessionControl: { allowReview: true },
        assessmentSections: [
          {
            kind: "assessmentSection",
            identifier: "S1",
            title: "Section one",
            visible: true,
            selection: { select: 2, withReplacement: false },
            ordering: { shuffle: true },
            preConditions: [
              {
                kind: "gte",
                expressions: [
                  { kind: "testVariables", variableIdentifier: "SCORE" },
                  { kind: "baseValue", baseType: "float", value: 1 },
                ],
              },
            ],
            children: [
              { kind: "assessmentItemRef", identifier: "Q1", href: "items/q1.xml", fixed: true },
              {
                kind: "assessmentSection",
                identifier: "S1a",
                children: [{ kind: "assessmentItemRef", identifier: "Q2", href: "items/q2.xml" }],
              },
            ],
          },
        ],
      },
    ],
  } satisfies AssessmentTestView;

  test("safeParses a real, rich AssessmentTestView and round-trips it", () => {
    const result = assessmentTestViewSchema.safeParse(richView);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(richView);
  });

  test("rejects a structurally invalid view (blank identifier, bad navigationMode)", () => {
    expect(assessmentTestViewSchema.safeParse({ identifier: "", testParts: [] }).success).toBe(false);
    expect(
      assessmentTestViewSchema.safeParse({
        identifier: "T",
        testParts: [
          { identifier: "P1", navigationMode: "sideways", submissionMode: "individual", assessmentSections: [] },
        ],
      }).success,
    ).toBe(false);
  });
});
