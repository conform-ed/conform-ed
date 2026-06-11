/**
 * The adapter from qti-xml's normalized assessmentTest JSON to the Test Controller's
 * AssessmentTestView (ADR-0005): testPart `children` become `assessmentSections`,
 * preCondition wrappers unwrap to expressions, `category` renames to `categories`,
 * and outcome-processing trees get the usual key conversions. The end-to-end check
 * drives a controller over the converted view.
 */

import { describe, expect, test } from "bun:test";

import { assessmentTestViewFromNormalized } from "../src/normalized-item";
import { createTestController } from "../src/test";

const normalizedTest = {
  assessmentTest: {
    identifier: "TEST-1",
    title: "Unit Test",
    outcomeDeclarations: [
      { identifier: "TOTAL", cardinality: "single", baseType: "float" },
      { identifier: "GRADE", cardinality: "single", baseType: "identifier" },
    ],
    timeLimits: { maxTime: 3600 },
    testParts: [
      {
        identifier: "PART-1",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        itemSessionControl: { maxAttempts: 2, allowSkipping: false },
        timeLimits: { maxTime: 1800, allowLateSubmission: true },
        children: [
          {
            identifier: "SECTION-1",
            title: "Main",
            visible: true,
            itemSessionControl: { showFeedback: true },
            children: [
              {
                identifier: "ITEM-1",
                href: "items/one.xml",
                category: ["easy", "practice"],
                itemSessionControl: { maxAttempts: 0 },
                timeLimits: { maxTime: 90 },
              },
              {
                identifier: "ITEM-2",
                href: "items/two.xml",
                preConditions: [
                  {
                    kind: "preCondition",
                    expression: {
                      kind: "gte",
                      children: [
                        { kind: "variable", identifier: "ITEM-1.SCORE" },
                        { kind: "baseValue", baseType: "float", value: "1" },
                      ],
                    },
                  },
                ],
                branchRules: [
                  {
                    kind: "branchRule",
                    target: "EXIT_TEST",
                    expression: {
                      kind: "isNull",
                      children: [{ kind: "variable", identifier: "ITEM-1.SCORE" }],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    outcomeProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "TOTAL",
          expression: { kind: "sum", children: [{ kind: "testVariables", variableIdentifier: "SCORE" }] },
        },
        {
          kind: "outcomeCondition",
          outcomeIf: {
            kind: "outcomeIf",
            expression: {
              kind: "gte",
              children: [
                { kind: "variable", identifier: "TOTAL" },
                { kind: "baseValue", baseType: "float", value: "1" },
              ],
            },
            actions: [
              {
                kind: "setOutcomeValue",
                identifier: "GRADE",
                expression: { kind: "baseValue", baseType: "identifier", value: "pass" },
              },
            ],
          },
          outcomeElse: {
            kind: "outcomeElse",
            actions: [
              {
                kind: "setOutcomeValue",
                identifier: "GRADE",
                expression: { kind: "baseValue", baseType: "identifier", value: "fail" },
              },
            ],
          },
        },
      ],
    },
    testFeedbacks: [
      {
        kind: "testFeedback",
        access: "atEnd",
        outcomeIdentifier: "GRADE",
        showHide: "show",
        identifier: "pass",
        title: "Done",
        content: [{ kind: "xml", name: "p", children: ["You passed."] }],
      },
    ],
  },
};

describe("assessmentTestViewFromNormalized", () => {
  test("converts shape: sections, categories, unwrapped preconditions, branch rules", () => {
    const view = assessmentTestViewFromNormalized(normalizedTest);

    expect(view).not.toBeNull();
    expect(view!.identifier).toBe("TEST-1");

    const part = view!.testParts[0]!;
    expect(part.assessmentSections).toHaveLength(1);

    const [refOne, refTwo] = part.assessmentSections[0]!.children;
    expect(refOne).toMatchObject({ kind: "assessmentItemRef", identifier: "ITEM-1", categories: ["easy", "practice"] });
    expect(refTwo).toMatchObject({ kind: "assessmentItemRef", identifier: "ITEM-2" });

    const itemTwo = refTwo as { preConditions?: unknown[]; branchRules?: Array<Record<string, unknown>> };
    expect(itemTwo.preConditions?.[0]).toEqual({
      kind: "gte",
      expressions: [
        { kind: "variable", identifier: "ITEM-1.SCORE" },
        { kind: "baseValue", baseType: "float", value: "1" },
      ],
    });
    expect(itemTwo.branchRules?.[0]).toMatchObject({ target: "EXIT_TEST" });

    const condition = view!.outcomeProcessing?.rules[1];
    expect(condition?.outcomeIf?.rules).toHaveLength(1);
    expect(condition?.outcomeElse?.rules).toHaveLength(1);

    expect(view!.testFeedbacks?.[0]?.content?.[0]).toMatchObject({ kind: "xml", name: "p" });
  });

  test("carries itemSessionControl and timeLimits at every level", () => {
    const view = assessmentTestViewFromNormalized(normalizedTest)!;
    const part = view.testParts[0]!;
    const section = part.assessmentSections[0]!;
    const refOne = section.children[0]!;

    expect(view.timeLimits).toEqual({ maxTime: 3600 });
    expect(part.itemSessionControl).toEqual({ maxAttempts: 2, allowSkipping: false });
    expect(part.timeLimits).toEqual({ maxTime: 1800, allowLateSubmission: true });
    expect(section.itemSessionControl).toEqual({ showFeedback: true });
    expect(refOne.itemSessionControl).toEqual({ maxAttempts: 0 });
    expect(refOne.timeLimits).toEqual({ maxTime: 90 });
  });

  test("a controller runs the converted view end to end", () => {
    const view = assessmentTestViewFromNormalized(normalizedTest)!;
    const controller = createTestController(view, { seed: 42 });

    expect(controller.issues).toEqual([]);
    expect(controller.plan.parts[0]?.items.map((item) => item.key)).toEqual(["ITEM-1", "ITEM-2"]);

    let state = controller.start();
    state = controller.submitItem(state, "ITEM-1", { outcomes: { SCORE: 1 } });
    state = controller.submitItem(state, "ITEM-2", { outcomes: { SCORE: 0 } });
    state = controller.end(state);

    expect(state.testOutcomes["TOTAL"]).toBe(1);
    expect(state.testOutcomes["GRADE"]).toBe("pass");
    expect(controller.visibleTestFeedbacks(state).map((feedback) => feedback.identifier)).toEqual(["pass"]);
  });

  test("returns null for non-test documents", () => {
    expect(assessmentTestViewFromNormalized({ assessmentItem: {} })).toBeNull();
  });
});
