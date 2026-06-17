import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { oneRosterV1_2 } from "../specs/oneroster/v1_2";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(oneRosterV1_2, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("OneRoster 1.2 Coverage Map — OpenAPI walker, all three services", () => {
  test("walks the rostering, gradebook and resources OpenAPI components into entity doc roots", () => {
    expect(map.meta.spec).toBe("or");
    expect(map.meta.version).toBe("1.2");
    for (const entity of [
      "UserDType", // rostering
      "EnrollmentDType",
      "LineItemDType", // gradebook
      "ResultDType",
      "CategoryDType",
      "ScoreScaleDType",
      "ResourceDType", // resources
    ]) {
      expect(byKey.get(`or:1.2:doc:${entity}`)?.kind).toBe("document");
    }
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("or:1.2:")).toBe(true);
  });

  test("pins each binding against its vendored OpenAPI service document", () => {
    expect(map.meta.sources).toHaveLength(15);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("openapi");
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("conform-ed's OneRoster port reconciles all three services (no gaps or extensions)", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.extensions).toEqual([]);
    expect(map.rollup.modelledYes).toBeGreaterThan(200);
  });

  test("#/components/schemas refs resolve across services — no dangling edges", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the curated catalogue spans all four certified service modes", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(12);
    const profiles = new Set(map.conformance.map((r) => r.profile));
    expect(profiles).toEqual(new Set(["rostering", "gradebook", "resources", "assessment-results"]));
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
    // The per-entity stable-identity requirements cross-link the schema's own sourcedId/
    // status/dateLastModified MUSTs across every service, so coverage is substantial.
    expect(map.rollup.normativeStatementsCited).toBeGreaterThanOrEqual(30);
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "oneroster-v1.2.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(oneRosterV1_2, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
