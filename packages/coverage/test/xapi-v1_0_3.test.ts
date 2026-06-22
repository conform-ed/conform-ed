import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { xapiV1_0_3 } from "../specs/xapi/v1_0_3";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(xapiV1_0_3, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("xAPI 1.0.3 (ADL) Coverage Map — curated Statement information model", () => {
  test("walks the hand-authored Statement denominator into the statement entity tree", () => {
    expect(map.meta.spec).toBe("xapi");
    expect(map.meta.version).toBe("1.0.3");
    expect(byKey.get("xapi:1.0.3:doc:Statement")?.kind).toBe("document");
    expect(map.meta.sources).toHaveLength(1);
    expect(map.meta.sources[0]?.language).toBe("curated");
    expect(map.meta.sources[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the Statement's required triple and its sub-object tree reconcile", () => {
    for (const key of [
      "xapi:1.0.3:doc:Statement/actor",
      "xapi:1.0.3:doc:Statement/verb",
      "xapi:1.0.3:doc:Statement/object",
      "xapi:1.0.3:def:Agent/mbox",
      "xapi:1.0.3:def:AgentAccount/homePage",
      "xapi:1.0.3:def:Group/member",
      "xapi:1.0.3:def:Verb/id",
      "xapi:1.0.3:def:Activity/id",
      "xapi:1.0.3:def:InteractionComponent/id",
      "xapi:1.0.3:def:StatementRef/id",
      "xapi:1.0.3:def:SubStatement/object",
      "xapi:1.0.3:def:Result/score",
      "xapi:1.0.3:def:Score/scaled",
      "xapi:1.0.3:def:Context/contextActivities",
      "xapi:1.0.3:def:ContextActivities/parent",
      "xapi:1.0.3:def:Attachment/sha2",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
  });

  test("1.0.3 carries no IEEE-2.0 contextAgents / contextGroups", () => {
    // The one structural difference from the xapi:2.0 sibling map — those are 2.0 additions.
    expect(byKey.has("xapi:1.0.3:def:Context/contextAgents")).toBe(false);
    expect(byKey.has("xapi:1.0.3:def:Context/contextGroups")).toBe(false);
    expect(map.items.some((i) => i.key.includes("ContextAgent") || i.key.includes("ContextGroup"))).toBe(false);
  });

  test("conform-ed reconciles the Statement model with no silent gaps", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.normalisations).toEqual([]);
    // The one extension is the Attachment inline base64 body — a conform-ed transport convenience
    // the xAPI Attachment JSON object does not define (honest, not a gap).
    expect(map.residues.extensions).toHaveLength(1);
    expect(map.residues.extensions[0]).toMatch(/\/contentBase64$/);
  });

  test("the interactionType vocabulary verifies as a value-set with no gaps", () => {
    expect(map.rollup.valueSetMembers).toBe(10);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets.map((v) => v.item)).toEqual(["xapi:1.0.3:def:ActivityDefinition/interactionType"]);
    expect(map.valueSets[0]?.modelled).toBe(10);
  });

  test("every conformance requirement cross-links to a real reconciled item", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(11);
    expect(new Set(map.conformance.map((r) => r.profile))).toEqual(new Set(["statement", "context", "attachment"]));
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "xapi-v1.0.3.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(xapiV1_0_3, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
