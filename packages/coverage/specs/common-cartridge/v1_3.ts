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
 * Documented normalisations (bridged by the `specRefOverrides` below, so they land in
 * `residues.normalisations` rather than as false `silentGaps` / `extensions`): the nameless
 * `xs:any` open-content point conform-ed names `extensions`; an XSD `simpleContent` text node
 * conform-ed names `value`; and the foreign `xml:base` attribute conform-ed names `xmlBase`.
 */

import { join } from "node:path";

import {
  CommonCartridgeAuthorizationsSchema,
  CommonCartridgeManifestRawSchema,
  CurriculumStandardsMetadataSetSchema,
  DiscussionTopicSchema,
  LomCcLtiLinkSchema,
  LomManifestSchema,
  LomResourceSchema,
  WebLinkSchema,
} from "@conform-ed/contracts/common-cartridge/v1_3";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";
import { SIMPLE_CONTENT_VALUE, XML_BASE, XS_ANY_EXTENSIONS } from "../xsd-normalisations";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "common-cartridge", "v1_3", file);

/**
 * Conformance catalogue — curated from the published CC 1.3 Conformance and Implementation
 * profile guides (https://www.imsglobal.org/cc/ccv1p3/imscc_Conformance-v1p3.html and
 * .../imscc_Implementation-v1p3.html), which carry the normative rules as prose (the CC XSDs
 * embed no RFC-2119 `xs:documentation`, so this map's `normativeStatements` is empty and the
 * catalogue is the whole conformance surface — there is no machine-extractable half to cite).
 * Requirement ids are synthesised per profile, grouped by the cartridge surface each governs:
 * `manifest` (the imscp packaging rules), then the per-resource-type bindings the map carries
 * (`web-link`, `discussion-topic`, `curriculum-standards-metadata`, `authorization`,
 * `lti-link`). Resource types that conform-ed validates through *other* maps (QTI assessment /
 * question bank, web content as plain files) have no L1 item here and are out of this catalogue.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "cc:1.3:conf:manifest/CC-MAN-1",
    profile: "manifest",
    reqId: "CC-MAN-1",
    level: "MUST",
    statement:
      "A Common Cartridge manifest MUST carry an identifier and exactly one organizations and one resources element.",
    constrains: [
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Manifest.Type/identifier",
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Manifest.Type/organizations",
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Manifest.Type/resources",
    ],
    source: "IMS CC 1.3 Conformance §manifest — https://www.imsglobal.org/cc/ccv1p3/imscc_Conformance-v1p3.html",
  },
  {
    key: "cc:1.3:conf:manifest/CC-MAN-2",
    profile: "manifest",
    reqId: "CC-MAN-2",
    level: "MUST",
    statement:
      "The manifest metadata MUST declare schema = 'IMS Common Cartridge' and schemaversion = '1.3.0', identifying the cartridge profile and version.",
    constrains: [
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.ManifestMetadata.Type/schema",
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.ManifestMetadata.Type/schemaversion",
    ],
    source:
      "IMS CC 1.3 Conformance §schema/schemaversion — https://www.imsglobal.org/cc/ccv1p3/imscc_Conformance-v1p3.html",
  },
  {
    key: "cc:1.3:conf:manifest/CC-MAN-3",
    profile: "manifest",
    reqId: "CC-MAN-3",
    level: "MUST",
    statement:
      "The organizations element MUST contain at most one organization (the predefined rooted-hierarchy); multiple organizations are not permitted.",
    constrains: ["cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Organizations.Type/organization"],
    source:
      "IMS CC 1.3 Conformance §organizations (single rooted-hierarchy) — https://www.imsglobal.org/cc/ccv1p3/imscc_Conformance-v1p3.html",
  },
  {
    key: "cc:1.3:conf:manifest/CC-RES-1",
    profile: "manifest",
    reqId: "CC-RES-1",
    level: "MUST",
    statement:
      "Every resource MUST carry an identifier and a type; a file-backed resource MUST reference its content via an href attribute or a file child element.",
    constrains: [
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Resource.Type/identifier",
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Resource.Type/type",
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Resource.Type/href",
      "cc:1.3:def:ccv1p3_imscp_v1p2_v1p0.Resource.Type/file",
    ],
    source: "IMS CC 1.3 Implementation §resources — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
  {
    key: "cc:1.3:conf:web-link/CC-WL-1",
    profile: "web-link",
    reqId: "CC-WL-1",
    level: "MUST",
    statement: "A Web Link resource MUST contain a webLink element carrying exactly one title and exactly one url.",
    constrains: ["cc:1.3:def:ccv1p3_imswl_v1p3.WebLink.Type/title", "cc:1.3:def:ccv1p3_imswl_v1p3.WebLink.Type/url"],
    source:
      "IMS CC 1.3 Implementation §Web Link (imswl_v1p3) — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
  {
    key: "cc:1.3:conf:web-link/CC-WL-2",
    profile: "web-link",
    reqId: "CC-WL-2",
    level: "MUST",
    statement: "The url element MUST carry an href attribute identifying the link target.",
    constrains: ["cc:1.3:def:ccv1p3_imswl_v1p3.URL.Type/href"],
    source:
      "IMS CC 1.3 Implementation §Web Link URL.Type — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
  {
    key: "cc:1.3:conf:web-link/CC-WL-3",
    profile: "web-link",
    reqId: "CC-WL-3",
    level: "MAY",
    statement:
      "The url element MAY carry a target attribute selecting the HTML anchor target window (e.g. _blank / _self) for the launched link.",
    constrains: ["cc:1.3:def:ccv1p3_imswl_v1p3.URL.Type/target"],
    source:
      "IMS CC 1.3 Implementation §Web Link URL.Type/@target — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
  {
    key: "cc:1.3:conf:discussion-topic/CC-DT-1",
    profile: "discussion-topic",
    reqId: "CC-DT-1",
    level: "MUST",
    statement: "A Discussion Topic resource MUST carry exactly one title and exactly one text body.",
    constrains: ["cc:1.3:def:ccv1p3_imsdt_v1p3.Topic.Type/title", "cc:1.3:def:ccv1p3_imsdt_v1p3.Topic.Type/text"],
    source:
      "IMS CC 1.3 Implementation §Discussion Topic (imsdt_v1p3) — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
  {
    key: "cc:1.3:conf:discussion-topic/CC-DT-2",
    profile: "discussion-topic",
    reqId: "CC-DT-2",
    level: "MUST",
    statement: "The text element MUST carry a texttype attribute whose value is 'text/html' or 'text/plain'.",
    constrains: ["cc:1.3:def:ccv1p3_imsdt_v1p3.Text.Type/texttype"],
    source:
      "IMS CC 1.3 Implementation §Discussion Topic Text.Type/@texttype — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
  {
    key: "cc:1.3:conf:curriculum-standards-metadata/CC-CSM-1",
    profile: "curriculum-standards-metadata",
    reqId: "CC-CSM-1",
    level: "MUST",
    statement:
      "A CurriculumStandardsMetadataSet MUST contain at least one curriculumStandardsMetadata, each with at least one setOfGUIDs.",
    constrains: [
      "cc:1.3:def:ccv1p3_imscsmd_v1p0.CurriculumStandardsMetadataSet.Type/curriculumStandardsMetadata",
      "cc:1.3:def:ccv1p3_imscsmd_v1p0.CurriculumStandardsMetadata.Type/setOfGUIDs",
    ],
    source:
      "IMS CC 1.3 Implementation §Curriculum Standards Metadata (imscsmd) — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
  {
    key: "cc:1.3:conf:authorization/CC-AUTH-1",
    profile: "authorization",
    reqId: "CC-AUTH-1",
    level: "MUST",
    statement:
      "An authorizations document MUST contain at least one authorization describing how to access a resource.",
    constrains: ["cc:1.3:def:ccv1p3_imsccauth_v1p3.Authorizations.Type/authorization"],
    source:
      "IMS CC 1.3 Implementation §Authorization (imsccauth_v1p3) — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
  {
    key: "cc:1.3:conf:lti-link/CC-LTI-1",
    profile: "lti-link",
    reqId: "CC-LTI-1",
    level: "MUST",
    statement: "A Basic LTI Link resource is carried as an IEEE LOM record whose general metadata identifies the link.",
    constrains: ["cc:1.3:def:ccv1p3_lomccltilink_v1p0.LOM.Type/general"],
    source:
      "IMS CC 1.3 Implementation §Basic LTI Link (lomccltilink) — https://www.imsglobal.org/cc/ccv1p3/imscc_Implementation-v1p3.html",
  },
];

export const commonCartridgeV1_3: SpecSource = {
  spec: "cc",
  version: "1.3",
  // Multi-file map: `def:`s are scoped by source schema (the three LOM profiles all
  // define `LOM.Type`, and the resource XSDs share boilerplate type names).
  scopeXsdDefsBySource: true,
  // conform-ed models xml:base (as xmlBase) here, so the `/base` items are renamed, not gaps.
  specRefOverrides: [XS_ANY_EXTENSIONS, SIMPLE_CONTENT_VALUE, XML_BASE],
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
    // The three LOM metadata profiles are all rooted at `<xs:element name="lom">` and all
    // define a (structurally distinct) `LOM.Type` — distinguished by source-scoped def keys.
    {
      binding: "ltiLink",
      rootElement: "lom",
      schemaPath: vendor("ccv1p3_lomccltilink_v1p0.xsd"),
      language: "xsd",
      zod: LomCcLtiLinkSchema,
    },
    {
      binding: "lomResource",
      rootElement: "lom",
      schemaPath: vendor("ccv1p3_lomresource_v1p0.xsd"),
      language: "xsd",
      zod: LomResourceSchema,
    },
    {
      binding: "lomManifest",
      rootElement: "lom",
      schemaPath: vendor("ccv1p3_lommanifest_v1p0.xsd"),
      language: "xsd",
      zod: LomManifestSchema,
    },
  ],
  conformance,
};
