// X.509 chain handling for the JAdES e-seal (conform-ed ADR-0019 §4). The JWS protected
// header carries the signing certificate chain in `x5c`. We use node's built-in
// `crypto.X509Certificate` to parse it, validate the links and validity periods, and check
// the leaf against a HOST-INJECTED trust anchor set — the trust-root *decision* (and the
// eIDAS "qualified" status) is the host's, keeping the engine offline-deterministic.

import { X509Certificate } from "node:crypto";

export interface CertInfo {
  readonly subject: string;
  readonly issuer: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly fingerprint256: string;
}

export interface ChainVerifyOptions {
  /**
   * Certificates the host trusts (PEM or base64-DER), e.g. the eIDAS issuer/root CA. When
   * empty, trust is reported `unevaluated` (NOT untrusted) — the host owns the trust decision.
   */
  readonly trustAnchors?: readonly string[];
  /**
   * Time to evaluate validity at. Defaults to now; pin it (e.g. to the seal's `sigT`) to
   * validate historical certificates whose validity window has since closed.
   */
  readonly verificationTime?: Date;
}

export type TrustStatus = "trusted" | "untrusted" | "unevaluated";

export interface ChainResult {
  readonly leaf: CertInfo;
  /** verificationTime falls within every chain cert's validity window. */
  readonly validAtTime: boolean;
  /** Each x5c cert is issued by the next (where more than the leaf is present). */
  readonly chainLinksValid: boolean;
  /** Leaf chains to / equals an injected trust anchor; `unevaluated` when none supplied. */
  readonly trust: TrustStatus;
  readonly errors: readonly string[];
}

function toCert(certB64OrPem: string): X509Certificate {
  const trimmed = certB64OrPem.trim();
  if (trimmed.includes("BEGIN CERTIFICATE")) return new X509Certificate(trimmed);
  return new X509Certificate(Buffer.from(trimmed, "base64"));
}

function info(cert: X509Certificate): CertInfo {
  return {
    subject: cert.subject.replace(/\n/g, ", "),
    issuer: cert.issuer.replace(/\n/g, ", "),
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    fingerprint256: cert.fingerprint256,
  };
}

/** Parse the `x5c` header value (array of base64-DER certs) into X509Certificates. */
export function parseX5c(x5c: readonly string[]): X509Certificate[] {
  return x5c.map((c) => new X509Certificate(Buffer.from(c, "base64")));
}

export function verifyChain(x5c: readonly string[], options: ChainVerifyOptions = {}): ChainResult {
  const errors: string[] = [];
  const certs = parseX5c(x5c);
  const leaf = certs[0];
  if (leaf === undefined) {
    return {
      leaf: { subject: "", issuer: "", validFrom: "", validTo: "", fingerprint256: "" },
      validAtTime: false,
      chainLinksValid: false,
      trust: "unevaluated",
      errors: ["x5c is empty — no signing certificate"],
    };
  }

  const at = options.verificationTime ?? new Date();
  let validAtTime = true;
  for (const cert of certs) {
    if (at < new Date(cert.validFrom) || at > new Date(cert.validTo)) {
      validAtTime = false;
      errors.push(`certificate '${cert.subject.replace(/\n/g, " ")}' not valid at ${at.toISOString()}`);
    }
  }

  // Verify each x5c link is issued+signed by the next (the EU examples ship only the leaf).
  let chainLinksValid = true;
  for (let i = 0; i < certs.length - 1; i += 1) {
    const child = certs[i];
    const parent = certs[i + 1];
    if (child === undefined || parent === undefined) continue;
    if (!child.checkIssued(parent) || !child.verify(parent.publicKey)) {
      chainLinksValid = false;
      errors.push(`x5c link ${i} not issued/signed by link ${i + 1}`);
    }
  }

  let trust: TrustStatus = "unevaluated";
  const anchors = options.trustAnchors ?? [];
  if (anchors.length > 0) {
    const anchorCerts = anchors.map(toCert);
    const top = certs[certs.length - 1] ?? leaf;
    trust = anchorCerts.some(
      (anchor) =>
        top.fingerprint256 === anchor.fingerprint256 ||
        (top.checkIssued(anchor) && top.verify(anchor.publicKey)) ||
        (leaf.checkIssued(anchor) && leaf.verify(anchor.publicKey)),
    )
      ? "trusted"
      : "untrusted";
    if (trust === "untrusted") errors.push("leaf does not chain to any injected trust anchor");
  }

  return { leaf: info(leaf), validAtTime, chainLinksValid, trust, errors };
}
