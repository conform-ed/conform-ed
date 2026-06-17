import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { qtiV2_1 } from "../specs/qti/v2_1";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(qtiV2_1, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("QTI 2.1 Coverage Map — XSD walker + element-ref resolution", () => {
  test("walks the literal ASI information model into the three assessment doc roots", () => {
    expect(map.meta.spec).toBe("qti");
    expect(map.meta.version).toBe("2.1");
    expect(map.items.length).toBeGreaterThan(4000);
    for (const root of ["qti:2.1:doc:assessmentItem", "qti:2.1:doc:assessmentTest", "qti:2.1:doc:assessmentSection"]) {
      expect(byKey.get(root)?.kind).toBe("document");
    }
  });

  test("the three bindings all pin the same vendored XSD", () => {
    expect(map.meta.sources).toHaveLength(3);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("xsd");
      expect(source.id).toBe("http://www.imsglobal.org/xsd/imsqti_v2p1");
    }
  });

  test("`<xs:element ref>` children resolve to their global element's type — no dangling edges", () => {
    // QTI 2.x declares every child as a ref to a global element (modular style); the
    // walker resolves the ref to that element's named type so the descent continues.
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the core assessment-item model reconciles with conform-ed's Zod past the ref boundary", () => {
    expect(byKey.get("qti:2.1:def:identifier.AssessmentItem.Attr/identifier")?.modelled).toBe("yes");
    expect(byKey.get("qti:2.1:def:title.AssessmentItem.Attr/title")?.modelled).toBe("yes");
    expect(byKey.get("qti:2.1:def:AssessmentItem.Type/itemBody")?.modelled).toBe("yes");
    // Reached only because the ref to the global `responseDeclaration` resolves to
    // `ResponseDeclaration.Type` — the previously-broken descent.
    expect(byKey.get("qti:2.1:def:AssessmentItem.Type/responseDeclaration")?.modelled).toBe("yes");
    expect(map.rollup.modelledYes).toBeGreaterThan(100);
  });

  test("genuine non-modelled structures surface as honest silent gaps", () => {
    expect(map.rollup.modelledNo).toBeGreaterThan(0);
    expect(map.residues.silentGaps.length).toBeGreaterThan(0);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(2);
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "qti-v2.1.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(qtiV2_1, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
