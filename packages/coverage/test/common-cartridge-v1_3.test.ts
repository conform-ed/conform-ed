import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { commonCartridgeV1_3 } from "../specs/common-cartridge/v1_3";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(commonCartridgeV1_3, { now: "2026-01-01" });

describe("Common Cartridge 1.3 (Web Link) Coverage Map — XSD walker pilot", () => {
  test("walks the literal XSD into a doc root + named-type definitions", () => {
    expect(map.meta.spec).toBe("cc");
    expect(map.meta.version).toBe("1.3");
    expect(map.items.some((i) => i.key === "cc:1.3:doc:webLink" && i.kind === "document")).toBe(true);
    expect(map.items.some((i) => i.key === "cc:1.3:def:WebLink.Type" && i.kind === "definition")).toBe(true);
    expect(map.items.some((i) => i.key === "cc:1.3:def:URL.Type")).toBe(true);
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("cc:1.3:")).toBe(true);
  });

  test("pins the vendored XSD by targetNamespace + sha256", () => {
    expect(map.meta.sources).toHaveLength(1);
    const [source] = map.meta.sources;
    expect(source?.language).toBe("xsd");
    expect(source?.id).toBe("http://www.imsglobal.org/xsd/imsccv1p3/imswl_v1p3");
    expect(source?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the named information model reconciles with conform-ed's Zod (no silent gaps)", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.rollup.modelledYes).toBe(5); // title, url, href, target, windowFeatures
  });

  test("the XSD xs:any wildcard surfaces as a single named `extensions` residue", () => {
    // conform-ed models the open extension point as a named field; the literal
    // schema has only a nameless xs:any — a documented normalisation, not a gap.
    expect(map.residues.extensions).toEqual(["cc:1.3:doc:webLink/extensions"]);
  });

  test("attributes are modelled as properties with use=required honoured", () => {
    const href = map.items.find((i) => i.key === "cc:1.3:def:URL.Type/href");
    expect(href?.required).toBe(true);
    expect(href?.modelled).toBe("yes");
    expect(map.items.find((i) => i.key === "cc:1.3:def:URL.Type/target")?.required).toBeUndefined();
  });

  test("type references are recorded as usage edges that target walked definitions", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.edges).toContainEqual({ from: "cc:1.3:doc:webLink", to: "cc:1.3:def:WebLink.Type" });
    expect(map.edges).toContainEqual({ from: "cc:1.3:def:WebLink.Type/url", to: "cc:1.3:def:URL.Type" });
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(2);
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("generation is deterministic", () => {
    const again = buildCoverageMap(commonCartridgeV1_3, { now: "2026-01-01" });
    expect(JSON.stringify(again)).toBe(JSON.stringify(map));
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "common-cartridge-v1.3.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(commonCartridgeV1_3, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
