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
