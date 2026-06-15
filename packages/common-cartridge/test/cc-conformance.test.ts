/**
 * CC conformance lane (ADR-0022). Gates the decompose + QTI-bridge pipeline against real,
 * MIT-licensed Common Cartridge exports vendored from instructure/common-cartridge-viewer
 * (see fixtures/README.md). Deterministic + offline — no nightly download needed.
 */

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { convertCcQtiV1ToV3, validateQtiXmlContent } from "@conform-ed/qti-xml";

import { decomposeCommonCartridge } from "../src";

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
}

test("all-question-types.imscc: decompose → bridge → every QTI item re-validates as QTI 3", async () => {
  const decomposed = decomposeCommonCartridge(fixture("all-question-types.imscc"));

  expect(decomposed.version).toBe("1.3");

  const qtiResources = decomposed.resources.filter(
    (resource) => resource.kind === "qti-assessment" || resource.kind === "qti-question-bank",
  );
  expect(qtiResources.length).toBeGreaterThan(0);

  const profiles = new Set<string>();
  let totalItems = 0;

  for (const resource of qtiResources) {
    const path = resource.href ?? resource.files[0];
    const xml = path ? decomposed.readText(path) : undefined;
    expect(xml).toBeDefined();

    const converted = convertCcQtiV1ToV3(xml!);
    expect(converted.status).toBe("converted");
    if (converted.status !== "converted") continue;

    for (const item of converted.items) {
      const validated = await validateQtiXmlContent(item.xml);
      expect(validated.status).toBe("valid");
      if (item.ccProfile) profiles.add(item.ccProfile);
      totalItems += 1;
    }
    if (converted.test) {
      const validatedTest = await validateQtiXmlContent(converted.test.xml);
      expect(validatedTest.status).toBe("valid");
    }
  }

  expect(totalItems).toBeGreaterThanOrEqual(4);
  // The corpus exercises these four CC profiles (fib/pattern_match are hand-authored elsewhere).
  expect(profiles).toContain("cc.multiple_choice.v0p1");
  expect(profiles).toContain("cc.true_false.v0p1");
  expect(profiles).toContain("cc.multiple_response.v0p1");
  expect(profiles).toContain("cc.essay.v0p1");
});

test("single-page.imscc: decompose recovers version, org tree, and webcontent classification", () => {
  const decomposed = decomposeCommonCartridge(fixture("single-page.imscc"));

  expect(decomposed.version).toBe("1.3");
  expect(decomposed.organizations.length).toBeGreaterThan(0);
  expect(decomposed.resources.some((resource) => resource.kind === "web-content")).toBe(true);
  // Every resource gets a classification (nothing silently unhandled).
  for (const resource of decomposed.resources) {
    expect(resource.kind).toBeDefined();
  }
});
