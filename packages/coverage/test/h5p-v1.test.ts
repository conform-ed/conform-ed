import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { h5pV1 } from "../specs/h5p/v1";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(h5pV1, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("H5P v1 Coverage Map — curated package/library/semantics file formats", () => {
  test("walks the three hand-authored denominators into doc roots", () => {
    expect(map.meta.spec).toBe("h5p");
    expect(map.meta.version).toBe("1");
    for (const doc of ["h5p:1:doc:h5p-json", "h5p:1:doc:library-json", "h5p:1:doc:semantics"]) {
      expect(byKey.get(doc)?.kind).toBe("document");
    }
    expect(map.meta.sources).toHaveLength(3);
    for (const s of map.meta.sources) {
      expect(s.language).toBe("curated");
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the manifests and the semantics field model reconcile (incl. the recursive composites)", () => {
    for (const key of [
      "h5p:1:doc:h5p-json/title",
      "h5p:1:doc:h5p-json/mainLibrary",
      "h5p:1:doc:h5p-json/embedTypes",
      "h5p:1:def:VersionRef/machineName",
      "h5p:1:def:Author/name",
      "h5p:1:doc:library-json/patchVersion",
      "h5p:1:doc:library-json/runnable",
      "h5p:1:def:FilePath/path",
      "h5p:1:def:CoreApi/majorVersion",
      "h5p:1:def:SemanticsField/name",
      "h5p:1:def:SemanticsField/type",
      "h5p:1:def:SemanticsField/fields",
      "h5p:1:def:SemanticsField/columns",
      "h5p:1:def:SelectOption/value",
      "h5p:1:def:ShowWhen/rules",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
  });

  test("conform-ed reconciles all three file formats with no silent gaps and no extensions", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.extensions).toEqual([]);
    expect(map.residues.normalisations).toEqual([]);
  });

  test("the h5p.json license code list verifies as a value-set with no gaps", () => {
    expect(map.rollup.valueSetMembers).toBe(12);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets.map((v) => v.item)).toEqual(["h5p:1:doc:h5p-json/license"]);
  });

  test("every conformance requirement cross-links to a real reconciled item", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(7);
    expect(new Set(map.conformance.map((r) => r.profile))).toEqual(new Set(["package", "library", "semantics"]));
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "h5p-v1.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(h5pV1, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
