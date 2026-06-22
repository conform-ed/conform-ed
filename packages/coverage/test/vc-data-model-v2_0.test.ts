import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { vcDataModelV2_0 } from "../specs/vc-data-model/v2_0";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(vcDataModelV2_0, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("VC Data Model 2.0 Coverage Map — curated credential/presentation core model", () => {
  test("walks the two curated denominators into doc roots", () => {
    expect(map.meta.spec).toBe("vc");
    expect(map.meta.version).toBe("2.0");
    expect(byKey.get("vc:2.0:doc:VerifiableCredential")?.kind).toBe("document");
    expect(byKey.get("vc:2.0:doc:VerifiablePresentation")?.kind).toBe("document");
    expect(map.meta.sources).toHaveLength(2);
    for (const s of map.meta.sources) {
      expect(s.language).toBe("curated");
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the credential core terms and one-or-many service objects reconcile", () => {
    // The required core terms plus a representative leaf from each one-or-many service object,
    // proving the oneOf[single, array] mirror of conform-ed's oneOrMany resolves both forms.
    for (const key of [
      "vc:2.0:def:VerifiableCredential/@context",
      "vc:2.0:def:VerifiableCredential/type",
      "vc:2.0:def:VerifiableCredential/issuer",
      "vc:2.0:def:VerifiableCredential/validFrom",
      "vc:2.0:def:VerifiableCredential/credentialSubject",
      "vc:2.0:def:CredentialSubject/id",
      "vc:2.0:def:Proof/type",
      "vc:2.0:def:CredentialSchema/type",
      "vc:2.0:def:CredentialStatus/type",
      "vc:2.0:def:Evidence/narrative",
      "vc:2.0:def:VerifiablePresentation/verifiableCredential",
      "vc:2.0:def:VerifiablePresentation/holder",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
  });

  test("the presentation's verifiableCredential reuses the shared VerifiableCredential definition", () => {
    // Both documents reconcile against one set of def: keys (the byte-identical $defs block),
    // so the credential definition exists once and the presentation references it.
    expect(byKey.has("vc:2.0:def:VerifiableCredential/credentialSubject")).toBe(true);
    expect(byKey.get("vc:2.0:def:VerifiablePresentation/verifiableCredential")?.modelled).toBe("yes");
  });

  test("conform-ed reconciles both documents with no silent gaps and no extensions", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.residues.silentGaps).toEqual([]);
    expect(map.residues.extensions).toEqual([]);
    expect(map.residues.normalisations).toEqual([]);
  });

  test("no value-sets — VCDM is JSON-LD-open with no closed core enumerations", () => {
    expect(map.valueSets).toEqual([]);
    expect(map.rollup.valueSetMembers).toBe(0);
  });

  test("every conformance requirement cross-links to a real reconciled item", () => {
    const keys = new Set(map.items.map((i) => i.key));
    expect(map.rollup.conformanceRequirements).toBe(5);
    expect(new Set(map.conformance.map((r) => r.profile))).toEqual(new Set(["credential", "presentation"]));
    for (const req of map.conformance) {
      expect(req.constrains.length).toBeGreaterThan(0);
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
    }
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "vc-data-model-v2.0.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(vcDataModelV2_0, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
