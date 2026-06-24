// The verification orchestrator. Detects the securing mechanism (enveloping VC-JOSE vs
// embedded Data Integrity), runs the proof check, then evaluates the validity window,
// revocation status and model schema, and rolls every axis into a single verdict. Pure:
// all I/O is via the injected resolvers.

import { verifyDataIntegrityCredential } from "./data-integrity";
import { staticDocumentLoader } from "./document-loader";
import { verifyJoseCredential } from "./jose";
import type { DocumentLoader, KeyResolver, SchemaValidator, StatusResolver } from "./resolvers";
import {
  deriveVerdict,
  type CredentialVerificationResult,
  type ProofVerification,
  type RevocationCheck,
  type SchemaCheck,
  type ValidityWindow,
} from "./result";
import { evaluateRevocation } from "./status";
import { evaluateValidityWindow } from "./validity";

export type VerifyDeps = {
  keyResolver: KeyResolver;
  /** Without it, a credential carrying a `credentialStatus` is `unknown` (→ unverifiable). */
  statusResolver?: StatusResolver;
  /** Opt-in model-schema validation; without it the schema axis is `not-checked`. */
  schemaValidator?: SchemaValidator;
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

function hasEmbeddedProof(input: Record<string, unknown>): boolean {
  return "proof" in input && input["proof"] !== undefined && input["proof"] !== null;
}

function issuerOf(body: Record<string, unknown>): { issuerId?: string } {
  const issuer = body["issuer"];
  if (typeof issuer === "string") {
    return { issuerId: issuer };
  }
  if (typeof issuer === "object" && issuer !== null) {
    const id = (issuer as Record<string, unknown>)["id"];
    return typeof id === "string" ? { issuerId: id } : {};
  }
  return {};
}

export async function verifyCredential(
  input: CredentialInput,
  deps: VerifyDeps,
): Promise<CredentialVerificationResult> {
  if (typeof input === "string") {
    return await assembleResult(await verifyJoseCredential(input, deps.keyResolver), deps);
  }
  if (hasEmbeddedProof(input)) {
    const documentLoader = deps.documentLoader ?? staticDocumentLoader;
    return await assembleResult(await verifyDataIntegrityCredential(input, deps.keyResolver, documentLoader), deps);
  }
  return await assembleResult(
    {
      signature: { state: "unverifiable", reason: "No securing mechanism found: not a compact JWS and no `proof`." },
      credential: input,
      ...issuerOf(input),
    },
    deps,
  );
}

/** Layer the validity / status / schema axes onto a completed proof check and roll the verdict. */
async function assembleResult(proof: ProofVerification, deps: VerifyDeps): Promise<CredentialVerificationResult> {
  const body = proof.credential ?? {};
  const validityWindow = evaluateValidityWindow(body, deps.now);
  const revocation = await evaluateRevocation(body, deps.statusResolver);
  const schema = evaluateSchema(body, deps);

  const verdict = deriveVerdict({ signature: proof.signature, validityWindow, revocation, schema });

  return {
    verdict,
    signature: proof.signature,
    validityWindow,
    revocation,
    schema,
    issuer: { resolved: proof.signature.state === "valid", ...(proof.issuerId ? { id: proof.issuerId } : {}) },
    ...(proof.credential ? { credential: proof.credential } : {}),
    reasons: buildReasons(proof.signature, validityWindow, revocation, schema),
  };
}

function evaluateSchema(body: Record<string, unknown>, deps: VerifyDeps): SchemaCheck {
  if (!deps.schemaValidator) {
    return { state: "not-checked" };
  }
  const validation = deps.schemaValidator.validate(body);
  return {
    state: validation.state,
    ...(validation.schema ? { schema: validation.schema } : {}),
    ...(validation.issues ? { issues: validation.issues } : {}),
  };
}

function buildReasons(
  signature: ProofVerification["signature"],
  validityWindow: ValidityWindow,
  revocation: RevocationCheck,
  schema: SchemaCheck,
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
  if (revocation.state === "revoked" || revocation.state === "suspended") {
    reasons.push(`Credential ${revocation.state} by its issuer${revocation.reason ? `: ${revocation.reason}` : "."}`);
  } else if (revocation.state === "unknown") {
    reasons.push(revocation.reason ?? "Revocation status could not be determined.");
  }
  if (schema.state === "invalid") {
    reasons.push(
      `Credential body failed the ${schema.schema ?? "model"} schema (${schema.issues?.length ?? 0} issue(s)).`,
    );
  }
  return reasons;
}
