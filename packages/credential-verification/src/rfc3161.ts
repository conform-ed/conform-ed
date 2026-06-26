// RFC-3161 timestamp-token verification for the JAdES `adoTst` (conform-ed ADR-0019 §4).
// The EDC seal carries an ETSI timestamp token (a CMS SignedData over a TSTInfo) that binds
// the credential to a time. We parse it with pkijs/asn1js and verify cryptographically with
// node:crypto: (1) the token's message imprint covers the timestamped bytes (the credential
// payload — JAdES adoTst is an all-data-objects timestamp), and (2) the TSA's signature over
// the token is valid against its embedded TSU certificate. Trusting the TSA *root* is the
// host's injected decision; here we prove the token is authentic and what it covers.

import { createHash, createVerify, X509Certificate } from "node:crypto";

import * as asn1js from "asn1js";
import { ContentInfo, SignedData, TSTInfo } from "pkijs";

const HASH_OID: Readonly<Record<string, string>> = {
  "1.3.14.3.2.26": "sha1",
  "2.16.840.1.101.3.4.2.1": "sha256",
  "2.16.840.1.101.3.4.2.2": "sha384",
  "2.16.840.1.101.3.4.2.3": "sha512",
};

export interface TimestampResult {
  readonly parsed: boolean;
  readonly genTime?: string;
  readonly hashAlgorithm?: string;
  /** The token's message imprint equals hash(timestampedBytes) — it covers this credential. */
  readonly imprintMatches: boolean;
  /** The TSA's signature over the token verifies against its embedded TSU certificate. */
  readonly tsaSignatureValid: boolean;
  readonly tsaSubject?: string;
  /** genTime falls within the TSU certificate's validity window. */
  readonly tsaValidAtGenTime?: boolean;
  readonly errors: readonly string[];
}

function hexOf(view: { readonly valueBlock: { readonly valueHexView: Uint8Array } }): Buffer {
  return Buffer.from(view.valueBlock.valueHexView);
}

/** Verify an RFC-3161 timestamp token covers `timestampedBytes` and is TSA-signed. */
export function verifyTimestampToken(tokenDerBase64: string, timestampedBytes: Buffer): TimestampResult {
  const errors: string[] = [];
  let signedData: SignedData;
  let tstInfo: TSTInfo;
  try {
    const der = Buffer.from(tokenDerBase64, "base64");
    const contentInfo = new ContentInfo({ schema: asn1js.fromBER(der).result });
    signedData = new SignedData({ schema: contentInfo.content });
    const eContent = hexOf(signedData.encapContentInfo.eContent as never);
    tstInfo = new TSTInfo({ schema: asn1js.fromBER(eContent).result });
  } catch (e) {
    return { parsed: false, imprintMatches: false, tsaSignatureValid: false, errors: [`parse failed: ${String(e)}`] };
  }

  const genTime = tstInfo.genTime instanceof Date ? tstInfo.genTime.toISOString() : undefined;
  const oid = tstInfo.messageImprint.hashAlgorithm.algorithmId;
  const hashAlgorithm = HASH_OID[oid];
  let imprintMatches = false;
  if (hashAlgorithm === undefined) {
    errors.push(`unsupported imprint hash OID ${oid}`);
  } else {
    const imprint = hexOf(tstInfo.messageImprint.hashedMessage as never);
    imprintMatches = createHash(hashAlgorithm).update(timestampedBytes).digest().equals(imprint);
    if (!imprintMatches) errors.push("message imprint does not cover the timestamped bytes");
  }

  // Verify the TSA signature over the signed attributes against the embedded TSU certificate.
  let tsaSignatureValid = false;
  let tsaSubject: string | undefined;
  let tsaValidAtGenTime: boolean | undefined;
  try {
    const signer = signedData.signerInfos[0];
    if (signer === undefined) throw new Error("no signerInfo");
    const signerSerial = hexOf(signer.sid.serialNumber as never)
      .toString("hex")
      .toLowerCase();
    let signerCert: X509Certificate | undefined;
    for (const cert of signedData.certificates ?? []) {
      const x = new X509Certificate(
        Buffer.from((cert as { toSchema(): { toBER(sizeOnly?: boolean): ArrayBuffer } }).toSchema().toBER(false)),
      );
      if (x.serialNumber.toLowerCase() === signerSerial) signerCert = x;
    }
    if (signerCert === undefined) throw new Error("TSU certificate not found in token");
    tsaSubject = signerCert.subject.replace(/\n/g, ", ");
    if (genTime !== undefined) {
      const at = new Date(genTime);
      tsaValidAtGenTime = at >= new Date(signerCert.validFrom) && at <= new Date(signerCert.validTo);
    }

    // CMS signs the DER of signedAttrs re-tagged as an explicit SET OF (0x31).
    const attrs = Buffer.from(signer.signedAttrs?.toSchema().toBER(false) ?? new ArrayBuffer(0));
    if (attrs.length === 0) throw new Error("no signed attributes");
    attrs[0] = 0x31;
    const digest = HASH_OID[signer.digestAlgorithm.algorithmId] ?? "sha256";
    const sig = hexOf(signer.signature as never);
    const isEc = signerCert.publicKey.asymmetricKeyType === "ec";
    tsaSignatureValid = createVerify(digest)
      .update(attrs)
      .end()
      .verify(isEc ? { key: signerCert.publicKey, dsaEncoding: "der" } : signerCert.publicKey, sig);
    if (!tsaSignatureValid) errors.push("TSA signature does not verify");
  } catch (e) {
    errors.push(`TSA signature check failed: ${String(e)}`);
  }

  return {
    parsed: true,
    ...(genTime !== undefined ? { genTime } : {}),
    ...(hashAlgorithm !== undefined ? { hashAlgorithm } : {}),
    imprintMatches,
    tsaSignatureValid,
    ...(tsaSubject !== undefined ? { tsaSubject } : {}),
    ...(tsaValidAtGenTime !== undefined ? { tsaValidAtGenTime } : {}),
    errors,
  };
}
