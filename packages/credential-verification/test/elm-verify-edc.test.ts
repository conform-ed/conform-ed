import { describe, expect, test } from "bun:test";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type SealedEdc } from "../src/jades";
import { deriveEdcVerdict, verifyEdc } from "../src/verify-edc";

// The vendored ELM SHACL shapes + the real EU EDC corpus live in the coverage package.
const elmDir = join(import.meta.dir, "../../coverage/vendor/elm");
const shape = (name: string): string => readFileSync(join(elmDir, "shapes", name), "utf8");
const load = (f: string): SealedEdc => JSON.parse(readFileSync(join(elmDir, "examples/edc", f), "utf8")) as SealedEdc;

const SHAPES = [shape("edc-generic-full.ttl")];
// The EU TEST SEAL certs were valid 2023–2025; pin to signing time so the (now-expired) windows pass.
const AT_SIGNING = new Date("2025-02-12T12:09:45Z");

const signed = [
  "AA-Annex1-MC-signed.jsonld",
  "Sample-CertOfPart-signed.jsonld",
  "Sample-JointDegree-signed.jsonld",
  "Sample-MastersDegree-signed.jsonld",
  "Sample-TranscriptOfRecords-signed.jsonld",
];

describe("verifyEdc — EDC verification orchestrator (ADR-0019 §3)", () => {
  for (const file of signed) {
    test(`${file}: intact seal + SHACL-valid → verdict 'verified', trust honestly not anchored`, async () => {
      const result = await verifyEdc(load(file), { shapes: SHAPES, verificationTime: AT_SIGNING });

      expect(result.sealIntact).toBe(true); // JWS + x5c chain check out at signing time
      expect(result.structure.conforms).toBe(true); // SHACL-valid against edc-generic-full
      expect(result.trustAnchored).toBe(false); // no anchor supplied — host owns the EU-trust decision
      expect(result.verdict).toBe("verified"); // intact + conformant + in-window, despite no trust anchor
      expect(result.credential?.["type"]).toEqual(["VerifiableCredential", "EuropeanDigitalCredential"]);
      expect(result.issuer.id).toBeDefined();
    });
  }

  test("trust becomes anchored when the host injects the signing cert", async () => {
    const sealed = load("Sample-CertOfPart-signed.jsonld");
    const header = JSON.parse(Buffer.from(sealed.signatures[0]!.protected, "base64url").toString("utf8")) as {
      x5c: string[];
    };
    const leafPem = new X509Certificate(Buffer.from(header.x5c[0]!, "base64")).toString();

    const result = await verifyEdc(sealed, { shapes: SHAPES, trustAnchors: [leafPem], verificationTime: AT_SIGNING });
    expect(result.trustAnchored).toBe(true);
    expect(result.verdict).toBe("verified");
  });

  test("a tampered payload fails the seal → verdict 'invalid'", async () => {
    const sealed = load("Sample-CertOfPart-signed.jsonld");
    const tampered: SealedEdc = { ...sealed, payload: sealed.payload.replace("urn:credential", "urn:tampered") };
    const result = await verifyEdc(tampered, { shapes: SHAPES, verificationTime: AT_SIGNING });
    expect(result.sealIntact).toBe(false);
    expect(result.verdict).toBe("invalid");
  });

  test("a non-sealed input is 'unverifiable', not a crash", async () => {
    const result = await verifyEdc({ hello: "world" }, { shapes: SHAPES });
    expect(result.verdict).toBe("unverifiable");
    expect(result.sealIntact).toBe(false);
  });

  test("deriveEdcVerdict: trust anchoring never downgrades an otherwise-verified EDC", () => {
    const intactSeal = { signatureCount: 1, signatures: [], allSignaturesValid: true } as never;
    const verdict = deriveEdcVerdict({
      seal: intactSeal,
      sealIntact: true,
      structure: { conforms: true, violations: [] },
      validityWindow: { state: "valid" },
      revocation: { state: "not-checked" },
    });
    expect(verdict).toBe("verified"); // trustAnchored is not an input — it cannot flip this to invalid

    const shaclFail = deriveEdcVerdict({
      seal: intactSeal,
      sealIntact: true,
      structure: { conforms: false, violations: [{ message: "x" }] },
      validityWindow: { state: "valid" },
      revocation: { state: "not-checked" },
    });
    expect(shaclFail).toBe("invalid");
  });
});
