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
