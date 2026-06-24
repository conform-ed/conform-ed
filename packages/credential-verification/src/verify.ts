// The verification orchestrator. Detects the securing mechanism (enveloping VC-JOSE vs
// embedded Data Integrity), runs the proof check, evaluates the validity window, and
// (slice 3) status + schema, then rolls the axes into a single verdict. Pure: all I/O is
// via the injected resolvers.

import { verifyDataIntegrityCredential } from "./data-integrity";
import { staticDocumentLoader } from "./document-loader";
import { verifyJoseCredential } from "./jose";
import type { DocumentLoader, KeyResolver, StatusResolver } from "./resolvers";
import { deriveVerdict, type CredentialVerificationResult, type ProofVerification, type SchemaCheck } from "./result";
import { evaluateValidityWindow } from "./validity";

export type VerifyDeps = {
  keyResolver: KeyResolver;
  /** Optional until slice 3 — without it, revocation is reported `not-checked`. */
  statusResolver?: StatusResolver;
  /** JSON-LD context loader for Data Integrity (`di-*`); defaults to the vendored, no-network loader. */
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
    return assembleResult(await verifyJoseCredential(input, deps.keyResolver), deps);
  }
  if (hasEmbeddedProof(input)) {
    const documentLoader = deps.documentLoader ?? staticDocumentLoader;
    return assembleResult(await verifyDataIntegrityCredential(input, deps.keyResolver, documentLoader), deps);
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

/** Assemble the multi-axis result around a completed proof check (shared by both mechanisms). */
function assembleResult(proof: ProofVerification, deps: VerifyDeps): CredentialVerificationResult {
  const body = proof.credential ?? {};
  const validityWindow = evaluateValidityWindow(body, deps.now);
  // Revocation (status list) + schema validation land in slice 3.
  const revocation = { state: "not-checked" as const };
  const schema = NOT_CHECKED_SCHEMA;

  const verdict = deriveVerdict({ signature: proof.signature, validityWindow, revocation, schema });

  return {
    verdict,
    signature: proof.signature,
    validityWindow,
    revocation,
    schema,
    issuer: { resolved: proof.signature.state === "valid", ...(proof.issuerId ? { id: proof.issuerId } : {}) },
    ...(proof.credential ? { credential: proof.credential } : {}),
    reasons: buildReasons(proof.signature, validityWindow),
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
