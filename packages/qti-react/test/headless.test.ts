import { expect, test } from "bun:test";

import { qtiCoreInteractions } from "../src/interactions";
import { referenceInteractionKinds, reportItemCapability } from "../src/item-capability";
import { referenceSkin } from "../src/reference-skin";
import type { AssessmentItemView } from "../src/runtime";

/**
 * referenceInteractionKinds is a hand-maintained React-free constant (the headless
 * surface can't import the React skins); this pins it to the actual deliverable set —
 * interactions that have BOTH a core descriptor and a reference skin — so it can't drift.
 */
test("referenceInteractionKinds matches the reference skin + core descriptor coverage", () => {
  const descriptorKinds = new Set(qtiCoreInteractions.map((descriptor) => descriptor.kind));
  const skinKinds = new Set(Object.keys(referenceSkin));
  const deliverable = [...descriptorKinds].filter((kind) => skinKinds.has(kind)).sort();

  expect([...referenceInteractionKinds].sort()).toEqual(deliverable);
});

function itemWith(kind: string): AssessmentItemView {
  return {
    responseDeclarations: [],
    itemBody: { content: [{ kind, responseIdentifier: "RESPONSE" }] },
  };
}

test("reportItemCapability flags an interaction the target runtime does not support", () => {
  const report = reportItemCapability(itemWith("sliderInteraction"), {
    supportedInteractions: new Set(["choiceInteraction"]),
  });

  expect(report.deliverable).toBe(false);
  expect(report.issues[0]).toMatchObject({ type: "unsupported-interaction", name: "sliderInteraction" });
});

test("reportItemCapability passes a supported interaction", () => {
  const report = reportItemCapability(itemWith("choiceInteraction"), {
    supportedInteractions: new Set(referenceInteractionKinds),
  });

  expect(report.deliverable).toBe(true);
  expect(report.issues).toEqual([]);
});
