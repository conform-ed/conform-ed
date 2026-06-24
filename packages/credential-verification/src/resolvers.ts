// The injected I/O seam. The verification engine is a pure function of (credential,
// resolvers): every network/registry lookup a real verifier performs — fetching an
// issuer's public key from a JWKS or DID document, dereferencing a JSON-LD `@context`,
// fetching a status-list credential — is supplied by the host. This keeps the engine
// deterministic and offline-testable (drive it with in-memory vectors; the consumer wires
// the HTTP implementations), per the "interop proof = done" pattern.

import type { ProofMechanism } from "./result";

/** A resolved public key usable to verify a proof. */
export type VerificationKey = {
  /** OKP/Ed25519 public JWK. */
  publicJwk: Record<string, unknown>;
  /** The identifier the proof referenced (JWS `kid` or DI `verificationMethod`). */
  keyId: string;
  /** The DID/issuer that controls the key, when the resolver can assert it. */
  controller?: string;
};

/** What the engine knows about which key to ask for, before it has verified anything. */
export type KeyResolutionRequest = {
  mechanism: ProofMechanism;
  /** The credential's `issuer` id (string form), read from the unverified body. */
  issuer?: string;
  /** The compact-JWS protected-header `kid` (vc-jose). */
  kid?: string;
  /** The Data Integrity `proof.verificationMethod` — typically a DID URL (di-*). */
  verificationMethod?: string;
};

export interface KeyResolver {
  /** Resolve the public key for a proof, or `null` if it cannot be found. */
  resolveKey(request: KeyResolutionRequest): Promise<VerificationKey | null>;
}

/** The lifecycle state a status-list lookup reports for one credential. */
export type StatusLookupResult = {
  state: "active" | "revoked" | "suspended" | "unknown";
  reason?: string;
};

/** The `credentialStatus` entry, handed to the host to dereference and evaluate. */
export type StatusListRequest = {
  /** The `credentialStatus.type` (e.g. "BitstringStatusListEntry"). */
  type: string;
  /** The full `credentialStatus` object from the credential, verbatim. */
  entry: Record<string, unknown>;
};

export interface StatusResolver {
  resolveStatus(request: StatusListRequest): Promise<StatusLookupResult>;
}

/** A JSON-LD document loader (for Data Integrity canonicalization `@context` resolution). */
export type LoadedDocument = { documentUrl: string; document: unknown };

export interface DocumentLoader {
  load(url: string): Promise<LoadedDocument>;
}
