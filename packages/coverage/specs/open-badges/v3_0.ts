/**
 * Open Badges 3.0 — the pilot {@link SpecSource} (conform-ed ADR-0013; emergent
 * ADR-0028 rollout). Wires the vendored literal JSON Schemas to the conform-ed
 * Zod model and a hand-curated conformance seed.
 *
 * Vendored schemas under `vendor/open-badges/v3_0/` are the literal denominator,
 * fetched from the published `purl.imsglobal.org` URLs recorded in
 * `packages/contracts/open-badges-v3_0-zod-templates.md`.
 */

import { join } from "node:path";

import {
  AchievementCredentialSchema,
  EndorsementCredentialSchema,
  GetOpenBadgeCredentialsResponseSchema,
  ImsxCodeMajorSchema,
  ImsxCodeMinorFieldValueSchema,
  ImsxSeveritySchema,
  ImsxStatusInfoSchema,
  ProfileSchema,
  ResultStatusTypeSchema,
} from "@conform-ed/contracts/open-badges/v3_0";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "open-badges", "v3_0", file);

/**
 * Conformance catalogue — curated from the published 1EdTech OB 3.0 Conformance &
 * Certification guide (https://www.imsglobal.org/spec/ob/v3p0/cert/), which has no
 * machine source. The guide certifies three product roles, used here as profiles:
 *
 *  - `issuer` (§3) — creates and issues a valid, signed credential;
 *  - `displayer` (§4) — verifies and displays a credential, determining valid /
 *    expired / revoked state;
 *  - `host` (§5) — aggregates / serves credentials over the Badge Connect API.
 *
 * Scope vs this map's denominator: the Coverage Map's L1 is the **information model**
 * (the five published JSON Schemas), so requirements that constrain credential / payload
 * *content* are curated and cross-linked here. The Badge Connect API **transport**
 * requirements (the `/discovery`, OAuth 2.0, `/credentials` and `/profile` endpoints,
 * scopes, and pagination — §3.2 / §5.2–5.4) are a separate conformance surface with no L1
 * item in this map; they belong to a future OpenAPI binding map and are intentionally not
 * curated here (only the payload-bearing parts — getCredentials' response and the imsx
 * status envelope — are). Requirement ids are synthesised per profile (`OB-ISS-n` /
 * `OB-DSP-n` / `OB-HST-n`); the guide exposes no clean per-statement id scheme. Where a
 * requirement constrains an item whose schema also embeds the rule, its `constrains`
 * includes that item so the map's `normativeStatementsCited` reflects the overlap.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "ob:3.0:conf:issuer/OB-ISS-1",
    profile: "issuer",
    reqId: "OB-ISS-1",
    level: "MUST",
    statement:
      "The @context MUST begin with the VC 2.0 context URI (https://www.w3.org/ns/credentials/v2) followed by the OB 3.0 context URI.",
    constrains: ["ob:3.0:doc:achievementcredential/@context"],
    source: "OB 3.0 §8 (AchievementCredential) — https://www.imsglobal.org/spec/ob/v3p0/#achievementcredential",
  },
  {
    key: "ob:3.0:conf:issuer/OB-ISS-2",
    profile: "issuer",
    reqId: "OB-ISS-2",
    level: "MUST",
    statement:
      "The type MUST be an unordered set containing 'VerifiableCredential' and one of 'AchievementCredential' or 'OpenBadgeCredential'.",
    constrains: ["ob:3.0:doc:achievementcredential/type", "ob:3.0:doc:achievementcredential/type/[]"],
    source: "OB 3.0 §8 (AchievementCredential.type) — https://www.imsglobal.org/spec/ob/v3p0/#achievementcredential",
  },
  {
    key: "ob:3.0:conf:issuer/OB-ISS-3",
    profile: "issuer",
    reqId: "OB-ISS-3",
    level: "MUST",
    statement:
      "A verifiable AchievementCredential MUST carry at least one proof mechanism (embedded data-integrity proof) or be issued as an external JWT proof.",
    constrains: ["ob:3.0:doc:achievementcredential/proof"],
    source:
      "OB 3.0 §8 + VC-DATA-MODEL-2.0 §4 (data integrity) — https://www.imsglobal.org/spec/ob/v3p0/#data-integrity",
  },
  {
    key: "ob:3.0:conf:issuer/OB-ISS-4",
    profile: "issuer",
    reqId: "OB-ISS-4",
    level: "MUST",
    statement: "The issuer MUST be a Profile identified by an IRI in the issuer.id property.",
    constrains: ["ob:3.0:doc:achievementcredential/issuer", "ob:3.0:def:ProfileRef"],
    source: "OB 3.0 §8 (AchievementCredential.issuer) + §9 (Profile) — https://www.imsglobal.org/spec/ob/v3p0/#profile",
  },
  {
    key: "ob:3.0:conf:issuer/OB-ISS-5",
    profile: "issuer",
    reqId: "OB-ISS-5",
    level: "MUST",
    statement: "credentialSubject MUST be an AchievementSubject that identifies the achievement being awarded.",
    constrains: ["ob:3.0:doc:achievementcredential/credentialSubject", "ob:3.0:def:AchievementSubject/achievement"],
    source:
      "OB 3.0 §8 (AchievementCredential.credentialSubject) + AchievementSubject — https://www.imsglobal.org/spec/ob/v3p0/#achievementsubject",
  },
  {
    // Cites the schema's own embedded MUST prose on the `type` sets (cf. normativeStatements):
    // demonstrates a curated requirement covering the machine-extracted normative surface.
    key: "ob:3.0:conf:issuer/OB-ISS-6",
    profile: "issuer",
    reqId: "OB-ISS-6",
    level: "MUST",
    statement:
      "The type sets MUST be unordered sets whose required IRIs are present: an AchievementCredential's type MUST include 'AchievementCredential', and an Achievement's type MUST include 'Achievement'.",
    constrains: ["ob:3.0:def:AchievementCredential/type/[]", "ob:3.0:def:Achievement/type/[]"],
    source:
      "OB 3.0 §8 (AchievementCredential.type) + §Achievement — https://www.imsglobal.org/spec/ob/v3p0/#achievement",
  },
  {
    key: "ob:3.0:conf:issuer/OB-ISS-7",
    profile: "issuer",
    reqId: "OB-ISS-7",
    level: "MUST",
    statement:
      "An issued credential MUST be signed with a supported proof mechanism — a Data Integrity proof (the eddsa-rdfc-2022 or ecdsa-sd-2023 cryptosuite) or an external VC-JWT proof — and an embedded proof's proofPurpose MUST be 'assertionMethod'.",
    constrains: ["ob:3.0:def:AchievementCredential/proof", "ob:3.0:def:Proof/proofPurpose"],
    source:
      "OB 3.0 Cert §3.1.1 (Issuer — Supported Proof Mechanisms) — https://www.imsglobal.org/spec/ob/v3p0/cert/#issuer",
  },
  {
    key: "ob:3.0:conf:issuer/OB-ISS-8",
    profile: "issuer",
    reqId: "OB-ISS-8",
    level: "MUST",
    statement:
      "The issued AchievementCredential MUST contain all required fields (id, @context, issuer, validFrom, credentialSubject) and be valid: it MUST pass JSON-LD validation in safe mode (every term resolved by an associated context).",
    constrains: [
      "ob:3.0:doc:achievementcredential",
      "ob:3.0:def:AchievementCredential/id",
      "ob:3.0:def:AchievementCredential/@context",
      "ob:3.0:def:AchievementCredential/issuer",
      "ob:3.0:def:AchievementCredential/validFrom",
      "ob:3.0:def:AchievementCredential/credentialSubject",
    ],
    source: "OB 3.0 Cert §3.1 (Issuer Tests) + §Valid Badge — https://www.imsglobal.org/spec/ob/v3p0/cert/#issuer",
  },
  {
    key: "ob:3.0:conf:issuer/OB-ISS-9",
    profile: "issuer",
    reqId: "OB-ISS-9",
    level: "MUST",
    statement:
      "The recipient MUST be identified in the AchievementSubject by either an id or at least one identifier (an IdentityObject, hashed or plaintext).",
    constrains: ["ob:3.0:def:AchievementSubject/id", "ob:3.0:def:AchievementSubject/identifier"],
    source:
      "OB 3.0 Cert §3.1 (Issuer — issue to recipient) + AchievementSubject — https://www.imsglobal.org/spec/ob/v3p0/#achievementsubject",
  },
  {
    key: "ob:3.0:conf:displayer/OB-DSP-1",
    profile: "displayer",
    reqId: "OB-DSP-1",
    level: "MUST",
    statement:
      "A displayer MUST verify a presented credential and correctly determine its state — valid, expired, or revoked — before display, and MUST allow a viewer to trigger verification and retrieve the result.",
    constrains: [
      "ob:3.0:def:AchievementCredential/proof",
      "ob:3.0:def:AchievementCredential/validUntil",
      "ob:3.0:def:AchievementCredential/credentialStatus",
    ],
    source: "OB 3.0 Cert §4.2 (Displayer Tests) — https://www.imsglobal.org/spec/ob/v3p0/cert/#displayer",
  },
  {
    key: "ob:3.0:conf:displayer/OB-DSP-2",
    profile: "displayer",
    reqId: "OB-DSP-2",
    level: "MUST",
    statement:
      "A displayer MUST present the badge's name, description, issuer name, issue date (validFrom) and verification status; and the image when the badge carries one (a baked badge).",
    constrains: [
      "ob:3.0:def:AchievementCredential/name",
      "ob:3.0:def:AchievementCredential/description",
      "ob:3.0:def:AchievementCredential/issuer",
      "ob:3.0:def:AchievementCredential/validFrom",
      "ob:3.0:def:AchievementCredential/image",
      "ob:3.0:def:AchievementCredential/credentialStatus",
    ],
    source:
      "OB 3.0 Cert §4.2 (Displayer — displayed badge data) — https://www.imsglobal.org/spec/ob/v3p0/cert/#displayer",
  },
  {
    key: "ob:3.0:conf:displayer/OB-DSP-3",
    profile: "displayer",
    reqId: "OB-DSP-3",
    level: "MUST",
    statement: "A credential MUST be treated as expired when the current date-time is after its validUntil.",
    constrains: ["ob:3.0:def:AchievementCredential/validUntil"],
    source: "OB 3.0 Cert §4.1 (Credential Status — expired) — https://www.imsglobal.org/spec/ob/v3p0/cert/#status",
  },
  {
    key: "ob:3.0:conf:displayer/OB-DSP-4",
    profile: "displayer",
    reqId: "OB-DSP-4",
    level: "MUST",
    statement:
      "A credential MUST be treated as revoked when credentialStatus is present with type 'BitstringStatusListEntry' and statusPurpose 'revocation'; the credentialStatus.id MUST be the URL of the issuer's credential status method.",
    constrains: [
      "ob:3.0:def:AchievementCredential/credentialStatus",
      "ob:3.0:def:CredentialStatus/id",
      "ob:3.0:def:CredentialStatus/type",
    ],
    source: "OB 3.0 Cert §4.1 (Credential Status — revoked) — https://www.imsglobal.org/spec/ob/v3p0/cert/#status",
  },
  {
    key: "ob:3.0:conf:displayer/OB-DSP-5",
    profile: "displayer",
    reqId: "OB-DSP-5",
    level: "MUST",
    statement:
      "A displayer MUST support the Data Integrity proof cryptosuites (eddsa-rdfc-2022, ecdsa-sd-2023) and MUST verify credentials expressed against the W3C VC Data Model 2.0 context.",
    constrains: ["ob:3.0:def:AchievementCredential/proof", "ob:3.0:def:AchievementCredential/@context"],
    source:
      "OB 3.0 Cert §4.2.1 (Displayer — Supported Proof Mechanisms) — https://www.imsglobal.org/spec/ob/v3p0/cert/#displayer",
  },
  {
    key: "ob:3.0:conf:host/OB-HST-1",
    profile: "host",
    reqId: "OB-HST-1",
    level: "MUST",
    statement:
      "The getCredentials response MUST return OpenBadgeCredentials, each independently verifiable; credentials signed with the VC-JWT proof format MUST be carried in the compactJwsString list.",
    constrains: [
      "ob:3.0:doc:getopenbadgecredentialsresponse/credential/[]",
      "ob:3.0:doc:getopenbadgecredentialsresponse/compactJwsString/[]",
    ],
    source:
      "OB 3.0 Cert §5.2–5.3 (Host — Service Provider/Consumer Read) — https://www.imsglobal.org/spec/ob/v3p0/cert/#host",
  },
  {
    key: "ob:3.0:conf:host/OB-HST-2",
    profile: "host",
    reqId: "OB-HST-2",
    level: "MUST",
    statement:
      "A Badge Connect API service error/status response MUST be reported through the imsx_statusInfo structure, carrying at least an imsx_codeMajor and imsx_severity.",
    constrains: ["ob:3.0:doc:imsx_statusinfo/imsx_codeMajor", "ob:3.0:doc:imsx_statusinfo/imsx_severity"],
    source:
      "OB 3.0 Cert §5 (Host — Service Provider compliance) + Badge Connect API — https://www.imsglobal.org/spec/ob/v3p0/cert/#host",
  },
];

export const openBadgesV3_0: SpecSource = {
  spec: "ob",
  version: "3.0",
  bindings: [
    {
      binding: "achievementcredential",
      schemaPath: vendor("ob_v3p0_achievementcredential_schema.json"),
      language: "json-schema",
      zod: AchievementCredentialSchema,
    },
    {
      binding: "endorsementcredential",
      schemaPath: vendor("ob_v3p0_endorsementcredential_schema.json"),
      language: "json-schema",
      zod: EndorsementCredentialSchema,
    },
    {
      binding: "profile",
      schemaPath: vendor("ob_v3p0_profile_schema.json"),
      language: "json-schema",
      zod: ProfileSchema,
    },
    {
      binding: "getopenbadgecredentialsresponse",
      schemaPath: vendor("ob_v3p0_getopenbadgecredentialsresponse_schema.json"),
      language: "json-schema",
      zod: GetOpenBadgeCredentialsResponseSchema,
    },
    {
      binding: "imsx_statusinfo",
      schemaPath: vendor("ob_v3p0_imsx_statusinfo_schema.json"),
      language: "json-schema",
      zod: ImsxStatusInfoSchema,
    },
  ],
  // Value-set verification (ADR-0017): the closed vocabularies the OB 3.0 schemas enumerate that
  // the structural name-join cannot check — the result status and the imsx REST status-info codes
  // — each safeParse'd member-by-member against conform-ed's z.enum.
  valueSets: [
    { item: "ob:3.0:def:Result/status", element: ResultStatusTypeSchema },
    { item: "ob:3.0:doc:imsx_statusinfo/imsx_codeMajor", element: ImsxCodeMajorSchema },
    { item: "ob:3.0:doc:imsx_statusinfo/imsx_severity", element: ImsxSeveritySchema },
    { item: "ob:3.0:def:Imsx_CodeMinorField/imsx_codeMinorFieldValue", element: ImsxCodeMinorFieldValueSchema },
  ],
  conformance,
};
