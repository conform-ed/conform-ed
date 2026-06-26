import { describe, expect, test } from "bun:test";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { extractSealedCredential, isSealedEdc, type SealedEdc, verifyJadesSeal } from "../src/jades";

const corpus = join(import.meta.dir, "../../coverage/vendor/elm/examples/edc");
const signed = [
  "AA-Annex1-MC-signed.jsonld",
  "Sample-CertOfPart-signed.jsonld",
  "Sample-JointDegree-signed.jsonld",
  "Sample-MastersDegree-signed.jsonld",
  "Sample-TranscriptOfRecords-signed.jsonld",
];
const load = (f: string): SealedEdc => JSON.parse(readFileSync(join(corpus, f), "utf8")) as SealedEdc;

// The EU TEST SEAL certs were valid in 2023–2025; pin verification to the signing time so the
// (now-expired) validity windows still pass — exactly the cert-rot mitigation in ADR-0019.
const AT_SIGNING = new Date("2025-02-12T12:09:45Z");

describe("EDC JAdES seal verification (ADR-0019 §4)", () => {
  for (const file of signed) {
    test(`${file}: JWS seal verifies + extracts the issued credential`, () => {
      const sealed = load(file);
      expect(isSealedEdc(sealed)).toBe(true);
      const verdict = verifyJadesSeal(sealed, { verificationTime: AT_SIGNING });
      expect(verdict.allSignaturesValid).toBe(true);
      expect(verdict.signatures[0]?.algorithm).toBe("RS256");
      expect(verdict.signatures[0]?.chain.validAtTime).toBe(true);

      const credential = extractSealedCredential(sealed) as Record<string, unknown>;
      expect(credential["@context"]).toBeDefined();
      expect(credential["issuer"]).toBeDefined();
      expect(credential["type"]).toEqual(["VerifiableCredential", "EuropeanDigitalCredential"]);
    });
  }

  test("cryptographically validates the RFC-3161 adoTst timestamp (covers payload + TSA-signed)", () => {
    const verdict = verifyJadesSeal(load("Sample-CertOfPart-signed.jsonld"), { verificationTime: AT_SIGNING });
    const ts = verdict.signatures[0]?.timestamps[0];
    expect(ts?.parsed).toBe(true);
    expect(ts?.imprintMatches).toBe(true); // the timestamp covers the credential payload
    expect(ts?.tsaSignatureValid).toBe(true); // TSA signature verifies against its TSU cert
    expect(ts?.genTime).toBe("2025-02-12T12:09:45.000Z");
  });

  test("detects tampering — a mutated payload fails the signature", () => {
    const sealed = load("Sample-CertOfPart-signed.jsonld");
    const tampered: SealedEdc = { ...sealed, payload: sealed.payload.replace("urn:credential", "urn:tampered") };
    const verdict = verifyJadesSeal(tampered, { verificationTime: AT_SIGNING });
    expect(verdict.allSignaturesValid).toBe(false);
  });

  test("pinned verification-time guards validity — the expired cert fails at 'now'", () => {
    const sealed = load("Sample-CertOfPart-signed.jsonld");
    const atNow = verifyJadesSeal(sealed, { verificationTime: new Date("2026-06-26T00:00:00Z") });
    expect(atNow.signatures[0]?.chain.validAtTime).toBe(false); // cert expired May 2025
    expect(atNow.signatures[0]?.signatureValid).toBe(true); // signature itself is still intact
  });

  test("trust is host-injected — unevaluated by default, trusted when the anchor is supplied", () => {
    const sealed = load("Sample-CertOfPart-signed.jsonld");
    expect(verifyJadesSeal(sealed, {}).signatures[0]?.chain.trust).toBe("unevaluated");

    const header = JSON.parse(Buffer.from(sealed.signatures[0]!.protected, "base64url").toString("utf8")) as {
      x5c: string[];
    };
    const leafPem = new X509Certificate(Buffer.from(header.x5c[0]!, "base64")).toString();
    const trusted = verifyJadesSeal(sealed, { trustAnchors: [leafPem], verificationTime: AT_SIGNING });
    expect(trusted.signatures[0]?.chain.trust).toBe("trusted");
  });
});
