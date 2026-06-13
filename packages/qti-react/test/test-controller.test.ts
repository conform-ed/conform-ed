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

describe("selection with replacement (keyed instances)", () => {
  // "By setting 'with-replacement' to 'true' each element becomes eligible for
  // selection multiple times. Selecting 3 nodes from {A,B,C,D} can then result in
  // combinations such as {A,A,A}, {A,A,B} etc." (§5.129.2) — and "The number of
  // children to select may exceed the number of child elements defined only if
  // with-replacement is true." (§5.129.1). Instance keys adopt the spec's own
  // addressing: "a number that denotes the instance's place in the sequence of the
  // item's instantiation is inserted between the item variable identifier and the
  // item variable, separated by a period character." (§2.11.1.2)
  const drill: AssessmentTestView = {
    identifier: "T-WR",
    testParts: [
      {
        identifier: "P1",
        navigationMode: "linear",
        submissionMode: "individual",
        assessmentSections: [
          {
            kind: "assessmentSection",
            identifier: "S1",
            selection: { select: 3, withReplacement: true },
            children: [itemRef("Q01")],
          },
        ],
      },
    ],
  };

  test("the drill pattern: one ref selected three times yields three keyed instances", () => {
    const controller = createTestController(drill, { seed: 1 });
    const items = controller.plan.parts[0]!.items;

    expect(items.map((entry) => entry.key)).toEqual(["Q01.1", "Q01.2", "Q01.3"]);
    expect(items.map((entry) => entry.instance)).toEqual([1, 2, 3]);
    expect(items.every((entry) => entry.ref.identifier === "Q01")).toBe(true);
  });

  test("each instance is its own item session: attempts and outcomes are per key", () => {
    const controller = createTestController(drill, { seed: 1 });
    let state = controller.start();

    expect(controller.currentItem(state)?.key).toBe("Q01.1");
    state = controller.submitItem(state, "Q01.1", { outcomes: { SCORE: 1 } });
    state = controller.next(state);
    state = controller.submitItem(state, "Q01.2", { outcomes: { SCORE: 5 } });

    expect(state.attemptCounts).toEqual({ "Q01.1": 1, "Q01.2": 1 });
    expect(state.itemOutcomes["Q01.1"]).toEqual({ SCORE: 1 });
    expect(state.itemOutcomes["Q01.2"]).toEqual({ SCORE: 5 });
  });

  test("single-instance refs keep bare keys; draws keep document order and replay per seed", () => {
    const pool: AssessmentTestView = {
      identifier: "T-WR-POOL",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              selection: { select: 6, withReplacement: true },
              children: [itemRef("A"), itemRef("B"), itemRef("C"), itemRef("D")],
            },
          ],
        },
      ],
    };
    const documentOrder = ["A", "B", "C", "D"];

    for (let seed = 0; seed < 8; seed += 1) {
      const items = createTestController(pool, { seed }).plan.parts[0]!.items;
      const ids = items.map((entry) => entry.ref.identifier);

      expect(items).toHaveLength(6); // six draws from four children (pigeonhole: repeats)
      // Selection keeps document order (repeats adjacent); ordering shuffles separately.
      expect(ids).toEqual([...ids].sort((a, b) => documentOrder.indexOf(a) - documentOrder.indexOf(b)));

      for (const id of documentOrder) {
        const instances = items.filter((entry) => entry.ref.identifier === id);

        expect(instances.map((entry) => entry.key)).toEqual(
          instances.length === 1 ? [id] : instances.map((_, index) => `${id}.${index + 1}`),
        );
      }

      // The same seed reproduces the same multiset (replayable sessions).
      expect(createTestController(pool, { seed }).plan.parts[0]!.items.map((entry) => entry.key)).toEqual(
        items.map((entry) => entry.key),
      );
    }
  });

  test("required children always appear; extra slots draw from the whole pool", () => {
    const guarded: AssessmentTestView = {
      identifier: "T-WR-REQ",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              selection: { select: 3, withReplacement: true },
              children: [itemRef("A", { required: true }), itemRef("B")],
            },
          ],
        },
      ],
    };

    for (let seed = 0; seed < 10; seed += 1) {
      const ids = createTestController(guarded, { seed }).plan.parts[0]!.items.map((entry) => entry.ref.identifier);

      expect(ids).toHaveLength(3);
      expect(ids).toContain("A");
    }
  });

  test("a section drawn with replacement instantiates its subtree per draw; numbering is global", () => {
    // "Sub-sections always count as 1, regardless of how many child elements they
    // have" (§5.129.1) — drawing one twice repeats its whole subtree.
    const nested: AssessmentTestView = {
      identifier: "T-WR-NEST",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "OUTER",
              selection: { select: 2, withReplacement: true },
              children: [{ kind: "assessmentSection", identifier: "INNER", children: [itemRef("Q01"), itemRef("X")] }],
            },
          ],
        },
      ],
    };
    const items = createTestController(nested, { seed: 1 }).plan.parts[0]!.items;

    expect(items.map((entry) => entry.key)).toEqual(["Q01.1", "X.1", "Q01.2", "X.2"]);
    expect(items.every((entry) => entry.sectionPath.includes("INNER"))).toBe(true);
  });

  test("Q01.n.VAR addresses each instantiation; a bare ref is NULL under individual submission", () => {
    // "to obtain the value of the SCORE variable in the item referred to as Q01 in
    // its second instantiation you would use … Q01.2.SCORE" (§2.11.1.2); the bare
    // form over multiple instances "is taken from the last instance submitted if
    // submission is simultaneous, otherwise it is undefined" — undefined maps to
    // NULL, like every undefined value in this engine.
    const addressed: AssessmentTestView = {
      ...drill,
      outcomeDeclarations: [
        { identifier: "FIRST", cardinality: "single", baseType: "float" },
        { identifier: "SECOND", cardinality: "single", baseType: "float" },
        { identifier: "BARE", cardinality: "single", baseType: "float" },
        { identifier: "D2", cardinality: "single", baseType: "duration" },
      ],
      outcomeProcessing: {
        rules: [
          { kind: "setOutcomeValue", identifier: "FIRST", expression: { kind: "variable", identifier: "Q01.1.SCORE" } },
          {
            kind: "setOutcomeValue",
            identifier: "SECOND",
            expression: { kind: "variable", identifier: "Q01.2.SCORE" },
          },
          { kind: "setOutcomeValue", identifier: "BARE", expression: { kind: "variable", identifier: "Q01.SCORE" } },
          { kind: "setOutcomeValue", identifier: "D2", expression: { kind: "variable", identifier: "Q01.2.duration" } },
        ],
      },
    };
    const controller = createTestController(addressed, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "Q01.1", { outcomes: { SCORE: 1 } });
    state = controller.next(state);
    state = controller.submitItem(state, "Q01.2", { outcomes: { SCORE: 5 }, durationSeconds: 42 });
    state = controller.end(state);

    expect(state.testOutcomes["FIRST"]).toBe(1);
    expect(state.testOutcomes["SECOND"]).toBe(5);
    expect(state.testOutcomes["BARE"]).toBeNull();
    expect(state.testOutcomes["D2"]).toBe(42);
  });

  test("a bare ref under simultaneous submission reads the last instance submitted", () => {
    const bareSimultaneous: AssessmentTestView = {
      ...drill,
      outcomeDeclarations: [{ identifier: "BARE", cardinality: "single", baseType: "float" }],
      outcomeProcessing: {
        rules: [
          { kind: "setOutcomeValue", identifier: "BARE", expression: { kind: "variable", identifier: "Q01.SCORE" } },
        ],
      },
      testParts: [{ ...drill.testParts[0]!, submissionMode: "simultaneous" }],
    };
    const controller = createTestController(bareSimultaneous, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "Q01.1", { outcomes: { SCORE: 1 } });
    state = controller.next(state);
    state = controller.submitItem(state, "Q01.2", { outcomes: { SCORE: 5 } });
    state = controller.next(state);
    state = controller.next(state); // Q01.3 left unsubmitted; leaving the part flushes

    expect(state.status).toBe("ended");
    expect(state.testOutcomes["BARE"]).toBe(5); // the last submitted instance, not Q01.3
  });

  test("numberSelected counts instances; outcomeMaximum reads declarations by ref identifier", () => {
    const counted: AssessmentTestView = {
      ...drill,
      outcomeDeclarations: [
        { identifier: "N", cardinality: "single", baseType: "integer" },
        { identifier: "MAX", cardinality: "single", baseType: "float" },
      ],
      outcomeProcessing: {
        rules: [
          { kind: "setOutcomeValue", identifier: "N", expression: { kind: "numberSelected" } },
          {
            kind: "setOutcomeValue",
            identifier: "MAX",
            expression: {
              kind: "sum",
              expressions: [{ kind: "outcomeMaximum", outcomeIdentifier: "SCORE" }],
            },
          },
        ],
      },
    };
    const controller = createTestController(counted, {
      seed: 1,
      itemOutcomeDeclarations: {
        Q01: [{ identifier: "SCORE", cardinality: "single", baseType: "float", normalMaximum: 2 }],
      },
    });
    const state = controller.end(controller.start());

    expect(state.testOutcomes["N"]).toBe(3);
    expect(state.testOutcomes["MAX"]).toBe(6); // each instance contributes the ref's declared maximum
  });

  test("the §2.8.3 repetition pattern: a precondition ends the drill once passed", () => {
    // "repetition can be achieved by using a section that selects with-replacement up
    // to a suitable upper bound of repitition [sic] in combination with a
    // pre-condition or branch-rule that terminates the section early when (or if) a
    // certain outcome has been achieved." (§2.8.3)
    const practice: AssessmentTestView = {
      ...drill,
      outcomeDeclarations: [
        {
          identifier: "PASSED",
          cardinality: "single",
          baseType: "boolean",
          defaultValue: { values: [{ value: false }] },
        },
      ],
      outcomeProcessing: {
        rules: [
          {
            kind: "outcomeCondition",
            outcomeIf: {
              expression: {
                kind: "gte",
                expressions: [
                  { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
                  { kind: "baseValue", baseType: "float", value: 1 },
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
      testParts: [
        {
          ...drill.testParts[0]!,
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              selection: { select: 3, withReplacement: true },
              children: [
                itemRef("Q01", {
                  preConditions: [{ kind: "not", expressions: [{ kind: "variable", identifier: "PASSED" }] }],
                }),
              ],
            },
          ],
        },
      ],
    };
    const controller = createTestController(practice, { seed: 1 });
    let state = controller.start();

    state = controller.submitItem(state, "Q01.1", { outcomes: { SCORE: 1 } }); // passed on the first try
    state = controller.next(state);

    expect(state.status).toBe("ended"); // the remaining instances were skipped
    expect(state.attemptCounts).toEqual({ "Q01.1": 1 });
  });

  test("a branch target naming a multi-instance ref jumps to the next instance after the current item", () => {
    const looping: AssessmentTestView = {
      identifier: "T-WR-BRANCH",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "OUTER",
              selection: { select: 2, withReplacement: true },
              children: [
                {
                  kind: "assessmentSection",
                  identifier: "INNER",
                  children: [
                    itemRef("Q01", {
                      branchRules: [
                        { target: "Q01", expression: { kind: "baseValue", baseType: "boolean", value: true } },
                      ],
                    }),
                    itemRef("X"),
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const controller = createTestController(looping, { seed: 1 });
    let state = controller.start(); // plan: Q01.1, X.1, Q01.2, X.2

    state = controller.submitItem(state, "Q01.1", { outcomes: { SCORE: 0 } });
    state = controller.next(state);

    expect(controller.currentItem(state)?.key).toBe("Q01.2"); // branched over X.1
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

describe("templateDefault (test-level template-variable overrides)", () => {
  // "The default value of a template variable in an item can be overridden based on
  // the test context in which the template is instantiated. … When the
  // assessmentItemRef occurs in a testPart navigated in linear mode the expression is
  // evaluated immediately prior to the start of the first attempt, after any
  // pre-conditions are evaluated and acted upon but before the templateProcessing
  // rules of the item itself are followed. In nonlinear mode the expression is
  // evaluated at the start of the testPart." (§5.152)
  const withDefaults = (navigationMode: "linear" | "nonlinear"): AssessmentTestView => ({
    identifier: "T-TD",
    testParts: [
      {
        identifier: "P1",
        navigationMode,
        submissionMode: "individual",
        assessmentSections: [
          {
            kind: "assessmentSection",
            identifier: "S1",
            children: [
              itemRef("I1"),
              itemRef("I2", {
                templateDefaults: [
                  { templateIdentifier: "X", expression: { kind: "variable", identifier: "I1.SCORE" } },
                ],
              }),
            ],
          },
        ],
      },
    ],
  });

  test("linear: evaluated when the item first becomes current, not before", () => {
    const controller = createTestController(withDefaults("linear"), { seed: 1 });
    let state = controller.start();

    expect(state.templateDefaultValues?.["I2"]).toBeUndefined();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 7 } });
    state = controller.next(state);

    expect(controller.currentItem(state)?.key).toBe("I2");
    expect(state.templateDefaultValues?.["I2"]).toEqual({ X: 7 });
  });

  test("nonlinear: evaluated at the start of the testPart for every ref", () => {
    const controller = createTestController(withDefaults("nonlinear"), { seed: 1 });
    const state = controller.start();

    expect(controller.currentItem(state)?.key).toBe("I1");
    // Evaluated already — I1.SCORE does not exist yet, so the recorded value is NULL.
    expect(state.templateDefaultValues?.["I2"]).toEqual({ X: null });
  });

  test("the static walk gates templateDefault expressions", () => {
    const broken: AssessmentTestView = {
      identifier: "T-TD-BROKEN",
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
                  templateDefaults: [{ templateIdentifier: "X", expression: { kind: "frobnicate" } }],
                }),
              ],
            },
          ],
        },
      ],
    };

    expect(createTestController(broken, { seed: 1 }).issues[0]?.name).toBe("frobnicate");
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

describe("itemSessionControl enforcement: validity, review, comments", () => {
  test("validateResponses bars invalid submissions in individual mode only", () => {
    // "When validate-responses is turned on (true) then the candidates are not
    // allowed to submit the item until they have provided valid responses for all
    // interactions. … The value of this attribute is only applicable when the item
    // is in a qti-test-part with individual submission mode."
    const strict: AssessmentTestView = {
      ...linearTest,
      testParts: [{ ...linearTest.testParts[0]!, itemSessionControl: { validateResponses: true } }],
    };
    const controller = createTestController(strict, { seed: 1 });
    let state = controller.start();

    const refused = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, valid: false });

    expect(refused).toBe(state); // identity: nothing recorded
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, valid: true });
    expect(state.attemptCounts).toEqual({ I1: 1 });

    const simultaneous: AssessmentTestView = {
      ...strict,
      testParts: [{ ...strict.testParts[0]!, submissionMode: "simultaneous" }],
    };
    const simController = createTestController(simultaneous, { seed: 1 });
    let simState = simController.start();

    simState = simController.submitItem(simState, "I1", { outcomes: { SCORE: 1 }, valid: false });
    expect(simState.pendingItemResults["I1"]).toBeDefined(); // not applicable in simultaneous mode
  });

  test("allowReview=false blocks revisiting an item after its last attempt", () => {
    // "If set to 'false' the candidate can not review the qti-item-body or their
    // responses once they have submitted their last attempt."
    const reviewable: AssessmentTestView = {
      identifier: "T-REV",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "nonlinear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              children: [itemRef("I1", { itemSessionControl: { allowReview: false } }), itemRef("I2"), itemRef("I3")],
            },
          ],
        },
      ],
    };
    const controller = createTestController(reviewable, { seed: 1 });
    let state = controller.start();

    // Before the last attempt ends, revisiting is interaction, not review.
    state = controller.moveTo(state, "I2");
    expect(controller.canMoveTo(state, "I1")).toBe(true);

    state = controller.moveTo(state, "I1");
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } }); // maxAttempts 1 spent
    state = controller.moveTo(state, "I2");
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 1 } });

    expect(controller.canMoveTo(state, "I1")).toBe(false); // allowReview=false
    expect(controller.moveTo(state, "I1")).toBe(state);
    expect(controller.canMoveTo(state, "I2")).toBe(true); // default allowReview=true
  });

  test("after the test ends, review() navigates presented review-allowed items read-only", () => {
    // "If set to 'true' the item session is allowed to enter the review state during
    // which the candidate can review the qti-item-body along with the responses they
    // gave, but cannot update or resubmit them."
    const conditional: AssessmentTestView = {
      identifier: "T-REV-END",
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
                  // Skipped via precondition: never presented, so never reviewable.
                  preConditions: [{ kind: "baseValue", baseType: "boolean", value: false }],
                }),
                itemRef("I3", { itemSessionControl: { allowReview: false } }),
              ],
            },
          ],
        },
      ],
    };
    const controller = createTestController(conditional, { seed: 1 });
    let state = controller.start();

    expect(controller.canReview(state, "I1")).toBe(false); // review is a post-end state
    expect(controller.review(state, "I1")).toBe(state);

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    state = controller.next(state); // I2 skipped → I3
    state = controller.next(state); // ended

    expect(state.status).toBe("ended");
    expect(controller.canReview(state, "I1")).toBe(true);
    expect(controller.canReview(state, "I2")).toBe(false); // never presented
    expect(controller.canReview(state, "I3")).toBe(false); // allowReview=false

    const reviewing = controller.review(state, "I1");

    expect(reviewing.status).toBe("ended"); // review never reopens the session
    expect(controller.currentItem(reviewing)?.key).toBe("I1");
    expect(controller.canSubmitItem(reviewing, "I1")).toBe(false); // "cannot update or resubmit"
    expect(controller.review(state, "I3")).toBe(state);
  });

  test("comments are recorded only where allowComment permits, while the session runs", () => {
    // "This constraint controls whether or not the candidate is allowed to provide a
    // comment on the item during the session." (default false)
    const commented: AssessmentTestView = {
      ...linearTest,
      testParts: [
        {
          ...linearTest.testParts[0]!,
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              children: [itemRef("I1", { itemSessionControl: { allowComment: true } }), itemRef("I2")],
            },
          ],
        },
      ],
    };
    const controller = createTestController(commented, { seed: 1 });
    let state = controller.start();

    expect(controller.canComment(state, "I1")).toBe(true);
    expect(controller.canComment(state, "I2")).toBe(false); // spec default: false

    state = controller.setItemComment(state, "I1", "The diagram is hard to read.");
    expect(state.itemComments).toEqual({ I1: "The diagram is hard to read." });
    expect(controller.setItemComment(state, "I2", "nope")).toBe(state);

    state = controller.end(state);
    expect(controller.canComment(state, "I1")).toBe(false); // only "during the session"
    expect(controller.setItemComment(state, "I1", "late")).toBe(state);
  });
});

describe("suspension and resume", () => {
  // The spec's duration rule is suspension-aware: duration "records the accumulated
  // time (in seconds) of all Candidate Sessions for all Attempts. In other words the
  // time between the beginning and the end of the item session minus any time the
  // session was in the suspended state." The controller extends the same model to
  // every scope clock (designed policy, documented in ADR-0005).
  const setVar = (identifier: string, expression: Record<string, unknown>) => ({
    kind: "setOutcomeValue",
    identifier,
    expression: expression as never,
  });
  const suspendable: AssessmentTestView = {
    identifier: "T-SUS",
    outcomeDeclarations: [
      { identifier: "D_TEST", cardinality: "single", baseType: "float" },
      { identifier: "D_P1", cardinality: "single", baseType: "float" },
      { identifier: "D_I1", cardinality: "single", baseType: "float" },
    ],
    outcomeProcessing: {
      rules: [
        setVar("D_TEST", { kind: "variable", identifier: "duration" }),
        setVar("D_P1", { kind: "variable", identifier: "P1.duration" }),
        setVar("D_I1", { kind: "variable", identifier: "I1.duration" }),
      ],
    },
    testParts: [
      {
        identifier: "P1",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        assessmentSections: [{ kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2")] }],
      },
    ],
  };

  test("suspend stops every scope clock; resume excludes the suspended gap", () => {
    let nowMs = 0;
    const controller = createTestController(suspendable, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs = 10_000;
    state = controller.suspend(state);
    expect(state.status).toBe("suspended");

    nowMs = 100_000;
    state = controller.resume(state);
    expect(state.status).toBe("in-progress");

    nowMs = 110_000;
    state = controller.end(state);

    expect(state.testOutcomes["D_TEST"]).toBe(20); // 10 before + 10 after, not 110
    expect(state.testOutcomes["D_P1"]).toBe(20);
  });

  test("a suspended session refuses every transition until resumed", () => {
    let nowMs = 0;
    const controller = createTestController(suspendable, { seed: 1, now: () => nowMs });
    let state = controller.start();

    state = controller.suspend(state);

    expect(controller.canNext(state)).toBe(false);
    expect(controller.next(state)).toBe(state);
    expect(controller.canMoveTo(state, "I2")).toBe(false);
    expect(controller.moveTo(state, "I2")).toBe(state);
    expect(controller.canSubmitItem(state, "I1")).toBe(false);
    expect(controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } })).toBe(state);
    expect(controller.tick(state)).toBe(state);
    expect(controller.canComment(state, "I1")).toBe(false);

    state = controller.resume(state);
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    expect(state.attemptCounts).toEqual({ I1: 1 });
  });

  test("suspend folds first: an already-exceeded time limit still applies", () => {
    let nowMs = 0;
    const timed: AssessmentTestView = { ...suspendable, timeLimits: { maxTime: 30 } };
    const controller = createTestController(timed, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs = 40_000; // past maxTime before the suspend arrives
    state = controller.suspend(state);

    expect(state.status).toBe("ended"); // the fold applied the expiry, not the suspension
  });

  test("end() works from suspended without folding the suspended gap", () => {
    let nowMs = 0;
    const controller = createTestController(suspendable, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs = 10_000;
    state = controller.suspend(state);
    nowMs = 100_000;
    state = controller.end(state);

    expect(state.status).toBe("ended");
    expect(state.testOutcomes["D_TEST"]).toBe(10);
  });

  test("suspend and resume are identity at the wrong edges", () => {
    let nowMs = 0;
    const controller = createTestController(suspendable, { seed: 1, now: () => nowMs });
    const running = controller.start();

    expect(controller.resume(running)).toBe(running); // not suspended
    const suspended = controller.suspend(running);
    expect(controller.suspend(suspended)).toBe(suspended); // already suspended
    const done = controller.end(running);
    expect(controller.suspend(done)).toBe(done);
    expect(controller.resume(done)).toBe(done);
  });

  test("a persisted suspended state resumes under a fresh controller", () => {
    let nowMs = 0;
    const first = createTestController(suspendable, { seed: 1, now: () => nowMs });
    let state = first.start();

    nowMs = 10_000;
    state = first.suspend(state);

    const revived = JSON.parse(JSON.stringify(state)) as typeof state;
    nowMs = 1_000_000; // a long break (laptop closed)
    const second = createTestController(suspendable, { seed: 1, now: () => nowMs });
    let resumed = second.resume(revived);

    nowMs = 1_010_000;
    resumed = second.end(resumed);

    expect(resumed.testOutcomes["D_TEST"]).toBe(20); // the break never accrued
  });
});

describe("attempt history (results reporting)", () => {
  // "A report may contain multiple results for the same instance of an item
  // representing multiple attempts … each item result must have a different
  // datestamp." (QTI Results Reporting §2.4.5) — the controller records every
  // committed attempt with its submission instant so the report can be produced
  // from persisted state.
  const twoAttempts: AssessmentTestView = {
    identifier: "T-HIST",
    testParts: [
      {
        identifier: "P1",
        navigationMode: "linear",
        submissionMode: "individual",
        itemSessionControl: { maxAttempts: 2 },
        assessmentSections: [{ kind: "assessmentSection", identifier: "S1", children: [itemRef("I1"), itemRef("I2")] }],
      },
    ],
  };

  test("every committed attempt is recorded with its timestamp, outcomes, and responses", () => {
    let nowMs = 1_000;
    const controller = createTestController(twoAttempts, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs = 5_000;
    state = controller.submitItem(state, "I1", {
      outcomes: { SCORE: 0 },
      responses: { RESPONSE: "A" },
      durationSeconds: 4,
    });
    nowMs = 9_000;
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, responses: { RESPONSE: "B" } });

    expect(state.attemptHistory?.["I1"]).toEqual([
      { atMs: 5_000, outcomes: { SCORE: 0 }, responses: { RESPONSE: "A" }, durationSeconds: 4 },
      { atMs: 9_000, outcomes: { SCORE: 1 }, responses: { RESPONSE: "B" } },
    ]);
    expect(state.attemptHistory?.["I2"]).toBeUndefined();
  });

  test("refused submissions never enter the history", () => {
    let nowMs = 0;
    const controller = createTestController(twoAttempts, { seed: 1, now: () => nowMs });
    let state = controller.start();

    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 0 } });
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 } });
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 2 } }); // maxAttempts spent

    expect(state.attemptHistory?.["I1"]).toHaveLength(2);
  });

  test("simultaneous submissions keep their submit-time stamps through the flush", () => {
    let nowMs = 0;
    const simultaneous: AssessmentTestView = {
      ...twoAttempts,
      testParts: [{ ...twoAttempts.testParts[0]!, itemSessionControl: {}, submissionMode: "simultaneous" }],
    };
    const controller = createTestController(simultaneous, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs = 3_000;
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, responses: { RESPONSE: "A" } });
    nowMs = 5_000;
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 2 }, responses: { RESPONSE: "B" } }); // revision
    state = controller.next(state);
    nowMs = 7_000;
    state = controller.submitItem(state, "I2", { outcomes: { SCORE: 3 } });
    nowMs = 10_000;
    state = controller.next(state); // leaves the part → flush

    expect(state.status).toBe("ended");
    expect(state.attemptHistory?.["I1"]).toEqual([
      { atMs: 5_000, outcomes: { SCORE: 2 }, responses: { RESPONSE: "B" } }, // the revision's stamp
    ]);
    expect(state.attemptHistory?.["I2"]?.[0]?.atMs).toBe(7_000);
  });
});

describe("PNP additional testing time (§2.8.5 + AfA additional-testing-time)", () => {
  // "Note that the durations may be changed depending on the relevant accessibility
  // values in the Personal Needs & Preferences settings for the learner." (§2.8.5)
  // AfA: "The container for the set of additional testing time preferences. Only one
  // of the available options can be selected."
  const timed = (extra: { testMaxTime?: number; itemMaxTime?: number; itemMinTime?: number }): AssessmentTestView => ({
    identifier: "T-PNP-TIME",
    outcomeDeclarations: [],
    ...(extra.testMaxTime !== undefined ? { timeLimits: { maxTime: extra.testMaxTime } } : {}),
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
                timeLimits: {
                  ...(extra.itemMaxTime !== undefined ? { maxTime: extra.itemMaxTime } : {}),
                  ...(extra.itemMinTime !== undefined ? { minTime: extra.itemMinTime } : {}),
                },
              }),
              itemRef("I2"),
            ],
          },
        ],
      },
    ],
  });

  test("a time multiplier scales every declared max-time proportionally", () => {
    let nowMs = 0;
    const controller = createTestController(timed({ testMaxTime: 100, itemMaxTime: 20 }), {
      seed: 1,
      now: () => nowMs,
      pnp: { additionalTestingTime: { timeMultiplier: 1.5 } },
    });
    let state = controller.start();

    // Item: declared 20s × 1.5 = 30s. Past 20s but under 30s the item is still live.
    nowMs += 25_000;
    state = controller.tick(state);
    expect(controller.canSubmitItem(state, "I1")).toBe(true);

    state = controller.submitItem(state, "I1", { outcomes: {} });

    // Test: declared 100s × 1.5 = 150s. 120s is in time; past 150s ends the session.
    nowMs += 100_000; // 125s total
    state = controller.tick(state);
    expect(state.status).toBe("in-progress");

    nowMs += 30_000; // 155s total
    state = controller.tick(state);
    expect(state.status).toBe("ended");
  });

  test("fixed minutes extend the assessment window, not nested scopes", () => {
    let nowMs = 0;
    const controller = createTestController(timed({ testMaxTime: 100, itemMaxTime: 20 }), {
      seed: 1,
      now: () => nowMs,
      pnp: { additionalTestingTime: { fixedMinutes: 1 } },
    });
    let state = controller.start();

    // The item's own ceiling is untouched: past 20s it is no longer submittable.
    nowMs += 21_000;
    state = controller.tick(state);
    expect(controller.canSubmitItem(state, "I1")).toBe(false);

    // The test window is 100s + 60s: alive at 130s, over at 161s.
    nowMs += 109_000; // 130s
    state = controller.tick(state);
    expect(state.status).toBe("in-progress");

    nowMs += 31_000; // 161s
    state = controller.tick(state);
    expect(state.status).toBe("ended");
  });

  test("unlimited removes max-time ceilings entirely", () => {
    let nowMs = 0;
    const controller = createTestController(timed({ testMaxTime: 100, itemMaxTime: 20 }), {
      seed: 1,
      now: () => nowMs,
      pnp: { additionalTestingTime: { unlimited: true } },
    });
    let state = controller.start();

    nowMs += 10_000_000;
    state = controller.tick(state);

    expect(state.status).toBe("in-progress");
    expect(controller.canSubmitItem(state, "I1")).toBe(true);
  });

  test("minimum times are floors, never adjusted by the accommodation", () => {
    let nowMs = 0;
    const controller = createTestController(timed({ itemMinTime: 30 }), {
      seed: 1,
      now: () => nowMs,
      pnp: { additionalTestingTime: { timeMultiplier: 2 } },
    });
    let state = controller.start();

    // The gate lifts at the declared 30s floor, not a doubled 60s.
    nowMs += 29_000;
    expect(controller.canNext(state)).toBe(false);

    nowMs += 1_000;
    state = controller.next(state);
    expect(controller.currentItem(state)?.key).toBe("I2");
  });

  test("a prohibited additional-testing-time accommodation does not apply", () => {
    let nowMs = 0;
    const controller = createTestController(timed({ testMaxTime: 100 }), {
      seed: 1,
      now: () => nowMs,
      pnp: {
        additionalTestingTime: { timeMultiplier: 2 },
        prohibitSet: { features: ["additional-testing-time"] },
      },
    });
    let state = controller.start();

    nowMs += 101_000;
    state = controller.tick(state);

    expect(state.status).toBe("ended");
  });
});
