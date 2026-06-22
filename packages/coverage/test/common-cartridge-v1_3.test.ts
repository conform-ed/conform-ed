import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { commonCartridgeV1_3 } from "../specs/common-cartridge/v1_3";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(commonCartridgeV1_3, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("Common Cartridge 1.3 Coverage Map — XSD walker (8 source-scoped bindings)", () => {
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
        "cc:1.3:doc:ltiLink",
        "cc:1.3:doc:lomResource",
        "cc:1.3:doc:lomManifest",
      ]),
    );
    expect(
      map.items.some((i) => i.key === "cc:1.3:def:ccv1p3_imswl_v1p3.WebLink.Type" && i.kind === "definition"),
    ).toBe(true);
    expect(map.items.some((i) => i.key === "cc:1.3:def:ccv1p3_imswl_v1p3.URL.Type")).toBe(true);
  });

  test("source-scoping keeps the three LOM profiles' `LOM.Type` definitions distinct", () => {
    // The three LOM-rooted bindings all share `<xs:element name="lom" type="LOM.Type">`
    // in separate files; without per-source def keys they would collide.
    for (const file of ["ccv1p3_lomccltilink_v1p0", "ccv1p3_lomresource_v1p0", "ccv1p3_lommanifest_v1p0"]) {
      expect(byKey.get(`cc:1.3:def:${file}.LOM.Type`)?.kind).toBe("definition");
    }
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("cc:1.3:")).toBe(true);
  });

  test("pins each vendored XSD by targetNamespace + sha256", () => {
    expect(map.meta.sources).toHaveLength(8);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("xsd");
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the named information model reconciles with conform-ed's Zod", () => {
    expect(map.rollup.modelledYes).toBe(413);
    expect(byKey.get("cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Manifest.Type/organizations")?.modelled).toBe("yes");
    expect(byKey.get("cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Manifest.Type/resources")?.modelled).toBe("yes");
    expect(byKey.get("cc:1.3:def:ccv1p3_imsccauth_v1p3.Authorizations.Type/authorization")?.modelled).toBe("yes");
    // The LtiLink LOM tree reconciles past the lom root.
    expect(byKey.get("cc:1.3:def:ccv1p3_lomccltilink_v1p0.LOM.Type/general")?.modelled).toBe("yes");
  });

  test("documented XSD→Zod renames are absorbed into residues.normalisations, not left as false signal", () => {
    // The structural name-join can't pair these; the `specRefOverrides` record them instead,
    // so the residue lists keep only genuine signal.
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.extensions.some((k) => /\/(xmlBase|extensions|value)$/.test(k))).toBe(false);

    // xml:base → xmlBase is a *named* rename: the literal `/base` items ARE modelled (flipped
    // to yes), not gaps — conform-ed names xmlBase here (unlike QTI 2.x).
    const xmlBase = map.residues.normalisations.find((n) => n.literalKeys.length > 0);
    expect(xmlBase?.literalKeys).toEqual([
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Manifest.Type/base",
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Resource.Type/base",
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Resources.Type/base",
    ]);
    for (const key of xmlBase?.literalKeys ?? []) expect(byKey.get(key)?.modelled).toBe("yes");
    expect(xmlBase?.modelledKeys.every((k) => k.endsWith("/xmlBase"))).toBe(true);

    // xs:any → extensions and simpleContent text → value are unnamed constructs: no literal side.
    const ext = map.residues.normalisations.find((n) => n.modelledKeys.some((k) => k.endsWith("/extensions")));
    expect(ext?.modelledKeys).toContain("cc:1.3:doc:webLink/extensions");
    expect(ext?.literalKeys).toEqual([]);
    const value = map.residues.normalisations.find((n) => n.modelledKeys.some((k) => k.endsWith("/value")));
    expect(value?.modelledKeys).toContain("cc:1.3:doc:topic/text/value");
    expect(value?.literalKeys).toEqual([]);

    // The rollup tallies the total absorbed keys (gaps + extensions).
    const absorbed = map.residues.normalisations.reduce((s, n) => s + n.modelledKeys.length + n.literalKeys.length, 0);
    expect(map.rollup.normalisations).toBe(absorbed);
    expect(absorbed).toBeGreaterThan(0);
  });

  test("attributes are modelled as properties with use=required honoured", () => {
    const href = map.items.find((i) => i.key === "cc:1.3:def:ccv1p3_imswl_v1p3.URL.Type/href");
    expect(href?.required).toBe(true);
    expect(href?.modelled).toBe("yes");
    expect(map.items.find((i) => i.key === "cc:1.3:def:ccv1p3_imswl_v1p3.URL.Type/target")?.required).toBeUndefined();
  });

  test("type references are recorded as usage edges that target walked definitions", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.edges).toContainEqual({
      from: "cc:1.3:doc:webLink",
      to: "cc:1.3:def:ccv1p3_imswl_v1p3.WebLink.Type",
    });
    expect(map.edges).toContainEqual({
      from: "cc:1.3:def:ccv1p3_imswl_v1p3.WebLink.Type/url",
      to: "cc:1.3:def:ccv1p3_imswl_v1p3.URL.Type",
    });
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(12);
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the CC XSDs embed no RFC-2119 prose — its norms are curated from the guides, not extracted", () => {
    // Unlike the JSON-family schemas, the CC bindings carry no MUST-level documentation,
    // so the extracted layer is empty and the C axis is curated-only.
    expect(map.normativeStatements).toEqual([]);
    expect(map.rollup.normativeStatements).toBe(0);
    expect(map.rollup.conformanceRequirements).toBeGreaterThan(0);
  });

  test("generation is deterministic", () => {
    const again = buildCoverageMap(commonCartridgeV1_3, { now: "2026-01-01" });
    expect(JSON.stringify(again)).toBe(JSON.stringify(map));
  });

  test("the closed CC manifest vocabularies verify as value-sets with no gaps", () => {
    // ADR-0017: resource type (11), intended use (4), authorization access (2) = 17. The LOM
    // metadata vocabularies are built via the LOM vocabulary() helper, not named exported enums.
    expect(map.rollup.valueSetMembers).toBe(17);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets).toHaveLength(3);
    expect(map.valueSets.find((v) => v.item.endsWith("/type"))?.modelled).toBe(11);
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "common-cartridge-v1.3.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(commonCartridgeV1_3, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
