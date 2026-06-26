// verifyEdc — the EDC verification orchestrator (conform-ed ADR-0019 §3). An EDC is a W3C VC
// sealed with a JAdES e-seal, so its trust state has independent axes the displayer must show
// separately (cf. result.ts for the OB/CLR analogue): is the e-seal cryptographically intact,
// does it chain to a trusted EU anchor, is the credential SHACL-valid, is it inside its validity
// window, and has the issuer revoked it. This composes the existing primitives — verifyJadesSeal +
// validateAgainstProfile + evaluateValidityWindow + evaluateRevocation — into one EdcVerdict, so a
// host (e.g. a wallet/displayer) calls one function instead of wiring four. Pure and offline: trust
// anchors and the status resolver are host-injected, exactly as the primitives require.

import {
  extractSealedCredential,
  isSealedEdc,
  type SealedEdc,
  type SealVerdict,
  type SealVerifyOptions,
  verifyJadesSeal,
} from "./jades";
import type { DocumentLoader, StatusResolver } from "./resolvers";
import type { RevocationCheck, ValidityWindow, VerificationVerdict } from "./result";
import { type ShaclReport, validateAgainstProfile } from "./shacl-validate";
import { evaluateRevocation } from "./status";
import { evaluateValidityWindow } from "./validity";

export interface VerifyEdcOptions extends SealVerifyOptions {
  /**
   * The EDC profile's SHACL shape graph(s) as Turtle — the vendored `owl:imports` closure
   * (typically `edc-generic-full`). The caller supplies the conform-ed vendored set.
   */
  readonly shapes: readonly string[];
  /** Offline JSON-LD context loader for the SHACL step; defaults to the bundled no-network loader. */
  readonly documentLoader?: DocumentLoader;
  /** `@context` injected when the credential omits it; defaults to the EDC default context. */
  readonly defaultContext?: unknown;
  /** Resolves `credentialStatus`; without it a status-bearing EDC is `unknown` → unverifiable. */
  readonly statusResolver?: StatusResolver;
  /** Clock for the validity-window axis (deterministic tests). */
  readonly now?: Date;
}

export interface EdcVerdict {
  /** The single rollup a simple consumer can switch on. */
  readonly verdict: VerificationVerdict;
  /** The JAdES e-seal check (per-signature: signature, x5c chain, RFC-3161 timestamps). */
  readonly seal: SealVerdict;
  /** The seal is cryptographically intact: at least one signature, and every signature verified. */
  readonly sealIntact: boolean;
  /**
   * Whether the seal chains to an injected EU trust anchor. It is `false` — and the rollup
   * `verdict` is NOT downgraded — whenever no anchors were supplied: the host owns the EU
   * Trusted-List decision, so an intact-but-unanchored EDC reports `verified` + `trustAnchored:false`
   * ("seal intact, EU-qualified trust not verified"), never a misleading "verified & trusted".
   */
  readonly trustAnchored: boolean;
  /** SHACL structural conformance of the sealed credential against the EDC profile shapes. */
  readonly structure: ShaclReport;
  readonly validityWindow: ValidityWindow;
  readonly revocation: RevocationCheck;
  readonly issuer: { readonly id?: string; readonly resolved: boolean };
  /** The credential carried in the seal payload, for rendering. */
  readonly credential?: Record<string, unknown>;
  /** Human-readable lines explaining the verdict, most-significant concern first. */
  readonly reasons: readonly string[];
}

/**
 * Verify a sealed EDC end-to-end. `input` is the JAdES delivery envelope (`{ payload, signatures }`),
 * i.e. the parsed `.json`/`.jsonld` a learner receives. A non-sealed input is reported `unverifiable`.
 */
export async function verifyEdc(input: unknown, options: VerifyEdcOptions): Promise<EdcVerdict> {
  if (!isSealedEdc(input)) {
    return notSealed();
  }
  const sealed: SealedEdc = input;

  const seal = verifyJadesSeal(sealed, options);
  const sealIntact = seal.signatureCount > 0 && seal.allSignaturesValid;
  const trustAnchored = seal.signatureCount > 0 && seal.signatures.every((s) => s.chain.trust === "trusted");

  const credential = readCredential(sealed);
  const body = credential ?? {};

  const structure = await validateAgainstProfile(body, {
    shapes: options.shapes,
    ...(options.documentLoader ? { documentLoader: options.documentLoader } : {}),
    ...(options.defaultContext !== undefined ? { defaultContext: options.defaultContext } : {}),
  });
  const validityWindow = evaluateValidityWindow(body, options.now);
  const revocation = await evaluateRevocation(body, options.statusResolver);

  const verdict = deriveEdcVerdict({ seal, sealIntact, structure, validityWindow, revocation });
  const { id: issuerId } = issuerOf(body);

  return {
    verdict,
    seal,
    sealIntact,
    trustAnchored,
    structure,
    validityWindow,
    revocation,
    issuer: { resolved: sealIntact, ...(issuerId ? { id: issuerId } : {}) },
    ...(credential ? { credential } : {}),
    reasons: buildReasons({ seal, sealIntact, trustAnchored, structure, validityWindow, revocation }),
  };
}

/**
 * Roll the independent axes into the single `verdict`. A missing seal is `unverifiable`; a present
 * seal that fails is `invalid`. Trust anchoring is deliberately NOT a factor (it is host-injected and
 * reported separately). Otherwise the credential is `verified` only if intact, inside its window, not
 * revoked/suspended, and SHACL-conformant.
 */
export function deriveEdcVerdict(input: {
  seal: SealVerdict;
  sealIntact: boolean;
  structure: ShaclReport;
  validityWindow: ValidityWindow;
  revocation: RevocationCheck;
}): VerificationVerdict {
  if (input.seal.signatureCount === 0) {
    return "unverifiable";
  }
  if (!input.sealIntact) {
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
  if (!input.structure.conforms) {
    return "invalid";
  }
  return "verified";
}

function readCredential(sealed: SealedEdc): Record<string, unknown> | undefined {
  try {
    const extracted = extractSealedCredential(sealed);
    return typeof extracted === "object" && extracted !== null ? (extracted as Record<string, unknown>) : undefined;
  } catch {
    return undefined; // malformed seal payload — the seal check already reports the failure
  }
}

function issuerOf(body: Record<string, unknown>): { id?: string } {
  const issuer = body["issuer"];
  if (typeof issuer === "string") {
    return { id: issuer };
  }
  if (typeof issuer === "object" && issuer !== null) {
    const id = (issuer as Record<string, unknown>)["id"];
    return typeof id === "string" ? { id } : {};
  }
  return {};
}

function notSealed(): EdcVerdict {
  return {
    verdict: "unverifiable",
    seal: { signatureCount: 0, signatures: [], allSignaturesValid: false },
    sealIntact: false,
    trustAnchored: false,
    structure: { conforms: false, violations: [{ message: "Input is not a sealed EDC; no credential to validate." }] },
    validityWindow: { state: "unbounded" },
    revocation: { state: "not-checked" },
    issuer: { resolved: false },
    reasons: ["Input is not a sealed EDC ({ payload, signatures }) — nothing to verify."],
  };
}

function buildReasons(input: {
  seal: SealVerdict;
  sealIntact: boolean;
  trustAnchored: boolean;
  structure: ShaclReport;
  validityWindow: ValidityWindow;
  revocation: RevocationCheck;
}): string[] {
  const reasons: string[] = [];
  if (input.seal.signatureCount === 0) {
    reasons.push("No JAdES e-seal present — nothing to verify.");
  } else if (!input.sealIntact) {
    reasons.push("JAdES e-seal did not verify — the credential is tampered or the signature/chain is broken.");
  } else if (!input.trustAnchored) {
    reasons.push(
      "Seal is cryptographically intact, but EU-qualified trust is not verified (no trust anchor supplied).",
    );
  }
  if (input.validityWindow.state === "expired") {
    reasons.push(`Credential expired (validUntil=${input.validityWindow.validUntil ?? "?"}).`);
  } else if (input.validityWindow.state === "not-yet-valid") {
    reasons.push(`Credential is not yet valid (validFrom=${input.validityWindow.validFrom ?? "?"}).`);
  }
  if (input.revocation.state === "revoked" || input.revocation.state === "suspended") {
    reasons.push(
      `Credential ${input.revocation.state} by its issuer${input.revocation.reason ? `: ${input.revocation.reason}` : "."}`,
    );
  } else if (input.revocation.state === "unknown") {
    reasons.push(input.revocation.reason ?? "Revocation status could not be determined.");
  }
  if (input.seal.signatureCount > 0 && !input.structure.conforms) {
    reasons.push(`Credential failed EDC SHACL validation (${input.structure.violations.length} violation(s)).`);
  }
  return reasons;
}
