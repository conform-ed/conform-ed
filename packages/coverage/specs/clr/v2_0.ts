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
  ClrCredentialSchema,
  EndorsementCredentialSchema,
  GetClrCredentialsResponseSchema,
  ImsxStatusInfoSchema,
  ProfileSchema,
} from "@conform-ed/contracts/clr/v2_0";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "clr", "v2_0", file);

/**
 * Conformance seed — a grounded slice of the CLR 2.0 issuer-side normative rules,
 * each cross-linked to the literal L1 item it constrains. Requirement ids are
 * synthesised (`CLR-ISS-n`); full extraction from the published 1EdTech CLR 2.0
 * conformance guide is the next hand-curation increment.
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
    constrains: ["clr:2.0:doc:clrcredential/type"],
    source: "CLR 2.0 §ClrCredential.type — https://www.imsglobal.org/spec/clr/v2p0/#clrcredential",
  },
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-3",
    profile: "issuer",
    reqId: "CLR-ISS-3",
    level: "MUST",
    statement:
      "credentialSubject MUST be a ClrSubject that carries the learner's achievements and the verifiable AchievementCredentials.",
    constrains: ["clr:2.0:doc:clrcredential/credentialSubject"],
    source: "CLR 2.0 §ClrSubject — https://www.imsglobal.org/spec/clr/v2p0/#clrsubject",
  },
  {
    key: "clr:2.0:conf:issuer/CLR-ISS-4",
    profile: "issuer",
    reqId: "CLR-ISS-4",
    level: "MUST",
    statement: "The issuer MUST be a Profile identified by an IRI in the issuer.id property.",
    constrains: ["clr:2.0:doc:clrcredential/issuer"],
    source: "CLR 2.0 §ClrCredential.issuer + §Profile — https://www.imsglobal.org/spec/clr/v2p0/#profile",
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
  conformance,
};
