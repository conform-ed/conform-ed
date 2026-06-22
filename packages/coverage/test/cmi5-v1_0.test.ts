import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cmi5V1_0 } from "../specs/cmi5/v1_0";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(cmi5V1_0, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("cmi5 1.0 (Quartz) Coverage Map — course-structure XSD", () => {
  test("walks the CourseStructure.xsd into the course-structure entity tree", () => {
    expect(map.meta.spec).toBe("cmi5");
    expect(map.meta.version).toBe("1.0");
    expect(byKey.get("cmi5:1.0:doc:courseStructure")?.kind).toBe("document");
    expect(map.meta.sources).toHaveLength(1);
    expect(map.meta.sources[0]?.language).toBe("xsd");
    expect(map.meta.sources[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the structural aliases bridge au/block→children and langstring→langstrings", () => {
    // The au/block choice that conform-ed regroups into a `children` union array — both
    // branches reconcile yes through the alias (at the course level and nested in blocks).
    for (const key of [
      "cmi5:1.0:def:courseType/au",
      "cmi5:1.0:def:courseType/block",
      "cmi5:1.0:def:blockType/au",
      "cmi5:1.0:def:blockType/block",
      "cmi5:1.0:def:textType/langstring",
      "cmi5:1.0:def:textType/langstring/[]/lang",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
  });

  test("conform-ed reconciles the course-structure schema with no silent gaps", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    // The single extension is the AU keyword-reference array — conform-ed models the cmi5
    // keyword extension the core CourseStructure.xsd does not define (honest, not a gap).
    expect(map.residues.extensions).toEqual(["cmi5:1.0:def:courseStructure.__schema4/keywords"]);
    // The <langstring> simpleContent text → conform-ed `value` is a documented normalisation.
    expect(map.residues.normalisations).toHaveLength(1);
  });

  test("the moveOn and launchMethod enum attributes verify as value-sets with no gaps", () => {
    expect(map.rollup.valueSetMembers).toBe(7);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets.map((v) => v.item)).toEqual([
      "cmi5:1.0:def:auType/launchMethod",
      "cmi5:1.0:def:auType/moveOn",
    ]);
  });

  test("every conformance requirement cross-links to a real reconciled item", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(6);
    for (const req of map.conformance) {
      expect(req.profile).toBe("course-structure");
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "cmi5-v1.0.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(cmi5V1_0, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
