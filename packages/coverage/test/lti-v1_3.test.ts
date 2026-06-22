import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ltiV1_3 } from "../specs/lti/v1_3";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(ltiV1_3, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("LTI 1.3 + Advantage Coverage Map — hybrid (AGS schema spine + curated DL denominator + guide catalogue)", () => {
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

  test("pins each AGS binding/REST service (OpenAPI) and the curated content-item denominator", () => {
    // 5 AGS component bindings + 1 restService (ags paths), all the same derived OpenAPI file,
    // plus the ADR-0017 curated Deep Linking content-item denominator (a distinct provenance tier).
    expect(map.meta.sources).toHaveLength(7);
    for (const source of map.meta.sources) expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    const byBinding = new Map(map.meta.sources.map((s) => [s.binding, s.language]));
    for (const openapi of ["ags (paths)", "LineItem", "LineItemContainer", "Result", "ResultContainer", "Score"]) {
      expect(byBinding.get(openapi)).toBe("openapi");
    }
    expect(byBinding.get("DeepLinkingContentItem")).toBe("curated");
  });

  test("conform-ed reconciles every denominator (AGS OpenAPI + curated content items) with no silent gaps", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.rollup.modelledYes).toBe(61);
    expect(map.residues.silentGaps).toEqual([]);
    // Honest extensions: optional fields conform-ed models that the denominator omits (NOT gaps).
    // Six are AGS fields the *illustrative* OpenAPI omits; the seventh is the `alt` text on
    // conform-ed's shared image resource, which the LTI Deep Linking image resource never defines.
    expect(map.residues.extensions).toEqual([
      "lti:1.3:def:DeepLinkingContentItem.__schema1/alt",
      "lti:1.3:doc:LineItem/gradesReleased",
      "lti:1.3:doc:LineItemContainer/[]/gradesReleased",
      "lti:1.3:doc:Result/scoringUserId",
      "lti:1.3:doc:ResultContainer/[]/scoringUserId",
      "lti:1.3:doc:Score/scorePublished",
      "lti:1.3:doc:Score/submission",
    ]);
  });

  test("the curated Deep Linking content-item denominator gives the gap-prone per-type fields a verdict", () => {
    // The exact fields that sat under-modelled before the contract fix + ADR-0017 — now each is a
    // real curated L1 item that conform-ed's ContentItemSchema reconciles as modelled `yes`.
    for (const key of [
      "lti:1.3:def:DlHtml/html",
      "lti:1.3:def:DlImage/width",
      "lti:1.3:def:DlImage/height",
      "lti:1.3:def:DlFile/mediaType",
      "lti:1.3:def:DlFile/expiresAt",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
    expect(byKey.get("lti:1.3:doc:DeepLinkingContentItem")?.kind).toBe("document");
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

  test("AGS and the curated Deep Linking content-item requirement carry anchors; the rest carry none", () => {
    const keys = new Set(map.items.map((i) => i.key));
    const anchored = new Set<string>();
    for (const req of map.conformance) {
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
      if (req.constrains.length > 0) anchored.add(req.reqId);
    }
    // AGS (every requirement except the launch-claim LTI-AGS-1) plus Deep Linking's content-item
    // requirement (LTI-DL-3, anchored to the ADR-0017 curated denominator) now have a literal
    // denominator. Core, Security, NRPS, Proctoring and the other Deep Linking requirements stay
    // guide-only — 1EdTech publishes no schema for those, recorded honestly as `constrains: []`.
    expect(anchored).toEqual(
      new Set(["LTI-AGS-2", "LTI-AGS-3", "LTI-AGS-4", "LTI-AGS-5", "LTI-AGS-6", "LTI-AGS-7", "LTI-AGS-8", "LTI-DL-3"]),
    );
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
