// Embedded Data Integrity verification, cryptosuite `eddsa-rdfc-2022` (W3C VC-DI-EDDSA;
// the 1EdTech-named Data Integrity suite for OB 3.0 / CLR 2.0). The proof secures the
// credential in place via an Ed25519 signature over a hash of the RDF-canonicalized
// (URDNA2015 / RDFC-1.0) document and proof configuration:
//
//   transformedDocument   = canonize(document without `proof`)
//   canonicalProofConfig  = canonize(proof without `proofValue`, @context := document.@context)
//   hashData              = SHA-256(canonicalProofConfig) ‖ SHA-256(transformedDocument)
//   verify Ed25519(publicKey, hashData, multibaseDecode(proof.proofValue))
//
// All `@context` IRIs are resolved through the injected (vendored, no-network) document
// loader. Never throws on attacker input — every failure resolves to an invalid/unverifiable
// SignatureCheck.

import { createHash, createPublicKey, verify as nodeVerify } from "node:crypto";

import jsonld from "jsonld";

import { multibaseDecode } from "./base58";
import { staticDocumentLoader, toJsonLdDocumentLoader } from "./document-loader";
import type { DocumentLoader, KeyResolver } from "./resolvers";
import type { ProofVerification } from "./result";

export const EDDSA_RDFC_2022 = "eddsa-rdfc-2022";

// `JsonWebKey` is a DOM-lib global; this package targets ESNext without the DOM lib, so we
// reference node:crypto's own jwk-key input type rather than naming the global.
type CryptoKeyInput = Parameters<typeof createPublicKey>[0];

function sha256(input: string): Buffer {
  return createHash("sha256").update(input, "utf8").digest();
}

function unverifiable(reason: string, body: Record<string, unknown>): ProofVerification {
  return { signature: { state: "unverifiable", reason }, credential: body, ...issuerOf(body) };
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

type ProofSelection = { ok: true; proof: Record<string, unknown> } | { ok: false; reason: string };

/** Pick the eddsa-rdfc-2022 Data Integrity proof from a single proof or a proof set. */
function selectDataIntegrityProof(proof: unknown): ProofSelection {
  const candidates = Array.isArray(proof) ? proof : [proof];
  const dataIntegrityProofs = candidates.filter(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
  );
  const match = dataIntegrityProofs.find((entry) => entry["cryptosuite"] === EDDSA_RDFC_2022);
  if (match) {
    return { ok: true, proof: match };
  }
  const labelOf = (entry: Record<string, unknown>): string => {
    const suite = entry["cryptosuite"];
    const type = entry["type"];
    if (typeof suite === "string") {
      return suite;
    }
    return typeof type === "string" ? type : "?";
  };
  const seen = dataIntegrityProofs.map(labelOf).join(", ");
  return { ok: false, reason: `No ${EDDSA_RDFC_2022} proof present (found: ${seen || "none"}).` };
}

/**
 * RDF-canonicalize a JSON-LD document (URDNA2015 / RDFC-1.0) into sorted n-quads. Exposed so
 * a signer/test can produce inputs identical to what the verifier hashes. Defaults to the
 * vendored, no-network document loader.
 */
export async function canonicalizeDocument(
  document: Record<string, unknown>,
  loader: DocumentLoader = staticDocumentLoader,
): Promise<string> {
  // `safe: true` makes canonicalization fail closed on undefined terms rather than silently
  // dropping them — essential for a verifier (an attacker must not be able to add unsigned
  // fields). It is real in jsonld v9 but absent from the outdated @types, hence the assertion.
  const nquads: unknown = await jsonld.canonize(document, {
    algorithm: "URDNA2015",
    format: "application/n-quads",
    documentLoader: toJsonLdDocumentLoader(loader),
    safe: true,
  } as Parameters<typeof jsonld.canonize>[1]);
  return nquads as string;
}

/**
 * Verify an embedded `eddsa-rdfc-2022` Data Integrity proof on a JSON-LD credential.
 * `documentLoader` must serve every `@context` the credential references.
 */
export async function verifyDataIntegrityCredential(
  document: Record<string, unknown>,
  keyResolver: KeyResolver,
  documentLoader: DocumentLoader,
): Promise<ProofVerification> {
  const selected = selectDataIntegrityProof(document["proof"]);
  if (!selected.ok) {
    return unverifiable(selected.reason, document);
  }
  const proof = selected.proof;

  if (proof["type"] !== "DataIntegrityProof") {
    return unverifiable(`Unexpected proof.type '${String(proof["type"])}' (expected DataIntegrityProof).`, document);
  }
  const proofValue = proof["proofValue"];
  const verificationMethod = proof["verificationMethod"];
  if (typeof proofValue !== "string" || typeof verificationMethod !== "string") {
    return unverifiable("Proof is missing a string proofValue / verificationMethod.", document);
  }

  const resolved = await keyResolver.resolveKey({
    mechanism: "di-eddsa-rdfc-2022",
    verificationMethod,
    ...issuerOf(document),
  });
  if (!resolved) {
    return unverifiable(`No verification key resolved for verificationMethod='${verificationMethod}'.`, document);
  }

  // Build the canonical inputs. proofConfig is the proof options minus proofValue, carrying
  // the document's @context; the unsecured document is the credential minus its proof.
  const proofConfig: Record<string, unknown> = { ...proof, "@context": document["@context"] };
  delete proofConfig["proofValue"];
  const unsecuredDocument: Record<string, unknown> = { ...document };
  delete unsecuredDocument["proof"];

  let hashData: Buffer;
  try {
    const canonicalProofConfig = await canonicalizeDocument(proofConfig, documentLoader);
    const transformedDocument = await canonicalizeDocument(unsecuredDocument, documentLoader);
    hashData = Buffer.concat([sha256(canonicalProofConfig), sha256(transformedDocument)]);
  } catch (error) {
    return unverifiable(`Canonicalization failed: ${error instanceof Error ? error.message : String(error)}`, document);
  }

  try {
    const keyObject = createPublicKey({ key: resolved.publicJwk, format: "jwk" } as CryptoKeyInput);
    const signatureBytes = multibaseDecode(proofValue);
    const ok = nodeVerify(null, hashData, keyObject, signatureBytes);
    if (ok) {
      return {
        signature: { state: "valid", mechanism: "di-eddsa-rdfc-2022", verificationKeyId: resolved.keyId },
        credential: document,
        ...issuerOf(document),
      };
    }
    return {
      signature: { state: "invalid", mechanism: "di-eddsa-rdfc-2022", reason: "Ed25519 signature did not verify." },
      credential: document,
      ...issuerOf(document),
    };
  } catch (error) {
    return {
      signature: {
        state: "invalid",
        mechanism: "di-eddsa-rdfc-2022",
        reason: error instanceof Error ? error.message : "Signature verification failed.",
      },
      credential: document,
      ...issuerOf(document),
    };
  }
}
