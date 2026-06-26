import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { type ShaclVariantInput, walkShacl } from "../src/walkers/shacl";

const shapesDir = join(import.meta.dir, "../vendor/elm/shapes");
const ctx = { spec: "elm", version: "3.3" } as const;

const edcVariants: ShaclVariantInput[] = [
  { path: join(shapesDir, "edc-generic-no-cv.ttl"), variant: "generic-no-cv" },
  { path: join(shapesDir, "edc-generic-full.ttl"), variant: "generic-full" },
  { path: join(shapesDir, "edc-accredited.ttl"), variant: "accredited" },
  { path: join(shapesDir, "edc-converted.ttl"), variant: "converted" },
  { path: join(shapesDir, "edc-issued-by-mandate.ttl"), variant: "issued-by-mandate" },
  { path: join(shapesDir, "edc-diploma-supplement.ttl"), variant: "diploma-supplement" },
];

const edc = walkShacl("edc", edcVariants, ctx);
const byKey = new Map(edc.items.map((i) => [i.key, i]));

describe("SHACL walker — EDC profile (ADR-0019)", () => {
  test("walks the EDC root class and its real envelope properties", () => {
    expect(edc.items.length).toBeGreaterThan(400);
    const root = byKey.get("elm:3.3:def:EuropeanDigitalCredential");
    expect(root?.kind).toBe("definition");
    expect(root?.description).toContain("Verifiable Credential");
    for (const prop of [
      "credentialSubject",
      "issuer",
      "credentialSchema",
      "issuanceDate",
      "validFrom",
      "issued",
      "credentialStatus",
      "credentialProfiles",
      "displayParameter",
    ]) {
      expect(byKey.has(`elm:3.3:def:EuropeanDigitalCredential/${prop}`)).toBe(true);
    }
  });

  test("unions all six EDC sub-variants and tags each constraint with its variant(s)", () => {
    const seen = new Set(edc.items.flatMap((i) => i.variants ?? []));
    expect([...seen].sort()).toEqual([
      "accredited",
      "converted",
      "diploma-supplement",
      "generic-full",
      "generic-no-cv",
      "issued-by-mandate",
    ]);
    // The structural base comes from generic-no-cv.
    expect(byKey.get("elm:3.3:def:EuropeanDigitalCredential")?.variants).toContain("generic-no-cv");
  });

  test("realises the hybrid CV decision — bounded schemes enforced, ESCO opaque", () => {
    const opaque = edc.items.filter((i) => i.cvEnforcement === "opaque");
    const membership = edc.items.filter((i) => i.cvEnforcement === "membership");
    expect(opaque.length).toBe(2); // ESCO occupations + skills
    expect(membership.length).toBeGreaterThan(25);
    for (const o of opaque) expect(o.cvScheme).toMatch(/esco/i);
    // A bounded leaf resolves to a concrete EU authority scheme IRI.
    const eqf = edc.items.find((i) => i.cvScheme?.includes("/snb/eqf/"));
    expect(eqf?.cvEnforcement).toBe("membership");
  });

  test("records value-type usage edges into shared definitions", () => {
    expect(edc.edges.length).toBeGreaterThan(100);
    for (const e of edc.edges) expect(e.to.startsWith("elm:3.3:def:")).toBe(true);
  });

  test("captures the owl:imports closure as metadata + the ontology source id", () => {
    expect(edc.sourceId).toContain("data.europa.eu/snb/model/ap/");
    expect(edc.imports.some((i) => i.to.includes("edc-generic-no-cv"))).toBe(true);
  });

  test("is deterministic", () => {
    expect(JSON.stringify(walkShacl("edc", edcVariants, ctx))).toBe(JSON.stringify(edc));
  });
});

describe("SHACL walker — LOQ profile (multi-rooted, base + mdr variants)", () => {
  const loq = walkShacl(
    "loq",
    [
      { path: join(shapesDir, "loq-constraints.ttl"), variant: "base" },
      { path: join(shapesDir, "loq-constraints-mdr.ttl"), variant: "mdr" },
    ],
    ctx,
  );
  const loqKeys = new Set(loq.items.map((i) => i.key));

  test("is multi-rooted at LearningOpportunity and Qualification", () => {
    expect(loqKeys.has("elm:3.3:def:LearningOpportunity")).toBe(true);
    expect(loqKeys.has("elm:3.3:def:Qualification")).toBe(true);
  });

  test("tags constraints with the base and mdr variants", () => {
    const seen = new Set(loq.items.flatMap((i) => i.variants ?? []));
    expect(seen.has("base")).toBe(true);
    expect(seen.has("mdr")).toBe(true);
  });
});
