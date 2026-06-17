import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { qtiV2_2 } from "../specs/qti/v2_2";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(qtiV2_2, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("QTI 2.2 Coverage Map — XSD walker, source-scoped document family", () => {
  test("walks the ASI core (incl. stimulus) + Results / UsageData / Metadata / CP / CSM / APIP roots", () => {
    expect(map.meta.spec).toBe("qti");
    expect(map.meta.version).toBe("2.2");
    expect(map.items.length).toBeGreaterThan(4000);
    for (const root of [
      "qti:2.2:doc:assessmentItem",
      "qti:2.2:doc:assessmentTest",
      "qti:2.2:doc:assessmentSection",
      "qti:2.2:doc:assessmentStimulus",
      "qti:2.2:doc:assessmentResult",
      "qti:2.2:doc:usageData",
      "qti:2.2:doc:qtiMetadata",
      "qti:2.2:doc:manifest",
      "qti:2.2:doc:curriculumStandardsMetadataSet",
      "qti:2.2:doc:apipAccessibility",
    ]) {
      expect(byKey.get(root)?.kind).toBe("document");
    }
  });

  test("pins one vendored XSD per binding, all source-scoped", () => {
    expect(map.meta.sources).toHaveLength(10);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("xsd");
      expect(source.id).toMatch(/^http:\/\/www\.imsglobal\.org\//);
    }
  });

  test("source-scoping + element-ref resolution + foreign imports leave no dangling edges", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the core assessment-item model reconciles past the ref boundary (2.2 uses the DType suffix)", () => {
    expect(byKey.get("qti:2.2:def:imsqti_v2p2p4.identifier.AssessmentItem.Attr/identifier")?.modelled).toBe("yes");
    expect(byKey.get("qti:2.2:def:imsqti_v2p2p4.AssessmentItemDType/itemBody")?.modelled).toBe("yes");
    expect(byKey.get("qti:2.2:def:imsqti_v2p2p4.AssessmentItemDType/responseDeclaration")?.modelled).toBe("yes");
    expect(byKey.get("qti:2.2:def:imsqti_result_v2p2.AssessmentResult.Type/context")?.modelled).toBe("yes");
    expect(map.rollup.modelledYes).toBeGreaterThan(150);
  });

  test("genuine non-modelled structures surface as honest silent gaps", () => {
    expect(map.rollup.modelledNo).toBeGreaterThan(0);
    expect(map.residues.silentGaps.length).toBeGreaterThan(0);
  });

  test("only the unnamed-construct renames are absorbed; xml:base stays a genuine gap", () => {
    // As QTI 2.1: the 2.x model names no `xmlBase`, so its `/base` items are real gaps and the
    // only normalisations are the unnamed xs:any / simpleContent-text constructs (no literal side).
    expect(map.residues.silentGaps.some((k) => k.endsWith("/base"))).toBe(true);
    expect(map.residues.normalisations.every((n) => n.literalKeys.length === 0)).toBe(true);
    expect(map.residues.normalisations.some((n) => n.modelledKeys.some((k) => k.endsWith("/extensions")))).toBe(true);
    expect(map.residues.normalisations.some((n) => n.modelledKeys.some((k) => k.endsWith("/value")))).toBe(true);
    expect(map.residues.extensions.some((k) => /\/(extensions|value)$/.test(k))).toBe(false);
  });

  test("every conformance requirement cross-links to a real item key", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(3);
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
