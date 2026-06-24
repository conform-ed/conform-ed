// The structured verdict a Verifier/Displayer produces for a single credential.
//
// A credential's trust state has independent axes the displayer must show separately
// (OB 3.0 / CLR 2.0 displayer requirements OB-DSP-2..5): is the proof cryptographically
// authentic, is it inside its validity window, has the issuer revoked/suspended it, and
// does it satisfy its model schema. We keep each axis explicit and derive a single
// rollup `verdict` from them, so a consumer can render "authentic but expired" (signature
// valid + window expired) rather than a single opaque pass/fail.

/** The securing mechanism a proof was verified under (W3C VC 2.0 §"Securing Mechanisms"). */
export type ProofMechanism = "vc-jose" | "di-eddsa-rdfc-2022";

/** Cryptographic authenticity of the proof — independent of validity/revocation. */
export type SignatureCheck =
  | { state: "valid"; mechanism: ProofMechanism; verificationKeyId: string }
  | { state: "invalid"; mechanism: ProofMechanism; reason: string }
  // The proof could not be evaluated at all: no key resolved, or an unsupported cryptosuite.
  | { state: "unverifiable"; reason: string };

/** Where the credential sits relative to its validFrom/validUntil window. */
export type ValidityWindowState = "valid" | "expired" | "not-yet-valid" | "unbounded";

export type ValidityWindow = {
  state: ValidityWindowState;
  validFrom?: string;
  validUntil?: string;
};

/** Issuer-driven lifecycle, evaluated from the credential's `credentialStatus` entry. */
export type RevocationState = "active" | "revoked" | "suspended" | "unknown" | "not-checked";

export type RevocationCheck = {
  state: RevocationState;
  /** The `credentialStatus.type` evaluated, when present (e.g. BitstringStatusListEntry). */
  statusType?: string;
  reason?: string;
};

/** Conformance of the credential body to its model schema (OB/CLR/VC). */
export type SchemaCheck = {
  state: "valid" | "invalid" | "not-checked";
  /** The schema id/name the body was checked against, when checked. */
  schema?: string;
  issues?: string[];
};

/**
 * The output of a single proof check (VC-JOSE or Data Integrity), before the validity /
 * status / schema axes are layered on. Shared by both mechanisms.
 */
export type ProofVerification = {
  signature: SignatureCheck;
  /** The decoded credential body, present whenever it could be parsed (even if forged). */
  credential?: Record<string, unknown>;
  /** The `issuer` id read from the (unverified) body, for issuer reporting. */
  issuerId?: string;
};

/** The single rollup a simple consumer can switch on. */
export type VerificationVerdict =
  // Authentic, inside its window, not revoked/suspended, schema-valid (where checked).
  | "verified"
  // Cryptographically authentic but not currently usable (expired / not-yet-valid /
  // revoked / suspended) OR the body failed its schema OR the signature was forged.
  | "invalid"
  // Could not reach a trust decision (key unresolvable, unsupported proof suite, a
  // required status list could not be fetched).
  | "unverifiable";

export type CredentialVerificationResult = {
  verdict: VerificationVerdict;
  signature: SignatureCheck;
  validityWindow: ValidityWindow;
  revocation: RevocationCheck;
  schema: SchemaCheck;
  issuer: { id?: string; resolved: boolean };
  /** The decoded credential body (JOSE payload or the input document), for rendering. */
  credential?: Record<string, unknown>;
  /** Human-readable lines explaining the verdict, newest concern first. */
  reasons: string[];
};

/**
 * Roll the independent axes into the single `verdict`. A forged or unevaluable signature
 * dominates; otherwise an authentic credential is `verified` only if it is inside its
 * window, not revoked/suspended, and schema-valid where a schema was checked.
 */
export function deriveVerdict(input: {
  signature: SignatureCheck;
  validityWindow: ValidityWindow;
  revocation: RevocationCheck;
  schema: SchemaCheck;
}): VerificationVerdict {
  if (input.signature.state === "unverifiable") {
    return "unverifiable";
  }
  if (input.signature.state === "invalid") {
    return "invalid";
  }
  // A required status list that could not be fetched leaves us unable to assert non-revocation.
  if (input.revocation.state === "unknown") {
    return "unverifiable";
  }
  if (input.validityWindow.state === "expired" || input.validityWindow.state === "not-yet-valid") {
    return "invalid";
  }
  if (input.revocation.state === "revoked" || input.revocation.state === "suspended") {
    return "invalid";
  }
  if (input.schema.state === "invalid") {
    return "invalid";
  }
  return "verified";
}
