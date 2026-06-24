// The verification orchestrator. Detects the securing mechanism, runs the proof check,
// evaluates the validity window, and (slices 3+) status + schema, then rolls the axes into
// a single verdict. Pure: all I/O is via the injected resolvers.

import { verifyJoseCredential } from "./jose";
import type { KeyResolver, StatusResolver, DocumentLoader } from "./resolvers";
import { deriveVerdict, type CredentialVerificationResult, type SchemaCheck } from "./result";
import { evaluateValidityWindow } from "./validity";

export type VerifyDeps = {
  keyResolver: KeyResolver;
  /** Optional until slice 3 — without it, revocation is reported `not-checked`. */
  statusResolver?: StatusResolver;
  /** Required only for Data Integrity (`di-*`) canonicalization. */
  documentLoader?: DocumentLoader;
  /** Clock injection for deterministic window tests. */
  now?: Date;
};

/**
 * A credential to verify. A string is treated as a compact JWS (enveloping VC-JOSE); an
 * object is treated as a JSON-LD credential carrying an embedded Data Integrity `proof`.
 */
export type CredentialInput = string | Record<string, unknown>;

const NOT_CHECKED_SCHEMA: SchemaCheck = { state: "not-checked" };

function hasEmbeddedProof(input: Record<string, unknown>): boolean {
  return "proof" in input && input["proof"] !== undefined && input["proof"] !== null;
}

export async function verifyCredential(
  input: CredentialInput,
  deps: VerifyDeps,
): Promise<CredentialVerificationResult> {
  if (typeof input === "string") {
    return await verifyJose(input, deps);
  }
  if (hasEmbeddedProof(input)) {
    // Data Integrity (eddsa-rdfc-2022) lands in slice 2; until then it is honestly
    // reported as unevaluable rather than silently passed.
    return {
      verdict: "unverifiable",
      signature: {
        state: "unverifiable",
        reason: "Embedded Data Integrity proof verification is not yet available in this build.",
      },
      validityWindow: evaluateValidityWindow(input, deps.now),
      revocation: { state: "not-checked" },
      schema: NOT_CHECKED_SCHEMA,
      issuer: readIssuer(input),
      credential: input,
      reasons: ["Embedded Data Integrity proof (di-*) verification is not yet supported."],
    };
  }
  return {
    verdict: "unverifiable",
    signature: { state: "unverifiable", reason: "No securing mechanism found: not a compact JWS and no `proof`." },
    validityWindow: evaluateValidityWindow(input, deps.now),
    revocation: { state: "not-checked" },
    schema: NOT_CHECKED_SCHEMA,
    issuer: readIssuer(input),
    credential: input,
    reasons: ["The input carries neither an enveloping JOSE proof nor an embedded Data Integrity proof."],
  };
}

async function verifyJose(jws: string, deps: VerifyDeps): Promise<CredentialVerificationResult> {
  const jose = await verifyJoseCredential(jws, deps.keyResolver);
  const body = jose.credential ?? {};
  const validityWindow = evaluateValidityWindow(body, deps.now);
  const revocation = { state: "not-checked" as const };
  const schema = NOT_CHECKED_SCHEMA;

  const verdict = deriveVerdict({ signature: jose.signature, validityWindow, revocation, schema });

  return {
    verdict,
    signature: jose.signature,
    validityWindow,
    revocation,
    schema,
    issuer: { resolved: jose.signature.state === "valid", ...(jose.issuerId ? { id: jose.issuerId } : {}) },
    ...(jose.credential ? { credential: jose.credential } : {}),
    reasons: buildReasons(jose.signature, validityWindow),
  };
}

function buildReasons(
  signature: CredentialVerificationResult["signature"],
  validityWindow: CredentialVerificationResult["validityWindow"],
): string[] {
  const reasons: string[] = [];
  if (signature.state === "unverifiable") {
    reasons.push(signature.reason);
  } else if (signature.state === "invalid") {
    reasons.push(`Signature did not verify: ${signature.reason}`);
  }
  if (validityWindow.state === "expired") {
    reasons.push(`Credential expired (validUntil=${validityWindow.validUntil ?? "?"}).`);
  } else if (validityWindow.state === "not-yet-valid") {
    reasons.push(`Credential is not yet valid (validFrom=${validityWindow.validFrom ?? "?"}).`);
  }
  return reasons;
}

function readIssuer(body: Record<string, unknown>): { id?: string; resolved: boolean } {
  const issuer = body["issuer"];
  if (typeof issuer === "string") {
    return { id: issuer, resolved: false };
  }
  if (typeof issuer === "object" && issuer !== null) {
    const id = (issuer as Record<string, unknown>)["id"];
    return typeof id === "string" ? { id, resolved: false } : { resolved: false };
  }
  return { resolved: false };
}
