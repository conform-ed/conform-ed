/**
 * The Test Session Store: the glue between the headless Test Controller (ADR-0005) and
 * per-item Attempt Stores. It owns navigation state, creates item stores lazily with
 * key-derived seeds (replayable clones), and feeds item submissions into the
 * controller so test outcome processing stays current. React-free.
 */

import { describe, expect, test } from "bun:test";

import type { AssessmentItemView } from "../src/runtime";
import { createTestController, createTestSessionStore } from "../src/test";
import type { AssessmentTestView } from "../src/test";

const matchCorrectUri = "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct";

function choiceItem(correct: string): AssessmentItemView {
  return {
    responseDeclarations: [
      {
        identifier: "RESPONSE",
        cardinality: "single",
        baseType: "identifier",
        correctResponse: { values: [{ value: correct }] },
      },
    ],
    outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
    responseProcessing: { template: matchCorrectUri },
    itemBody: {
      content: [
        {
          kind: "choiceInteraction",
          responseIdentifier: "RESPONSE",
          maxChoices: 1,
          simpleChoices: [{ identifier: "A" }, { identifier: "B" }],
        },
      ],
    },
  };
}

const templatedItem: AssessmentItemView = {
  responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "integer" }],
  templateDeclarations: [{ identifier: "X", cardinality: "single", baseType: "integer" }],
  templateProcessing: {
    rules: [{ kind: "setTemplateValue", identifier: "X", expression: { kind: "randomInteger", min: 1, max: 1000000 } }],
  },
  itemBody: { content: [] },
};

const testView: AssessmentTestView = {
  identifier: "TEST-1",
  outcomeDeclarations: [
    { identifier: "TOTAL", cardinality: "single", baseType: "float" },
    { identifier: "GRADE", cardinality: "single", baseType: "identifier" },
  ],
  testParts: [
    {
      identifier: "PART-1",
      navigationMode: "nonlinear",
      submissionMode: "individual",
      assessmentSections: [
        {
          kind: "assessmentSection",
          identifier: "SECTION-1",
          children: [
            { kind: "assessmentItemRef", identifier: "ITEM-1" },
            { kind: "assessmentItemRef", identifier: "ITEM-2" },
            { kind: "assessmentItemRef", identifier: "ITEM-3" },
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
              identifier: "GRADE",
              expression: { kind: "baseValue", baseType: "identifier", value: "pass" },
            },
          ],
        },
        outcomeElse: {
          rules: [
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
      access: "atEnd",
      outcomeIdentifier: "GRADE",
      identifier: "pass",
      showHide: "show",
      content: [{ kind: "text", value: "Well done." } as never],
    },
  ],
};

const itemsByKey: Record<string, AssessmentItemView> = {
  "ITEM-1": choiceItem("A"),
  "ITEM-2": choiceItem("B"),
  "ITEM-3": templatedItem,
};

function makeSession(seed = 42) {
  const controller = createTestController(testView, { seed });

  return createTestSessionStore(controller, {
    seed,
    resolveItem: (ref) => itemsByKey[ref.identifier] ?? null,
  });
}

describe("test session store", () => {
  test("starts at the first item with its resolved view", () => {
    const session = makeSession();
    const snapshot = session.getSnapshot();

    expect(snapshot.state.status).toBe("in-progress");
    expect(snapshot.currentItem?.key).toBe("ITEM-1");
    expect(snapshot.currentItemView).toBe(itemsByKey["ITEM-1"]!);
  });

  test("item submission flows into test state and outcome processing", () => {
    const session = makeSession();
    const store = session.itemStore("ITEM-1")!;

    store.setResponse("RESPONSE", "A");
    store.submit();

    const snapshot = session.getSnapshot();
    expect(snapshot.state.itemOutcomes["ITEM-1"]?.["SCORE"]).toBe(1);
    expect(snapshot.state.testOutcomes["TOTAL"]).toBe(1);
    expect(snapshot.state.attemptedItems).toEqual(["ITEM-1"]);
  });

  test("navigation preserves item attempt state across visits", () => {
    const session = makeSession();
    const first = session.itemStore("ITEM-1")!;

    first.setResponse("RESPONSE", "A");
    session.next();
    expect(session.getSnapshot().currentItem?.key).toBe("ITEM-2");

    expect(session.canMoveTo("ITEM-1")).toBe(true);
    session.moveTo("ITEM-1");
    expect(session.getSnapshot().currentItem?.key).toBe("ITEM-1");
    expect(session.itemStore("ITEM-1")).toBe(first);
    expect(first.getSnapshot().responses["RESPONSE"]).toBe("A");
  });

  test("ending the test runs outcome processing and reveals atEnd feedback", () => {
    const session = makeSession();

    for (const [key, answer] of [
      ["ITEM-1", "A"],
      ["ITEM-2", "B"],
    ] as const) {
      const store = session.itemStore(key)!;
      store.setResponse("RESPONSE", answer);
      store.submit();
    }

    session.end();

    const snapshot = session.getSnapshot();
    expect(snapshot.state.status).toBe("ended");
    expect(snapshot.state.testOutcomes["TOTAL"]).toBe(2);
    expect(snapshot.state.testOutcomes["GRADE"]).toBe("pass");
    expect(snapshot.visibleFeedbacks.map((feedback) => feedback.identifier)).toEqual(["pass"]);
  });

  test("item clones are replayable: same seed, same template values", () => {
    const first = makeSession(7).itemStore("ITEM-3")!.getSnapshot().templateValues["X"];
    const second = makeSession(7).itemStore("ITEM-3")!.getSnapshot().templateValues["X"];

    expect(first).not.toBeUndefined();
    expect(second).toBe(first);
  });

  test("unresolvable items surface as null views and stores", () => {
    const controller = createTestController(testView, { seed: 1 });
    const session = createTestSessionStore(controller, { seed: 1, resolveItem: () => null });

    expect(session.getSnapshot().currentItemView).toBeNull();
    expect(session.itemStore("ITEM-1")).toBeNull();
  });

  test("submissions beyond maxAttempts never reach the controller", () => {
    const session = makeSession();
    const store = session.itemStore("ITEM-1")!;

    store.setResponse("RESPONSE", "A");
    store.submit();
    expect(session.getSnapshot().state.itemOutcomes["ITEM-1"]?.["SCORE"]).toBe(1);

    // Re-attempt locally (reset + change + resubmit): the default maxAttempts of 1 is
    // spent, so the controller keeps the first attempt's outcomes.
    store.reset();
    store.setResponse("RESPONSE", "B");
    store.submit();

    const snapshot = session.getSnapshot();
    expect(snapshot.state.itemOutcomes["ITEM-1"]?.["SCORE"]).toBe(1);
    expect(snapshot.state.attemptCounts["ITEM-1"]).toBe(1);
  });

  test("snapshot identity is stable until state changes", () => {
    const session = makeSession();
    const before = session.getSnapshot();

    expect(session.getSnapshot()).toBe(before);
    session.next();
    expect(session.getSnapshot()).not.toBe(before);
  });
});

describe("test session store: per-item correctness flags", () => {
  test("submissions carry derived correct/responded flags into session state", () => {
    const session = makeSession();

    const one = session.itemStore("ITEM-1")!; // correct answer is A
    one.setResponse("RESPONSE", "A");
    one.submit();

    const two = session.itemStore("ITEM-2")!; // correct answer is B
    two.setResponse("RESPONSE", "A");
    two.submit();

    const { state } = session.getSnapshot();
    expect(state.correctItems).toEqual(["ITEM-1"]);
    expect(state.incorrectItems).toEqual(["ITEM-2"]);
    expect(state.respondedItems).toEqual(["ITEM-1", "ITEM-2"]);
    expect(state.presentedItems).toEqual(["ITEM-1"]); // only the start item was shown
  });

  test("an item with no scorable declaration is neither correct nor incorrect", () => {
    const session = makeSession();
    const store = session.itemStore("ITEM-3")!; // templated item without correctResponse

    store.submit();

    const { state } = session.getSnapshot();
    expect(state.correctItems).toEqual([]);
    expect(state.incorrectItems).toEqual([]);
    expect(state.respondedItems).toEqual([]); // nothing was answered either
  });
});

describe("test session store: simultaneous submission", () => {
  const simultaneousView: AssessmentTestView = {
    ...testView,
    testParts: [
      {
        ...testView.testParts[0]!,
        navigationMode: "linear",
        submissionMode: "simultaneous",
      },
    ],
  };

  test("a local re-attempt before the part is submitted revises the pending outcomes", () => {
    const controller = createTestController(simultaneousView, { seed: 42 });
    const session = createTestSessionStore(controller, {
      seed: 42,
      resolveItem: (ref) => itemsByKey[ref.identifier] ?? null,
    });
    const store = session.itemStore("ITEM-1")!;

    store.setResponse("RESPONSE", "B"); // wrong (correct is A)
    store.submit();
    expect(session.getSnapshot().state.pendingItemResults["ITEM-1"]?.outcomes["SCORE"]).toBe(0);

    store.reset();
    store.setResponse("RESPONSE", "A");
    store.submit();
    expect(session.getSnapshot().state.pendingItemResults["ITEM-1"]?.outcomes["SCORE"]).toBe(1);

    session.end();

    const { state } = session.getSnapshot();
    expect(state.itemOutcomes["ITEM-1"]?.["SCORE"]).toBe(1);
    expect(state.testOutcomes["TOTAL"]).toBe(1);
  });
});

describe("test session store: templateDefault", () => {
  test("values recorded in test state flow into the item store's clone", () => {
    const view: AssessmentTestView = {
      identifier: "TEST-TD",
      testParts: [
        {
          identifier: "PART-1",
          navigationMode: "nonlinear",
          submissionMode: "individual",
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "SECTION-1",
              children: [
                {
                  kind: "assessmentItemRef",
                  identifier: "ITEM-TD",
                  templateDefaults: [
                    {
                      templateIdentifier: "X",
                      expression: { kind: "baseValue", baseType: "integer", value: 9 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const templated: AssessmentItemView = {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "integer" }],
      templateDeclarations: [
        {
          identifier: "X",
          cardinality: "single",
          baseType: "integer",
          defaultValue: { values: [{ value: 1 }] },
        },
      ],
      templateProcessing: { rules: [] },
      itemBody: { content: [] },
    };
    const controller = createTestController(view, { seed: 3 });
    const session = createTestSessionStore(controller, { seed: 3, resolveItem: () => templated });

    expect(session.itemStore("ITEM-TD")!.getSnapshot().templateValues["X"]).toBe(9);
  });
});

describe("test session store: timing", () => {
  test("submitted attempts forward their item-session duration to the controller", () => {
    const session = makeSession();
    const store = session.itemStore("ITEM-1")!;

    store.setResponse("RESPONSE", "A");
    store.submit();

    const reported = session.getSnapshot().state.itemDurationSeconds?.["ITEM-1"];

    expect(typeof reported).toBe("number"); // AttemptSnapshot.durationSeconds, forwarded
  });

  test("tick() folds time through the controller and emits the new state", () => {
    const session = makeSession();
    const before = session.getSnapshot().state;

    session.tick();

    const after = session.getSnapshot().state;

    expect(after).not.toBe(before);
    expect(after.timing).toBeDefined();
  });
});

describe("test session store: selection with replacement", () => {
  // The §2.8.3 drill-and-practice pattern: each instantiation is an independent item
  // session, so key-derived clone seeds must differ per instance — the same templated
  // item rolls fresh values every time it is drawn.
  const drillView: AssessmentTestView = {
    identifier: "T-DRILL",
    testParts: [
      {
        identifier: "P1",
        navigationMode: "linear",
        submissionMode: "individual",
        assessmentSections: [
          {
            kind: "assessmentSection",
            identifier: "S1",
            selection: { select: 2, withReplacement: true },
            children: [{ kind: "assessmentItemRef", identifier: "ITEM-T" }],
          },
        ],
      },
    ],
  };

  test("instances get independent stores with instance-distinct template clones", () => {
    const make = () =>
      createTestSessionStore(createTestController(drillView, { seed: 42 }), {
        seed: 42,
        resolveItem: (ref) => (ref.identifier === "ITEM-T" ? templatedItem : null),
      });
    const session = make();
    const first = session.itemStore("ITEM-T.1")!;
    const second = session.itemStore("ITEM-T.2")!;

    expect(first).not.toBe(second);
    expect(first.getSnapshot().templateValues["X"]).not.toEqual(second.getSnapshot().templateValues["X"]);

    // Replayable: an identical session reproduces both clones from the test seed alone.
    const replay = make();

    expect(replay.itemStore("ITEM-T.1")!.getSnapshot().templateValues).toEqual(first.getSnapshot().templateValues);
    expect(replay.itemStore("ITEM-T.2")!.getSnapshot().templateValues).toEqual(second.getSnapshot().templateValues);
  });
});

describe("test session store: itemSessionControl enforcement", () => {
  const constrainedItem: AssessmentItemView = {
    responseDeclarations: [{ identifier: "RESPONSE", cardinality: "multiple", baseType: "identifier" }],
    outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
    itemBody: {
      content: [
        {
          kind: "choiceInteraction",
          responseIdentifier: "RESPONSE",
          minChoices: 2,
          maxChoices: 3,
          simpleChoices: [{ identifier: "A" }, { identifier: "B" }, { identifier: "C" }],
        },
      ],
    },
  };

  function strictSession(submissionMode: "individual" | "simultaneous") {
    const view: AssessmentTestView = {
      identifier: "T-VAL",
      testParts: [
        {
          identifier: "P1",
          navigationMode: "linear",
          submissionMode,
          itemSessionControl: { validateResponses: true },
          assessmentSections: [
            {
              kind: "assessmentSection",
              identifier: "S1",
              children: [{ kind: "assessmentItemRef", identifier: "C1" }],
            },
          ],
        },
      ],
    };
    const controller = createTestController(view, { seed: 1 });

    return createTestSessionStore(controller, { seed: 1, resolveItem: () => constrainedItem });
  }

  test("the item store wires interaction constraints and blocks invalid submits", () => {
    const session = strictSession("individual");
    const store = session.itemStore("C1")!;

    store.setResponse("RESPONSE", ["A"]);
    store.submit();

    expect(store.getSnapshot().submitted).toBe(false); // attempt-store gate
    expect(store.getSnapshot().responseViolations).toEqual([
      { responseIdentifier: "RESPONSE", kind: "minChoices", bound: 2 },
    ]);
    expect(session.getSnapshot().state.attemptCounts["C1"]).toBeUndefined();

    store.setResponse("RESPONSE", ["A", "B"]);
    store.submit();
    expect(session.getSnapshot().state.attemptCounts["C1"]).toBe(1);
  });

  test("validate-responses is 'only applicable … with individual submission mode'", () => {
    const session = strictSession("simultaneous");
    const store = session.itemStore("C1")!;

    store.setResponse("RESPONSE", ["A"]); // violates minChoices, but mode exempts it
    store.submit();

    expect(store.getSnapshot().submitted).toBe(true);
    expect(session.getSnapshot().state.pendingItemResults["C1"]).toBeDefined();
  });

  test("review() and setItemComment() flow through the store", () => {
    const session = makeSession();
    const store = session.itemStore("ITEM-1")!;

    store.setResponse("RESPONSE", "A");
    store.submit();
    session.end();

    expect(session.getSnapshot().state.status).toBe("ended");
    session.review("ITEM-1");
    expect(session.getSnapshot().currentItem?.key).toBe("ITEM-1");

    // Comments are session-time only; the default (allowComment=false) bars them too.
    session.setItemComment("ITEM-1", "too late");
    expect(session.getSnapshot().state.itemComments).toBeUndefined();
  });
});

describe("test session store: suspension and item-session clocks", () => {
  // "candidates may change their responses for an item and then leave it in the
  // suspended state by navigating to a different item in the same part of the test"
  // — the departed item's duration clock stops, and resumes on return.
  const twoItems: AssessmentTestView = {
    identifier: "T-SUS-S",
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
              { kind: "assessmentItemRef", identifier: "ITEM-1" },
              { kind: "assessmentItemRef", identifier: "ITEM-2" },
            ],
          },
        ],
      },
    ],
  };

  function timedSession(now: () => number) {
    const controller = createTestController(twoItems, { seed: 1, now });

    return createTestSessionStore(controller, {
      seed: 1,
      now,
      resolveItem: () => choiceItem("A"),
    });
  }

  test("navigating away suspends the departed item's clock; returning resumes it", () => {
    let nowMs = 0;
    const session = timedSession(() => nowMs);
    const first = session.itemStore("ITEM-1")!;

    nowMs = 10_000;
    session.moveTo("ITEM-2");
    session.itemStore("ITEM-2");
    nowMs = 30_000;
    session.moveTo("ITEM-1"); // 20s away from ITEM-1
    nowMs = 40_000;
    first.setResponse("RESPONSE", "A");
    first.submit();

    expect(first.getSnapshot().durationSeconds).toBe(20); // 10 + 10, the absence excluded
    expect(session.getSnapshot().state.itemDurationSeconds?.["ITEM-1"]).toBe(20);
  });

  test("a store created for a non-current item starts suspended", () => {
    let nowMs = 0;
    const session = timedSession(() => nowMs);
    const second = session.itemStore("ITEM-2")!; // ITEM-1 is current

    nowMs = 50_000;
    session.moveTo("ITEM-2");
    nowMs = 60_000;
    second.setResponse("RESPONSE", "A");
    second.submit();

    expect(second.getSnapshot().durationSeconds).toBe(10); // only the time as current
  });

  test("suspending the session stops the current item's clock too", () => {
    let nowMs = 0;
    const session = timedSession(() => nowMs);
    const first = session.itemStore("ITEM-1")!;

    nowMs = 10_000;
    session.suspend();
    expect(session.getSnapshot().state.status).toBe("suspended");

    nowMs = 100_000;
    session.resume();
    expect(session.getSnapshot().state.status).toBe("in-progress");

    nowMs = 110_000;
    first.setResponse("RESPONSE", "A");
    first.submit();

    expect(first.getSnapshot().durationSeconds).toBe(20);
  });
});

describe("test session store: results reporting", () => {
  test("assessmentResult() reports attempts with the clones' correct responses", async () => {
    const { QtiAssessmentResultDocumentSchema } = await import("@conform-ed/contracts/qti/v3_0_1");
    const session = makeSession(11);
    const store = session.itemStore("ITEM-1")!; // choiceItem("A")

    store.setResponse("RESPONSE", "A");
    store.submit();
    session.end();

    const document = session.assessmentResult({ context: { sourcedId: "learner-7" }, nowMs: 50_000 });

    expect(QtiAssessmentResultDocumentSchema.safeParse(document).success).toBe(true);
    expect(document.assessmentResult.context.sourcedId).toBe("learner-7");
    expect(document.assessmentResult.testResult?.identifier).toBe("TEST-1");

    const first = document.assessmentResult.itemResults!.find(
      (entry) => entry.identifier === "ITEM-1" && entry.sessionStatus === "final",
    )!;
    const response = first.responseVariables!.find((variable) => variable.identifier === "RESPONSE")!;

    expect(response.candidateResponse).toEqual({ values: [{ value: "A" }] });
    expect(response.correctResponse).toEqual({ values: [{ value: "A" }] });
    expect(response.baseType).toBe("identifier");

    // Items never attempted are still reported ("all items selected for
    // presentation should be reported with a corresponding itemResult").
    const statuses = document.assessmentResult.itemResults!.map((entry) => [entry.identifier, entry.sessionStatus]);

    expect(statuses).toContainEqual(["ITEM-2", "initial"]);
    expect(statuses).toContainEqual(["ITEM-3", "initial"]);
  });
});
