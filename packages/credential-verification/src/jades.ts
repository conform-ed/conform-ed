// JAdES e-seal verification for EDC (conform-ed ADR-0019 §4). An EDC is sealed with a JAdES
// JWS JSON serialization: `{ payload, signatures: [...] }`, where `b64:false` (RFC-7797) means
// `payload` is the literal credential JSON-LD (not base64). We verify, cryptographically and
// offline: the JWS signature over the RFC-7797 detached signing input; the x5c chain validity
// at a (pinnable) verification time against a host-injected trust anchor; and the RFC-3161
// `adoTst` timestamp token(s). The trust-root and eIDAS "qualified" decisions are injected.

import { verify as cryptoVerify, X509Certificate } from "node:crypto";

import { type TimestampResult, verifyTimestampToken } from "./rfc3161";
import { type ChainResult, type ChainVerifyOptions, verifyChain } from "./x509-chain";

export interface JadesSignature {
  readonly protected: string;
  readonly signature: string;
  readonly header?: unknown;
}

/** The JAdES JSON-serialization delivery envelope of a sealed EDC. */
export interface SealedEdc {
  readonly payload: string;
  readonly signatures: readonly JadesSignature[];
}

export function isSealedEdc(value: unknown): value is SealedEdc {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { payload?: unknown }).payload === "string" &&
    Array.isArray((value as { signatures?: unknown }).signatures)
  );
}

/** The issued credential carried in the seal's `payload` (RFC-7797 b64:false → literal JSON). */
export function extractSealedCredential(sealed: SealedEdc): unknown {
  return JSON.parse(sealed.payload);
}

/** JWS `alg` → node digest name. RSA family covers the EU EDC examples (RS256). */
const JWS_DIGEST: Readonly<Record<string, string>> = {
  RS256: "RSA-SHA256",
  RS384: "RSA-SHA384",
  RS512: "RSA-SHA512",
  PS256: "RSA-SHA256",
  PS384: "RSA-SHA384",
  PS512: "RSA-SHA512",
  ES256: "sha256",
  ES384: "sha384",
  ES512: "sha512",
};

export interface SealVerifyOptions extends ChainVerifyOptions {
  /** Verify the RFC-3161 `adoTst` timestamp token(s); defaults to true. */
  readonly checkTimestamps?: boolean;
}

export interface SignatureVerdict {
  readonly algorithm: string;
  /** The JWS signature verifies over the RFC-7797 detached signing input via x5c[0]. */
  readonly signatureValid: boolean;
  readonly signingTime?: string;
  readonly chain: ChainResult;
  readonly timestamps: readonly TimestampResult[];
  readonly errors: readonly string[];
}

export interface SealVerdict {
  readonly signatureCount: number;
  readonly signatures: readonly SignatureVerdict[];
  /** Every signature's cryptographic check passed (chain trust is reported per-signature). */
  readonly allSignaturesValid: boolean;
}

interface ProtectedHeader {
  readonly alg?: string;
  readonly b64?: boolean;
  readonly x5c?: readonly string[];
  readonly sigT?: string;
  readonly adoTst?: { readonly tstTokens?: ReadonlyArray<{ readonly val?: string }> };
}

function decodeProtected(protectedB64: string): ProtectedHeader {
  return JSON.parse(Buffer.from(protectedB64, "base64url").toString("utf8")) as ProtectedHeader;
}

/**
 * RFC-7797 signing input: `ASCII(protected) || '.' || payload`. EDC seals are `b64:false`,
 * so the credential `payload` bytes are appended raw (not base64url-encoded).
 */
function signingInput(protectedB64: string, payload: string): Buffer {
  return Buffer.concat([Buffer.from(`${protectedB64}.`, "ascii"), Buffer.from(payload, "utf8")]);
}

function verifySignature(sealed: SealedEdc, sig: JadesSignature, options: SealVerifyOptions): SignatureVerdict {
  const errors: string[] = [];
  const header = decodeProtected(sig.protected);
  const alg = header.alg ?? "";
  const digest = JWS_DIGEST[alg];
  const x5c = header.x5c ?? [];

  let signatureValid = false;
  if (digest === undefined) {
    errors.push(`unsupported JWS alg '${alg}'`);
  } else if (x5c.length === 0) {
    errors.push("no x5c signing certificate in protected header");
  } else {
    try {
      const cert = new X509Certificate(Buffer.from(x5c[0] as string, "base64"));
      const input = signingInput(sig.protected, sealed.payload);
      const sigBytes = Buffer.from(sig.signature, "base64url");
      const isEc = alg.startsWith("ES");
      signatureValid = cryptoVerify(
        digest,
        input,
        isEc ? { key: cert.publicKey, dsaEncoding: "ieee-p1363" } : cert.publicKey,
        sigBytes,
      );
      if (!signatureValid) errors.push("JWS signature does not verify against x5c[0]");
    } catch (e) {
      errors.push(`signature verification failed: ${String(e)}`);
    }
  }

  const chain = verifyChain(x5c, options);

  const timestamps: TimestampResult[] = [];
  if (options.checkTimestamps !== false) {
    for (const token of header.adoTst?.tstTokens ?? []) {
      if (typeof token.val === "string") {
        // adoTst is an all-data-objects timestamp: it covers the credential payload bytes.
        timestamps.push(verifyTimestampToken(token.val, Buffer.from(sealed.payload, "utf8")));
      }
    }
  }

  return {
    algorithm: alg,
    signatureValid,
    ...(header.sigT !== undefined ? { signingTime: header.sigT } : {}),
    chain,
    timestamps,
    errors,
  };
}

/** Verify all JAdES signatures on a sealed EDC. */
export function verifyJadesSeal(sealed: SealedEdc, options: SealVerifyOptions = {}): SealVerdict {
  const signatures = sealed.signatures.map((sig) => verifySignature(sealed, sig, options));
  return {
    signatureCount: signatures.length,
    signatures,
    allSignaturesValid: signatures.length > 0 && signatures.every((s) => s.signatureValid),
  };
}
