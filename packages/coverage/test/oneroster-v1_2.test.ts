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

  test("pins each binding and each REST service against its vendored OpenAPI document", () => {
    // 15 component bindings + 3 restServices (rostering/gradebook/resources paths).
    expect(map.meta.sources).toHaveLength(18);
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

  test("the curated catalogue spans the data-model modes plus the transport profile", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(21);
    const profiles = new Set(map.conformance.map((r) => r.profile));
    expect(profiles).toEqual(new Set(["rostering", "gradebook", "resources", "assessment-results", "transport"]));
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
    // The per-entity stable-identity requirements cross-link the schema's own sourcedId/
    // status/dateLastModified MUSTs across every service, so coverage is substantial.
    expect(map.rollup.normativeStatementsCited).toBeGreaterThanOrEqual(30);
  });

  test("the transport axis inventories the OpenAPI paths without polluting the model residues", () => {
    const operations = map.items.filter((i) => i.kind === "operation");
    const parameters = map.items.filter((i) => i.kind === "parameter");
    const security = map.items.filter((i) => i.kind === "security");
    // 81 operations across the three services, the six shared query mechanisms, and OAuth2CC.
    expect(operations).toHaveLength(81);
    expect(new Set(parameters.map((i) => i.key))).toEqual(
      new Set(["limit", "offset", "filter", "sort", "orderBy", "fields"].map((p) => `or:1.2:param:${p}`)),
    );
    expect(security.map((i) => i.key)).toEqual(["or:1.2:sec:OAuth2CC"]);
    // Transport items are a distinct axis: never reconciled, so never a gap or extension.
    for (const item of [...operations, ...parameters, ...security]) expect(item.modelled).toBeUndefined();
    expect(map.residues.silentGaps).toEqual([]);

    // The §4 transport requirements cross-link to those items.
    const transport = map.conformance.filter((r) => r.profile === "transport");
    expect(transport.map((r) => r.reqId).sort()).toEqual(["OR-TR-1", "OR-TR-2", "OR-TR-3", "OR-TR-4", "OR-TR-5"]);
    expect(map.conformance.find((r) => r.reqId === "OR-TR-1")?.constrains).toEqual(["or:1.2:sec:OAuth2CC"]);
  });

  test("the enumerated OneRoster vocabularies verify as value-sets with no gaps", () => {
    // ADR-0017: the vocabularies the OpenAPI denominator actually enumerates — status,
    // importance, and the imsx status-info codes — safeParse'd against conform-ed's z.enum.
    // 2 + 2 + 4 + 3 + 9 = 20. (role/gender/grade are free CEDS strings, not enumerated.)
    expect(map.rollup.valueSetMembers).toBe(20);
    expect(map.rollup.valueSetGaps).toBe(0);
    expect(map.valueSets).toHaveLength(5);
    expect(map.valueSets.find((v) => v.item.endsWith("/imsx_codeMinorFieldValue"))?.modelled).toBe(9);
    expect(map.valueSets.find((v) => v.item.endsWith("/status"))?.modelled).toBe(2);
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "oneroster-v1.2.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(oneRosterV1_2, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
