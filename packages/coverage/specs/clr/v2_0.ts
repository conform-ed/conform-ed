/**
 * Comprehensive Learner Record 2.0 — {@link SpecSource} (conform-ed ADR-0013;
 * emergent ADR-0028 rollout). The second JSON-Schema-family spec after Open
 * Badges 3.0, with which it shares its credential machinery (CLR is built on the
 * OB/VC stack), so the same six bindings map 1:1 to conform-ed's Zod roots.
 *
 * Vendored schemas under `vendor/clr/v2_0/` are the literal denominator, fetched
 * from the published `purl.imsglobal.org/spec/clr/v2p0/schema/json` URLs recorded
 * in `packages/contracts/clr-v2_0-zod-templates.md`.
 */

import { join } from "node:path";

import {
  AchievementCredentialSchema,
  AssociationTypeSchema,
  ClrCredentialSchema,
  EndorsementCredentialSchema,
  GetClrCredentialsResponseSchema,
  ImsxCodeMajorSchema,
  ImsxCodeMinorFieldValueSchema,
  ImsxSeveritySchema,
  ImsxStatusInfoSchema,
  ProfileSchema,
  ResultStatusTypeSchema,
} from "@conform-ed/contracts/clr/v2_0";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "clr", "v2_0", file);

/**
 * Conformance catalogue — curated from the published 1EdTech CLR 2.0 Conformance &
 * Certification guide (https://www.imsglobal.org/spec/clr/v2p0/cert/), which has no
 * machine source. As for Open Badges 3.0 (the shared credential stack), the guide certifies
 * three product roles used here as profiles: `issuer` (§3) issues a valid, baked, signed
 * ClrCredential; `displayer` (§4) verifies + displays it and determines valid/expired/revoked
 * state; `host` (§5) imports, aggregates and serves ClrCredentials over the CLR API.
 *
 * Scope vs this map's denominator: L1 is the **information model** (the six JSON Schemas), so
 * credential / payload **content** requirements are curated and cross-linked here. The CLR API
 * **transport** requirements (`/discovery`, OAuth 2.0, `/credentials`, `/profile` endpoints,
 * scopes, pagination — §3.2 / §5.2–5.4) are a separate surface with no L1 item in this map
 * (a future OpenAPI binding map); only the payload-bearing parts (getCredentials' response and
 * the imsx status envelope) are curated. Requirement ids are synthesised per profile. Where a
 * requirement constrains an item whose schema also embeds the rule, its `constrains` includes
 * that item so `normativeStatementsCited` reflects the overlap.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-1",
    profile: "issuer",
    reqId: "CLR-ISS-1",
    level: "MUST",
    statement:
      "The @context MUST begin with the VC 2.0 context URI (https://www.w3.org/ns/credentials/v2) followed by the CLR 2.0 context URI.",
    constrains: ["clr:2.0:doc:clrcredential/@context"],
    source: "CLR 2.0 §ClrCredential — https://www.imsglobal.org/spec/clr/v2p0/#clrcredential",
  },
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-2",
    profile: "issuer",
    reqId: "CLR-ISS-2",
    level: "MUST",
    statement: "The type MUST be an unordered set containing 'VerifiableCredential' and 'ClrCredential'.",
    constrains: ["clr:2.0:doc:clrcredential/type", "clr:2.0:doc:clrcredential/type/[]"],
    source: "CLR 2.0 §ClrCredential.type — https://www.imsglobal.org/spec/clr/v2p0/#clrcredential",
  },
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-3",
    profile: "issuer",
    reqId: "CLR-ISS-3",
    level: "MUST",
    statement:
      "credentialSubject MUST be a ClrSubject that carries the learner's achievements and the verifiable AchievementCredentials.",
    constrains: ["clr:2.0:doc:clrcredential/credentialSubject", "clr:2.0:def:ClrSubject/type/[]"],
    source: "CLR 2.0 §ClrSubject — https://www.imsglobal.org/spec/clr/v2p0/#clrsubject",
  },
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-4",
    profile: "issuer",
    reqId: "CLR-ISS-4",
    level: "MUST",
    statement: "The issuer MUST be a Profile identified by an IRI in the issuer.id property.",
    constrains: ["clr:2.0:doc:clrcredential/issuer", "clr:2.0:def:ProfileRef"],
    source: "CLR 2.0 §ClrCredential.issuer + §Profile — https://www.imsglobal.org/spec/clr/v2p0/#profile",
  },
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-5",
    profile: "issuer",
    reqId: "CLR-ISS-5",
    level: "MUST",
    statement:
      "An issued ClrCredential MUST be signed with a supported proof mechanism — a Data Integrity proof (eddsa-rdfc-2022 or ecdsa-sd-2023) or an external VC-JWT proof — and an embedded proof's proofPurpose MUST be 'assertionMethod'.",
    constrains: ["clr:2.0:def:ClrCredential/proof", "clr:2.0:def:Proof/proofPurpose"],
    source:
      "CLR 2.0 Cert §3 (Issuer — baked, signed ClrCredential) — https://www.imsglobal.org/spec/clr/v2p0/cert/#issuer",
  },
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-6",
    profile: "issuer",
    reqId: "CLR-ISS-6",
    level: "MUST",
    statement:
      "The issued ClrCredential MUST contain all required fields (id, @context, issuer, validFrom, credentialSubject) and be valid: it MUST pass JSON-LD validation in safe mode.",
    constrains: [
      "clr:2.0:doc:clrcredential",
      "clr:2.0:def:ClrCredential/id",
      "clr:2.0:def:ClrCredential/@context",
      "clr:2.0:def:ClrCredential/issuer",
      "clr:2.0:def:ClrCredential/validFrom",
      "clr:2.0:def:ClrCredential/credentialSubject",
    ],
    source:
      "CLR 2.0 Cert §3.1 (Issuer Tests — valid baked ClrCredential) — https://www.imsglobal.org/spec/clr/v2p0/cert/#issuer",
  },
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-7",
    profile: "issuer",
    reqId: "CLR-ISS-7",
    level: "MUST",
    statement:
      "The ClrSubject MUST aggregate the learner's record as a set of verifiable credentials (verifiableCredential), each itself a VerifiableCredential, alongside the achievements they evidence.",
    constrains: [
      "clr:2.0:def:ClrSubject/verifiableCredential",
      "clr:2.0:def:ClrSubject/achievement",
      "clr:2.0:def:VerifiableCredential/type/[]",
    ],
    source: "CLR 2.0 §ClrSubject (verifiableCredential) — https://www.imsglobal.org/spec/clr/v2p0/#clrsubject",
  },
  {
    key: "clr:2.0:conf:displayer/CLR-DSP-1",
    profile: "displayer",
    reqId: "CLR-DSP-1",
    level: "MUST",
    statement:
      "A displayer MUST verify a presented ClrCredential and correctly determine its state — valid, expired or revoked — before display, and MUST allow a viewer to trigger verification and retrieve the result.",
    constrains: [
      "clr:2.0:def:ClrCredential/proof",
      "clr:2.0:def:ClrCredential/validUntil",
      "clr:2.0:def:ClrCredential/credentialStatus",
    ],
    source: "CLR 2.0 Cert §4.2 (Displayer Tests) — https://www.imsglobal.org/spec/clr/v2p0/cert/#displayer",
  },
  {
    key: "clr:2.0:conf:displayer/CLR-DSP-2",
    profile: "displayer",
    reqId: "CLR-DSP-2",
    level: "MUST",
    statement:
      "A displayer MUST present the record's name, description, issuer name, issue date (validFrom), verification status, and the image when present.",
    constrains: [
      "clr:2.0:def:ClrCredential/name",
      "clr:2.0:def:ClrCredential/description",
      "clr:2.0:def:ClrCredential/issuer",
      "clr:2.0:def:ClrCredential/validFrom",
      "clr:2.0:def:ClrCredential/image",
      "clr:2.0:def:ClrCredential/credentialStatus",
    ],
    source: "CLR 2.0 Cert §4.2 (Displayer — displayed data) — https://www.imsglobal.org/spec/clr/v2p0/cert/#displayer",
  },
  {
    key: "clr:2.0:conf:displayer/CLR-DSP-3",
    profile: "displayer",
    reqId: "CLR-DSP-3",
    level: "MUST",
    statement: "A ClrCredential MUST be treated as expired when the current date-time is after its validUntil.",
    constrains: ["clr:2.0:def:ClrCredential/validUntil"],
    source:
      "CLR 2.0 Cert §4.1 (Verification and Status — expired) — https://www.imsglobal.org/spec/clr/v2p0/cert/#status",
  },
  {
    key: "clr:2.0:conf:displayer/CLR-DSP-4",
    profile: "displayer",
    reqId: "CLR-DSP-4",
    level: "MUST",
    statement:
      "A ClrCredential MUST be treated as revoked when credentialStatus is present with type '1EdTechRevocationList'; credentialStatus.id MUST be the URL of the issuer's credential status method.",
    constrains: [
      "clr:2.0:def:ClrCredential/credentialStatus",
      "clr:2.0:def:CredentialStatus/id",
      "clr:2.0:def:CredentialStatus/type",
    ],
    source:
      "CLR 2.0 Cert §4.1 (Verification and Status — revoked) — https://www.imsglobal.org/spec/clr/v2p0/cert/#status",
  },
  {
    key: "clr:2.0:conf:displayer/CLR-DSP-5",
    profile: "displayer",
    reqId: "CLR-DSP-5",
    level: "MUST",
    statement:
      "A displayer MUST support the Data Integrity proof cryptosuites and MUST verify credentials expressed against the W3C VC Data Model 2.0 context.",
    constrains: ["clr:2.0:def:ClrCredential/proof", "clr:2.0:def:ClrCredential/@context"],
    source: "CLR 2.0 Cert §4.2 (Displayer — VC 2.0 + proof) — https://www.imsglobal.org/spec/clr/v2p0/cert/#displayer",
  },
  {
    key: "clr:2.0:conf:host/CLR-HST-1",
    profile: "host",
    reqId: "CLR-HST-1",
    level: "MUST",
    statement:
      "The getCredentials response MUST return ClrCredentials, each independently verifiable; VC-JWT-signed credentials MUST be carried in compactJwsString. A host MUST import and re-export a ClrCredential with no data loss.",
    constrains: [
      "clr:2.0:doc:getclrcredentialsresponse/credential/[]",
      "clr:2.0:doc:getclrcredentialsresponse/compactJwsString/[]",
    ],
    source:
      "CLR 2.0 Cert §5.1–5.3 (Host — import/export + Service Provider Read) — https://www.imsglobal.org/spec/clr/v2p0/cert/#host",
  },
  {
    key: "clr:2.0:conf:host/CLR-HST-2",
    profile: "host",
    reqId: "CLR-HST-2",
    level: "MUST",
    statement:
      "A CLR API service error/status response MUST be reported through the imsx_statusInfo structure, carrying at least an imsx_codeMajor and imsx_severity.",
    constrains: ["clr:2.0:doc:imsx_statusinfo/imsx_codeMajor", "clr:2.0:doc:imsx_statusinfo/imsx_severity"],
    source: "CLR 2.0 Cert §5 (Host — Service Provider compliance) — https://www.imsglobal.org/spec/clr/v2p0/cert/#host",
  },
];

export const clrV2_0: SpecSource = {
  spec: "clr",
  version: "2.0",
  bindings: [
    {
      binding: "clrcredential",
      schemaPath: vendor("clr_v2p0_clrcredential_schema.json"),
      language: "json-schema",
      zod: ClrCredentialSchema,
    },
    {
      binding: "achievementcredential",
      schemaPath: vendor("clr_v2p0_achievementcredential_schema.json"),
      language: "json-schema",
      zod: AchievementCredentialSchema,
    },
    {
      binding: "endorsementcredential",
      schemaPath: vendor("clr_v2p0_endorsementcredential_schema.json"),
      language: "json-schema",
      zod: EndorsementCredentialSchema,
    },
    {
      binding: "profile",
      schemaPath: vendor("clr_v2p0_profile_schema.json"),
      language: "json-schema",
      zod: ProfileSchema,
    },
    {
      binding: "getclrcredentialsresponse",
      schemaPath: vendor("clr_v2p0_getclrcredentialsresponse_schema.json"),
      language: "json-schema",
      zod: GetClrCredentialsResponseSchema,
    },
    {
      binding: "imsx_statusinfo",
      schemaPath: vendor("clr_v2p0_imsx_statusinfo_schema.json"),
      language: "json-schema",
      zod: ImsxStatusInfoSchema,
    },
  ],
  // Value-set verification (ADR-0017): the closed vocabularies the CLR 2.0 schemas enumerate that
  // the structural name-join cannot check — the result status, the association type, and the imsx
  // REST status-info codes — each safeParse'd member-by-member against conform-ed's z.enum.
  valueSets: [
    { item: "clr:2.0:def:Result/status", element: ResultStatusTypeSchema },
    { item: "clr:2.0:def:Association/associationType", element: AssociationTypeSchema },
    { item: "clr:2.0:doc:imsx_statusinfo/imsx_codeMajor", element: ImsxCodeMajorSchema },
    { item: "clr:2.0:doc:imsx_statusinfo/imsx_severity", element: ImsxSeveritySchema },
    { item: "clr:2.0:def:Imsx_CodeMinorField/imsx_codeMinorFieldValue", element: ImsxCodeMinorFieldValueSchema },
  ],
  conformance,
};
