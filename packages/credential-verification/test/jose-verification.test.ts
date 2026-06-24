import { describe, expect, test } from "bun:test";

import { CompactSign, exportJWK, generateKeyPair, type JWK } from "jose";

import {
  deriveVerdict,
  evaluateValidityWindow,
  verifyCredential,
  type KeyResolver,
  type VerificationKey,
} from "../src/index";

const ALG = "EdDSA";
const KID = "https://issuer.example/keys/1";
const ISSUER = "https://issuer.example";

type Vector = { jws: string; publicJwk: JWK };

/** Sign a credential body as an enveloping compact JWS, the way an OB 3.0 issuer does. */
async function signCredential(body: Record<string, unknown>, kid = KID): Promise<Vector> {
  const { publicKey, privateKey } = await generateKeyPair(ALG, { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: ALG, use: "sig" };
  const jws = await new CompactSign(new TextEncoder().encode(JSON.stringify(body)))
    .setProtectedHeader({ alg: ALG, kid, typ: "vc+jwt", cty: "vc-ld+json" })
    .sign(privateKey);
  return { jws, publicJwk };
}

/** An in-memory key resolver mapping a kid to its published public JWK (stands in for a JWKS). */
function keyResolverFor(...keys: Array<{ kid: string; publicJwk: JWK }>): KeyResolver {
  return {
    async resolveKey(request): Promise<VerificationKey | null> {
      const match = keys.find((key) => key.kid === request.kid);
      return match
        ? { publicJwk: match.publicJwk as Record<string, unknown>, keyId: match.kid, controller: ISSUER }
        : null;
    },
  };
}

function achievementCredential(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
    type: ["VerifiableCredential", "AchievementCredential"],
    issuer: ISSUER,
    validFrom: "2020-01-01T00:00:00Z",
    credentialSubject: { id: "did:example:learner", type: ["AchievementSubject"] },
    ...overrides,
  };
}

describe("VC-JOSE credential verification", () => {
  test("a well-formed, in-window credential verifies", async () => {
    const { jws, publicJwk } = await signCredential(achievementCredential());
    const result = await verifyCredential(jws, { keyResolver: keyResolverFor({ kid: KID, publicJwk }) });

    expect(result.verdict).toBe("verified");
    expect(result.signature).toMatchObject({ state: "valid", mechanism: "vc-jose", verificationKeyId: KID });
    expect(result.validityWindow.state).toBe("valid");
    expect(result.revocation.state).toBe("not-checked");
    expect(result.issuer).toEqual({ id: ISSUER, resolved: true });
    expect(result.credential?.["type"]).toEqual(["VerifiableCredential", "AchievementCredential"]);
    expect(result.reasons).toHaveLength(0);
  });

  test("an authentic but expired credential is invalid, with the signature still valid", async () => {
    const { jws, publicJwk } = await signCredential(achievementCredential({ validUntil: "2021-01-01T00:00:00Z" }));
    const result = await verifyCredential(jws, {
      keyResolver: keyResolverFor({ kid: KID, publicJwk }),
      now: new Date("2026-01-01T00:00:00Z"),
    });

    expect(result.verdict).toBe("invalid");
    expect(result.signature.state).toBe("valid");
    expect(result.validityWindow.state).toBe("expired");
    expect(result.reasons.join(" ")).toContain("expired");
  });

  test("a not-yet-valid credential is invalid", async () => {
    const { jws, publicJwk } = await signCredential(achievementCredential({ validFrom: "2099-01-01T00:00:00Z" }));
    const result = await verifyCredential(jws, {
      keyResolver: keyResolverFor({ kid: KID, publicJwk }),
      now: new Date("2026-01-01T00:00:00Z"),
    });

    expect(result.verdict).toBe("invalid");
    expect(result.signature.state).toBe("valid");
    expect(result.validityWindow.state).toBe("not-yet-valid");
  });

  test("a credential signed by a different key fails the signature (forgery)", async () => {
    const { jws } = await signCredential(achievementCredential());
    // Publish an unrelated key under the same kid — the signature must not verify.
    const { publicKey: wrongPublic } = await generateKeyPair(ALG, { extractable: true });
    const wrongJwk = { ...(await exportJWK(wrongPublic)), kid: KID, alg: ALG, use: "sig" };
    const result = await verifyCredential(jws, { keyResolver: keyResolverFor({ kid: KID, publicJwk: wrongJwk }) });

    expect(result.verdict).toBe("invalid");
    expect(result.signature.state).toBe("invalid");
  });

  test("an unresolvable key is unverifiable, not invalid", async () => {
    const { jws } = await signCredential(achievementCredential());
    const result = await verifyCredential(jws, { keyResolver: keyResolverFor() });

    expect(result.verdict).toBe("unverifiable");
    expect(result.signature.state).toBe("unverifiable");
    // The unverified body is still surfaced for display context.
    expect(result.issuer.id).toBe(ISSUER);
  });

  test("a malformed compact JWS is unverifiable", async () => {
    const result = await verifyCredential("not.a.jws", { keyResolver: keyResolverFor() });
    expect(result.verdict).toBe("unverifiable");
    expect(result.signature.state).toBe("unverifiable");
  });

  test("an embedded Data Integrity proof is reported unverifiable until slice 2", async () => {
    const result = await verifyCredential(achievementCredential({ proof: { type: "DataIntegrityProof" } }), {
      keyResolver: keyResolverFor(),
    });
    expect(result.verdict).toBe("unverifiable");
    expect(result.reasons.join(" ")).toContain("Data Integrity");
  });
});

describe("validity window", () => {
  test("accepts VC 1.1 legacy issuanceDate/expirationDate names", () => {
    const window = evaluateValidityWindow(
      { issuanceDate: "2020-01-01T00:00:00Z", expirationDate: "2021-01-01T00:00:00Z" },
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(window.state).toBe("expired");
    expect(window.validUntil).toBe("2021-01-01T00:00:00Z");
  });

  test("both bounds absent is unbounded", () => {
    expect(evaluateValidityWindow({}).state).toBe("unbounded");
  });
});

describe("deriveVerdict rollup", () => {
  const validSig = { state: "valid", mechanism: "vc-jose", verificationKeyId: KID } as const;

  test("an unfetchable status list leaves the credential unverifiable", () => {
    expect(
      deriveVerdict({
        signature: validSig,
        validityWindow: { state: "valid" },
        revocation: { state: "unknown" },
        schema: { state: "not-checked" },
      }),
    ).toBe("unverifiable");
  });

  test("a revoked credential is invalid even when authentic and in-window", () => {
    expect(
      deriveVerdict({
        signature: validSig,
        validityWindow: { state: "valid" },
        revocation: { state: "revoked" },
        schema: { state: "valid" },
      }),
    ).toBe("invalid");
  });
});
