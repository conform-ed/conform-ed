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

  test("an invisible keep-together=false section mixes its children into the parent shuffle", () => {
    // "An invisible section with a parent that is subject to shuffling can specify
    // whether or not its children, which will appear to the candidate as if they were
    // part of the parent, are shuffled as a block or mixed up with the other children
    // of the parent section." (§4.2.7, default true)
    const mixing = (keepTogether: boolean | undefined): AssessmentTestView => ({
      identifier: "T-KT",
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
              children: [
                itemRef("A"),
                itemRef("B"),
                {
                  kind: "assessmentSection",
                  identifier: "INV",
                  visible: false,
                  ...(keepTogether === undefined ? {} : { keepTogether }),
                  children: [itemRef("X"), itemRef("Y")],
                },
                itemRef("C"),
              ],
            },
          ],
        },
      ],
    });

    // Default (keep-together true): the block stays intact in document order.
    for (let seed = 0; seed < 10; seed += 1) {
      const keys = createTestController(mixing(undefined), { seed }).plan.parts[0]!.items.map((item) => item.key);

      expect(keys[keys.indexOf("X") + 1]).toBe("Y");
    }

    // keep-together=false: the children join the parent's pool individually.
    const separated = Array.from({ length: 12 }, (_, seed) =>
      createTestController(mixing(false), { seed }).plan.parts[0]!.items.map((item) => item.key),
    ).some((keys) => Math.abs(keys.indexOf("X") - keys.indexOf("Y")) > 1);

    expect(separated).toBe(true);

    // Hoisted items keep their section identity (durations, subsets, limits).
    const plan = createTestController(mixing(false), { seed: 1 }).plan;

    expect(plan.parts[0]!.items.find((item) => item.key === "X")!.sectionPath).toEqual(["S1", "INV"]);
    expect(Object.keys(plan.sections)).toContain("INV");
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

describe("simultaneous submission", () => {
  const totalProcessing = {
    rules: [
      {
        kind: "setOutcomeValue",
        identifier: "TOTAL",
        expression: { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
      },
    ],
  } as const;

  const simultaneous: AssessmentTestView = {
    identifier: "T-SIM",
    outcomeDeclarations: [{ identifier: "TOTAL", cardinality: "single", baseType: "float" }],
    outcomeProcessing: totalProcessing,
    testParts: [
      {
        identifier: "P1",
        navigationMode: "linear",
        submissionMode: "simultaneous",
        assessmentSections: [{ kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2")] }],
      },
    ],
  };

  test("submissions are held pending until the part is left, then commit together", () => {
    const controller = createTestController(simultaneous, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });

    // Held: the attempt registers, but nothing reaches outcome processing yet
    // (sum over an empty testVariables set stays NULL, exactly as at start).
    expect(state.attemptedItems).toEqual(["I1"]);
    expect(state.itemOutcomes["I1"]).toBeUndefined();
    expect(state.pendingItemResults["I1"]?.outcomes).toEqual({ SCORE: 1 });
    expect(state.testOutcomes["TOTAL"]).toBeNull();

    state = controller.next(state);
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 2 } });
    state = controller.next(state); // leaves the part → flush

    expect(state.status).toBe("ended");
    expect(state.itemOutcomes["I1"]).toEqual({ SCORE: 1 });
    expect(state.itemOutcomes["I2"]).toEqual({ SCORE: 2 });
    expect(state.pendingItemResults).toEqual({});
    expect(state.attemptCounts).toEqual({ I1: 1, I2: 1 });
    expect(state.testOutcomes["TOTAL"]).toBe(3);
  });

  test("pending submissions may be revised until the part is submitted", () => {
    const controller = createTestController(simultaneous, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 0 } });
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } }); // revision, not a new attempt
    expect(state.pendingItemResults["I1"]?.outcomes).toEqual({ SCORE: 1 });
    expect(state.attemptCounts["I1"]).toBeUndefined();

    state = controller.end(state); // ending flushes whatever is pending

    expect(state.itemOutcomes["I1"]).toEqual({ SCORE: 1 });
    expect(state.testOutcomes["TOTAL"]).toBe(1);
    expect(controller.submitItem(state, "I1", { outcomes: { SCORE: 9 } })).toBe(state);
  });

  test("crossing into the next part flushes the simultaneous part's pending outcomes", () => {
    const twoParts: AssessmentTestView = {
      ...simultaneous,
      testParts: [
        ...simultaneous.testParts,
        {
          identifier: "P2",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [{ kind: "assessmentSection", identifier: "S2", children: [itemRef("I3")] }],
        },
      ],
    };
    const controller = createTestController(twoParts, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    state = controller.next(state);
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 2 } });
    state = controller.next(state); // P1 → P2 boundary

    expect(state.status).toBe("in-progress");
    expect(controller.currentItem(state)?.key).toBe("I3");
    expect(state.itemOutcomes["I1"]).toEqual({ SCORE: 1 });
    expect(state.pendingItemResults).toEqual({});
    expect(state.testOutcomes["TOTAL"]).toBe(3);
  });

  test("allowSkipping=false accepts a pending submission as the attempt", () => {
    const strict: AssessmentTestView = {
      ...simultaneous,
      testParts: [
        {
          ...simultaneous.testParts[0]!,
          itemSessionControl: { allowSkipping: false },
        },
      ],
    };
    const controller = createTestController(strict, { seed: 1 });
    let state = controller.start();

    expect(controller.canNext(state)).toBe(false);
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    expect(controller.canNext(state)).toBe(true);
  });
});

describe("number* aggregates and weights", () => {
  function aggregate(kind: string, extra: Record<string, unknown> = {}) {
    return { kind, ...extra };
  }

  const aggregating: AssessmentTestView = {
    identifier: "T-AGG",
    outcomeDeclarations: [
      { identifier: "N_SELECTED", cardinality: "single", baseType: "integer" },
      { identifier: "N_SELECTED_EASY", cardinality: "single", baseType: "integer" },
      { identifier: "N_PRESENTED", cardinality: "single", baseType: "integer" },
      { identifier: "N_RESPONDED", cardinality: "single", baseType: "integer" },
      { identifier: "N_CORRECT", cardinality: "single", baseType: "integer" },
      { identifier: "N_INCORRECT", cardinality: "single", baseType: "integer" },
      { identifier: "N_IN_S1", cardinality: "single", baseType: "integer" },
      { identifier: "N_ELSEWHERE", cardinality: "single", baseType: "integer" },
    ],
    outcomeProcessing: {
      rules: [
        { kind: "setOutcomeValue", identifier: "N_SELECTED", expression: aggregate("numberSelected") },
        {
          kind: "setOutcomeValue",
          identifier: "N_IN_S1",
          expression: aggregate("numberSelected", { sectionIdentifier: "S1" }),
        },
        {
          kind: "setOutcomeValue",
          identifier: "N_ELSEWHERE",
          expression: aggregate("numberSelected", { sectionIdentifier: "S9" }),
        },
        {
          kind: "setOutcomeValue",
          identifier: "N_SELECTED_EASY",
          expression: aggregate("numberSelected", { includeCategory: ["easy"] }),
        },
        { kind: "setOutcomeValue", identifier: "N_PRESENTED", expression: aggregate("numberPresented") },
        { kind: "setOutcomeValue", identifier: "N_RESPONDED", expression: aggregate("numberResponded") },
        { kind: "setOutcomeValue", identifier: "N_CORRECT", expression: aggregate("numberCorrect") },
        { kind: "setOutcomeValue", identifier: "N_INCORRECT", expression: aggregate("numberIncorrect") },
      ],
    },
    testParts: [
      {
        identifier: "P1",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        assessmentSections: [
          {
            kind: "assessmentSection",
            identifier: "S1",
            children: [
              itemRef("I1", { categories: ["easy"] }),
              itemRef("I2", { categories: ["easy"] }),
              itemRef("I3", { categories: ["hard"] }),
            ],
          },
        ],
      },
    ],
  };

  test("the aggregates count selection, presentation, responses, and correctness", () => {
    const controller = createTestController(aggregating, { seed: 1 });

    expect(controller.issues).toEqual([]); // no longer unsupported-rp

    let state = controller.start(); // I1 presented
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, correct: true, responded: true });
    state = controller.next(state); // I2 presented
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 0 }, correct: false, responded: true });
    state = controller.end(state); // I3 never presented, never attempted

    expect(state.testOutcomes["N_SELECTED"]).toBe(3);
    expect(state.testOutcomes["N_SELECTED_EASY"]).toBe(2);
    expect(state.testOutcomes["N_PRESENTED"]).toBe(2);
    expect(state.testOutcomes["N_RESPONDED"]).toBe(2);
    expect(state.testOutcomes["N_CORRECT"]).toBe(1);
    expect(state.testOutcomes["N_INCORRECT"]).toBe(1);
    expect(state.testOutcomes["N_IN_S1"]).toBe(3);
    expect(state.testOutcomes["N_ELSEWHERE"]).toBe(0);
  });

  test("a re-attempt can flip an item between correct and incorrect", () => {
    const reattempts: AssessmentTestView = {
      ...aggregating,
      testParts: [
        {
          ...aggregating.testParts[0]!,
          itemSessionControl: { maxAttempts: 0 },
        },
      ],
    };
    const controller = createTestController(reattempts, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 0 }, correct: false, responded: true });
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, correct: true, responded: true });
    state = controller.end(state);

    expect(state.testOutcomes["N_CORRECT"]).toBe(1);
    expect(state.testOutcomes["N_INCORRECT"]).toBe(0);
  });

  test("testVariables multiplies numeric outcomes by the item's named weight", () => {
    const weighted: AssessmentTestView = {
      identifier: "T-W",
      outcomeDeclarations: [{ identifier: "TOTAL", cardinality: "single", baseType: "float" }],
      outcomeProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "TOTAL",
            expression: {
              kind: "sum",
              expressions: [{ kind: "testVariables", identifier: "SCORE", weightIdentifier: "W" }],
            },
          },
        ],
      },
      testParts: [
        {
          identifier: "P1",
          navigationMode: "nonlinear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              children: [
                itemRef("I1", { weights: [{ identifier: "W", value: 2 }] }),
                itemRef("I2"), // no weight named W → weight 1
              ],
            },
          ],
        },
      ],
    };
    const controller = createTestController(weighted, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 1 } });
    state = controller.end(state);

    expect(state.testOutcomes["TOTAL"]).toBe(3); // 1×2 + 1×1
  });

  describe("outcomeMinimum/outcomeMaximum (declared bounds)", () => {
    // "…simultaneously looks up the normal-maximum value of an outcome variable in a
    // sub-set of the items referred to in a test." (§2.11.2.7); weighting is "As per
    // the 'weight-identifier' characteristic of 'qti-test-variables'" (§7.28.5).
    const boundsTest = (
      rules: ReadonlyArray<Record<string, unknown>>,
      refs = [itemRef("I1", { weights: [{ identifier: "W", value: 2 }] }), itemRef("I2"), itemRef("I3")],
    ): AssessmentTestView => ({
      identifier: "T-BOUNDS",
      outcomeDeclarations: [
        { identifier: "MAX", cardinality: "single", baseType: "float" },
        { identifier: "MIN", cardinality: "single", baseType: "float" },
      ],
      outcomeProcessing: { rules: rules as never },
      testParts: [
        {
          identifier: "P1",
          navigationMode: "nonlinear",
          submissionMode: "individual",
          assessmentSections: [{ kind: "assessmentSection", identifier: "S1", children: refs }],
        },
      ],
    });
    const sumOf = (kind: string, extra: Record<string, unknown> = {}) => ({
      kind: "sum",
      expressions: [{ kind, outcomeIdentifier: "SCORE", ...extra }],
    });
    const score = (bounds: { normalMaximum?: number; normalMinimum?: number }) => [
      { identifier: "SCORE", cardinality: "single" as const, baseType: "float", ...bounds },
    ];

    test("outcomeMaximum aggregates declared maxima, weighted like testVariables", () => {
      const view = boundsTest([
        { kind: "setOutcomeValue", identifier: "MAX", expression: sumOf("outcomeMaximum", { weightIdentifier: "W" }) },
      ]);
      const controller = createTestController(view, {
        seed: 1,
        itemOutcomeDeclarations: {
          I1: score({ normalMaximum: 2 }),
          I2: score({ normalMaximum: 3 }),
          I3: score({ normalMaximum: 1 }),
        },
      });

      expect(controller.issues).toEqual([]);

      const state = controller.end(controller.start());

      expect(state.testOutcomes["MAX"]).toBe(8); // 2×2 + 3 + 1
    });

    test("any subset item without a declared maximum makes outcomeMaximum NULL", () => {
      // "If any of the items within the given subset have no declared maximum the
      // result is NULL" (§2.11.2.7)
      const view = boundsTest([{ kind: "setOutcomeValue", identifier: "MAX", expression: sumOf("outcomeMaximum") }]);
      const controller = createTestController(view, {
        seed: 1,
        itemOutcomeDeclarations: { I1: score({ normalMaximum: 2 }), I2: score({ normalMaximum: 3 }), I3: score({}) },
      });
      const state = controller.end(controller.start());

      expect(state.testOutcomes["MAX"]).toBeNull();
    });

    test("outcomeMinimum ignores items without a declared minimum", () => {
      // "Items with no declared minimum are ignored." (§2.11.2.6)
      const view = boundsTest([
        { kind: "setOutcomeValue", identifier: "MIN", expression: sumOf("outcomeMinimum", { weightIdentifier: "W" }) },
      ]);
      const controller = createTestController(view, {
        seed: 1,
        itemOutcomeDeclarations: {
          I1: score({ normalMinimum: 1 }),
          I2: score({ normalMinimum: 0.5 }),
          I3: score({}),
        },
      });
      const state = controller.end(controller.start());

      expect(state.testOutcomes["MIN"]).toBe(2.5); // 1×2 + 0.5; I3 ignored

      const allMissing = createTestController(view, {
        seed: 1,
        itemOutcomeDeclarations: { I1: score({}), I2: score({}), I3: score({}) },
      });

      expect(allMissing.end(allMissing.start()).testOutcomes["MIN"]).toBeNull();
    });

    test("the subset machinery applies: an empty subset is NULL", () => {
      const view = boundsTest([
        {
          kind: "setOutcomeValue",
          identifier: "MAX",
          expression: sumOf("outcomeMaximum", { sectionIdentifier: "S9" }),
        },
      ]);
      const controller = createTestController(view, {
        seed: 1,
        itemOutcomeDeclarations: {
          I1: score({ normalMaximum: 2 }),
          I2: score({ normalMaximum: 3 }),
          I3: score({ normalMaximum: 1 }),
        },
      });

      expect(controller.end(controller.start()).testOutcomes["MAX"]).toBeNull();
    });

    test("no itemOutcomeDeclarations option degrades per spec — NULL, not a refusal", () => {
      const view = boundsTest([
        { kind: "setOutcomeValue", identifier: "MAX", expression: sumOf("outcomeMaximum") },
        { kind: "setOutcomeValue", identifier: "MIN", expression: sumOf("outcomeMinimum") },
      ]);
      const controller = createTestController(view, { seed: 1 });

      expect(controller.issues).toEqual([]);

      const state = controller.end(controller.start());

      expect(state.testOutcomes["MAX"]).toBeNull();
      expect(state.testOutcomes["MIN"]).toBeNull();
    });
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

  test("lookupOutcomeValue bands the total through the test declaration's matchTable", () => {
    // "The lookupOutcomeValue rule sets the value of an outcome variable to the value
    // obtained by looking up the value of the associated expression in the
    // lookupTable associated with the outcome's declaration." (§5.87)
    const banded: AssessmentTestView = {
      ...linearTest,
      outcomeDeclarations: [
        { identifier: "TOTAL", cardinality: "single", baseType: "float" },
        {
          identifier: "GRADE",
          cardinality: "single",
          baseType: "identifier",
          matchTable: { defaultValue: "fail", matchTableEntries: [{ sourceValue: 2, targetValue: "pass" }] },
        },
      ],
      outcomeProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "TOTAL",
            expression: { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
          },
          {
            kind: "lookupOutcomeValue",
            identifier: "GRADE",
            expression: { kind: "round", expressions: [{ kind: "variable", identifier: "TOTAL" }] },
          },
        ],
      },
    };
    const controller = createTestController(banded, { seed: 1 });

    expect(controller.issues).toEqual([]);

    let state = controller.start();
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    state = controller.next(state);
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 1 } });
    state = controller.end(state);

    expect(state.testOutcomes["GRADE"]).toBe("pass");

    let failing = controller.start();
    failing = controller.submitItem(failing, "I1", { outcomes: { SCORE: 1 } });
    failing = controller.end(failing);

    expect(failing.testOutcomes["GRADE"]).toBe("fail");
  });

  test("an interpolationTable bands a float total; includeBoundary=false falls through", () => {
    const banded: AssessmentTestView = {
      ...linearTest,
      outcomeDeclarations: [
        { identifier: "TOTAL", cardinality: "single", baseType: "float" },
        {
          identifier: "GRADE",
          cardinality: "single",
          baseType: "identifier",
          interpolationTable: {
            defaultValue: "fail",
            interpolationTableEntries: [
              { sourceValue: 2, targetValue: "distinction", includeBoundary: false },
              { sourceValue: 1, targetValue: "pass" },
            ],
          },
        },
      ],
      outcomeProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "TOTAL",
            expression: { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
          },
          {
            kind: "lookupOutcomeValue",
            identifier: "GRADE",
            expression: { kind: "variable", identifier: "TOTAL" },
          },
        ],
      },
    };
    const controller = createTestController(banded, { seed: 1 });
    const gradeFor = (scores: readonly number[]) => {
      let state = controller.start();

      for (const [index, value] of scores.entries()) {
        state = controller.submitItem(state, `I${index + 1}`, { outcomes: { SCORE: value } });
        state = controller.next(state);
      }

      return controller.end(state).testOutcomes["GRADE"];
    };

    expect(gradeFor([2.5])).toBe("distinction");
    expect(gradeFor([1, 1])).toBe("pass"); // exactly 2: boundary excluded, falls through
    expect(gradeFor([0.5])).toBe("fail");
  });

  test("outcomeProcessingFragment executes inline, in order; exitTest inside it ends the run", () => {
    // "Outcome rules are followed in the order given. Variables updated by a rule take
    // their new value when evaluated as part of any following rules." (§5.103.1)
    const fragmented: AssessmentTestView = {
      ...linearTest,
      outcomeProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "TOTAL",
            expression: { kind: "baseValue", baseType: "float", value: 1 },
          },
          {
            kind: "outcomeProcessingFragment",
            rules: [
              {
                kind: "setOutcomeValue",
                identifier: "TOTAL",
                expression: {
                  kind: "sum",
                  expressions: [
                    { kind: "variable", identifier: "TOTAL" },
                    { kind: "baseValue", baseType: "float", value: 1 },
                  ],
                },
              },
              { kind: "exitTest" },
            ],
          },
          {
            kind: "setOutcomeValue",
            identifier: "TOTAL",
            expression: { kind: "baseValue", baseType: "float", value: 9 },
          },
        ],
      },
    };
    const controller = createTestController(fragmented, { seed: 1 });

    expect(controller.issues).toEqual([]);

    const state = controller.end(controller.start());

    expect(state.testOutcomes["TOTAL"]).toBe(2);
  });

  test("a tableless lookup declaration is reported statically; outcomes keep defaults", () => {
    const tableless: AssessmentTestView = {
      ...linearTest,
      outcomeDeclarations: [
        { identifier: "TOTAL", cardinality: "single", baseType: "float" },
        { identifier: "GRADE", cardinality: "single", baseType: "identifier" },
      ],
      outcomeProcessing: {
        rules: [
          {
            kind: "lookupOutcomeValue",
            identifier: "GRADE",
            expression: { kind: "baseValue", baseType: "integer", value: 1 },
          },
        ],
      },
    };
    const controller = createTestController(tableless, { seed: 1 });

    expect(controller.issues[0]?.name).toBe("lookupOutcomeValue");

    const state = controller.end(controller.start());

    expect(state.testOutcomes["GRADE"]).toBeNull();
  });

  test("the static walk recurses into fragments", () => {
    const broken: AssessmentTestView = {
      ...linearTest,
      outcomeProcessing: { rules: [{ kind: "outcomeProcessingFragment", rules: [{ kind: "weirdRule" }] }] },
    };

    expect(createTestController(broken, { seed: 1 }).issues[0]?.name).toBe("weirdRule");
  });
});

describe("test-level duration tracking", () => {
  // "The time spent on the test is recorded as if it were a built-in response variable
  // called 'duration' declared at the test-level … time spent on test parts or
  // sections are treated as built-in response variables declared within each
  // respective scope … referred to during outcome-processing by using the variable
  // name duration prefixed with the identifier of the part or section followed by the
  // period character." (§2.8.5)
  const setVar = (identifier: string, expression: Record<string, unknown>) => ({
    kind: "setOutcomeValue",
    identifier,
    expression: expression as never,
  });
  const durationOf = (prefix?: string) => ({
    kind: "variable",
    identifier: prefix === undefined ? "duration" : `${prefix}.duration`,
  });

  const tracking: AssessmentTestView = {
    identifier: "T-DUR",
    outcomeDeclarations: [
      // The name is reserved: an author-declared `duration` outcome never shadows the
      // built-in (its declared default stays visible as a plain outcome).
      {
        identifier: "duration",
        cardinality: "single",
        baseType: "duration",
        defaultValue: { values: [{ value: 999 }] },
      },
      { identifier: "D_TEST", cardinality: "single", baseType: "float" },
      { identifier: "D_P1", cardinality: "single", baseType: "float" },
      { identifier: "D_P2", cardinality: "single", baseType: "float" },
      { identifier: "D_S1", cardinality: "single", baseType: "float" },
      { identifier: "D_S2", cardinality: "single", baseType: "float" },
      { identifier: "D_I1", cardinality: "single", baseType: "float" },
      { identifier: "NULL_I2", cardinality: "single", baseType: "boolean" },
      { identifier: "SLOW", cardinality: "single", baseType: "boolean" },
    ],
    outcomeProcessing: {
      rules: [
        setVar("D_TEST", durationOf()),
        setVar("D_P1", durationOf("P1")),
        setVar("D_P2", durationOf("P2")),
        setVar("D_S1", durationOf("S1")),
        setVar("D_S2", durationOf("S2")),
        setVar("D_I1", durationOf("I1")),
        setVar("NULL_I2", { kind: "isNull", expressions: [durationOf("I2")] }),
        setVar("SLOW", {
          kind: "durationGte",
          expressions: [durationOf("P1"), { kind: "baseValue", baseType: "duration", value: 30 }],
        }),
      ],
    },
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
              { kind: "assessmentSection", identifier: "S2", children: [itemRef("I2")] },
              itemRef("I3"),
            ],
          },
        ],
      },
      {
        identifier: "P2",
        navigationMode: "linear",
        submissionMode: "individual",
        assessmentSections: [{ kind: "assessmentSection", identifier: "S3", children: [itemRef("I4")] }],
      },
    ],
  };

  test("durations accrue per scope across transitions; nested sections feed every ancestor", () => {
    let nowMs = 0;
    const controller = createTestController(tracking, { seed: 1, now: () => nowMs });
    let state = controller.start(); // I1 (S1)

    nowMs += 10_000;
    state = controller.next(state); // I2 (S1/S2)
    nowMs += 5_000;
    state = controller.next(state); // I3 (S1)
    nowMs += 20_000;
    state = controller.next(state); // I4 (P2/S3)
    nowMs += 2_000;
    state = controller.end(state);

    expect(state.testOutcomes["D_TEST"]).toBe(37);
    expect(state.testOutcomes["D_P1"]).toBe(35); // navigation time inside P1, not an item sum
    expect(state.testOutcomes["D_P2"]).toBe(2);
    expect(state.testOutcomes["D_S1"]).toBe(35); // S2's 5s accrued to its ancestor too
    expect(state.testOutcomes["D_S2"]).toBe(5);
    expect(state.testOutcomes["SLOW"]).toBe(true); // durationGte over P1.duration
    expect(state.testOutcomes["duration"]).toBe(999); // the declared outcome is untouched
  });

  test("ITEM.duration resolves from the submitItem report; unreported is NULL", () => {
    let nowMs = 0;
    const controller = createTestController(tracking, { seed: 1, now: () => nowMs });
    let state = controller.start();

    // An item outcome literally named `duration` must not shadow the built-in either.
    state = controller.submitItem(state, "I1", {
      outcomes: { SCORE: 1, duration: 999 },
      durationSeconds: 42,
    });

    expect(state.testOutcomes["D_I1"]).toBe(42);
    expect(state.testOutcomes["NULL_I2"]).toBe(true);
  });

  test("the resolved plan carries a section table", () => {
    const controller = createTestController(tracking, { seed: 1 });

    expect(Object.keys(controller.plan.sections).sort()).toEqual(["S1", "S2", "S3"]);
  });

  test("a persisted pre-timing state flows through unchanged in behavior", () => {
    let nowMs = 500_000;
    const controller = createTestController(tracking, { seed: 1, now: () => nowMs });
    const oldShape = {
      status: "in-progress",
      currentItemKey: "I1",
      itemOutcomes: {},
      attemptedItems: [],
      attemptCounts: {},
      presentedItems: ["I1"],
      respondedItems: [],
      correctItems: [],
      incorrectItems: [],
      pendingItemResults: {},
      testOutcomes: {},
    } as const;

    let state = controller.next(oldShape); // timing initializes lazily; accrual starts here

    expect(controller.currentItem(state)?.key).toBe("I2");

    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 1 } });

    expect(state.testOutcomes["D_TEST"]).toBe(0); // no time credited before the first fold
  });

  test("a backwards clock clamps to zero elapsed", () => {
    let nowMs = 100_000;
    const controller = createTestController(tracking, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs = 50_000;
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });

    expect(state.testOutcomes["D_TEST"]).toBe(0);
  });

  test("the clock stops at end: tick on an ended session is identity", () => {
    let nowMs = 0;
    const controller = createTestController(tracking, { seed: 1, now: () => nowMs });
    const state = controller.end(controller.start());

    nowMs += 60_000;

    expect(controller.tick(state)).toBe(state);
  });
});

describe("timeLimits enforcement", () => {
  // The only normative expiry behavior in the spec: "The allow-late-submission
  // attribute regulates whether a candidate's response that is beyond the max-time
  // should still be accepted." (§7.40.3, default false). Forced moves/end, the
  // every-exceeded-scope rule, and minTime-vs-end() are designed delivery-engine
  // policy, documented in ADR-0005.
  interface SectionedOptions {
    readonly testTimeLimits?: { maxTime?: number; minTime?: number; allowLateSubmission?: boolean };
    readonly partTimeLimits?: { maxTime?: number; minTime?: number; allowLateSubmission?: boolean };
    readonly navigationMode?: "linear" | "nonlinear";
  }

  const sectioned = (sectionOne: Record<string, unknown>, opts: SectionedOptions = {}): AssessmentTestView => ({
    identifier: "T-LIMITS",
    outcomeDeclarations: [{ identifier: "TOTAL", cardinality: "single", baseType: "float" }],
    outcomeProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "TOTAL",
          expression: { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
        },
      ],
    },
    ...(opts.testTimeLimits ? { timeLimits: opts.testTimeLimits } : {}),
    testParts: [
      {
        identifier: "P1",
        navigationMode: opts.navigationMode ?? "linear",
        submissionMode: "individual",
        ...(opts.partTimeLimits ? { timeLimits: opts.partTimeLimits } : {}),
        assessmentSections: [sectionOne as never],
      },
      {
        identifier: "P2",
        navigationMode: "linear",
        submissionMode: "individual",
        assessmentSections: [{ kind: "assessmentSection", identifier: "SZ", children: [itemRef("I9")] }],
      },
    ],
  });

  test("test maxTime: tick past it ends the session and runs outcome processing", () => {
    let nowMs = 0;
    const view = sectioned(
      { kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2")] },
      { testTimeLimits: { maxTime: 100 } },
    );
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    nowMs += 101_000;
    state = controller.tick(state);

    expect(state.status).toBe("ended");
    expect(state.currentItemKey).toBeNull();
    expect(state.testOutcomes["TOTAL"]).toBe(1);
  });

  test("part maxTime: the expired part is closed and navigation lands in the next part", () => {
    let nowMs = 0;
    const view = sectioned(
      { kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2")] },
      { partTimeLimits: { maxTime: 60 } },
    );
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 61_000;
    state = controller.tick(state);

    expect(controller.currentItem(state)?.key).toBe("I9"); // I2 skipped: inside expired P1
  });

  test("part maxTime in a simultaneous part flushes pending results at the forced exit", () => {
    let nowMs = 0;
    const view: AssessmentTestView = {
      identifier: "T-SIM",
      outcomeDeclarations: [{ identifier: "TOTAL", cardinality: "single", baseType: "float" }],
      outcomeProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "TOTAL",
            expression: { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
          },
        ],
      },
      testParts: [
        {
          identifier: "P1",
          navigationMode: "nonlinear",
          submissionMode: "simultaneous",
          timeLimits: { maxTime: 60 },
          assessmentSections: [
            { kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2")] },
          ],
        },
        {
          identifier: "P2",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [{ kind: "assessmentSection", identifier: "SZ", children: [itemRef("I9")] }],
        },
      ],
    };
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, durationSeconds: 42 });
    nowMs += 61_000;
    state = controller.tick(state);

    expect(controller.currentItem(state)?.key).toBe("I9");
    expect(state.attemptCounts["I1"]).toBe(1); // the part's single attempt was spent
    expect(state.testOutcomes["TOTAL"]).toBe(1); // deposited in time → counted
    expect(state.itemDurationSeconds?.["I1"]).toBe(42); // report survived the pending flush
  });

  test("section maxTime: items inside are skipped and moveTo into it is blocked", () => {
    let nowMs = 0;
    const view = sectioned(
      {
        kind: "assessmentSection",
        identifier: "S1",
        timeLimits: { maxTime: 30 },
        children: [itemRef("I1"), itemRef("I2")],
      },
      { navigationMode: "nonlinear" },
    );
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 31_000;
    state = controller.tick(state);

    expect(controller.currentItem(state)?.key).toBe("I9"); // both S1 items unnavigable
    expect(controller.canMoveTo(state, "I1")).toBe(false);
  });

  test("item maxTime: the item becomes non-reenterable and unsubmittable", () => {
    let nowMs = 0;
    const view = sectioned(
      {
        kind: "assessmentSection",
        identifier: "S1",
        children: [itemRef("I1", { timeLimits: { maxTime: 20 } }), itemRef("I2")],
      },
      { navigationMode: "nonlinear" },
    );
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 21_000;
    state = controller.tick(state);

    expect(controller.currentItem(state)?.key).toBe("I2");
    expect(controller.canSubmitItem(state, "I1")).toBe(false);
    expect(controller.canMoveTo(state, "I1")).toBe(false);
  });

  test("a late submission is rejected, recorded, and the expiry then applies", () => {
    let nowMs = 0;
    const view = sectioned({
      kind: "assessmentSection",
      identifier: "S1",
      children: [itemRef("I1", { timeLimits: { maxTime: 20 } }), itemRef("I2")],
    });
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 21_000;
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });

    expect(state.itemOutcomes["I1"]).toBeUndefined(); // not accepted (§7.40.3 default false)
    expect(state.attemptCounts["I1"]).toBeUndefined();
    expect(state.rejectedSubmissions).toEqual([
      { itemKey: "I1", scope: { kind: "item", key: "I1" }, atTestSeconds: 21 },
    ]);
    expect(controller.currentItem(state)?.key).toBe("I2"); // expiry applied after recording
  });

  test("allowLateSubmission=true accepts the late response, then the expiry applies", () => {
    let nowMs = 0;
    const view = sectioned({
      kind: "assessmentSection",
      identifier: "S1",
      children: [itemRef("I1", { timeLimits: { maxTime: 20, allowLateSubmission: true } }), itemRef("I2")],
    });
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 21_000;
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });

    expect(state.itemOutcomes["I1"]).toEqual({ SCORE: 1 });
    expect(state.rejectedSubmissions ?? []).toEqual([]);
    expect(controller.currentItem(state)?.key).toBe("I2");
  });

  test("every exceeded scope must allow lateness: an outer barring scope still rejects", () => {
    // Interpretation (spec is silent on stacked expiries): each scope's own
    // allow-late-submission governs its own bar.
    let nowMs = 0;
    const view = sectioned({
      kind: "assessmentSection",
      identifier: "S1",
      timeLimits: { maxTime: 30 },
      children: [itemRef("I1", { timeLimits: { maxTime: 20, allowLateSubmission: true } }), itemRef("I2")],
    });
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 31_000; // beyond both the item's 20s (allows late) and S1's 30s (bars)
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });

    expect(state.itemOutcomes["I1"]).toBeUndefined();
    expect(state.rejectedSubmissions?.[0]?.scope).toEqual({ kind: "section", identifier: "S1" });
  });

  test("exact boundaries are candidate-favorable: == maxTime is not expired", () => {
    let nowMs = 0;
    const view = sectioned({
      kind: "assessmentSection",
      identifier: "S1",
      children: [itemRef("I1", { timeLimits: { maxTime: 20 } }), itemRef("I2")],
    });
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 20_000; // exactly maxTime: "beyond the max-time" means strictly beyond
    state = controller.tick(state);

    expect(controller.currentItem(state)?.key).toBe("I1");
    expect(controller.canSubmitItem(state, "I1")).toBe(true);

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });

    expect(state.itemOutcomes["I1"]).toEqual({ SCORE: 1 });
  });

  test("minTime gates next() in linear mode for items and sections; == minTime satisfies", () => {
    // "Minimum times are applicable to qti-assessment-sections and qti-assessment-items
    // only when linear navigation mode is in effect." (§7.40.1)
    let nowMs = 0;
    const view = sectioned({
      kind: "assessmentSection",
      identifier: "S1",
      timeLimits: { minTime: 50 },
      children: [itemRef("I1", { timeLimits: { minTime: 30 } }), itemRef("I2")],
    });
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 10_000;
    expect(controller.canNext(state)).toBe(false); // I1's 30s unmet

    state = controller.next(state);
    expect(controller.currentItem(state)?.key).toBe("I1");

    nowMs += 20_000; // exactly 30s on I1
    state = controller.next(state);
    expect(controller.currentItem(state)?.key).toBe("I2");

    state = controller.next(state); // leaving S1 at 30s < its 50s minTime
    expect(controller.currentItem(state)?.key).toBe("I2");

    nowMs += 20_000; // S1 at exactly 50s
    state = controller.next(state);
    expect(controller.currentItem(state)?.key).toBe("I9");
  });

  test("minTime does not gate nonlinear parts or end()", () => {
    let nowMs = 0;
    const view = sectioned(
      {
        kind: "assessmentSection",
        identifier: "S1",
        children: [itemRef("I1", { timeLimits: { minTime: 30 } }), itemRef("I2")],
      },
      { navigationMode: "nonlinear" },
    );
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    state = controller.next(state);
    expect(controller.currentItem(state)?.key).toBe("I2"); // nonlinear: ungated

    const linear = createTestController(
      sectioned({
        kind: "assessmentSection",
        identifier: "S1",
        children: [itemRef("I1", { timeLimits: { minTime: 30 } })],
      }),
      { seed: 1, now: () => nowMs },
    );

    expect(linear.end(linear.start()).status).toBe("ended"); // end() is never gated
  });

  test("expiry is enforced on any transition, not only tick", () => {
    let nowMs = 0;
    const view = sectioned(
      { kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2")] },
      { partTimeLimits: { maxTime: 60 } },
    );
    const controller = createTestController(view, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs += 61_000;
    state = controller.next(state); // the fold at entry sees the expired part

    expect(controller.currentItem(state)?.key).toBe("I9");
  });
});
