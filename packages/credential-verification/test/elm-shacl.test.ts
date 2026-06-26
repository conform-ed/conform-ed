import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateAgainstProfile } from "../src/shacl-validate";

// The vendored ELM SHACL shapes + EU corpus live in the coverage package.
const elmDir = join(import.meta.dir, "../../coverage/vendor/elm");
const shape = (name: string): string => readFileSync(join(elmDir, "shapes", name), "utf8");
const credentialOf = (file: string): Record<string, unknown> =>
  (JSON.parse(readFileSync(join(elmDir, "examples/edc", file), "utf8")) as { credential: Record<string, unknown> })
    .credential;

const ISSUER = "https://www.w3.org/2018/credentials#issuer";
const noCv = [shape("edc-generic-no-cv.ttl")];

describe("EDC verify — real SHACL over JSON-LD→RDF (ADR-0019 §3)", () => {
  test("validates a real EU credential and reports the genuine missing-issuer violation", async () => {
    // The pre-issuance delivery form omits `issuer` (added at sealing) — SHACL must catch it.
    const report = await validateAgainstProfile(credentialOf("Sample-CertOfPart-unsigned.json"), { shapes: noCv });
    expect(report.conforms).toBe(false);
    expect(report.violations.some((v) => v.path === ISSUER)).toBe(true);
  });

  test("is real validation — removing a required field surfaces a new violation", async () => {
    const credential = credentialOf("Sample-CertOfPart-unsigned.json");
    const base = await validateAgainstProfile(credential, { shapes: noCv });
    const { credentialSubject, ...withoutSubject } = credential;
    void credentialSubject;
    const broken = await validateAgainstProfile(withoutSubject, { shapes: noCv });
    // Dropping the required credentialSubject adds a violation — the engine reads the data.
    expect(broken.violations.length).toBeGreaterThan(base.violations.length);
  });

  test("injects the EDC default @context when the delivery form omits it (RDF is non-empty)", async () => {
    // A credential with no @context still produces RDF (the default EDC context is injected),
    // so SHACL has a graph to evaluate rather than silently passing an empty one.
    const report = await validateAgainstProfile(credentialOf("Sample-MastersDegree-unsigned.json"), { shapes: noCv });
    expect(report.violations.length).toBeGreaterThan(0); // a graph was evaluated (not empty-pass)
  });

  test("is profile-agnostic — the same engine validates a PID dataset (LOQ/AMS/PID free later)", async () => {
    const person = {
      "@context": ["https://www.w3.org/2018/credentials/v1", "http://data.europa.eu/snb/model/context/edc-ap"],
      type: "Person",
      id: "https://people.example/1",
    };
    const report = await validateAgainstProfile(person, {
      shapes: [shape("pid-constraints.ttl")],
      defaultContext: ["http://data.europa.eu/snb/model/context/edc-ap"],
    });
    expect(typeof report.conforms).toBe("boolean");
    expect(Array.isArray(report.violations)).toBe(true);
  });
});
