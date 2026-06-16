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

describe("interaction state collectors (PCI getState persistence, ADR-0012)", () => {
  test("suspend captures each registered collector's state into the snapshot", () => {
    const store = createAttemptStore(declarations, {});

    expect(store.getSnapshot().interactionStates).toEqual({});

    store.registerStateCollector("RESPONSE", () => JSON.stringify({ taps: 3 }));
    store.suspend();

    expect(store.getSnapshot().interactionStates["RESPONSE"]).toBe(JSON.stringify({ taps: 3 }));
  });

  test("a collector returning undefined records no state for that interaction", () => {
    const store = createAttemptStore(declarations, {});

    store.registerStateCollector("RESPONSE", () => undefined);
    store.suspend();

    expect(store.getSnapshot().interactionStates).toEqual({});
  });

  test("initialInteractionStates seeds the snapshot for a resumed session", () => {
    const store = createAttemptStore(declarations, {}, { initialInteractionStates: { RESPONSE: '{"taps":7}' } });

    // The PCI host reads this as its mount-time `state` to restore the instance.
    expect(store.getSnapshot().interactionStates["RESPONSE"]).toBe('{"taps":7}');
  });

  test("unregistering stops a collector from contributing at suspend", () => {
    const store = createAttemptStore(declarations, {});

    const unregister = store.registerStateCollector("RESPONSE", () => "stale");
    unregister();
    store.suspend();

    expect(store.getSnapshot().interactionStates).toEqual({});
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

describe("templateDefault overrides (test-level, §5.152)", () => {
  const integerResponse: ResponseDeclarationView[] = [
    { identifier: "RESPONSE", cardinality: "single", baseType: "integer" },
  ];
  const optionsWith = (overrides: Record<string, number | null> | undefined) => ({
    templateDeclarations: [
      {
        identifier: "X",
        cardinality: "single" as const,
        baseType: "integer",
        defaultValue: { values: [{ value: 1 }] },
      },
    ],
    templateProcessing: { rules: [] },
    ...(overrides === undefined ? {} : { templateDefaultValues: overrides }),
  });

  test("an override replaces the declared default for the clone", () => {
    const store = createAttemptStore(integerResponse, {}, optionsWith({ X: 5 }));

    expect(store.getSnapshot().templateValues["X"]).toBe(5);
  });

  test("without overrides the declared default stands", () => {
    const store = createAttemptStore(integerResponse, {}, optionsWith(undefined));

    expect(store.getSnapshot().templateValues["X"]).toBe(1);
  });

  test("a NULL override clears the declared default", () => {
    const store = createAttemptStore(integerResponse, {}, optionsWith({ X: null }));

    expect(store.getSnapshot().templateValues["X"]).toBeNull();
  });
});

describe("completionStatus lifecycle (built-in outcome)", () => {
  // "It starts with the reserved value 'not_attempted'. At the start of the first
  // attempt it changes to the reserved value 'unknown'." (§2.2.2.3) — the attempt
  // store exists only for a presented item, so its creation is the start of the
  // first attempt and the in-store value begins at "unknown"; "not_attempted" is the
  // state of items that never got a store.
  const scoredOptions = {
    outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single" as const, baseType: "float" }],
    responseProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "baseValue", baseType: "float", value: 1 },
        },
      ],
    },
  };

  test("starts at unknown and stays there when RP never sets it", () => {
    const store = createAttemptStore(declarations, {}, scoredOptions);

    expect(store.getSnapshot().outcomes["completionStatus"]).toBe("unknown");

    store.submit();

    expect(store.getSnapshot().outcomes["completionStatus"]).toBe("unknown");
    expect(store.getSnapshot().outcomes["SCORE"]).toBe(1);
  });

  test("responseProcessing can set it; the value persists into the next attempt's context", () => {
    const store = createAttemptStore(
      declarations,
      {},
      {
        adaptive: true,
        outcomeDeclarations: [],
        responseProcessing: {
          rules: [
            {
              kind: "setOutcomeValue",
              identifier: "completionStatus",
              expression: { kind: "baseValue", baseType: "identifier", value: "completed" },
            },
          ],
        },
      },
    );

    store.submit();

    expect(store.getSnapshot().outcomes["completionStatus"]).toBe("completed");
    expect(store.getSnapshot().submitted).toBe(true); // adaptive close on completed
  });

  test("items without responseProcessing keep the maintained value across submit", () => {
    const store = createAttemptStore(declarations, {});

    store.submit();

    expect(store.getSnapshot().outcomes["completionStatus"]).toBe("unknown");
  });

  test("reset returns the session to unknown", () => {
    const store = createAttemptStore(declarations, {}, scoredOptions);

    store.submit();
    store.reset();

    expect(store.getSnapshot().outcomes["completionStatus"]).toBe("unknown");
  });

  test("an explicit declaration keeps today's declared behavior", () => {
    const store = createAttemptStore(
      declarations,
      {},
      {
        outcomeDeclarations: [
          { identifier: "completionStatus", cardinality: "single" as const, baseType: "identifier" },
        ],
        responseProcessing: { rules: [] },
      },
    );

    expect(store.getSnapshot().outcomes["completionStatus"]).toBeUndefined(); // pre-submit, declared path

    store.submit();

    expect(store.getSnapshot().outcomes["completionStatus"]).toBeNull(); // declared, no default
  });
});

describe("attempt store suspension", () => {
  // "The duration is defined as being a single float that records the accumulated
  // time (in seconds) of all Candidate Sessions for all Attempts. In other words the
  // time between the beginning and the end of the item session minus any time the
  // session was in the suspended state."
  const declarations = [{ identifier: "RESPONSE", cardinality: "single" as const, baseType: "identifier" }];

  test("duration excludes time spent suspended", () => {
    let nowMs = 0;
    const store = createAttemptStore(declarations, {}, { now: () => nowMs });

    nowMs = 5_000;
    store.suspend();
    nowMs = 60_000;
    store.resume();
    nowMs = 65_000;
    store.submit();

    expect(store.getSnapshot().durationSeconds).toBe(10); // 5 + 5, not 65
  });

  test("suspend and resume are idempotent", () => {
    let nowMs = 0;
    const store = createAttemptStore(declarations, {}, { now: () => nowMs });

    store.suspend();
    nowMs = 10_000;
    store.suspend(); // no double-fold
    store.resume();
    store.resume(); // no double-start
    nowMs = 13_000;
    store.submit();

    expect(store.getSnapshot().durationSeconds).toBe(3);
  });

  test("reset restarts the active clock", () => {
    let nowMs = 0;
    const store = createAttemptStore(declarations, {}, { now: () => nowMs });

    nowMs = 5_000;
    store.suspend();
    store.reset();
    nowMs = 8_000;
    store.submit();

    expect(store.getSnapshot().durationSeconds).toBe(3);
  });
});
