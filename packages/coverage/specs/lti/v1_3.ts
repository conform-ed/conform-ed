/**
 * LTI 1.3 + Advantage — {@link SpecSource} (conform-ed ADR-0013; emergent ADR-0033
 * rollout). The hybrid map: a thin **schema-reconciled spine** (Assignment & Grade
 * Services), **curated denominators** for the prose-only payloads (Deep Linking content
 * items + the NRPS membership container, ADR-0017), a **value-set** check for the role
 * vocabulary, and a **guide-curated catalogue** (Core launch, Security, the remaining service
 * requirements) with no `cited` denominator — the CC/QTI catalogue shape.
 *
 * Deep Linking and NRPS publish no machine-readable schema, so before ADR-0017 the conform-ed
 * Zod was its own yardstick — and a real under-modelling (the html content item's `html`
 * payload, the image item's dimensions) sat undetected. The curated JSON Schemas under
 * `vendor/lti/v1_3/curated/` now give those payloads a hand-authored, spec-cited denominator
 * (walked by `walkers/curated.ts`), reconciled against the conform-ed contracts so a future
 * regression surfaces as a silent gap. The LTI **role vocabulary** is a controlled value-set,
 * not an object shape — the structural property-join cannot verify it — so it is checked by
 * the ADR-0017 value-set extension: every published role is `safeParse`d against
 * `KnownLtiRoleSchema`, and a member conform-ed fails to recognise is a value-set gap.
 *
 * Why hybrid (verified against the published specs, 2026-06-21):
 *
 *  - **AGS 2.0** is the only LTI service 1EdTech ships any machine-readable artifact
 *    for: an *illustrative* OpenAPI (`[AGS-OpenAPI]`, §3.2.1/§3.3.4/§3.4.3) whose five
 *    1EdTech-named media-type schemas (lineitem / lineitemcontainer / score / result /
 *    resultcontainer) are **inlined under the path media types** — no `components.schemas`,
 *    no `$ref`. The vendored `ims_lti_ags_v2p0_openapi3_v1p0.json` is that document with
 *    those five schemas lifted **verbatim** into `components.schemas` (lineitem = the
 *    response superset; the lift is byte-asserted against the source). This is a
 *    documented, lossless relocation of 1EdTech's own artifact — the Caliper precedent —
 *    recorded in `vendor/lti/v1_3/PROVENANCE.md`. Each lifted schema reconciles against
 *    its {@link LtiAgsV2_0} Zod root, so AGS earns a real L2 denominator (`modelledYes` +
 *    honest extensions where conform-ed models more than the illustrative OpenAPI).
 *  - **NRPS 2.0 / Core 1.3 / Deep Linking 2.0** publish NO schema at all — inline JSON
 *    examples + normative prose only (the membership container, the launch claims, the
 *    deep-linking messages). They are guide-catalogue-only.
 *
 * `cited` (the schema-prose denominator) is **0 across every profile**, AGS included:
 * the AGS OpenAPI descriptions use prose-case "must", not the ALL-CAPS RFC-2119 "MUST"
 * the `normativeStatementsCited` metric keys on (exactly as the XSD-family CC/QTI maps).
 * So the schema-backed-vs-catalogue distinction here is **L2 reconciliation** (AGS:
 * `modelledYes`), not `cited`. The AGS conformance requirements still cross-link to the
 * real schema anchors (`constrains` → the lifted `def:` keys) and the transport
 * operations, which the sync test validates.
 *
 * Wire-vs-Zod: the AGS media-type schemas are camelCase on both sides (the JSON binding),
 * so — unlike QTI's XML↔JSON binding — **no `nameNormalizer` is needed** for the L2 join.
 * The snake_case names (the `resource_link_id` / `user_id` query filters) and the URN
 * scopes/claims live only on the transport axis and in the catalogue, never in the
 * reconciled information model.
 *
 * Roles: emergent is an LTI **tool** (provider); the catalogue is authored for the tool
 * role. The PLATFORM role is out of scope (ADR-0033) — recorded in the emergent overlay,
 * not here.
 */

import { join } from "node:path";

import { DocumentTargetSchema, KnownLtiRoleSchema } from "@conform-ed/contracts/lti";
import {
  LineItemContainerSchema,
  LineItemSchema,
  ResultContainerSchema,
  ResultSchema,
  ScoreSchema,
} from "@conform-ed/contracts/lti/ags/v2_0";
import {
  ContentItemSchema,
  ContentItemTypeSchema,
  DeepLinkingSettingsSchema,
} from "@conform-ed/contracts/lti/deep-linking/v2_0";
import { MembershipContainerSchema } from "@conform-ed/contracts/lti/nrps/v2_0";
import { CoreLaunchRequestSchema } from "@conform-ed/contracts/lti/v1_3";

import type { SpecBindingSource, SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const agsOpenApi = "ims_lti_ags_v2p0_openapi3_v1p0.json";
const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "lti", "v1_3", file);

/** binding (the lifted AGS `components.schemas` name) → its conform-ed Zod root. */
const binding = (component: string, zod: SpecBindingSource["zod"]): SpecBindingSource => ({
  binding: component,
  schemaPath: vendor(agsOpenApi),
  language: "openapi",
  ...(zod !== undefined ? { zod } : {}),
});

/**
 * Conformance catalogue — curated from the published 1EdTech LTI 1.3 Core + Advantage
 * material for the **tool** role: the LTI Advantage Conformance & Certification Guide
 * (https://www.imsglobal.org/spec/lti/v1p3/cert/), the 1EdTech Security Framework 1.1,
 * and the four service specs (Core, NRPS 2.0, AGS 2.0, Deep Linking 2.0, Proctoring 1.0).
 * Profiles follow the Advantage services: `core` (the OIDC launch), `security` (the JWT /
 * OAuth foundation), `nrps`, `ags`, `deep-linking`, `proctoring`.
 *
 * Only `ags` has a literal denominator (the lifted OpenAPI), so only its requirements
 * `constrains` real `def:`/`path:`/`param:` anchors (the sync test asserts they exist).
 * Every other profile is **guide-only** — 1EdTech publishes no schema for the launch
 * claims, the membership container or the deep-linking messages — so those requirements
 * carry `constrains: []` (no machine denominator to anchor to, recorded honestly rather
 * than invented). `cited` is 0 throughout: even the AGS anchors are not normative-flagged
 * (the AGS OpenAPI prose is prose-case "must", not the ALL-CAPS RFC-2119 the metric reads).
 */
const conformance: readonly ConformanceRequirement[] = [
  // --- Core 1.3 launch (the OIDC resource-link launch) ----------------------------
  {
    key: "lti:1.3:conf:core/LTI-CORE-1",
    profile: "core",
    reqId: "LTI-CORE-1",
    level: "MUST",
    statement:
      "A tool MUST implement the OpenID Connect third-party-initiated login: on the login initiation it returns an authentication request to the platform's authorization endpoint. Every launch follows OIDC — there are no exceptions.",
    constrains: [],
    source: "LTI Core 1.3 §5.1.1 (OIDC login) / Advantage Cert §4.2.2 — https://www.imsglobal.org/spec/lti/v1p3/cert/",
  },
  {
    key: "lti:1.3:conf:core/LTI-CORE-2",
    profile: "core",
    reqId: "LTI-CORE-2",
    level: "MUST",
    statement:
      "A tool MUST validate the id_token: a JWT signed (RS256) with the platform key resolved via its JWKS, with valid iss, aud, exp and iat, and the nonce the tool issued — rejecting any that fail.",
    constrains: [],
    source:
      "1EdTech Security Framework 1.1 §5.1.3 / LTI Core 1.3 §5.1.3 — https://www.imsglobal.org/spec/security/v1p1",
  },
  {
    key: "lti:1.3:conf:core/LTI-CORE-3",
    profile: "core",
    reqId: "LTI-CORE-3",
    level: "MUST",
    statement:
      "A resource-link launch MUST carry the required claims: message_type=LtiResourceLinkRequest, version=1.3.0, the deployment_id, the target_link_uri, and the resource_link claim with an id.",
    // Anchored to the ADR-0017 curated launch-claim denominator.
    constrains: [
      "lti:1.3:doc:CoreLaunchRequest/messageType",
      "lti:1.3:doc:CoreLaunchRequest/version",
      "lti:1.3:doc:CoreLaunchRequest/deploymentId",
      "lti:1.3:doc:CoreLaunchRequest/targetLinkUri",
      "lti:1.3:def:ClResourceLink/id",
    ],
    source: "LTI Core 1.3 §4.2 (required message claims) / §5 — https://www.imsglobal.org/spec/lti/v1p3/",
  },
  {
    key: "lti:1.3:conf:core/LTI-CORE-4",
    profile: "core",
    reqId: "LTI-CORE-4",
    level: "MUST",
    statement:
      "The launch MUST carry the roles claim (an array of role URIs) binding the user to the context; the tool authorizes from it.",
    // Anchored to the ADR-0017 value-set denominator: conform-ed must recognise every published
    // role (verified by safeParse against KnownLtiRoleSchema), not merely accept an array.
    constrains: ["lti:1.3:doc:RoleVocabulary/role"],
    source: "LTI Core 1.3 §5.3.3 (roles claim) — https://www.imsglobal.org/spec/lti/v1p3/",
  },
  {
    key: "lti:1.3:conf:core/LTI-CORE-5",
    profile: "core",
    reqId: "LTI-CORE-5",
    level: "MUST",
    statement:
      "A tool MUST reject a launch missing a required claim, carrying the wrong LTI version, with an invalid iat/exp, or whose JWT signature or kid does not verify.",
    constrains: [],
    source: "LTI Advantage Cert §6.1.1 (known-bad payloads) — https://www.imsglobal.org/spec/lti/v1p3/cert/",
  },

  // --- Security foundation (JWT + OAuth 2.0) ---------------------------------------
  {
    key: "lti:1.3:conf:security/LTI-SEC-1",
    profile: "security",
    reqId: "LTI-SEC-1",
    level: "MUST",
    statement:
      "All JWT signing and verification MUST use asymmetric RSA-256; symmetric cryptosystems are forbidden and a JWT MUST be signed only with the holder's private key.",
    constrains: [],
    source: "LTI Advantage Cert §4.2 (security requirements) — https://www.imsglobal.org/spec/lti/v1p3/cert/",
  },
  {
    key: "lti:1.3:conf:security/LTI-SEC-2",
    profile: "security",
    reqId: "LTI-SEC-2",
    level: "MUST",
    statement: "All communication endpoints MUST be secured with TLS (SSL alone is forbidden).",
    constrains: [],
    source: "LTI Advantage Cert §4.2 (TLS) — https://www.imsglobal.org/spec/lti/v1p3/cert/",
  },
  {
    key: "lti:1.3:conf:security/LTI-SEC-3",
    profile: "security",
    reqId: "LTI-SEC-3",
    level: "MUST",
    statement:
      "A tool MUST expose its public keys for the platform to verify the tool's JWTs — a JWKS URL (recommended) or a registered public key.",
    constrains: [],
    source: "LTI Advantage Cert §4.2.2.1 (JWKS exchange) — https://www.imsglobal.org/spec/lti/v1p3/cert/",
  },
  {
    key: "lti:1.3:conf:security/LTI-SEC-4",
    profile: "security",
    reqId: "LTI-SEC-4",
    level: "MUST",
    statement:
      "To call a service (NRPS / AGS) a tool MUST obtain an OAuth 2.0 access token via the client-credentials grant, presenting a signed client-assertion JWT and requesting the service scope.",
    constrains: [],
    source:
      "1EdTech Security Framework 1.1 §4 (client-credentials grant) — https://www.imsglobal.org/spec/security/v1p1",
  },

  // --- Names & Role Provisioning Services 2.0 (guide-only; no published schema) -----
  {
    key: "lti:1.3:conf:nrps/LTI-NRPS-1",
    profile: "nrps",
    reqId: "LTI-NRPS-1",
    level: "MUST",
    statement:
      "A tool consumes the NRPS claim (context_memberships_url + service_versions) from the launch to locate the membership service.",
    constrains: [],
    source: "LTI NRPS 2.0 §2 (the names and role service claim) — https://www.imsglobal.org/spec/lti-nrps/v2p0",
  },
  {
    key: "lti:1.3:conf:nrps/LTI-NRPS-2",
    profile: "nrps",
    reqId: "LTI-NRPS-2",
    level: "MUST",
    statement:
      "A tool retrieves the membership container (media type application/vnd.ims.lti-nrps.v2.membershipcontainer+json) via GET on the context membership URL, following Link-header paging.",
    // Anchored to the ADR-0017 curated membership-container denominator.
    constrains: ["lti:1.3:doc:NrpsMembershipContainer", "lti:1.3:doc:NrpsMembershipContainer/members"],
    source: "LTI NRPS 2.0 §2.1 (membership container) — https://www.imsglobal.org/spec/lti-nrps/v2p0",
  },
  {
    key: "lti:1.3:conf:nrps/LTI-NRPS-3",
    profile: "nrps",
    reqId: "LTI-NRPS-3",
    level: "MUST",
    statement:
      "Each member carries a user_id (the launch sub) and a roles array; a member with status Inactive/Deleted MUST be honoured (not treated as active).",
    // Anchored to the curated member shape (the status field is conform-ed's enum gate).
    constrains: ["lti:1.3:def:NrpsMember/userId", "lti:1.3:def:NrpsMember/roles", "lti:1.3:def:NrpsMember/status"],
    source: "LTI NRPS 2.0 §4.2 (membership / member status) — https://www.imsglobal.org/spec/lti-nrps/v2p0",
  },
  {
    key: "lti:1.3:conf:nrps/LTI-NRPS-4",
    profile: "nrps",
    reqId: "LTI-NRPS-4",
    level: "MUST",
    statement:
      "The membership request MUST be authorized by an OAuth 2.0 access token bearing the scope https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly.",
    constrains: [],
    source: "LTI NRPS 2.0 §3 (accessing the service) — https://www.imsglobal.org/spec/lti-nrps/v2p0",
  },

  // --- Assignment & Grade Services 2.0 (the schema-reconciled spine) ----------------
  {
    key: "lti:1.3:conf:ags/LTI-AGS-1",
    profile: "ags",
    reqId: "LTI-AGS-1",
    level: "MUST",
    statement:
      "A tool reads the AGS endpoint claim — the lineitems URL and the scopes it was granted (lineitem, lineitem.readonly, result.readonly, score) — and restricts itself to those scopes. (The claim is an LTI launch claim, not part of the AGS OpenAPI, so it has no schema anchor here.)",
    constrains: [],
    source: "LTI AGS 2.0 §3.1 (the AGS claim) — https://www.imsglobal.org/spec/lti-ags/v2p0",
  },
  {
    key: "lti:1.3:conf:ags/LTI-AGS-2",
    profile: "ags",
    reqId: "LTI-AGS-2",
    level: "MUST",
    statement: "A line item MUST carry a label (the gradebook-column title) and a scoreMaximum.",
    constrains: ["lti:1.3:def:LineItem/label", "lti:1.3:def:LineItem/scoreMaximum"],
    source: "LTI AGS 2.0 §3.2.7 (label) / §3.2.8 (scoreMaximum) — https://www.imsglobal.org/spec/lti-ags/v2p0",
  },
  {
    key: "lti:1.3:conf:ags/LTI-AGS-3",
    profile: "ags",
    reqId: "LTI-AGS-3",
    level: "MUST",
    statement:
      "A line item is identified by an id URL present on all responses, and MAY bind to a resource link (resourceLinkId) and a tool resource (resourceId).",
    constrains: ["lti:1.3:def:LineItem/id", "lti:1.3:def:LineItem/resourceLinkId", "lti:1.3:def:LineItem/resourceId"],
    source: "LTI AGS 2.0 §3.2.3 (line item id) / §3.2.9 / §3.2.10 — https://www.imsglobal.org/spec/lti-ags/v2p0",
  },
  {
    key: "lti:1.3:conf:ags/LTI-AGS-4",
    profile: "ags",
    reqId: "LTI-AGS-4",
    level: "MUST",
    statement:
      "The line item container (GET /lineitems) returns a paged array of line items, filterable by resource_link_id, resource_id and tag and paged by limit/page.",
    constrains: [
      "lti:1.3:def:LineItemContainer",
      "lti:1.3:path:ags/GET /{contextId}/lineitems",
      "lti:1.3:param:resource_link_id",
      "lti:1.3:param:resource_id",
      "lti:1.3:param:tag",
      "lti:1.3:param:limit",
      "lti:1.3:param:page",
    ],
    source: "LTI AGS 2.0 §3.2 / §3.2.4 (container request filters) — https://www.imsglobal.org/spec/lti-ags/v2p0",
  },
  {
    key: "lti:1.3:conf:ags/LTI-AGS-5",
    profile: "ags",
    reqId: "LTI-AGS-5",
    level: "MUST",
    statement:
      "A tool publishes a score by POSTing to the scores endpoint; the Score MUST carry userId, activityProgress, gradingProgress and timestamp.",
    constrains: [
      "lti:1.3:def:Score/userId",
      "lti:1.3:def:Score/activityProgress",
      "lti:1.3:def:Score/gradingProgress",
      "lti:1.3:def:Score/timestamp",
      "lti:1.3:path:ags/POST /{contextId}/lineitems/{lineItemId}/scores",
    ],
    source: "LTI AGS 2.0 §3.4 (score publish service) — https://www.imsglobal.org/spec/lti-ags/v2p0",
  },
  {
    key: "lti:1.3:conf:ags/LTI-AGS-6",
    profile: "ags",
    reqId: "LTI-AGS-6",
    level: "MUST",
    statement: "When scoreGiven is present it MUST be accompanied by scoreMaximum (the scale it is given in).",
    constrains: ["lti:1.3:def:Score/scoreGiven", "lti:1.3:def:Score/scoreMaximum"],
    source: "LTI AGS 2.0 §3.4.4 (scoreGiven and scoreMaximum) — https://www.imsglobal.org/spec/lti-ags/v2p0",
  },
  {
    key: "lti:1.3:conf:ags/LTI-AGS-7",
    profile: "ags",
    reqId: "LTI-AGS-7",
    level: "MUST",
    statement:
      "The result container (GET …/results, filterable by user_id) returns results; a Result references its line item (scoreOf), the user (userId) and the achieved and maximum scores (resultScore / resultMaximum).",
    constrains: [
      "lti:1.3:def:ResultContainer",
      "lti:1.3:def:Result/scoreOf",
      "lti:1.3:def:Result/userId",
      "lti:1.3:def:Result/resultScore",
      "lti:1.3:def:Result/resultMaximum",
      "lti:1.3:path:ags/GET /{contextId}/lineitems/{lineItemId}/results",
      "lti:1.3:param:user_id",
    ],
    source: "LTI AGS 2.0 §3.3 (result service) — https://www.imsglobal.org/spec/lti-ags/v2p0",
  },
  {
    key: "lti:1.3:conf:ags/LTI-AGS-8",
    profile: "ags",
    reqId: "LTI-AGS-8",
    level: "MUST",
    statement:
      "A tool manages line items over the full REST surface: create (POST /lineitems) and read/update/delete the single line item (GET/PUT/DELETE …/lineitems/{lineItemId}).",
    constrains: [
      "lti:1.3:path:ags/POST /{contextId}/lineitems",
      "lti:1.3:path:ags/GET /{contextId}/lineitems/{lineItemId}",
      "lti:1.3:path:ags/PUT /{contextId}/lineitems/{lineItemId}",
      "lti:1.3:path:ags/DELETE /{contextId}/lineitems/{lineItemId}",
    ],
    source: "LTI AGS 2.0 §3.2.3 / §3.2.5 / §3.2.6 (line item endpoints) — https://www.imsglobal.org/spec/lti-ags/v2p0",
  },

  // --- Deep Linking 2.0 (guide-only; not built — deferred in the emergent overlay) --
  {
    key: "lti:1.3:conf:deep-linking/LTI-DL-1",
    profile: "deep-linking",
    reqId: "LTI-DL-1",
    level: "MUST",
    statement:
      "A LtiDeepLinkingRequest carries the deep_linking_settings claim with deep_link_return_url, accept_types and accept_presentation_document_targets.",
    // Anchored to the ADR-0017 curated settings denominator.
    constrains: [
      "lti:1.3:doc:DeepLinkingSettings/deepLinkReturnUrl",
      "lti:1.3:doc:DeepLinkingSettings/acceptTypes",
      "lti:1.3:doc:DeepLinkingSettings/acceptPresentationDocumentTargets",
    ],
    source: "LTI Deep Linking 2.0 §4.4 (deep linking settings) — https://www.imsglobal.org/spec/lti-dl/v2p0",
  },
  {
    key: "lti:1.3:conf:deep-linking/LTI-DL-2",
    profile: "deep-linking",
    reqId: "LTI-DL-2",
    level: "MUST",
    statement:
      "The request lti_message_type MUST be LtiDeepLinkingRequest and the tool's reply LtiDeepLinkingResponse.",
    constrains: [],
    source: "LTI Deep Linking 2.0 §4.4.2 / §4.5 (message types) — https://www.imsglobal.org/spec/lti-dl/v2p0",
  },
  {
    key: "lti:1.3:conf:deep-linking/LTI-DL-3",
    profile: "deep-linking",
    reqId: "LTI-DL-3",
    level: "MUST",
    statement:
      "The tool returns the selection as a signed JWT carrying the content_items claim (a JSON array of the selected content items: ltiResourceLink, link, file, html or image).",
    // Anchored to the ADR-0017 curated content-item denominator (the gap-prone per-type
    // fields: the html item's payload, the image item's dimensions, the file item's metadata).
    constrains: [
      "lti:1.3:doc:DeepLinkingContentItem",
      "lti:1.3:def:DlHtml/html",
      "lti:1.3:def:DlImage/width",
      "lti:1.3:def:DlImage/height",
      "lti:1.3:def:DlFile/mediaType",
      "lti:1.3:def:DlFile/expiresAt",
    ],
    source: "LTI Deep Linking 2.0 §3 / §4.5.6 (content items) — https://www.imsglobal.org/spec/lti-dl/v2p0",
  },
  {
    key: "lti:1.3:conf:deep-linking/LTI-DL-4",
    profile: "deep-linking",
    reqId: "LTI-DL-4",
    level: "MUST",
    statement:
      "After encoding the response JWT the tool MUST redirect the workflow to the deep_link_return_url via an auto-submitted form.",
    constrains: [],
    source: "LTI Deep Linking 2.0 §2.3 (redirect back) — https://www.imsglobal.org/spec/lti-dl/v2p0",
  },

  // --- Proctoring 1.0 (guide-only; not built — deferred in the emergent overlay) ----
  {
    key: "lti:1.3:conf:proctoring/LTI-PROC-1",
    profile: "proctoring",
    reqId: "LTI-PROC-1",
    level: "MUST",
    statement:
      "A proctoring tool receives the LtiStartProctoring message (with the proctoring_settings and the start_assessment_url) and only launches the assessment via the start_assessment_url once proctoring setup completes.",
    constrains: [],
    source: "LTI Proctoring Services 1.0 §4 (start proctoring) — https://www.imsglobal.org/spec/proctoring/v1p0",
  },
  {
    key: "lti:1.3:conf:proctoring/LTI-PROC-2",
    profile: "proctoring",
    reqId: "LTI-PROC-2",
    level: "MUST",
    statement:
      "The tool returns control to the platform with an LtiEndAssessment message at the end of the attempt (and MAY surface an Assessment Control Service verdict during it).",
    constrains: [],
    source: "LTI Proctoring Services 1.0 §5 (end assessment / ACS) — https://www.imsglobal.org/spec/proctoring/v1p0",
  },
];

export const ltiV1_3: SpecSource = {
  spec: "lti",
  version: "1.3",
  bindings: [
    binding("LineItem", LineItemSchema),
    binding("LineItemContainer", LineItemContainerSchema),
    binding("Score", ScoreSchema),
    binding("Result", ResultSchema),
    binding("ResultContainer", ResultContainerSchema),
    // Curated denominator (ADR-0017): Deep Linking publishes no schema for content items,
    // so this hand-authored JSON Schema gives the content-item union a real L2 denominator,
    // reconciled against the per-type discriminated union in conform-ed's contracts.
    {
      binding: "DeepLinkingContentItem",
      schemaPath: vendor("curated/deep-linking-content-item.schema.json"),
      language: "curated",
      zod: ContentItemSchema,
    },
    // Curated denominator (ADR-0017): NRPS publishes no schema for the membership container,
    // reconciled against conform-ed's MembershipContainerSchema.
    {
      binding: "NrpsMembershipContainer",
      schemaPath: vendor("curated/nrps-membership-container.schema.json"),
      language: "curated",
      zod: MembershipContainerSchema,
    },
    // Curated denominator (ADR-0017): Core 1.3 publishes no schema for the launch claims,
    // reconciled against conform-ed's CoreLaunchRequestSchema.
    {
      binding: "CoreLaunchRequest",
      schemaPath: vendor("curated/core-launch-request.schema.json"),
      language: "curated",
      zod: CoreLaunchRequestSchema,
    },
    // Curated denominator (ADR-0017): Deep Linking publishes no schema for the settings claim,
    // reconciled against conform-ed's DeepLinkingSettingsSchema.
    {
      binding: "DeepLinkingSettings",
      schemaPath: vendor("curated/deep-linking-settings.schema.json"),
      language: "curated",
      zod: DeepLinkingSettingsSchema,
    },
    // Value-set-only (ADR-0017): the role vocabulary is a controlled value-set modelled by a
    // refinement, not an object shape — it contributes its members for value-set verification
    // and is excluded from the structural reconciliation.
    {
      binding: "RoleVocabulary",
      schemaPath: vendor("curated/role-vocabulary.schema.json"),
      language: "curated",
      valueSetOnly: true,
    },
  ],
  // Value-set verification (ADR-0017): each published vocabulary member is safeParse'd against
  // the conform-ed Zod that models one member, so a member conform-ed fails to accept surfaces
  // as a value-set gap — the check the structural property-join cannot do. The role vocabulary
  // (a refinement, invisible to JSON-Schema rendering) and the Deep Linking / launch enums.
  valueSets: [
    { item: "lti:1.3:doc:RoleVocabulary/role", element: KnownLtiRoleSchema },
    { item: "lti:1.3:def:ClLaunchPresentation/documentTarget", element: DocumentTargetSchema },
    { item: "lti:1.3:doc:DeepLinkingSettings/acceptTypes/[]", element: ContentItemTypeSchema },
    { item: "lti:1.3:doc:DeepLinkingSettings/acceptPresentationDocumentTargets/[]", element: DocumentTargetSchema },
  ],
  // Transport axis: the AGS OpenAPI `paths` (operations + query filters; no security
  // scheme is declared — AGS keeps OAuth out of band), inventoried as L1-only items the
  // AGS REST-binding requirements cross-link to.
  restServices: [{ service: "ags", schemaPath: vendor(agsOpenApi) }],
  conformance,
};
