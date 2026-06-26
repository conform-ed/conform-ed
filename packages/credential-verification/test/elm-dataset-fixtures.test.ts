import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateAgainstProfile } from "../src/shacl-validate";

// Authored LOQ/AMS/PID dataset fixtures (the EU repo ships only EDC examples). These exercise
// the profile-agnostic SHACL validator on the unsealed plain-dataset profiles (ADR-0019 §1):
// the same engine, pointed at the loq/ams/pid shapes — the "free later addition" made concrete.
const shapesDir = join(import.meta.dir, "../../coverage/vendor/elm/shapes");
const fixturesDir = join(import.meta.dir, "fixtures/elm");
const shape = (name: string): string => readFileSync(join(shapesDir, name), "utf8");
const fixture = (rel: string): unknown => JSON.parse(readFileSync(join(fixturesDir, rel), "utf8"));

describe("ELM plain-dataset SHACL validation — LOQ / AMS / PID (ADR-0019 §1)", () => {
  test("PID: canonical Person conforms; missing Identifier.notation is rejected", async () => {
    const shapes = [shape("pid-constraints.ttl")];
    const canonical = await validateAgainstProfile(fixture("pid/canonical.jsonld"), { shapes });
    const invalid = await validateAgainstProfile(fixture("pid/invalid-missing-notation.jsonld"), { shapes });
    expect(canonical.conforms).toBe(true);
    expect(invalid.conforms).toBe(false);
    expect(invalid.violations.some((v) => v.path?.endsWith("notation"))).toBe(true);
  });

  test("AMS: the empty Accreditation negative has more violations than the canonical", async () => {
    const shapes = [shape("ams-constraints.ttl")];
    const canonical = await validateAgainstProfile(fixture("ams/canonical.jsonld"), { shapes });
    const invalid = await validateAgainstProfile(fixture("ams/invalid-empty.jsonld"), { shapes });
    expect(invalid.violations.length).toBeGreaterThan(canonical.violations.length);
    expect(invalid.violations.some((v) => v.path?.endsWith("title"))).toBe(true);
  });

  test("LOQ: the title-less Qualification negative has more violations than the canonical", async () => {
    const shapes = [shape("loq-constraints.ttl")];
    const canonical = await validateAgainstProfile(fixture("loq/canonical.jsonld"), { shapes });
    const invalid = await validateAgainstProfile(fixture("loq/invalid-missing-title.jsonld"), { shapes });
    expect(invalid.violations.length).toBeGreaterThan(canonical.violations.length);
    expect(invalid.violations.some((v) => v.path?.endsWith("title"))).toBe(true);
  });
});
