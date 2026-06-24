import { describe, expect, test } from "bun:test";

import { CompactSign, exportJWK, generateKeyPair, type JWK } from "jose";

import {
  conformedSchemaValidator,
  evaluateRevocation,
  verifyCredential,
  type KeyResolver,
  type SchemaValidator,
  type StatusResolver,
  type VerificationKey,
} from "../src/index";

const ALG = "EdDSA";
const KID = "https://issuer.example/keys/1";
const ISSUER = "https://issuer.example";

async function signedCredential(body: Record<string, unknown>): Promise<{ jws: string; publicJwk: JWK }> {
  const { publicKey, privateKey } = await generateKeyPair(ALG, { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid: KID, alg: ALG, use: "sig" };
  const jws = await new CompactSign(new TextEncoder().encode(JSON.stringify(body)))
    .setProtectedHeader({ alg: ALG, kid: KID })
    .sign(privateKey);
  return { jws, publicJwk };
}

function keyResolverFor(publicJwk: JWK): KeyResolver {
  return {
    async resolveKey(): Promise<VerificationKey | null> {
      return { publicJwk: publicJwk as Record<string, unknown>, keyId: KID, controller: ISSUER };
    },
  };
}

function credentialWithStatus(): Record<string, unknown> {
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    issuer: ISSUER,
    validFrom: "2020-01-01T00:00:00Z",
    credentialStatus: {
      id: "https://issuer.example/status/1#94567",
      type: "BitstringStatusListEntry",
      statusPurpose: "revocation",
      statusListIndex: "94567",
      statusListCredential: "https://issuer.example/status/1",
    },
    credentialSubject: { id: "did:example:learner" },
  };
}

const statusResolverReturning = (state: "active" | "revoked" | "suspended" | "unknown"): StatusResolver => ({
  async resolveStatus() {
    return { state };
  },
});

describe("revocation evaluation", () => {
  test("no credentialStatus entry → not-checked", async () => {
    expect((await evaluateRevocation({ type: ["VerifiableCredential"] })).state).toBe("not-checked");
  });

  test("credentialStatus present but no resolver → unknown (cannot assert non-revocation)", async () => {
    const result = await evaluateRevocation(credentialWithStatus());
    expect(result.state).toBe("unknown");
    expect(result.statusType).toBe("BitstringStatusListEntry");
  });

  test("resolver result is surfaced (revoked / suspended / active)", async () => {
    expect((await evaluateRevocation(credentialWithStatus(), statusResolverReturning("revoked"))).state).toBe(
      "revoked",
    );
    expect((await evaluateRevocation(credentialWithStatus(), statusResolverReturning("suspended"))).state).toBe(
      "suspended",
    );
    expect((await evaluateRevocation(credentialWithStatus(), statusResolverReturning("active"))).state).toBe("active");
  });

  test("a throwing resolver fails safe to unknown", async () => {
    const throwing: StatusResolver = {
      async resolveStatus() {
        throw new Error("status list 503");
      },
    };
    const result = await evaluateRevocation(credentialWithStatus(), throwing);
    expect(result.state).toBe("unknown");
    expect(result.reason).toContain("503");
  });
});

describe("verifyCredential with status + schema wired", () => {
  test("an authentic but revoked credential is invalid", async () => {
    const { jws, publicJwk } = await signedCredential(credentialWithStatus());
    const result = await verifyCredential(jws, {
      keyResolver: keyResolverFor(publicJwk),
      statusResolver: statusResolverReturning("revoked"),
    });

    expect(result.verdict).toBe("invalid");
    expect(result.signature.state).toBe("valid");
    expect(result.revocation.state).toBe("revoked");
    expect(result.reasons.join(" ")).toContain("revoked");
  });

  test("an authentic credential with an uncheckable status is unverifiable", async () => {
    const { jws, publicJwk } = await signedCredential(credentialWithStatus());
    const result = await verifyCredential(jws, { keyResolver: keyResolverFor(publicJwk) });

    expect(result.verdict).toBe("unverifiable");
    expect(result.revocation.state).toBe("unknown");
  });

  test("an authentic, active, schema-valid credential verifies", async () => {
    const { jws, publicJwk } = await signedCredential(credentialWithStatus());
    const result = await verifyCredential(jws, {
      keyResolver: keyResolverFor(publicJwk),
      statusResolver: statusResolverReturning("active"),
      schemaValidator: passingSchemaValidator,
    });

    expect(result.verdict).toBe("verified");
    expect(result.revocation.state).toBe("active");
    expect(result.schema.state).toBe("valid");
  });

  test("a schema-invalid credential is invalid even when authentic and active", async () => {
    const { jws, publicJwk } = await signedCredential(credentialWithStatus());
    const result = await verifyCredential(jws, {
      keyResolver: keyResolverFor(publicJwk),
      statusResolver: statusResolverReturning("active"),
      schemaValidator: failingSchemaValidator,
    });

    expect(result.verdict).toBe("invalid");
    expect(result.signature.state).toBe("valid");
    expect(result.schema.state).toBe("invalid");
    expect(result.reasons.join(" ")).toContain("schema");
  });
});

const passingSchemaValidator: SchemaValidator = { validate: () => ({ state: "valid", schema: "OpenBadgeCredential" }) };
const failingSchemaValidator: SchemaValidator = {
  validate: () => ({ state: "invalid", schema: "OpenBadgeCredential", issues: ["name: Required"] }),
};

describe("conformedSchemaValidator (real conform-ed schemas)", () => {
  test("selects a credential's most specific schema and rejects a malformed body", () => {
    // A bare object missing every required VC field must fail the VerifiableCredential schema.
    const result = conformedSchemaValidator.validate({ type: ["VerifiableCredential"] });
    expect(result.state).toBe("invalid");
    expect(result.schema).toBe("VerifiableCredential");
    expect(result.issues?.length ?? 0).toBeGreaterThan(0);
  });
});
