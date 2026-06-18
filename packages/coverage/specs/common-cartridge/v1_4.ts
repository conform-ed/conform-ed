/**
 * Common Cartridge 1.4 — {@link SpecSource} (conform-ed ADR-0013; emergent ADR-0028
 * rollout). The XSD-family sibling of {@link commonCartridgeV1_3}: the same five
 * resource-type bindings carried forward to CC 1.4 (`imscp_v1p1` content packaging,
 * `imswl_v1p4` Web Link, `imsdt_v1p4` Discussion Topic, `imsccauth_v1p4` Authorization,
 * `imscsmd_v1p1` Curriculum Standards Metadata), each walked from its literal published
 * `.xsd` and reconciled with conform-ed's Zod.
 *
 * Adds the CC 1.4 `assignment` extension (`cc_extresource_assignment`). Its `Text.Type`
 * / `Attachment.Type` complexTypes share names with Discussion Topic's, so this map sets
 * `scopeXsdDefsBySource` to key every `def:` by its source schema — the same mechanism
 * that lets CC 1.3 carry the three `LOM.Type` profiles distinctly.
 */

import { join } from "node:path";

import {
  AssignmentSchema,
  CommonCartridgeAuthorizationsSchema,
  CommonCartridgeManifestRawSchema,
  CurriculumStandardsMetadataSetSchema,
  DiscussionTopicSchema,
  WebLinkSchema,
} from "@conform-ed/contracts/common-cartridge/v1_4";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";
import { SIMPLE_CONTENT_VALUE, XML_BASE, XS_ANY_EXTENSIONS } from "../xsd-normalisations";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "common-cartridge", "v1_4", file);

/**
 * Conformance catalogue — curated from the published CC 1.4 profile
 * (https://www.imsglobal.org/spec/cc/v1p4), carried in lockstep with CC 1.3's catalogue
 * (the packaging and shared resource-type rules are unchanged across the two versions; CC 1.4
 * adds the `assignment` extension). Like CC 1.3 the XSDs embed no RFC-2119 `xs:documentation`,
 * so this map has no machine-extractable `normativeStatements` to cite — the catalogue is the
 * whole conformance surface. Requirement ids are synthesised per profile, grouped by the
 * cartridge surface each governs: `manifest`, then the per-resource-type bindings the map
 * carries (`web-link`, `discussion-topic`, `curriculum-standards-metadata`, `authorization`,
 * `assignment`).
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
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Manifest.Type/identifier",
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Manifest.Type/organizations",
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Manifest.Type/resources",
    ],
    source: "IMS CC 1.4 — Content Packaging manifest (imscp_v1p2) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:manifest/CC14-MAN-2",
    profile: "manifest",
    reqId: "CC14-MAN-2",
    level: "MUST",
    statement:
      "The manifest metadata MUST declare schema = 'IMS Common Cartridge' and a schemaversion identifying the CC 1.4 profile.",
    constrains: [
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.ManifestMetadata.Type/schema",
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.ManifestMetadata.Type/schemaversion",
    ],
    source: "IMS CC 1.4 — manifest schema/schemaversion — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:manifest/CC14-MAN-3",
    profile: "manifest",
    reqId: "CC14-MAN-3",
    level: "MUST",
    statement:
      "The organizations element MUST contain at most one organization (the predefined rooted-hierarchy); multiple organizations are not permitted.",
    constrains: ["cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Organizations.Type/organization"],
    source: "IMS CC 1.4 — organizations (single rooted-hierarchy) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:manifest/CC14-RES-1",
    profile: "manifest",
    reqId: "CC14-RES-1",
    level: "MUST",
    statement:
      "Every resource MUST carry an identifier and a type; a file-backed resource MUST reference its content via an href attribute or a file child element.",
    constrains: [
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Resource.Type/identifier",
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Resource.Type/type",
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Resource.Type/href",
      "cc:1.4:def:ccv1p4_imscp_v1p2_v1p0.Resource.Type/file",
    ],
    source: "IMS CC 1.4 — resources — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:web-link/CC14-WL-1",
    profile: "web-link",
    reqId: "CC14-WL-1",
    level: "MUST",
    statement: "A Web Link resource MUST contain a webLink element carrying exactly one title and exactly one url.",
    constrains: ["cc:1.4:def:ccv1p4_imswl_v1p4.WebLink.Type/title", "cc:1.4:def:ccv1p4_imswl_v1p4.WebLink.Type/url"],
    source: "IMS CC 1.4 — Web Link resource (imswl_v1p4) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:web-link/CC14-WL-2",
    profile: "web-link",
    reqId: "CC14-WL-2",
    level: "MUST",
    statement: "The url element MUST carry an href attribute identifying the link target.",
    constrains: ["cc:1.4:def:ccv1p4_imswl_v1p4.URL.Type/href"],
    source: "IMS CC 1.4 — Web Link URL.Type — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:web-link/CC14-WL-3",
    profile: "web-link",
    reqId: "CC14-WL-3",
    level: "MAY",
    statement:
      "The url element MAY carry a target attribute selecting the HTML anchor target window (e.g. _blank / _self) for the launched link.",
    constrains: ["cc:1.4:def:ccv1p4_imswl_v1p4.URL.Type/target"],
    source: "IMS CC 1.4 — Web Link URL.Type/@target — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:discussion-topic/CC14-DT-1",
    profile: "discussion-topic",
    reqId: "CC14-DT-1",
    level: "MUST",
    statement: "A Discussion Topic resource MUST carry exactly one title and exactly one text body.",
    constrains: ["cc:1.4:def:ccv1p4_imsdt_v1p4.Topic.Type/title", "cc:1.4:def:ccv1p4_imsdt_v1p4.Topic.Type/text"],
    source: "IMS CC 1.4 — Discussion Topic resource (imsdt_v1p4) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:discussion-topic/CC14-DT-2",
    profile: "discussion-topic",
    reqId: "CC14-DT-2",
    level: "MUST",
    statement: "The text element MUST carry a texttype attribute whose value is 'text/html' or 'text/plain'.",
    constrains: ["cc:1.4:def:ccv1p4_imsdt_v1p4.Text.Type/texttype"],
    source: "IMS CC 1.4 — Discussion Topic Text.Type/@texttype — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:curriculum-standards-metadata/CC14-CSM-1",
    profile: "curriculum-standards-metadata",
    reqId: "CC14-CSM-1",
    level: "MUST",
    statement:
      "A CurriculumStandardsMetadataSet MUST contain at least one curriculumStandardsMetadata, each with at least one setOfGUIDs.",
    constrains: [
      "cc:1.4:def:ccv1p4_imscsmd_v1p1.CurriculumStandardsMetadataSet.Type/curriculumStandardsMetadata",
      "cc:1.4:def:ccv1p4_imscsmd_v1p1.CurriculumStandardsMetadata.Type/setOfGUIDs",
    ],
    source: "IMS CC 1.4 — Curriculum Standards Metadata (imscsmd_v1p1) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:authorization/CC14-AUTH-1",
    profile: "authorization",
    reqId: "CC14-AUTH-1",
    level: "MUST",
    statement:
      "An authorizations document MUST contain at least one authorization describing how to access a resource.",
    constrains: ["cc:1.4:def:ccv1p4_imsccauth_v1p4.Authorizations.Type/authorization"],
    source: "IMS CC 1.4 — Authorization (imsccauth_v1p4) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:assignment/CC14-ASN-1",
    profile: "assignment",
    reqId: "CC14-ASN-1",
    level: "MUST",
    statement: "An Assignment resource MUST carry a title and a text body describing the work the learner must submit.",
    constrains: [
      "cc:1.4:def:cc_extresource_assignmentv1p0_v1p0.Assignment.Type/title",
      "cc:1.4:def:cc_extresource_assignmentv1p0_v1p0.Assignment.Type/text",
    ],
    source: "IMS CC 1.4 — Assignment extension (cc_extresource_assignment) — https://www.imsglobal.org/spec/cc/v1p4",
  },
  {
    key: "cc:1.4:conf:assignment/CC14-ASN-2",
    profile: "assignment",
    reqId: "CC14-ASN-2",
    level: "MUST",
    statement:
      "An Assignment resource MUST declare the submission_formats it accepts (the submission types — html / text / url / file — the learner may submit).",
    constrains: ["cc:1.4:def:cc_extresource_assignmentv1p0_v1p0.Assignment.Type/submission_formats"],
    source: "IMS CC 1.4 — Assignment submission_formats — https://www.imsglobal.org/spec/cc/v1p4",
  },
];

export const commonCartridgeV1_4: SpecSource = {
  spec: "cc",
  version: "1.4",
  // Multi-file map: `def:`s are scoped by source schema so the `assignment` extension's
  // `Text.Type` / `Attachment.Type` stay distinct from Discussion Topic's.
  scopeXsdDefsBySource: true,
  // Same documented renames as CC 1.3, including xml:base→xmlBase (conform-ed models it here).
  specRefOverrides: [XS_ANY_EXTENSIONS, SIMPLE_CONTENT_VALUE, XML_BASE],
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
    {
      binding: "assignment",
      schemaPath: vendor("cc_extresource_assignmentv1p0_v1p0.xsd"),
      language: "xsd",
      zod: AssignmentSchema,
    },
  ],
  conformance,
};
