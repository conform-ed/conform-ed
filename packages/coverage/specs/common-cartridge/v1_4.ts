/**
 * Common Cartridge 1.4 — {@link SpecSource} (conform-ed ADR-0013; emergent ADR-0028
 * rollout). The XSD-family sibling of {@link commonCartridgeV1_3}: the same five
 * resource-type bindings carried forward to CC 1.4 (`imscp_v1p1` content packaging,
 * `imswl_v1p4` Web Link, `imsdt_v1p4` Discussion Topic, `imsccauth_v1p4` Authorization,
 * `imscsmd_v1p1` Curriculum Standards Metadata), each walked from its literal published
 * `.xsd` and reconciled with conform-ed's Zod.
 *
 * Deferred (a documented boundary, not an omission): the CC 1.4 `assignment` extension
 * (`cc_extresource_assignment`) and the LOM-derived `lom`-rooted bindings define
 * complexTypes whose **names collide across files** (`Text.Type` / `Attachment.Type` in
 * assignment vs Discussion Topic; `LOM.Type` across the three LOM profiles). The XSD
 * walker currently keys `def:`s by global type name, so including them would conflate
 * structurally-distinct types. Bridging them needs per-source def-namespacing in the
 * walker (mirroring the Zod side's per-binding scoping) — the next walker increment.
 */

import { join } from "node:path";

import {
  CommonCartridgeAuthorizationsSchema,
  CommonCartridgeManifestRawSchema,
  CurriculumStandardsMetadataSetSchema,
  DiscussionTopicSchema,
  WebLinkSchema,
} from "@conform-ed/contracts/common-cartridge/v1_4";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "common-cartridge", "v1_4", file);

/**
 * Conformance seed — grounded slices of the CC 1.4 resource-type normative rules, each
 * cross-linked to the literal L1 item it constrains. Requirement ids synthesised per
 * profile; full extraction from the published CC 1.4 conformance guide is the next
 * hand-curation increment.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "cc:1.4:conf:manifest/CC14-MAN-1",
    profile: "manifest",
    reqId: "CC14-MAN-1",
    level: "MUST",
    statement:
      "A Common Cartridge 1.4 manifest MUST carry an identifier and exactly one organizations and one resources element.",
    constrains: [
      "cc:1.4:def:Manifest.Type/identifier",
      "cc:1.4:def:Manifest.Type/organizations",
      "cc:1.4:def:Manifest.Type/resources",
    ],
    source: "IMS CC 1.4 — Content Packaging manifest (imscp_v1p2) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:web-link/CC14-WL-1",
    profile: "web-link",
    reqId: "CC14-WL-1",
    level: "MUST",
    statement: "A Web Link resource MUST contain a webLink element carrying exactly one title and exactly one url.",
    constrains: ["cc:1.4:def:WebLink.Type/title", "cc:1.4:def:WebLink.Type/url"],
    source: "IMS CC 1.4 — Web Link resource (imswl_v1p4) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:discussion-topic/CC14-DT-1",
    profile: "discussion-topic",
    reqId: "CC14-DT-1",
    level: "MUST",
    statement: "A Discussion Topic resource MUST carry exactly one title and exactly one text body.",
    constrains: ["cc:1.4:def:Topic.Type/title", "cc:1.4:def:Topic.Type/text"],
    source: "IMS CC 1.4 — Discussion Topic resource (imsdt_v1p4) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:authorization/CC14-AUTH-1",
    profile: "authorization",
    reqId: "CC14-AUTH-1",
    level: "MUST",
    statement:
      "An authorizations document MUST contain at least one authorization describing how to access a resource.",
    constrains: ["cc:1.4:def:Authorizations.Type/authorization"],
    source: "IMS CC 1.4 — Authorization (imsccauth_v1p4) — https://www.imsglobal.org/spec/cc/v1p4",
  },
];

export const commonCartridgeV1_4: SpecSource = {
  spec: "cc",
  version: "1.4",
  bindings: [
    {
      binding: "manifest",
      schemaPath: vendor("ccv1p4_imscp_v1p2_v1p0.xsd"),
      language: "xsd",
      zod: CommonCartridgeManifestRawSchema,
    },
    {
      binding: "webLink",
      schemaPath: vendor("ccv1p4_imswl_v1p4.xsd"),
      language: "xsd",
      zod: WebLinkSchema,
    },
    {
      binding: "topic",
      schemaPath: vendor("ccv1p4_imsdt_v1p4.xsd"),
      language: "xsd",
      zod: DiscussionTopicSchema,
    },
    {
      binding: "authorizations",
      schemaPath: vendor("ccv1p4_imsccauth_v1p4.xsd"),
      language: "xsd",
      zod: CommonCartridgeAuthorizationsSchema,
    },
    {
      binding: "curriculumStandardsMetadataSet",
      schemaPath: vendor("ccv1p4_imscsmd_v1p1.xsd"),
      language: "xsd",
      zod: CurriculumStandardsMetadataSetSchema,
    },
  ],
  conformance,
};
