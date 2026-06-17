import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { commonCartridgeV1_4 } from "../specs/common-cartridge/v1_4";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(commonCartridgeV1_4, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("Common Cartridge 1.4 Coverage Map — XSD walker (5 resource-type bindings)", () => {
  test("walks each resource-type XSD into a doc root + named-type definitions", () => {
    expect(map.meta.spec).toBe("cc");
    expect(map.meta.version).toBe("1.4");
    const docRoots = map.items.filter((i) => i.kind === "document").map((i) => i.key);
    expect(docRoots).toEqual(
      expect.arrayContaining([
        "cc:1.4:doc:manifest",
        "cc:1.4:doc:webLink",
        "cc:1.4:doc:topic",
        "cc:1.4:doc:authorizations",
        "cc:1.4:doc:curriculumStandardsMetadataSet",
      ]),
    );
    expect(map.items.some((i) => i.key === "cc:1.4:def:Manifest.Type" && i.kind === "definition")).toBe(true);
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("cc:1.4:")).toBe(true);
  });

  test("pins each vendored XSD by targetNamespace + sha256", () => {
    expect(map.meta.sources).toHaveLength(5);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("xsd");
      expect(source.id).toMatch(/^http:\/\/www\.imsglobal\.org\/xsd\/imsccv1p4\//);
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the named information model reconciles with conform-ed's Zod", () => {
    expect(map.rollup.modelledYes).toBe(66);
    expect(byKey.get("cc:1.4:def:WebLink.Type/url")?.modelled).toBe("yes");
    expect(byKey.get("cc:1.4:def:Manifest.Type/resources")?.modelled).toBe("yes");
    expect(byKey.get("cc:1.4:def:Topic.Type/text")?.modelled).toBe("yes");
  });

  test("the only silent gaps are the foreign xml:base attribute (modelled by conform-ed as xmlBase)", () => {
    expect(map.residues.silentGaps).toEqual([
      "cc:1.4:def:Manifest.Type/base",
      "cc:1.4:def:Resource.Type/base",
      "cc:1.4:def:Resources.Type/base",
    ]);
    expect(map.residues.extensions.some((k) => k.endsWith("/xmlBase"))).toBe(true);
  });

  test("no dangling edges (foreign-namespace imports stay opaque)", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(4);
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "common-cartridge-v1.4.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(commonCartridgeV1_4, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
