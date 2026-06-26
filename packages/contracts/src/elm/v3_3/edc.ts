/**
 * EDC — European Digital Credentials for Learning (ELM v3.3 application profile).
 *
 * The only VC-shaped, sealed ELM profile: a W3C Verifiable Credential envelope (VC Data
 * Model 1.1) over the ELM Core (core.ts), `type: ["VerifiableCredential",
 * "EuropeanDigitalCredential"]`, sealed with a JAdES e-seal. The envelope carries the
 * as-shipped date-field superset (`issuanceDate` + `validFrom` + ELM's `issued`) and the
 * ELM-only `credentialProfiles` / `displayParameter` fields (ADR-0019). `@context` is
 * optional because the delivery-wrapped form omits it.
 */

import { z } from "zod";

import {
  credentialTypeSchema,
  JsonLdContextEntrySchema,
  oneOrMany,
  passthroughObject,
  UriValueSchema,
} from "../../vc-data-model/v2_0/shared";
import {
  ConceptSchema,
  DisplayParameterSchema,
  IdentifierSchema,
  LangStringSchema,
  MediaObjectSchema,
  OrganisationSchema,
  PersonSchema,
} from "./core";

const Dt = z.string();

/** EDC evidence (ELM shape: accreditation / embeddedEvidence / evidenceTarget). */
export const EdcEvidenceSchema = passthroughObject({
  id: z.string().optional(),
  type: oneOrMany(z.union([z.string(), ConceptSchema])),
  evidenceStatement: z.string().optional(),
  evidenceTarget: z.unknown().optional(),
  embeddedEvidence: oneOrMany(MediaObjectSchema).optional(),
  accreditation: z.unknown().optional(),
});

/** `credentialSchema` — the EDC self-declares `ShaclValidator2017` + the variant IRI in `id`. */
export const EdcCredentialSchemaRefSchema = passthroughObject({
  id: UriValueSchema,
  type: z.string(),
});

/** One JAdES signature (JWS JSON serialization member). Verified cryptographically in P5. */
export const JadesSignatureSchema = passthroughObject({
  protected: z.string(),
  signature: z.string().optional(),
  header: z.unknown().optional(),
});

export const EuropeanDigitalCredentialSchema = passthroughObject({
  "@context": z.union([z.string(), z.array(JsonLdContextEntrySchema)]).optional(),
  id: z.string().optional(),
  type: credentialTypeSchema(["EuropeanDigitalCredential"]),
  identifier: oneOrMany(IdentifierSchema).optional(),

  // Issuer / subject — the VC core, ELM-typed. `issuer` is added at issuance/sealing, so
  // it is absent from the pre-issuance delivery form; the parse gate keeps it optional while
  // the SHACL `edc-generic-full` shape enforces it at verify-time (P4).
  issuer: z.union([z.string(), OrganisationSchema]).optional(),
  credentialSubject: PersonSchema,
  holder: z.union([z.string(), OrganisationSchema, PersonSchema]).optional(),

  // Date-field superset actually shipped (ADR-0019 §1).
  issued: Dt,
  issuanceDate: Dt.optional(),
  validFrom: Dt,
  validUntil: Dt.optional(),
  expirationDate: Dt.optional(),

  // Schema (SHACL self-declaration) + ELM-only envelope fields.
  credentialSchema: oneOrMany(EdcCredentialSchemaRefSchema),
  credentialProfiles: oneOrMany(ConceptSchema),
  displayParameter: DisplayParameterSchema,

  // Optional VC machinery.
  evidence: oneOrMany(EdcEvidenceSchema).optional(),
  credentialStatus: z.unknown().optional(),
  termsOfUse: z.unknown().optional(),
  attachment: oneOrMany(MediaObjectSchema).optional(),
  proof: z.unknown().optional(),
});

/** EuropeanDigitalPresentation — a presentation bundling credential(s) + verification checks. */
export const EuropeanDigitalPresentationSchema = passthroughObject({
  "@context": z.union([z.string(), z.array(JsonLdContextEntrySchema)]).optional(),
  id: z.string().optional(),
  type: oneOrMany(z.string()).optional(),
  holder: z.union([z.string(), OrganisationSchema, PersonSchema]).optional(),
  verifiableCredential: oneOrMany(EuropeanDigitalCredentialSchema).optional(),
  verificationCheck: z.unknown().optional(),
  proof: z.unknown().optional(),
});

/**
 * The JAdES delivery envelope of a sealed EDC: a JWS JSON serialization carrying the
 * (base64url) credential `payload` and the `signatures` array. Verified in P5.
 */
export const SealedEdcSchema = passthroughObject({
  payload: z.string(),
  signatures: z.array(JadesSignatureSchema).min(1),
});

export const EdcTitleSchema = LangStringSchema; // re-export for convenience

export type EuropeanDigitalCredential = z.infer<typeof EuropeanDigitalCredentialSchema>;
export type EuropeanDigitalPresentation = z.infer<typeof EuropeanDigitalPresentationSchema>;
export type SealedEdc = z.infer<typeof SealedEdcSchema>;
