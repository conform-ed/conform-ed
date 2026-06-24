// Enveloping VC-JOSE verification (W3C VC 2.0 §"Securing with JOSE"; OB 3.0 / CLR 2.0
// VC-JWT proof format). The credential is the compact-JWS payload; EdDSA/Ed25519 is the
// one curve emergent and most modern 1EdTech issuers use. This is the exact inverse of an
// enveloping signer: read the protected-header `kid` and the unverified issuer to select a
// key, resolve it, then `compactVerify`. The body is only trusted after verification.

import { compactVerify, decodeProtectedHeader, importJWK } from "jose";

import type { KeyResolver } from "./resolvers";
import type { ProofVerification } from "./result";

const SIGNING_ALG = "EdDSA";

function base64UrlToString(segment: string): string {
  return new TextDecoder().decode(Uint8Array.from(Buffer.from(segment, "base64url")));
}

/** Read the credential body out of a compact JWS without verifying (key selection only). */
function decodeUnverifiedBody(jws: string): Record<string, unknown> | undefined {
  const segments = jws.split(".");
  if (segments.length !== 3 || !segments[1]) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(base64UrlToString(segments[1]));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function readIssuerId(body: Record<string, unknown> | undefined): string | undefined {
  const issuer = body?.["issuer"];
  if (typeof issuer === "string") {
    return issuer;
  }
  if (typeof issuer === "object" && issuer !== null) {
    const id = (issuer as Record<string, unknown>)["id"];
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

/**
 * Verify a compact-JWS (enveloping VC-JOSE) credential. Returns a `SignatureCheck` plus the
 * decoded body; never throws for an attacker-controlled input — a malformed token, missing
 * key, or bad signature all resolve to an `invalid`/`unverifiable` check.
 */
export async function verifyJoseCredential(jws: string, keyResolver: KeyResolver): Promise<ProofVerification> {
  const body = decodeUnverifiedBody(jws);
  const issuerId = readIssuerId(body);

  let kid: string | undefined;
  try {
    const header = decodeProtectedHeader(jws);
    kid = typeof header.kid === "string" ? header.kid : undefined;
  } catch {
    return {
      signature: { state: "unverifiable", reason: "Malformed compact JWS: protected header is not decodable." },
    };
  }

  const resolved = await keyResolver.resolveKey({
    mechanism: "vc-jose",
    ...(issuerId ? { issuer: issuerId } : {}),
    ...(kid ? { kid } : {}),
  });
  if (!resolved) {
    return {
      signature: {
        state: "unverifiable",
        reason: `No verification key resolved for kid='${kid ?? "(none)"}' issuer='${issuerId ?? "(none)"}'.`,
      },
      ...(body ? { credential: body } : {}),
      ...(issuerId ? { issuerId } : {}),
    };
  }

  try {
    const key = await importJWK(resolved.publicJwk, SIGNING_ALG);
    const { payload } = await compactVerify(jws, key);
    const verifiedBody = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
    return {
      signature: { state: "valid", mechanism: "vc-jose", verificationKeyId: resolved.keyId },
      credential: verifiedBody,
      ...(readIssuerId(verifiedBody) ? { issuerId: readIssuerId(verifiedBody)! } : {}),
    };
  } catch (error) {
    return {
      signature: {
        state: "invalid",
        mechanism: "vc-jose",
        reason: error instanceof Error ? error.message : "Signature verification failed.",
      },
      ...(body ? { credential: body } : {}),
      ...(issuerId ? { issuerId } : {}),
    };
  }
}
