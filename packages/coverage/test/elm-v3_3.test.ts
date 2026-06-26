import { describe, expect, test } from "bun:test";

import { amsProfile, edcProfile, loqProfile, pidProfile } from "../specs/elm/v3_3";
import { buildElmCoverageMap } from "../src/elm";

const edc = buildElmCoverageMap(edcProfile, { now: "2026-01-01" });
const byKey = new Map(edc.items.map((i) => [i.key, i]));

describe("ELM v3.3 EDC Coverage Map — SHACL denominator, class-based reconciliation", () => {
  test("inventories the EDC profile from the SHACL shapes", () => {
    expect(edc.meta.spec).toBe("elm");
    expect(edc.meta.version).toBe("3.3");
    expect(edc.items.length).toBeGreaterThan(500);
    expect(byKey.get("elm:3.3:def:EuropeanDigitalCredential")?.modelled).toBe("yes");
    expect(byKey.get("elm:3.3:def:EuropeanDigitalCredential/credentialSubject")?.modelled).toBe("yes");
  });

  test("the P2 contracts model the EDC profile near-completely", () => {
    // The only residual modelledNo are the property-less Mailbox / ShaclValidator2017 classes.
    expect(edc.rollup.modelledYes).toBeGreaterThan(520);
    expect(edc.residues.silentGaps.length).toBe(0); // no property-level silent gaps remain
  });

  test("carries variant provenance and the hybrid CV annotations into the map", () => {
    const root = byKey.get("elm:3.3:def:EuropeanDigitalCredential");
    expect(root?.variants).toContain("generic-no-cv");
    const opaque = edc.items.filter((i) => i.cvEnforcement === "opaque");
    const membership = edc.items.filter((i) => i.cvEnforcement === "membership");
    expect(opaque.length).toBe(2); // ESCO occupation + skill
    expect(membership.length).toBeGreaterThan(25);
  });

  test("records the SHACL source provenance with sha256 pins", () => {
    expect(edc.meta.sources.length).toBe(6); // 6 EDC variant shapes
    for (const s of edc.meta.sources) {
      expect(s.language).toBe("shacl");
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("is deterministic", () => {
    expect(JSON.stringify(buildElmCoverageMap(edcProfile, { now: "2026-01-01" }))).toBe(JSON.stringify(edc));
  });
});

describe("ELM v3.3 LOQ/AMS/PID Coverage Maps", () => {
  test("LOQ is multi-rooted and surfaces the MDR `publisher` gaps", () => {
    const loq = buildElmCoverageMap(loqProfile, { now: "2026-01-01" });
    const keys = new Set(loq.items.map((i) => i.key));
    expect(keys.has("elm:3.3:def:LearningOpportunity")).toBe(true);
    expect(keys.has("elm:3.3:def:Qualification")).toBe(true);
    // The `-mdr` variant adds `publisher`, which the conform-ed core does not model (a real gap).
    expect(loq.residues.silentGaps.some((k) => k.endsWith("/publisher"))).toBe(true);
  });

  test("AMS roots at Accreditation; PID roots at Person", () => {
    const ams = buildElmCoverageMap(amsProfile, { now: "2026-01-01" });
    const pid = buildElmCoverageMap(pidProfile, { now: "2026-01-01" });
    expect(ams.items.some((i) => i.key === "elm:3.3:def:Accreditation")).toBe(true);
    expect(pid.items.some((i) => i.key === "elm:3.3:def:Person")).toBe(true);
    // PID surfaces the literal EU spelling `patronimycName` (sic) the conform-ed model corrects.
    expect(pid.residues.silentGaps.some((k) => k.includes("patronimycName"))).toBe(true);
  });
});
