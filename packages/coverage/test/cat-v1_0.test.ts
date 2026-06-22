import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { catV1_0 } from "../specs/cat/v1_0";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(catV1_0, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("CAT 1.0 Coverage Map — curated adaptive-testing service model", () => {
  test("walks the five curated entity denominators into doc roots", () => {
    expect(map.meta.spec).toBe("cat");
    expect(map.meta.version).toBe("1.0");
    for (const doc of [
      "cat:1.0:doc:SectionData",
      "cat:1.0:doc:ItemStage",
      "cat:1.0:doc:AssessmentResult",
      "cat:1.0:doc:CatEngineResultReport",
      "cat:1.0:doc:SessionInfo",
    ]) {
      expect(byKey.get(doc)?.kind).toBe("document");
    }
    expect(map.meta.sources).toHaveLength(5);
    for (const s of map.meta.sources) {
      expect(s.language).toBe("curated");
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the data model reconciles, incl. the shared sub-objects and the nextStage recursion", () => {
    for (const key of [
      "cat:1.0:doc:SectionData/itemPool",
      "cat:1.0:def:ItemPool/itemRefs",
      "cat:1.0:def:ItemRef/href",
      "cat:1.0:def:CatConstraint/type",
      "cat:1.0:doc:ItemStage/items",
      "cat:1.0:doc:AssessmentResult/itemsAttempted",
      "cat:1.0:def:ItemAttempt/attemptNumber",
      "cat:1.0:def:ResponseVariable/cardinality",
      "cat:1.0:def:OutcomeVariable/baseType",
      "cat:1.0:doc:CatEngineResultReport/recommendation",
      "cat:1.0:doc:CatEngineResultReport/nextStage",
      "cat:1.0:def:ItemStage/stageId",
      "cat:1.0:doc:SessionInfo/status",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
  });

  test("conform-ed reconciles all five entities with no silent gaps and no extensions", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.extensions).toEqual([]);
    expect(map.residues.normalisations).toEqual([]);
  });

  test("the three CAT controlled vocabularies verify as value-sets with no gaps", () => {
    // ADR-0017: outcome-variable type (11), cardinality (4), assessment-result status (6) = 21.
    expect(map.rollup.valueSetMembers).toBe(21);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets.map((v) => v.item)).toEqual([
      "cat:1.0:def:OutcomeVariable/baseType",
      "cat:1.0:def:OutcomeVariable/cardinality",
      "cat:1.0:doc:SessionInfo/status",
    ]);
    expect(map.valueSets.find((v) => v.item.endsWith("/baseType"))?.modelled).toBe(11);
  });

  test("the catalogue covers the data model surfaces plus the six REST operations", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(8);
    expect(new Set(map.conformance.map((r) => r.profile))).toEqual(new Set(["section", "delivery", "operations"]));
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "cat-v1.0.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(catV1_0, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
