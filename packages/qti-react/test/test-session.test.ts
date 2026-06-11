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

  test("snapshot identity is stable until state changes", () => {
    const session = makeSession();
    const before = session.getSnapshot();

    expect(session.getSnapshot()).toBe(before);
    session.next();
    expect(session.getSnapshot()).not.toBe(before);
  });
});
