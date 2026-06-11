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

    expect(store.getSnapshot().responses.RESPONSE).toBe("A");
    expect(notifications).toBe(1);
  });

  test("submit computes scores and locks further edits", () => {
    const store = createAttemptStore(declarations, {});
    store.setResponse("RESPONSE", "B");

    const scores = store.submit();

    expect(scores).toEqual([{ identifier: "RESPONSE", score: 1, maxScore: 1, correct: true }]);
    expect(store.getSnapshot().submitted).toBe(true);

    store.setResponse("RESPONSE", "A");
    expect(store.getSnapshot().responses.RESPONSE).toBe("B"); // locked after submit
  });

  test("reset clears responses and submitted flag", () => {
    const store = createAttemptStore(declarations, {});
    store.setResponse("RESPONSE", "B");
    store.submit();

    store.reset();

    expect(store.getSnapshot().submitted).toBe(false);
    expect(store.getSnapshot().responses.RESPONSE).toBeUndefined();
    expect(store.getSnapshot().scores).toEqual([]);
  });
});

describe("response collectors (imperative interactions, e.g. PCI)", () => {
  test("collectors flush into responses at submit and feed scoring", () => {
    const store = createAttemptStore(declarations, {});

    store.registerResponseCollector("RESPONSE", () => "B");

    const scores = store.submit();

    expect(store.getSnapshot().responses.RESPONSE).toBe("B");
    expect(scores[0]?.correct).toBe(true);
  });

  test("a collector returning undefined leaves the response untouched", () => {
    const store = createAttemptStore(declarations, {});

    store.setResponse("RESPONSE", "A");
    store.registerResponseCollector("RESPONSE", () => undefined);
    store.submit();

    expect(store.getSnapshot().responses.RESPONSE).toBe("A");
  });

  test("unregistering stops the collector from applying", () => {
    const store = createAttemptStore(declarations, {});

    const unregister = store.registerResponseCollector("RESPONSE", () => "B");
    unregister();
    store.setResponse("RESPONSE", "A");
    store.submit();

    expect(store.getSnapshot().responses.RESPONSE).toBe("A");
  });
});
