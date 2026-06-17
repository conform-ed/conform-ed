/**
 * Common Cartridge 1.3 — Web Link resource — the XSD-family pilot {@link SpecSource}
 * (conform-ed ADR-0013; emergent ADR-0028 rollout). It exercises the direct XSD
 * walker (`src/walkers/xsd.ts`) end-to-end against the literal published `.xsd`
 * denominator, reconciled with conform-ed's Zod model.
 *
 * The vendored schema under `vendor/common-cartridge/v1_3/` is the literal
 * denominator, copied verbatim from the IMS CC 1.3 binding bundle
 * (`ccv1p3_imswl_v1p3.xsd`, targetNamespace
 * `http://www.imsglobal.org/xsd/imsccv1p3/imswl_v1p3`).
 *
 * Note on the expected residue: the XSD's open extension point is the nameless
 * `xs:any` inside `grpStrict.any`; conform-ed models it as a named `extensions`
 * field. The two cannot align by name, so `extensions` surfaces as a single
 * `extension` residue — the literal-denominator mechanism correctly reporting a
 * documented normalisation (to be bridged by a `specRef` override increment),
 * not a defect.
 */

import { join } from "node:path";

import {
  CommonCartridgeAuthorizationsSchema,
  CommonCartridgeManifestRawSchema,
  CurriculumStandardsMetadataSetSchema,
  DiscussionTopicSchema,
  WebLinkSchema,
} from "@conform-ed/contracts/common-cartridge/v1_3";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "common-cartridge", "v1_3", file);

/**
 * Conformance seed — grounded slices of the CC 1.3 resource-type normative rules,
 * each cross-linked to the literal L1 item it constrains. Requirement ids are
 * synthesised per profile (`CC-WL-n`, `CC-DT-n`, `CC-CSM-n`); the published CC 1.3
 * conformance guide has no clean per-statement id scheme. Full extraction is the
 * next hand-curation increment.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "cc:1.3:conf:web-link/CC-WL-1",
    profile: "web-link",
    reqId: "CC-WL-1",
    level: "MUST",
    statement: "A Web Link resource MUST contain a webLink element carrying exactly one title and exactly one url.",
    constrains: ["cc:1.3:def:WebLink.Type/title", "cc:1.3:def:WebLink.Type/url"],
    source:
      "IMS CC 1.3 — Web Link resource (imswl_v1p3) — https://www.imsglobal.org/cc/CCv1p3/imscc_profilev1p3-Final.html#WebLinks",
  },
  {
    key: "cc:1.3:conf:web-link/CC-WL-2",
    profile: "web-link",
    reqId: "CC-WL-2",
    level: "MUST",
    statement: "The url element MUST carry an href attribute identifying the link target.",
    constrains: ["cc:1.3:def:URL.Type/href"],
    source:
      "IMS CC 1.3 — Web Link resource (imswl_v1p3) URL.Type — https://www.imsglobal.org/cc/CCv1p3/imscc_profilev1p3-Final.html#WebLinks",
  },
  {
    key: "cc:1.3:conf:discussion-topic/CC-DT-1",
    profile: "discussion-topic",
    reqId: "CC-DT-1",
    level: "MUST",
    statement: "A Discussion Topic resource MUST carry exactly one title and exactly one text body.",
    constrains: ["cc:1.3:def:Topic.Type/title", "cc:1.3:def:Topic.Type/text"],
    source:
      "IMS CC 1.3 — Discussion Topic resource (imsdt_v1p3) — https://www.imsglobal.org/cc/CCv1p3/imscc_profilev1p3-Final.html#DiscussionTopics",
  },
  {
    key: "cc:1.3:conf:curriculum-standards-metadata/CC-CSM-1",
    profile: "curriculum-standards-metadata",
    reqId: "CC-CSM-1",
    level: "MUST",
    statement:
      "A CurriculumStandardsMetadataSet MUST contain at least one curriculumStandardsMetadata, each with at least one setOfGUIDs.",
    constrains: [
      "cc:1.3:def:CurriculumStandardsMetadataSet.Type/curriculumStandardsMetadata",
      "cc:1.3:def:CurriculumStandardsMetadata.Type/setOfGUIDs",
    ],
    source:
      "IMS CC 1.3 — Curriculum Standards Metadata (imscsmd_v1p0) — https://www.imsglobal.org/cc/CCv1p3/imscc_profilev1p3-Final.html",
  },
  {
    key: "cc:1.3:conf:manifest/CC-MAN-1",
    profile: "manifest",
    reqId: "CC-MAN-1",
    level: "MUST",
    statement:
      "A Common Cartridge manifest MUST carry an identifier and exactly one organizations and one resources element.",
    constrains: [
      "cc:1.3:def:Manifest.Type/identifier",
      "cc:1.3:def:Manifest.Type/organizations",
      "cc:1.3:def:Manifest.Type/resources",
    ],
    source:
      "IMS CC 1.3 — Content Packaging manifest (imscp_v1p2) — https://www.imsglobal.org/cc/CCv1p3/imscc_profilev1p3-Final.html",
  },
  {
    key: "cc:1.3:conf:authorization/CC-AUTH-1",
    profile: "authorization",
    reqId: "CC-AUTH-1",
    level: "MUST",
    statement:
      "An authorizations document MUST contain at least one authorization describing how to access a resource.",
    constrains: ["cc:1.3:def:Authorizations.Type/authorization"],
    source:
      "IMS CC 1.3 — Authorization (imsccauth_v1p3) — https://www.imsglobal.org/cc/CCv1p3/imscc_profilev1p3-Final.html",
  },
];

export const commonCartridgeV1_3: SpecSource = {
  spec: "cc",
  version: "1.3",
  bindings: [
    {
      binding: "webLink",
      schemaPath: vendor("ccv1p3_imswl_v1p3.xsd"),
      language: "xsd",
      zod: WebLinkSchema,
    },
    {
      binding: "topic",
      schemaPath: vendor("ccv1p3_imsdt_v1p3.xsd"),
      language: "xsd",
      zod: DiscussionTopicSchema,
    },
    {
      binding: "curriculumStandardsMetadataSet",
      schemaPath: vendor("ccv1p3_imscsmd_v1p0.xsd"),
      language: "xsd",
      zod: CurriculumStandardsMetadataSetSchema,
    },
    {
      binding: "manifest",
      schemaPath: vendor("ccv1p3_imscp_v1p2_v1p0.xsd"),
      language: "xsd",
      zod: CommonCartridgeManifestRawSchema,
    },
    {
      binding: "authorizations",
      schemaPath: vendor("ccv1p3_imsccauth_v1p3.xsd"),
      language: "xsd",
      zod: CommonCartridgeAuthorizationsSchema,
    },
  ],
  conformance,
};
