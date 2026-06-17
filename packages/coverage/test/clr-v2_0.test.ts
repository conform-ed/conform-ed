import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { clrV2_0 } from "../specs/clr/v2_0";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(clrV2_0, { now: "2026-01-01" });

describe("Comprehensive Learner Record 2.0 Coverage Map", () => {
  test("walks a non-trivial literal inventory across all six bindings", () => {
    expect(map.items.length).toBeGreaterThan(300);
    expect(map.meta.spec).toBe("clr");
    expect(map.meta.version).toBe("2.0");
    expect(map.meta.sources).toHaveLength(6);
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("clr:2.0:")).toBe(true);
  });

  test("pins each vendored source with a sha256", () => {
    for (const source of map.meta.sources) {
      expect(source.language).toBe("json-schema");
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("conform-ed's CLR port has no silent gaps or extensions", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.extensions).toEqual([]);
  });

  test("captures normative items and the conformance seed", () => {
    expect(map.rollup.normativeItems).toBeGreaterThan(0);
    expect(map.rollup.conformanceRequirements).toBe(4);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("every usage edge targets a walked definition", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "clr-v2.0.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(clrV2_0, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
