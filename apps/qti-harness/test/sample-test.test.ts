import { describe, expect, test } from "bun:test";

import {
  createQtiRuntime,
  createTestController,
  createTestSessionStore,
  qtiCoreInteractions,
  referenceSkin,
} from "@conform-ed/qti-react";

import { sampleTest, sampleTestItems } from "../src/sample-test";

const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });

describe("harness sample test", () => {
  test("the test and every item in it are deliverable", () => {
    const controller = createTestController(sampleTest, { seed: 42 });

    expect(controller.issues).toEqual([]);
    expect(controller.plan.parts[0]?.items).toHaveLength(3); // selection picks 3 of 4

    for (const item of Object.values(sampleTestItems)) {
      expect(runtime.canDeliver(item).issues).toEqual([]);
    }
  });

  test("a full session over the sample test grades the attempt", () => {
    const controller = createTestController(sampleTest, { seed: 42 });
    const session = createTestSessionStore(controller, {
      seed: 42,
      resolveItem: (ref) => sampleTestItems[ref.identifier] ?? null,
    });

    const correctAnswers: Record<string, string> = {
      "capital-choice": "edinburgh",
      "river-entry": "Tay",
      "verb-hottext": "ran",
    };

    for (const item of controller.plan.parts[0]!.items) {
      const store = session.itemStore(item.key)!;
      const answer =
        item.key === "addition-clone"
          ? String(Number(store.getSnapshot().templateValues["A"]) + Number(store.getSnapshot().templateValues["B"]))
          : correctAnswers[item.key]!;

      store.setResponse("RESPONSE", answer);
      store.submit();
    }

    session.end();

    const { state, visibleFeedbacks } = session.getSnapshot();
    expect(state.testOutcomes["TOTAL"]).toBe(3);
    expect(state.testOutcomes["GRADE"]).toBe("pass");
    expect(visibleFeedbacks.map((feedback) => feedback.identifier)).toEqual(["pass"]);
  });

  test("the same seed replays the same selection and clones", () => {
    const planOf = (seed: number) =>
      createTestController(sampleTest, { seed }).plan.parts[0]!.items.map((item) => item.key);

    expect(planOf(42)).toEqual(planOf(42));

    const cloneOf = (seed: number) => {
      const controller = createTestController(sampleTest, { seed });
      const session = createTestSessionStore(controller, {
        seed,
        resolveItem: (ref) => sampleTestItems[ref.identifier] ?? null,
      });

      return session.itemStore("addition-clone")?.getSnapshot().templateValues;
    };

    expect(cloneOf(7)).toEqual(cloneOf(7));
  });
});
