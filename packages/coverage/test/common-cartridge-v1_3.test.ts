import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { commonCartridgeV1_3 } from "../specs/common-cartridge/v1_3";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(commonCartridgeV1_3, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("Common Cartridge 1.3 Coverage Map — XSD walker (5 resource-type bindings)", () => {
  test("walks each resource-type XSD into a doc root + named-type definitions", () => {
    expect(map.meta.spec).toBe("cc");
    expect(map.meta.version).toBe("1.3");
    const docRoots = map.items.filter((i) => i.kind === "document").map((i) => i.key);
    expect(docRoots).toEqual(
      expect.arrayContaining([
        "cc:1.3:doc:webLink",
        "cc:1.3:doc:topic",
        "cc:1.3:doc:curriculumStandardsMetadataSet",
        "cc:1.3:doc:manifest",
        "cc:1.3:doc:authorizations",
      ]),
    );
    expect(map.items.some((i) => i.key === "cc:1.3:def:WebLink.Type" && i.kind === "definition")).toBe(true);
    expect(map.items.some((i) => i.key === "cc:1.3:def:URL.Type")).toBe(true);
    expect(map.items.some((i) => i.key === "cc:1.3:def:Manifest.Type" && i.kind === "definition")).toBe(true);
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("cc:1.3:")).toBe(true);
  });

  test("pins each vendored XSD by targetNamespace + sha256", () => {
    expect(map.meta.sources).toHaveLength(5);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("xsd");
      expect(source.id).toMatch(/^http:\/\/www\.imsglobal\.org\/xsd\/imsccv1p3\//);
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the named information model reconciles with conform-ed's Zod", () => {
    expect(map.rollup.modelledYes).toBe(65);
    // The manifest's core structure reconciles past the content-packaging boundary.
    expect(byKey.get("cc:1.3:def:Manifest.Type/organizations")?.modelled).toBe("yes");
    expect(byKey.get("cc:1.3:def:Manifest.Type/resources")?.modelled).toBe("yes");
    expect(byKey.get("cc:1.3:def:Authorizations.Type/authorization")?.modelled).toBe("yes");
  });

  test("the only silent gaps are the foreign xml:base attribute (modelled by conform-ed as xmlBase)", () => {
    // `base` is the imported `xml:base` attribute; conform-ed names it `xmlBase`, so it
    // surfaces split across a gap (`/base`) and an extension (`/xmlBase`) — a documented
    // normalisation, not an unmodelled feature.
    expect(map.residues.silentGaps).toEqual([
      "cc:1.3:def:Manifest.Type/base",
      "cc:1.3:def:Resource.Type/base",
      "cc:1.3:def:Resources.Type/base",
    ]);
    expect(map.residues.extensions.some((k) => k.endsWith("/xmlBase"))).toBe(true);
  });

  test("XSD open-content points (xs:any / simpleContent text) surface as documented residues", () => {
    // conform-ed names the open extension point `extensions` and the simpleContent text
    // body `value`; the literal XSD leaves both nameless — documented normalisations.
    expect(map.residues.extensions).toContain("cc:1.3:doc:webLink/extensions");
    expect(map.residues.extensions).toContain("cc:1.3:doc:topic/text/value");
    // The manifest's `metadata` is an imported LOM tree (opaque at the import boundary),
    // so conform-ed's rich LOM model surfaces as extensions until the LOM bindings land.
    expect(map.residues.extensions.some((k) => k.startsWith("cc:1.3:def:manifest.") && k.endsWith("/general"))).toBe(
      true,
    );
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
    expect(map.rollup.conformanceRequirements).toBe(6);
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
