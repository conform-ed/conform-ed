import { describe, expect, test } from "bun:test";

import {
  createPciSkin,
  createQtiRuntime,
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
    expect(report.issues[0]?.name).toBe("drawingInteraction");
  });

  test("the dice-roller PCI module resolves through the harness registry", () => {
    const module = harnessPciRegistry.resolve("urn:conform-ed:pci:dice-roller");

    expect(module).toBeDefined();
    expect(harnessPciRegistry.resolve("dice-roller")).toBe(module!);
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
