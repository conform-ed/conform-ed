import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeQtiName, qtiV3_0_1 } from "../specs/qti/v3_0_1";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(qtiV3_0_1, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("normalizeQtiName (XML↔JSON binding canonicalisation)", () => {
  test("drops qti- prefix + kebab→canonical, so XML and JSON names align", () => {
    expect(normalizeQtiName("qti-response-processing")).toBe(normalizeQtiName("responseProcessing"));
    expect(normalizeQtiName("response-identifier")).toBe(normalizeQtiName("responseIdentifier"));
  });
  test("collapses the singular(XML)/plural(JSON) array convention", () => {
    expect(normalizeQtiName("qti-response-declaration")).toBe(normalizeQtiName("responseDeclarations"));
  });
  test("passes the structural array marker through untouched", () => {
    expect(normalizeQtiName("[]")).toBe("[]");
  });
});

describe("QTI 3.0.1 Coverage Map — XSD walker + name-normalisation", () => {
  test("walks the full literal ASI information model", () => {
    expect(map.meta.spec).toBe("qti");
    expect(map.meta.version).toBe("3.0.1");
    expect(map.items.length).toBeGreaterThan(5000);
    for (const root of [
      "qti:3.0.1:doc:qti-assessment-item",
      "qti:3.0.1:doc:qti-assessment-test",
      "qti:3.0.1:doc:qti-assessment-section",
      "qti:3.0.1:doc:qti-assessment-stimulus",
    ]) {
      expect(byKey.get(root)?.kind).toBe("document");
    }
  });

  test("the four ASI bindings all pin the same vendored XSD", () => {
    expect(map.meta.sources).toHaveLength(4);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("xsd");
      expect(source.id).toBe("http://www.imsglobal.org/xsd/imsqtiasi_v3p0");
    }
  });

  test("foreign-namespace imports leave no dangling edges (MathML/SSML/XML/XInclude opaque)", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the core assessment-item model reconciles with conform-ed's Zod", () => {
    // name-normalisation makes the XML-binding kebab names line up with the JSON-binding Zod.
    expect(byKey.get("qti:3.0.1:def:AssessmentItemDType/identifier")?.modelled).toBe("yes");
    expect(byKey.get("qti:3.0.1:def:AssessmentItemDType/title")?.modelled).toBe("yes");
    expect(byKey.get("qti:3.0.1:def:AssessmentItemDType/qti-item-body")?.modelled).toBe("yes");
    expect(byKey.get("qti:3.0.1:def:AssessmentItemDType/qti-response-declaration")?.modelled).toBe("yes");
    expect(map.rollup.modelledYes).toBeGreaterThan(150);
  });

  test("genuine non-modelled structures surface as honest silent gaps (e.g. ARIA attributes)", () => {
    expect(map.rollup.modelledNo).toBeGreaterThan(0);
    expect(map.residues.silentGaps.some((k) => k.includes("/aria-"))).toBe(true);
  });

  test("xml:base is a named rename here (flipped to modelled), unlike QTI 2.x", () => {
    // The flattened 3.0.1 ASI models xml:base as xmlBase, so its single `/base` item is a
    // rename absorbed into normalisations (literal side flipped to yes), not a silent gap.
    const xmlBase = map.residues.normalisations.find((n) => n.literalKeys.length > 0);
    expect(xmlBase?.literalKeys).toEqual(["qti:3.0.1:def:BaseSequenceXBaseDType/base"]);
    expect(byKey.get("qti:3.0.1:def:BaseSequenceXBaseDType/base")?.modelled).toBe("yes");
    expect(xmlBase?.modelledKeys.every((k) => k.endsWith("/xmlBase"))).toBe(true);
    expect(map.residues.silentGaps.some((k) => k.endsWith("/base"))).toBe(false);
    expect(map.residues.extensions.some((k) => /\/(xmlBase|extensions|value)$/.test(k))).toBe(false);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(10);
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the QTI controlled vocabularies verify as value-sets with no gaps", () => {
    // ADR-0017: the closed ASI attribute vocabularies (base-type, cardinality, navigation/
    // submission mode, show-hide, shape, external-scored, suppress-tts, dir) the structural join
    // cannot check — each safeParse'd against conform-ed's z.enum. 11+4+2+2+2+5+2+3+3 = 34.
    expect(map.rollup.valueSetMembers).toBe(34);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets).toHaveLength(9);
    expect(map.valueSets.find((v) => v.item.endsWith("/base-type"))?.modelled).toBe(11);
    expect(map.valueSets.find((v) => v.item.endsWith("/cardinality"))?.modelled).toBe(4);
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "qti-v3.0.1.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(qtiV3_0_1, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
