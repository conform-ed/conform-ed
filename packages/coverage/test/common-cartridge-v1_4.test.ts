import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { commonCartridgeV1_4 } from "../specs/common-cartridge/v1_4";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(commonCartridgeV1_4, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("Common Cartridge 1.4 Coverage Map — XSD walker (6 source-scoped bindings)", () => {
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
        "cc:1.4:doc:assignment",
      ]),
    );
    expect(map.items.some((i) => i.key === "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Manifest.Type")).toBe(true);
  });

  test("source-scoping keeps the assignment extension's Text.Type distinct from Discussion Topic's", () => {
    expect(byKey.get("cc:1.4:def:cc_extresource_assignmentv1p0_v1p0.Text.Type")?.kind).toBe("definition");
    expect(byKey.get("cc:1.4:def:ccv1p4_imsdt_v1p4.Text.Type")?.kind).toBe("definition");
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("cc:1.4:")).toBe(true);
  });

  test("pins each vendored XSD by targetNamespace + sha256", () => {
    expect(map.meta.sources).toHaveLength(6);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("xsd");
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the named information model reconciles with conform-ed's Zod", () => {
    expect(map.rollup.modelledYes).toBe(81);
    expect(byKey.get("cc:1.4:def:ccv1p4_imswl_v1p4.WebLink.Type/url")?.modelled).toBe("yes");
    expect(byKey.get("cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Manifest.Type/resources")?.modelled).toBe("yes");
    expect(byKey.get("cc:1.4:def:cc_extresource_assignmentv1p0_v1p0.Assignment.Type/text")?.modelled).toBe("yes");
  });

  test("the only silent gaps are the foreign xml:base attribute (modelled by conform-ed as xmlBase)", () => {
    expect(map.residues.silentGaps).toEqual([
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Manifest.Type/base",
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Resource.Type/base",
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Resources.Type/base",
    ]);
    expect(map.residues.extensions.some((k) => k.endsWith("/xmlBase"))).toBe(true);
  });

  test("no dangling edges (foreign-namespace imports stay opaque)", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(5);
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
