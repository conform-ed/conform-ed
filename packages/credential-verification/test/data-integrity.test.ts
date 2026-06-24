import { describe, expect, test } from "bun:test";
import { createHash, generateKeyPairSync, type KeyObject, sign as nodeSign } from "node:crypto";

import {
  base58btcEncode,
  canonicalizeDocument,
  verifyCredential,
  type KeyResolver,
  type VerificationKey,
} from "../src/index";

const VERIFICATION_METHOD = "did:example:issuer#key-1";
const ISSUER = "https://issuer.example";
const CREATED = "2024-01-01T00:00:00Z";

const sha256 = (input: string): Buffer => createHash("sha256").update(input, "utf8").digest();

/** Produce a genuine eddsa-rdfc-2022 secured credential — the exact algorithm the verifier inverts. */
async function signDataIntegrity(
  credential: Record<string, unknown>,
  privateKey: KeyObject,
): Promise<Record<string, unknown>> {
  const proofConfig = {
    "@context": credential["@context"],
    type: "DataIntegrityProof",
    cryptosuite: "eddsa-rdfc-2022",
    created: CREATED,
    verificationMethod: VERIFICATION_METHOD,
    proofPurpose: "assertionMethod",
  };
  const hashData = Buffer.concat([
    sha256(await canonicalizeDocument(proofConfig)),
    sha256(await canonicalizeDocument(credential)),
  ]);
  const signature = nodeSign(null, hashData, privateKey);
  return {
    ...credential,
    proof: {
      type: "DataIntegrityProof",
      cryptosuite: "eddsa-rdfc-2022",
      created: CREATED,
      verificationMethod: VERIFICATION_METHOD,
      proofPurpose: "assertionMethod",
      proofValue: `z${base58btcEncode(signature)}`,
    },
  };
}

function openBadgeCredential(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
    id: "https://issuer.example/credentials/1",
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    issuer: ISSUER,
    validFrom: "2024-01-01T00:00:00Z",
    name: "Test Badge",
    credentialSubject: {
      type: ["AchievementSubject"],
      achievement: {
        id: "https://issuer.example/achievements/1",
        type: ["Achievement"],
        name: "Test Achievement",
        description: "A test achievement.",
        criteria: { narrative: "Did the thing." },
      },
    },
    ...overrides,
  };
}

function keyResolverFor(publicJwk: Record<string, unknown> | null, keyId = VERIFICATION_METHOD): KeyResolver {
  return {
    async resolveKey(request): Promise<VerificationKey | null> {
      if (publicJwk && request.verificationMethod === VERIFICATION_METHOD) {
        return { publicJwk, keyId, controller: ISSUER };
      }
      return null;
    },
  };
}

describe("eddsa-rdfc-2022 Data Integrity verification", () => {
  test("a genuine eddsa-rdfc-2022 credential round-trips and verifies", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const secured = await signDataIntegrity(openBadgeCredential(), privateKey);

    const result = await verifyCredential(secured, {
      keyResolver: keyResolverFor(publicKey.export({ format: "jwk" }) as Record<string, unknown>),
    });

    expect(result.verdict).toBe("verified");
    expect(result.signature).toMatchObject({
      state: "valid",
      mechanism: "di-eddsa-rdfc-2022",
      verificationKeyId: VERIFICATION_METHOD,
    });
    expect(result.issuer).toEqual({ id: ISSUER, resolved: true });
  });

  test("tampering with the body after signing fails the signature", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const secured = await signDataIntegrity(openBadgeCredential(), privateKey);
    secured["name"] = "Tampered Badge"; // mutate a signed field

    const result = await verifyCredential(secured, {
      keyResolver: keyResolverFor(publicKey.export({ format: "jwk" }) as Record<string, unknown>),
    });

    expect(result.verdict).toBe("invalid");
    expect(result.signature.state).toBe("invalid");
  });

  test("a different public key fails the signature (forgery)", async () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const { publicKey: unrelatedPublic } = generateKeyPairSync("ed25519");
    const secured = await signDataIntegrity(openBadgeCredential(), privateKey);

    const result = await verifyCredential(secured, {
      keyResolver: keyResolverFor(unrelatedPublic.export({ format: "jwk" }) as Record<string, unknown>),
    });

    expect(result.verdict).toBe("invalid");
    expect(result.signature.state).toBe("invalid");
  });

  test("an unsupported cryptosuite is reported unverifiable, not silently passed", async () => {
    const result = await verifyCredential(
      openBadgeCredential({
        proof: { type: "DataIntegrityProof", cryptosuite: "ecdsa-rdfc-2019", proofValue: "z123" },
      }),
      { keyResolver: keyResolverFor(null) },
    );

    expect(result.verdict).toBe("unverifiable");
    expect(result.reasons.join(" ")).toContain("eddsa-rdfc-2022");
  });

  test("a credential referencing a non-vendored @context fails closed (no network)", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    // Sign a vendored-context credential, then point its @context at an unknown IRI: the
    // verifier must refuse to dereference it rather than reach out to the network.
    const secured = await signDataIntegrity(openBadgeCredential(), privateKey);
    secured["@context"] = ["https://www.w3.org/ns/credentials/v2", "https://unknown.example/context.json"];

    const result = await verifyCredential(secured, {
      keyResolver: keyResolverFor(publicKey.export({ format: "jwk" }) as Record<string, unknown>),
    });

    expect(result.verdict).toBe("unverifiable");
    expect(result.reasons.join(" ")).toContain("Canonicalization failed");
  });

  test("an authentic but expired Data Integrity credential is invalid", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const secured = await signDataIntegrity(openBadgeCredential({ validUntil: "2025-01-01T00:00:00Z" }), privateKey);

    const result = await verifyCredential(secured, {
      keyResolver: keyResolverFor(publicKey.export({ format: "jwk" }) as Record<string, unknown>),
      now: new Date("2026-06-24T00:00:00Z"),
    });

    expect(result.verdict).toBe("invalid");
    expect(result.signature.state).toBe("valid");
    expect(result.validityWindow.state).toBe("expired");
  });
});
