import { describe, expect, test } from "bun:test";

import { createAttemptStore } from "../src/store";
import type { ResponseDeclarationView } from "../src/types";

const declarations: ResponseDeclarationView[] = [
  {
    identifier: "RESPONSE",
    cardinality: "single",
    baseType: "identifier",
    correctResponse: { values: [{ value: "B" }] },
  },
];

describe("attempt store", () => {
  test("records responses and notifies subscribers", () => {
    const store = createAttemptStore(declarations, {});
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.setResponse("RESPONSE", "A");

    expect(store.getSnapshot().responses["RESPONSE"]).toBe("A");
    expect(notifications).toBe(1);
  });

  test("submit computes scores and locks further edits", () => {
    const store = createAttemptStore(declarations, {});
    store.setResponse("RESPONSE", "B");

    const scores = store.submit();

    expect(scores).toEqual([{ identifier: "RESPONSE", score: 1, maxScore: 1, correct: true }]);
    expect(store.getSnapshot().submitted).toBe(true);

    store.setResponse("RESPONSE", "A");
    expect(store.getSnapshot().responses["RESPONSE"]).toBe("B"); // locked after submit
  });

  test("reset clears responses and submitted flag", () => {
    const store = createAttemptStore(declarations, {});
    store.setResponse("RESPONSE", "B");
    store.submit();

    store.reset();

    expect(store.getSnapshot().submitted).toBe(false);
    expect(store.getSnapshot().responses["RESPONSE"]).toBeUndefined();
    expect(store.getSnapshot().scores).toEqual([]);
  });
});

describe("response collectors (imperative interactions, e.g. PCI)", () => {
  test("collectors flush into responses at submit and feed scoring", () => {
    const store = createAttemptStore(declarations, {});

    store.registerResponseCollector("RESPONSE", () => "B");

    const scores = store.submit();

    expect(store.getSnapshot().responses["RESPONSE"]).toBe("B");
    expect(scores[0]?.correct).toBe(true);
  });

  test("a collector returning undefined leaves the response untouched", () => {
    const store = createAttemptStore(declarations, {});

    store.setResponse("RESPONSE", "A");
    store.registerResponseCollector("RESPONSE", () => undefined);
    store.submit();

    expect(store.getSnapshot().responses["RESPONSE"]).toBe("A");
  });

  test("a collected record response scores through fieldValue", () => {
    const store = createAttemptStore(
      [{ identifier: "RESPONSE", cardinality: "record" }],
      {},
      {
        outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
        responseProcessing: {
          rules: [
            {
              kind: "responseCondition",
              responseIf: {
                expression: {
                  kind: "match",
                  expressions: [
                    {
                      kind: "fieldValue",
                      fieldIdentifier: "verdict",
                      expressions: [{ kind: "variable", identifier: "RESPONSE" }],
                    },
                    { kind: "baseValue", baseType: "boolean", value: "true" },
                  ],
                },
                rules: [
                  {
                    kind: "setOutcomeValue",
                    identifier: "SCORE",
                    expression: { kind: "baseValue", baseType: "float", value: "1" },
                  },
                ],
              },
              responseElse: {
                rules: [
                  {
                    kind: "setOutcomeValue",
                    identifier: "SCORE",
                    expression: { kind: "baseValue", baseType: "float", value: "0" },
                  },
                ],
              },
            },
          ],
        },
      },
    );

    store.registerResponseCollector("RESPONSE", () => ({ expression: "x+1", verdict: true }));
    store.submit();

    expect(store.getSnapshot().responses["RESPONSE"]).toEqual({ expression: "x+1", verdict: true });
    expect(store.getSnapshot().outcomes["SCORE"]).toBe(1);
  });

  test("unregistering stops the collector from applying", () => {
    const store = createAttemptStore(declarations, {});

    const unregister = store.registerResponseCollector("RESPONSE", () => "B");
    unregister();
    store.setResponse("RESPONSE", "A");
    store.submit();

    expect(store.getSnapshot().responses["RESPONSE"]).toBe("A");
  });
});

describe("attempt duration (built-in response variable)", () => {
  // QTI: "the duration of the item session as defined by the builtin response
  // variable duration" — wall-clock seconds from session start to submit, under an
  // injectable clock so tests (and replays) stay deterministic.
  const responseProcessing = {
    rules: [
      {
        kind: "responseCondition",
        responseIf: {
          expression: {
            kind: "durationGte",
            expressions: [
              { kind: "variable", identifier: "duration" },
              { kind: "baseValue", baseType: "duration", value: "60" },
            ],
          },
          rules: [
            {
              kind: "setOutcomeValue",
              identifier: "SLOW",
              expression: { kind: "baseValue", baseType: "boolean", value: "true" },
            },
          ],
        },
        responseElse: {
          rules: [
            {
              kind: "setOutcomeValue",
              identifier: "SLOW",
              expression: { kind: "baseValue", baseType: "boolean", value: "false" },
            },
          ],
        },
      },
    ],
  };
  const outcomeDeclarations = [{ identifier: "SLOW", cardinality: "single" as const, baseType: "boolean" }];

  test("submit hands RP the elapsed seconds and exposes durationSeconds", () => {
    let nowMs = 100_000;
    const store = createAttemptStore(declarations, {}, { responseProcessing, outcomeDeclarations, now: () => nowMs });

    expect(store.getSnapshot().durationSeconds).toBeNull();

    nowMs += 90_000; // candidate takes 90s
    store.setResponse("RESPONSE", "B");
    store.submit();

    expect(store.getSnapshot().durationSeconds).toBe(90);
    expect(store.getSnapshot().outcomes["SLOW"]).toBe(true);
  });

  test("a fast attempt scores the other branch", () => {
    let nowMs = 0;
    const store = createAttemptStore(declarations, {}, { responseProcessing, outcomeDeclarations, now: () => nowMs });

    nowMs += 5_000;
    store.setResponse("RESPONSE", "B");
    store.submit();

    expect(store.getSnapshot().durationSeconds).toBe(5);
    expect(store.getSnapshot().outcomes["SLOW"]).toBe(false);
  });

  test("reset restarts the session clock", () => {
    let nowMs = 0;
    const store = createAttemptStore(declarations, {}, { responseProcessing, outcomeDeclarations, now: () => nowMs });

    nowMs += 70_000;
    store.submit();
    expect(store.getSnapshot().durationSeconds).toBe(70);

    store.reset();
    expect(store.getSnapshot().durationSeconds).toBeNull();

    nowMs += 10_000;
    store.submit();
    expect(store.getSnapshot().durationSeconds).toBe(10);
  });
});

describe("numAttempts built-in", () => {
  test("RP sees the current attempt number (increments at attempt start, per spec)", () => {
    const store = createAttemptStore(
      declarations,
      {},
      {
        adaptive: true,
        outcomeDeclarations: [
          { identifier: "TRIES", cardinality: "single" as const, baseType: "integer" },
          { identifier: "completionStatus", cardinality: "single" as const, baseType: "identifier" },
        ],
        responseProcessing: {
          rules: [
            {
              kind: "setOutcomeValue",
              identifier: "TRIES",
              expression: { kind: "variable", identifier: "numAttempts" },
            },
          ],
        },
      },
    );

    store.submit();
    expect(store.getSnapshot().outcomes["TRIES"]).toBe(1);

    store.submit();
    expect(store.getSnapshot().outcomes["TRIES"]).toBe(2);
  });
});
