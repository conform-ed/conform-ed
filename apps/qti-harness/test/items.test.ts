import { describe, expect, test } from "bun:test";

import { createQtiRuntime, qtiCoreInteractions, referenceSkin } from "@conform-ed/qti-react";

import { harnessItems } from "../src/items";

const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });

describe("harness sample items", () => {
  test("every supported sample is deliverable", () => {
    for (const entry of harnessItems.filter((candidate) => candidate.id !== "unsupported")) {
      const report = runtime.canDeliver(entry.item);

      expect(report.deliverable).toBe(true);
      expect(report.issues).toEqual([]);
    }
  });

  test("the unsupported sample demonstrates the capability gate", () => {
    const entry = harnessItems.find((candidate) => candidate.id === "unsupported");
    const report = runtime.canDeliver(entry!.item);

    expect(report.deliverable).toBe(false);
    expect(report.issues[0]?.type).toBe("unsupported-interaction");
    expect(report.issues[0]?.name).toBe("drawingInteraction");
  });
});
