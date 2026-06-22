import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { xapiV2_0 } from "../specs/xapi/v2_0";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(xapiV2_0, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("xAPI 2.0 (IEEE 9274.1.1) Coverage Map — curated Statement information model", () => {
  test("walks the hand-authored Statement denominator into the statement entity tree", () => {
    expect(map.meta.spec).toBe("xapi");
    expect(map.meta.version).toBe("2.0");
    expect(byKey.get("xapi:2.0:doc:Statement")?.kind).toBe("document");
    // The single curated source — xAPI publishes no machine schema (ADR-0017).
    expect(map.meta.sources).toHaveLength(1);
    expect(map.meta.sources[0]?.language).toBe("curated");
    expect(map.meta.sources[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the Statement's required triple and its sub-object tree reconcile", () => {
    // The required actor/verb/object triple plus a representative leaf from each sub-object,
    // proving the polymorphic union slots (actor/object/authority) resolve through the oneOf refs.
    for (const key of [
      "xapi:2.0:doc:Statement/actor",
      "xapi:2.0:doc:Statement/verb",
      "xapi:2.0:doc:Statement/object",
      "xapi:2.0:def:Agent/mbox",
      "xapi:2.0:def:AgentAccount/homePage",
      "xapi:2.0:def:Group/member",
      "xapi:2.0:def:Verb/id",
      "xapi:2.0:def:Activity/id",
      "xapi:2.0:def:InteractionComponent/id",
      "xapi:2.0:def:StatementRef/id",
      "xapi:2.0:def:SubStatement/object",
      "xapi:2.0:def:Result/score",
      "xapi:2.0:def:Score/scaled",
      "xapi:2.0:def:Context/contextActivities",
      "xapi:2.0:def:ContextActivities/parent",
      "xapi:2.0:def:ContextAgent/agent",
      "xapi:2.0:def:ContextGroup/group",
      "xapi:2.0:def:Attachment/sha2",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
  });

  test("conform-ed reconciles the Statement model with no silent gaps", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.normalisations).toEqual([]);
    // The one extension is the Attachment inline base64 body — conform-ed models a transport
    // convenience the xAPI Attachment JSON object does not define (honest, not a gap).
    expect(map.residues.extensions).toHaveLength(1);
    expect(map.residues.extensions[0]).toMatch(/\/contentBase64$/);
  });

  test("the interactionType vocabulary verifies as a value-set with no gaps", () => {
    expect(map.rollup.valueSetMembers).toBe(10);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets.map((v) => v.item)).toEqual(["xapi:2.0:def:ActivityDefinition/interactionType"]);
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
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "xapi-v2.0.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(xapiV2_0, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
