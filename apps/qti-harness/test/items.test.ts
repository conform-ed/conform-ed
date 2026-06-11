import { describe, expect, test } from "bun:test";

import {
  createPciSkin,
  createQtiRuntime,
  executeResponseProcessing,
  portableCustomInteraction,
  qtiCoreInteractions,
  referenceSkin,
} from "@conform-ed/qti-react";

import { harnessItems } from "../src/items";
import { harnessPciRegistry } from "../src/pci-module";

// Mirrors the browser harness: core interactions plus the opt-in PCI host.
const runtime = createQtiRuntime({
  interactions: [...qtiCoreInteractions, portableCustomInteraction],
  skin: { ...referenceSkin, portableCustomInteraction: createPciSkin({ registry: harnessPciRegistry }) },
});

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
    expect(report.issues[0]?.name).toBe("customInteraction");
  });

  test("the dice-roller PCI module resolves through the harness registry", () => {
    const module = harnessPciRegistry.resolve("urn:conform-ed:pci:dice-roller");

    expect(module).toBeDefined();
    expect(harnessPciRegistry.resolve("dice-roller")).toBe(module!);
  });

  test("the math-entry item scores through plain QTI fieldValue over the PCI record", () => {
    const entry = harnessItems.find((candidate) => candidate.id === "pci-math-entry")!;
    const score = (response: Record<string, string | boolean> | null) =>
      executeResponseProcessing(entry.item.responseProcessing!, {
        responseDeclarations: entry.item.responseDeclarations,
        outcomeDeclarations: entry.item.outcomeDeclarations ?? [],
        responses: response === null ? {} : { RESPONSE: response },
      }).outcomes["SCORE"];

    expect(score({ expression: "x+x", verdict: true })).toBe(1);
    expect(score({ expression: "x+2", verdict: false })).toBe(0);
    // Redacted delivery: no verdict field — the advisory path scores 0 and the
    // platform's server-side re-score of the expression is the result of record.
    expect(score({ expression: "x+x" })).toBe(0);
    expect(score(null)).toBe(0);
  });

  test("the PCI sample is undeliverable without the opt-in host", () => {
    const core = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });
    const entry = harnessItems.find((candidate) => candidate.id === "pci-dice-roller")!;

    expect(core.canDeliver(entry.item).issues[0]).toMatchObject({
      type: "unsupported-interaction",
      name: "portableCustomInteraction",
    });
  });
});
