import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { qtiV2_2 } from "../specs/qti/v2_2";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(qtiV2_2, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("QTI 2.2 Coverage Map — XSD walker + element-ref resolution", () => {
  test("walks the literal ASI information model into the four assessment doc roots", () => {
    expect(map.meta.spec).toBe("qti");
    expect(map.meta.version).toBe("2.2");
    expect(map.items.length).toBeGreaterThan(4000);
    for (const root of [
      "qti:2.2:doc:assessmentItem",
      "qti:2.2:doc:assessmentTest",
      "qti:2.2:doc:assessmentSection",
      "qti:2.2:doc:assessmentStimulus",
    ]) {
      expect(byKey.get(root)?.kind).toBe("document");
    }
  });

  test("the four bindings all pin the same vendored XSD", () => {
    expect(map.meta.sources).toHaveLength(4);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("xsd");
      expect(source.id).toBe("http://www.imsglobal.org/xsd/imsqti_v2p2");
    }
  });

  test("`<xs:element ref>` children + foreign imports leave no dangling edges", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the core assessment-item model reconciles past the ref boundary (2.2 uses the DType suffix)", () => {
    expect(byKey.get("qti:2.2:def:identifier.AssessmentItem.Attr/identifier")?.modelled).toBe("yes");
    expect(byKey.get("qti:2.2:def:title.AssessmentItem.Attr/title")?.modelled).toBe("yes");
    expect(byKey.get("qti:2.2:def:AssessmentItemDType/itemBody")?.modelled).toBe("yes");
    expect(byKey.get("qti:2.2:def:AssessmentItemDType/responseDeclaration")?.modelled).toBe("yes");
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
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "qti-v2.2.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(qtiV2_2, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
