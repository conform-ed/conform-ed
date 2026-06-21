import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ltiV1_3 } from "../specs/lti/v1_3";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(ltiV1_3, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("LTI 1.3 + Advantage Coverage Map — hybrid (AGS schema spine + guide catalogue)", () => {
  test("walks the five lifted AGS media-type schemas into entity doc roots", () => {
    expect(map.meta.spec).toBe("lti");
    expect(map.meta.version).toBe("1.3");
    for (const entity of ["LineItem", "LineItemContainer", "Score", "Result", "ResultContainer"]) {
      expect(byKey.get(`lti:1.3:doc:${entity}`)?.kind).toBe("document");
    }
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("lti:1.3:")).toBe(true);
  });

  test("pins each lifted AGS binding and the AGS REST service against the vendored OpenAPI", () => {
    // 5 component bindings + 1 restService (ags paths) — all the same derived OpenAPI file.
    expect(map.meta.sources).toHaveLength(6);
    for (const source of map.meta.sources) {
      expect(source.language).toBe("openapi");
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("conform-ed's AGS contracts reconcile the OpenAPI with no silent gaps", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.rollup.modelledYes).toBe(21);
    expect(map.residues.silentGaps).toEqual([]);
    // Honest extensions: optional fields conform-ed models that the *illustrative* AGS
    // OpenAPI omits (NOT silent gaps — these are Zod-side, conform-ed is the richer contract).
    expect(map.residues.extensions).toEqual([
      "lti:1.3:doc:LineItem/gradesReleased",
      "lti:1.3:doc:LineItemContainer/[]/gradesReleased",
      "lti:1.3:doc:Result/scoringUserId",
      "lti:1.3:doc:ResultContainer/[]/scoringUserId",
      "lti:1.3:doc:Score/scorePublished",
      "lti:1.3:doc:Score/submission",
    ]);
  });

  test("#/components/schemas refs resolve — no dangling edges", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the catalogue spans the six Advantage profiles", () => {
    expect(map.rollup.conformanceRequirements).toBe(27);
    const profiles = new Set(map.conformance.map((r) => r.profile));
    expect(profiles).toEqual(new Set(["core", "security", "nrps", "ags", "deep-linking", "proctoring"]));
  });

  test("only AGS requirements carry schema/transport anchors; the guide-only profiles carry none", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const req of map.conformance) {
      if (req.profile === "ags") {
        // AGS is the only profile with a literal denominator — every anchor must exist.
        // (LTI-AGS-1 is the launch-claim half, which has no OpenAPI schema, so it is exempt.)
        if (req.reqId === "LTI-AGS-1") {
          expect(req.constrains).toEqual([]);
        } else {
          expect(req.constrains.length).toBeGreaterThan(0);
          for (const key of req.constrains) expect(keys.has(key)).toBe(true);
        }
      } else {
        // Core / Security / NRPS / Deep-Linking / Proctoring publish no schema → no anchor.
        expect(req.constrains).toEqual([]);
      }
    }
  });

  test("cited is 0 throughout — the AGS OpenAPI carries no ALL-CAPS RFC-2119 prose", () => {
    // The schema-backed-vs-catalogue distinction here is L2 reconciliation (modelledYes),
    // not `cited` (as for the XSD-family CC/QTI maps).
    expect(map.rollup.normativeStatementsCited).toBe(0);
    expect(map.rollup.normativeStatements).toBe(0);
  });

  test("the transport axis inventories the AGS paths (no security scheme is declared)", () => {
    const operations = map.items.filter((i) => i.kind === "operation");
    const parameters = map.items.filter((i) => i.kind === "parameter");
    const security = map.items.filter((i) => i.kind === "security");
    // 7 AGS operations, the six query filters, and NO security scheme (AGS keeps OAuth out of band).
    expect(operations).toHaveLength(7);
    expect(new Set(parameters.map((i) => i.key))).toEqual(
      new Set(["limit", "page", "resource_link_id", "resource_id", "tag", "user_id"].map((p) => `lti:1.3:param:${p}`)),
    );
    expect(security).toHaveLength(0);
    // Transport items are a distinct axis: never reconciled, so never a gap or extension.
    for (const item of [...operations, ...parameters]) expect(item.modelled).toBeUndefined();
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "lti-v1.3.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(ltiV1_3, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
