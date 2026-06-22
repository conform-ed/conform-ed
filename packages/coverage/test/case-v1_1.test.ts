import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { caseV1_1 } from "../specs/case/v1_1";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(caseV1_1, { now: "2026-01-01" });

describe("CASE 1.1 Coverage Map", () => {
  test("walks all 13 published entity schemas into a single inventory", () => {
    expect(map.meta.spec).toBe("case");
    expect(map.meta.version).toBe("1.1");
    expect(map.meta.sources).toHaveLength(13);
    expect(map.items.length).toBeGreaterThan(200);
    for (const binding of ["cfpackage", "cfdocument", "cfitem", "cfassociation", "imsx_statusinfo"]) {
      expect(map.items.some((i) => i.key === `case:1.1:doc:${binding}`)).toBe(true);
    }
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("case:1.1:")).toBe(true);
  });

  test("pins each vendored source with a sha256", () => {
    for (const source of map.meta.sources) {
      expect(source.language).toBe("json-schema");
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("conform-ed's CASE port reconciles every binding (no silent gaps or extensions)", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.extensions).toEqual([]);
    expect(map.rollup.modelledYes).toBeGreaterThan(200);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(9);
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the curated catalogue spans the core / provider / consumer profiles", () => {
    const profiles = new Set(map.conformance.map((req) => req.profile));
    expect([...profiles].sort()).toEqual(["consumer", "core", "provider"]);
  });

  test("CASE-4 cites every embedded caseVersion MUST (the spec's only machine-readable norm)", () => {
    // CASE embeds exactly the caseVersion='1.1' MUST across CFDocument variants; the
    // curated rule constrains them, so all of them flip to cited.
    expect(map.rollup.normativeStatements).toBe(3);
    expect(map.rollup.normativeStatementsCited).toBe(3);
  });

  test("every usage edge targets a walked definition", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the imsx status-info vocabularies verify as value-sets with no gaps", () => {
    // ADR-0017: CASE's only enumerated vocabularies are the imsx codes (4 + 3 + 9) = 16; the
    // content vocabularies are open ext:* extensible enums with no fixed members to verify.
    expect(map.rollup.valueSetMembers).toBe(16);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets).toHaveLength(3);
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "case-v1.1.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(caseV1_1, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
