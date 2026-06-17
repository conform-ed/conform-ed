import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { openBadgesV3_0 } from "../specs/open-badges/v3_0";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(openBadgesV3_0, { now: "2026-01-01" });

describe("Open Badges 3.0 Coverage Map", () => {
  test("walks a non-trivial literal inventory", () => {
    expect(map.items.length).toBeGreaterThan(300);
    expect(map.meta.spec).toBe("ob");
    expect(map.meta.version).toBe("3.0");
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("ob:3.0:")).toBe(true);
  });

  test("pins each vendored source with a sha256", () => {
    expect(map.meta.sources).toHaveLength(5);
    for (const source of map.meta.sources) expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("conform-ed's validated OB port has no silent gaps or extensions", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.extensions).toEqual([]);
  });

  test("captures normative items and the curated catalogue across the three cert profiles", () => {
    expect(map.rollup.normativeItems).toBeGreaterThan(0);
    expect(map.rollup.conformanceRequirements).toBe(16);
    // The catalogue is curated from the OB 3.0 cert guide's three product roles.
    const profiles = new Set(map.conformance.map((c) => c.profile));
    expect(profiles).toEqual(new Set(["issuer", "displayer", "host"]));
  });

  test("extracts the schema's embedded normative statements + tracks curated coverage", () => {
    // Every normative L1 item is materialised as a regenerated statement.
    expect(map.normativeStatements.length).toBe(map.rollup.normativeItems);
    expect(map.rollup.normativeStatements).toBe(map.normativeStatements.length);
    for (const s of map.normativeStatements) expect(s.level === "MUST" || s.level === "MUST NOT").toBe(true);
    // The curated catalogue cross-links the schema's own MUSTs where requirements coincide
    // (type sets, proofPurpose, AchievementSubject.id, CredentialStatus.id, the JWS list, …),
    // so coverage of the extracted surface is materially above the demonstrative seed.
    expect(map.rollup.normativeStatementsCited).toBeGreaterThanOrEqual(9);
    const cited = map.normativeStatements.find((s) => s.item === "ob:3.0:def:Achievement/type/[]");
    expect(cited?.cited).toBe(true);
    // A displayer requirement cites the credential-status MUST.
    const status = map.normativeStatements.find((s) => s.item === "ob:3.0:def:CredentialStatus/id");
    expect(status?.cited).toBe(true);
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

  test("generation is deterministic", () => {
    const again = buildCoverageMap(openBadgesV3_0, { now: "2026-01-01" });
    expect(JSON.stringify(again)).toBe(JSON.stringify(map));
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "open-badges-v3.0.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(openBadgesV3_0, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
