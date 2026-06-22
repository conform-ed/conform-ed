import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { caliperV1_2 } from "../specs/caliper/v1_2";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(caliperV1_2, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("Caliper 1.2 Coverage Map — bundled-bootcamp JSON-Schema walker", () => {
  test("bundles the bootcamp files into entity doc roots + definitions", () => {
    expect(map.meta.spec).toBe("caliper");
    expect(map.meta.version).toBe("1.2");
    // The bundle walks all 110 types, far more than the 8 entry-point bindings.
    expect(map.items.length).toBeGreaterThan(1000);
    for (const root of [
      "caliper:1.2:doc:Envelope",
      "caliper:1.2:doc:Event",
      "caliper:1.2:doc:AssessmentEvent",
      "caliper:1.2:doc:Entity",
      "caliper:1.2:doc:Person",
    ]) {
      expect(byKey.get(root)?.kind).toBe("document");
    }
  });

  test("records the weaker bootcamp-repo provenance in meta.sources", () => {
    expect(map.meta.sources).toHaveLength(8);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("caliper");
      expect(source.id).toContain("CaliperBootcamp");
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the bootcamp `File`/`File#/key` refs are rewritten so no edge dangles", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the Envelope transport and the Event core reconcile with conform-ed's Zod", () => {
    for (const m of ["sensor", "dataVersion", "sendTime", "data"]) {
      expect(byKey.get(`caliper:1.2:def:Envelope/${m}`)?.modelled).toBe("yes");
    }
    for (const m of ["actor", "action", "object", "eventTime"]) {
      expect(byKey.get(`caliper:1.2:def:Event/${m}`)?.modelled).toBe("yes");
    }
    expect(map.rollup.modelledYes).toBeGreaterThan(50);
  });

  test("conform-ed's focused Caliper surface leaves honest silent gaps across the entity zoo", () => {
    expect(map.rollup.modelledNo).toBeGreaterThan(0);
    expect(map.residues.silentGaps.length).toBeGreaterThan(0);
  });

  test("extracts the rich embedded normative surface (the JSON-family schemas carry MUST prose)", () => {
    // Caliper's schemas embed ~99 MUST statements; all materialise as regenerated entries.
    expect(map.rollup.normativeStatements).toBeGreaterThan(50);
    expect(map.normativeStatements.length).toBe(map.rollup.normativeStatements);
    for (const s of map.normativeStatements) expect(s.statement.length).toBeGreaterThan(0);
    // The embedded MUSTs are all the same `id` rule, carried on every type's id field; CAL-ID-1
    // constrains all of them, so the whole extracted surface is cited (99/99).
    expect(map.rollup.normativeStatementsCited).toBe(map.rollup.normativeStatements);
    expect(map.normativeStatements.find((s) => s.item === "caliper:1.2:def:Event/id")?.cited).toBe(true);
    expect(map.normativeStatements.every((s) => s.cited)).toBe(true);
  });

  test("the four Caliper controlled vocabularies verify as value-sets with no gaps", () => {
    // ADR-0017: the action/profile/metric/status term lists the structural join cannot check —
    // every published member safeParse'd against conform-ed's z.enum. 80 + 15 + 8 + 2 = 105.
    expect(map.rollup.valueSetMembers).toBe(105);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets.map((v) => v.item)).toEqual([
      "caliper:1.2:def:Action",
      "caliper:1.2:def:Metric",
      "caliper:1.2:def:Profile",
      "caliper:1.2:def:Status",
    ]);
    expect(map.valueSets.find((v) => v.item === "caliper:1.2:def:Action")?.modelled).toBe(80);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(7);
    expect(map.conformance.filter((r) => r.profile === "vocabulary")).toHaveLength(2);
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "caliper-v1.2.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(caliperV1_2, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
