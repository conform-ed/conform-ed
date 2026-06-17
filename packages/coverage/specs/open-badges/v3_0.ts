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
  ImsxStatusInfoSchema,
  ProfileSchema,
} from "@conform-ed/contracts/open-badges/v3_0";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "open-badges", "v3_0", file);

/**
 * Conformance seed. A grounded, deliberately partial slice of the normative
 * issuer-side rules of OB 3.0, each cross-linked to the literal L1 item it
 * constrains. Full extraction from the published 1EdTech OB 3.0 Conformance &
 * Certification guide is the next hand-curation increment (the C axis has no
 * machine source). Requirement ids are synthesised (`OB-ISS-n`) because the
 * published guide does not expose a clean per-statement id scheme.
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
    constrains: ["ob:3.0:doc:achievementcredential/type"],
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
    constrains: ["ob:3.0:doc:achievementcredential/issuer"],
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
  conformance,
};
