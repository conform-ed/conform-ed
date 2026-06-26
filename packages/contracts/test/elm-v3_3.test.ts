import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EuropeanDigitalCredentialSchema } from "../src/elm/v3_3";

// The vendored EU corpus lives in the coverage package (the version-pinned denominator home).
const corpusDir = join(import.meta.dir, "../../coverage/vendor/elm/examples/edc");
const unsigned = [
  "AA-Annex1-MC-unsigned.json",
  "Sample-CertOfPart-unsigned.json",
  "Sample-JointDegree-unsigned.json",
  "Sample-MastersDegree-unsigned.json",
  "Sample-TranscriptOfRecords-unsigned.json",
];

/** The unsigned EU examples are delivery-wrapped: the EDC is under `.credential`. */
function loadCredential(file: string): unknown {
  const wrapper = JSON.parse(readFileSync(join(corpusDir, file), "utf8")) as { credential: unknown };
  return wrapper.credential;
}

describe("ELM v3.3 EDC contract — round-trips the real EU corpus", () => {
  for (const file of unsigned) {
    test(`${file} parses and round-trips (no drops, no transforms)`, () => {
      const credential = loadCredential(file);
      const parsed: unknown = EuropeanDigitalCredentialSchema.parse(credential);
      // passthroughObject + non-transforming validators ⇒ parse output equals input.
      expect(parsed).toEqual(credential);
    });
  }

  test("models the EDC envelope structurally", () => {
    const credential = loadCredential("Sample-CertOfPart-unsigned.json") as Record<string, unknown>;
    const parsed = EuropeanDigitalCredentialSchema.parse(credential) as Record<string, unknown>;
    expect(parsed["type"]).toEqual(["VerifiableCredential", "EuropeanDigitalCredential"]);
    expect((parsed["credentialSubject"] as Record<string, unknown>)["hasClaim"]).toBeDefined();
    expect(parsed["credentialSchema"]).toBeDefined();
    expect(parsed["displayParameter"]).toBeDefined();
  });

  test("rejects a credential missing the required EDC type", () => {
    const credential = loadCredential("Sample-CertOfPart-unsigned.json") as Record<string, unknown>;
    const broken = { ...credential, type: ["VerifiableCredential"] };
    expect(EuropeanDigitalCredentialSchema.safeParse(broken).success).toBe(false);
  });
});
