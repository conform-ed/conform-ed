import { describe, expect, test } from "bun:test";

import { createTestController } from "../src/test";
import type { AssessmentTestView } from "../src/test";

function itemRef(identifier: string, extra: Record<string, unknown> = {}) {
  return { kind: "assessmentItemRef" as const, identifier, ...extra };
}

const linearTest: AssessmentTestView = {
  identifier: "T1",
  outcomeDeclarations: [{ identifier: "TOTAL", cardinality: "single", baseType: "float" }],
  outcomeProcessing: {
    rules: [
      {
        kind: "setOutcomeValue",
        identifier: "TOTAL",
        expression: {
          kind: "sum",
          expressions: [{ kind: "testVariables", identifier: "SCORE" }],
        },
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
      navigationMode: "linear",
      submissionMode: "individual",
      assessmentSections: [
        {
          kind: "assessmentSection",
          identifier: "S1",
          children: [itemRef("I1"), itemRef("I2"), itemRef("I3")],
        },
      ],
    },
  ],
};

describe("plan resolution (seeded, deterministic)", () => {
  const selecting: AssessmentTestView = {
    identifier: "T2",
    testParts: [
      {
        identifier: "P1",
        navigationMode: "linear",
        submissionMode: "individual",
        assessmentSections: [
          {
            kind: "assessmentSection",
            identifier: "S1",
            selection: { select: 2 },
            ordering: { shuffle: true },
            children: [itemRef("A"), itemRef("B"), itemRef("C"), itemRef("D")],
          },
        ],
      },
    ],
  };

  test("selection picks the requested count and the same seed reproduces the same plan", () => {
    const first = createTestController(selecting, { seed: 11 });
    const again = createTestController(selecting, { seed: 11 });

    expect(first.plan.parts[0]!.items).toHaveLength(2);
    expect(first.plan.parts[0]!.items.map((entry) => entry.key)).toEqual(
      again.plan.parts[0]!.items.map((entry) => entry.key),
    );
  });

  test("different seeds eventually produce different plans", () => {
    const plans = new Set<string>();

    for (let seed = 0; seed < 12; seed += 1) {
      const controller = createTestController(selecting, { seed });

      plans.add(controller.plan.parts[0]!.items.map((entry) => entry.key).join(","));
    }

    expect(plans.size).toBeGreaterThan(1);
  });

  test("fixed items keep their position under shuffle", () => {
    const fixedTest: AssessmentTestView = {
      identifier: "T3",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              ordering: { shuffle: true },
              children: [itemRef("FIRST", { fixed: true }), itemRef("X"), itemRef("Y"), itemRef("Z")],
            },
          ],
        },
      ],
    };

    for (let seed = 0; seed < 8; seed += 1) {
      const controller = createTestController(fixedTest, { seed });

      expect(controller.plan.parts[0]!.items[0]!.key).toBe("FIRST");
    }
  });
});

describe("linear navigation", () => {
  test("start at the first item, advance with next, end after the last", () => {
    const controller = createTestController(linearTest, { seed: 1 });
    let state = controller.start();

    expect(controller.currentItem(state)?.key).toBe("I1");

    state = controller.next(state);
    expect(controller.currentItem(state)?.key).toBe("I2");

    state = controller.next(state);
    state = controller.next(state);
    expect(state.status).toBe("ended");
    expect(controller.currentItem(state)).toBeNull();
  });

  test("preconditions skip items based on earlier outcomes", () => {
    const conditional: AssessmentTestView = {
      ...linearTest,
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              children: [
                itemRef("I1"),
                itemRef("I2", {
                  preConditions: [
                    {
                      kind: "gt",
                      expressions: [
                        { kind: "variable", identifier: "I1.SCORE" },
                        { kind: "baseValue", baseType: "float", value: 0 },
                      ],
                    },
                  ],
                }),
                itemRef("I3"),
              ],
            },
          ],
        },
      ],
    };
    const controller = createTestController(conditional, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 0 } });
    state = controller.next(state);

    // I2's precondition (I1.SCORE > 0) fails → skipped straight to I3.
    expect(controller.currentItem(state)?.key).toBe("I3");
  });

  test("branch rules jump forward and can exit the test", () => {
    const branching: AssessmentTestView = {
      ...linearTest,
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              children: [
                itemRef("I1", {
                  branchRules: [
                    {
                      target: "I3",
                      expression: {
                        kind: "gte",
                        expressions: [
                          { kind: "variable", identifier: "I1.SCORE" },
                          { kind: "baseValue", baseType: "float", value: 1 },
                        ],
                      },
                    },
                  ],
                }),
                itemRef("I2"),
                itemRef("I3", {
                  branchRules: [
                    {
                      target: "EXIT_TEST",
                      expression: { kind: "baseValue", baseType: "boolean", value: true },
                    },
                  ],
                }),
                itemRef("I4"),
              ],
            },
          ],
        },
      ],
    };
    const controller = createTestController(branching, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    state = controller.next(state);
    expect(controller.currentItem(state)?.key).toBe("I3"); // branched over I2

    state = controller.submitItem(state, "I3", { outcomes: { SCORE: 0 } });
    state = controller.next(state);
    expect(state.status).toBe("ended"); // EXIT_TEST
  });
});

describe("nonlinear navigation", () => {
  const nonlinear: AssessmentTestView = {
    ...linearTest,
    testParts: [
      {
        identifier: "P1",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        assessmentSections: [
          { kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2"), itemRef("I3")] },
        ],
      },
      {
        identifier: "P2",
        navigationMode: "linear",
        submissionMode: "individual",
        assessmentSections: [{ kind: "assessmentSection", identifier: "S2", children: [itemRef("I4")] }],
      },
    ],
  };

  test("moveTo jumps within the current part; other parts are out of reach", () => {
    const controller = createTestController(nonlinear, { seed: 1 });
    let state = controller.start();

    expect(controller.canMoveTo(state, "I3")).toBe(true);
    expect(controller.canMoveTo(state, "I4")).toBe(false);

    state = controller.moveTo(state, "I3");
    expect(controller.currentItem(state)?.key).toBe("I3");

    state = controller.moveTo(state, "I1");
    expect(controller.currentItem(state)?.key).toBe("I1");
  });

  test("crossing a part boundary is one-way", () => {
    const controller = createTestController(nonlinear, { seed: 1 });
    let state = controller.start();

    state = controller.next(state); // I2
    state = controller.next(state); // I3
    state = controller.next(state); // crosses into P2 → I4

    expect(controller.currentItem(state)?.key).toBe("I4");
    expect(controller.canMoveTo(state, "I1")).toBe(false);
  });
});

describe("itemSessionControl and timeLimits", () => {
  const controlled: AssessmentTestView = {
    identifier: "T-ISC",
    timeLimits: { maxTime: 3600 },
    testParts: [
      {
        identifier: "P1",
        navigationMode: "linear",
        submissionMode: "individual",
        itemSessionControl: { maxAttempts: 3, allowSkipping: false },
        timeLimits: { maxTime: 1800 },
        assessmentSections: [
          {
            kind: "assessmentSection",
            identifier: "S1",
            itemSessionControl: { allowSkipping: true },
            children: [
              itemRef("I1", { itemSessionControl: { maxAttempts: 2 }, timeLimits: { maxTime: 60 } }),
              itemRef("I2"),
            ],
          },
        ],
      },
    ],
  };

  test("effective session control cascades part → section → item ref over spec defaults", () => {
    const controller = createTestController(controlled, { seed: 1 });
    const [first, second] = controller.plan.parts[0]!.items;

    expect(first!.sessionControl).toEqual({
      maxAttempts: 2, // item-ref override
      allowSkipping: true, // section override of the part's false
      showFeedback: false,
      allowReview: true,
      showSolution: false,
      allowComment: false,
      validateResponses: false,
    });
    expect(second!.sessionControl.maxAttempts).toBe(3); // part level
    expect(second!.sessionControl.allowSkipping).toBe(true);
  });

  test("time limits surface on the plan at test, part, and item level", () => {
    const controller = createTestController(controlled, { seed: 1 });

    expect(controller.plan.timeLimits).toEqual({ maxTime: 3600 });
    expect(controller.plan.parts[0]!.timeLimits).toEqual({ maxTime: 1800 });
    expect(controller.plan.parts[0]!.items[0]!.timeLimits).toEqual({ maxTime: 60 });
    expect(controller.plan.parts[0]!.items[1]!.timeLimits).toBeUndefined();
  });

  test("maxAttempts gates submissions; the default is a single attempt", () => {
    const controller = createTestController(linearTest, { seed: 1 });
    let state = controller.start();

    expect(controller.remainingAttempts(state, "I1")).toBe(1);
    expect(controller.canSubmitItem(state, "I1")).toBe(true);

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    expect(state.attemptCounts["I1"]).toBe(1);
    expect(controller.remainingAttempts(state, "I1")).toBe(0);
    expect(controller.canSubmitItem(state, "I1")).toBe(false);

    const refused = controller.submitItem(state, "I1", { outcomes: { SCORE: 0 } });
    expect(refused).toBe(state); // refused outright, not partially applied
  });

  test("maxAttempts above one allows re-attempts; zero means unlimited", () => {
    const controller = createTestController(controlled, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 0 } });
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    expect(state.attemptCounts["I1"]).toBe(2);
    expect(controller.canSubmitItem(state, "I1")).toBe(false); // maxAttempts 2 spent

    const unlimited: AssessmentTestView = {
      ...linearTest,
      testParts: [
        {
          ...linearTest.testParts[0]!,
          itemSessionControl: { maxAttempts: 0 },
        },
      ],
    };
    const open = createTestController(unlimited, { seed: 1 });
    let openState = open.start();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      openState = open.submitItem(openState, "I1", { outcomes: { SCORE: attempt } });
    }

    expect(openState.attemptCounts["I1"]).toBe(5);
    expect(open.remainingAttempts(openState, "I1")).toBe(Number.POSITIVE_INFINITY);
  });

  test("adaptive submissions ignore maxAttempts (spec)", () => {
    const controller = createTestController(linearTest, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 0 }, adaptive: true });
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, adaptive: true });

    expect(state.attemptCounts["I1"]).toBe(2);
    expect(state.itemOutcomes["I1"]?.["SCORE"]).toBe(1);
  });

  test("allowSkipping=false blocks next() on an unattempted linear item", () => {
    const strict: AssessmentTestView = {
      ...linearTest,
      testParts: [
        {
          ...linearTest.testParts[0]!,
          itemSessionControl: { allowSkipping: false },
        },
      ],
    };
    const controller = createTestController(strict, { seed: 1 });
    let state = controller.start();

    expect(controller.canNext(state)).toBe(false);
    expect(controller.next(state)).toBe(state); // refused, same reference

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    expect(controller.canNext(state)).toBe(true);

    state = controller.next(state);
    expect(controller.currentItem(state)?.key).toBe("I2");
  });

  test("allowSkipping=false blocks leaving a nonlinear part with unattempted items", () => {
    const strict: AssessmentTestView = {
      identifier: "T-NL",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "nonlinear",
          submissionMode: "individual",
          itemSessionControl: { allowSkipping: false },
          assessmentSections: [
            { kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2")] },
          ],
        },
      ],
    };
    const controller = createTestController(strict, { seed: 1 });
    let state = controller.start();

    state = controller.moveTo(state, "I2");
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 1 } });
    expect(controller.next(state)).toBe(state); // I1 still unattempted → cannot leave the part

    state = controller.moveTo(state, "I1");
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    state = controller.next(state); // I1 → I2 (still inside the part)
    state = controller.next(state); // everything attempted → the part may end
    expect(state.status).toBe("ended");
  });
});

describe("outcome processing and test feedback", () => {
  test("testVariables aggregates item outcomes; feedback shows atEnd", () => {
    const scored: AssessmentTestView = {
      ...linearTest,
      outcomeDeclarations: [
        { identifier: "TOTAL", cardinality: "single", baseType: "float" },
        { identifier: "PASSED", cardinality: "single", baseType: "boolean" },
      ],
      outcomeProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "TOTAL",
            expression: { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
          },
          {
            kind: "outcomeCondition",
            outcomeIf: {
              expression: {
                kind: "gte",
                expressions: [
                  { kind: "variable", identifier: "TOTAL" },
                  { kind: "baseValue", baseType: "float", value: 2 },
                ],
              },
              rules: [
                {
                  kind: "setOutcomeValue",
                  identifier: "PASSED",
                  expression: { kind: "baseValue", baseType: "boolean", value: true },
                },
              ],
            },
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
    };
    const controller = createTestController(scored, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    state = controller.next(state);
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 1.5 } });

    expect(state.testOutcomes["TOTAL"]).toBe(2.5);
    expect(controller.visibleTestFeedbacks(state)).toHaveLength(0); // atEnd only

    state = controller.end(state);

    expect(state.status).toBe("ended");
    expect(state.testOutcomes["PASSED"]).toBe(true);
    expect(controller.visibleTestFeedbacks(state)).toHaveLength(1);
  });

  test("unsupported outcome-processing constructs are reported, outcomes keep defaults", () => {
    const broken: AssessmentTestView = {
      ...linearTest,
      outcomeProcessing: {
        rules: [{ kind: "setOutcomeValue", identifier: "TOTAL", expression: { kind: "customOperator" } }],
      },
    };
    const controller = createTestController(broken, { seed: 1 });

    expect(controller.issues[0]?.type).toBe("unsupported-rp");
    expect(controller.issues[0]?.name).toBe("customOperator");

    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    expect(state.testOutcomes["TOTAL"]).toBe(0); // declared numeric default
  });
});
