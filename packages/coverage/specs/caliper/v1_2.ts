/**
 * Caliper Analytics 1.2 — {@link SpecSource} (conform-ed ADR-0013; emergent ADR-0028
 * rollout). A JSON-Schema-family map walked from the bundled bootcamp distribution by
 * `src/walkers/caliper.ts`.
 *
 * ⚠️ **Provenance caveat.** Unlike every other map's denominator, 1EdTech publishes no
 * canonical Caliper schema release at a `purl.imsglobal.org` spec URL. The literal
 * denominator here is the **CaliperBootcamp** GitHub repo (`schemas/v1_2/*.json`, pinned
 * commit `0a2d118`) — developer-education material that nonetheless self-identifies as
 * the Caliper model (`metaFormat: http://purl.imsglobal.org/caliper/`) and is the only
 * versionable machine-readable artifact 1EdTech ships. Accepted as the denominator on
 * Anton's call; the weaker provenance is recorded in `meta.sources[].id` and in
 * `vendor/caliper/v1_2/PROVENANCE.md`. Re-vendor + re-pin if a canonical release appears.
 *
 * Bindings are the document/entry types conform-ed treats as Caliper entry points
 * (Envelope transport, the Event hierarchy, core Entities); the walker bundles all 110
 * types so every referenced definition is inventoried regardless. Caliper uses camelCase
 * JSON property names on both sides, so no name-normalisation is needed, and the bundle
 * is a single document, so no source-scoping.
 *
 * **Value-set verification (ADR-0017).** Caliper carries five controlled vocabularies in the
 * denominator — the `Action` term list (80), the `Membership.roles` vocabulary (56), the
 * `Profile` list (15), the `Metric` list (8) and the entity `Status` (2) — that the structural
 * property-join cannot check (it matches property *names*, never enumerated *values*). Each is
 * verified by safeParse'ing every published member against the conform-ed `z.enum` that models it
 * (`ActionSchema` / `RoleSchema` / `ProfileSchema` / `MetricSchema` / `StatusSchema`): all 161
 * members are accepted, so conform-ed's five vocabularies match the bootcamp denominator exactly.
 * The role vocabulary was previously a permissive `z.looseObject({})`; it is now modelled as the
 * `CALIPER_ROLES` enum (the eight base roles + their `Base#Subrole` LIS specialisations) so the
 * value-set verifies the full 56-term list. The one remaining enum-bearing denominator item left
 * unverified is `SystemIdentifier.identifierType` — the bootcamp lists a single `LtiUserId`, which
 * conform-ed mirrors as a `z.literal`, so there is no multi-member vocabulary to check.
 */

import { join } from "node:path";

import {
  ActionSchema,
  CaliperV1P2JsonSchemaEntryPoints,
  MetricSchema,
  ProfileSchema,
  RoleSchema,
  StatusSchema,
} from "@conform-ed/contracts/caliper/v1_2";

import type { SpecBindingSource, SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "caliper", "v1_2", file);

/** binding (the entity id == its vendored `<id>.json` file) → its conform-ed Zod root. */
const entity = (id: string, zod: SpecBindingSource["zod"]): SpecBindingSource => ({
  binding: id,
  schemaPath: vendor(`${id}.json`),
  language: "caliper",
  ...(zod !== undefined ? { zod } : {}),
});

/**
 * Conformance catalogue — curated from the published Caliper 1.2 specification &
 * certification guide (https://www.imsglobal.org/spec/caliper/v1p2). Caliper certifies a
 * **Sensor** that emits conformant event data; its 15 activity profiles (Assessment, Session,
 * Reading, …) constrain which events/actions are valid per learning activity. This catalogue
 * covers the cross-profile information-model rules the schema carries — the Envelope transport,
 * the Event required fields, the Entity required fields, and the identifier rule.
 *
 * The identifier rule is the ONLY RFC-2119 prose the bundled schema embeds, and it is
 * documented IDENTICALLY on the `id` field of every one of the 99 inventoried types (an Event
 * id MUST be a urn:uuid; an Entity id MUST be a unique, persistent IRI). CAL-ID-1 therefore
 * constrains every one of those `id` items via {@link EVERY_TYPE_ID} — the single rule
 * genuinely governs each, so `normativeStatementsCited` reflects the full extracted surface
 * (99/99), not an arbitrary sample.
 *
 * Per ADR-0018 the whole Caliper information model is now modelled (every object type is a binding,
 * reconciling against its deepened conform-ed Zod schema), in support of emergent adopting Caliper as
 * a second analytics rail in both Sensor and Endpoint roles (emergent ADR-0041/0042). The board has
 * three tiers: the 8 cross-profile data-model MUSTs (the spine), and the `sender` / `endpoint` role
 * profiles carrying the transport obligations from the spec's §5.4 / §6 (each at its true RFC-2119
 * level — MUST vs SHOULD). Per-profile event constraints (which actions/objects each metric profile
 * permits) live in the information model + `validateCaliperEvent`, sourced from the §3 profile tables.
 *
 * Provenance (strengthened, ADR-0018): the structural denominator remains the CaliperBootcamp JSON
 * schemas (1EdTech publishes no canonical Caliper schema release — see `vendor/.../PROVENANCE.md`),
 * but the conformance surface is independently grounded in the published Caliper 1.2 prose spec: the
 * five controlled vocabularies are value-set-verified, the per-profile event rules are transcribed
 * verbatim from the §3 profile tables, and the transport requirements quote §5.4 / §6. A certifier
 * thus sees a full-conformance claim resting on the prose spec, not on the bootcamp material alone.
 */

/**
 * Every inventoried Caliper type carries the same `id` MUST (Event → urn:uuid, Entity →
 * persistent IRI). CAL-ID-1 constrains them all; kept as an explicit list so the
 * referential-integrity test stays a pure structural check against the generated inventory.
 */
const EVERY_TYPE_ID: readonly string[] = [
  "caliper:1.2:def:Agent/id",
  "caliper:1.2:def:AggregateMeasure/id",
  "caliper:1.2:def:AggregateMeasureCollection/id",
  "caliper:1.2:def:Annotation/id",
  "caliper:1.2:def:AnnotationEvent/id",
  "caliper:1.2:def:Assessment/id",
  "caliper:1.2:def:AssessmentEvent/id",
  "caliper:1.2:def:AssessmentItem/id",
  "caliper:1.2:def:AssessmentItemEvent/id",
  "caliper:1.2:def:AssignableDigitalResource/id",
  "caliper:1.2:def:AssignableEvent/id",
  "caliper:1.2:def:Attempt/id",
  "caliper:1.2:def:AudioObject/id",
  "caliper:1.2:def:BookmarkAnnotation/id",
  "caliper:1.2:def:Chapter/id",
  "caliper:1.2:def:Collection/id",
  "caliper:1.2:def:Comment/id",
  "caliper:1.2:def:CourseOffering/id",
  "caliper:1.2:def:CourseSection/id",
  "caliper:1.2:def:DateTimeQuestion/id",
  "caliper:1.2:def:DateTimeResponse/id",
  "caliper:1.2:def:DigitalResource/id",
  "caliper:1.2:def:DigitalResourceCollection/id",
  "caliper:1.2:def:Document/id",
  "caliper:1.2:def:Entity/id",
  "caliper:1.2:def:Event/id",
  "caliper:1.2:def:FeedbackEvent/id",
  "caliper:1.2:def:FillinBlankResponse/id",
  "caliper:1.2:def:Forum/id",
  "caliper:1.2:def:ForumEvent/id",
  "caliper:1.2:def:Frame/id",
  "caliper:1.2:def:GradeEvent/id",
  "caliper:1.2:def:Group/id",
  "caliper:1.2:def:HighlightAnnotation/id",
  "caliper:1.2:def:ImageObject/id",
  "caliper:1.2:def:LearningObjective/id",
  "caliper:1.2:def:LikertScale/id",
  "caliper:1.2:def:Link/id",
  "caliper:1.2:def:LtiLink/id",
  "caliper:1.2:def:LtiSession/id",
  "caliper:1.2:def:MediaEvent/id",
  "caliper:1.2:def:MediaLocation/id",
  "caliper:1.2:def:MediaObject/id",
  "caliper:1.2:def:Membership/id",
  "caliper:1.2:def:Message/id",
  "caliper:1.2:def:MessageEvent/id",
  "caliper:1.2:def:MultipleChoiceResponse/id",
  "caliper:1.2:def:MultipleResponseResponse/id",
  "caliper:1.2:def:MultiselectQuestion/id",
  "caliper:1.2:def:MultiselectResponse/id",
  "caliper:1.2:def:MultiselectScale/id",
  "caliper:1.2:def:NavigationEvent/id",
  "caliper:1.2:def:NumericScale/id",
  "caliper:1.2:def:OpenEndedQuestion/id",
  "caliper:1.2:def:OpenEndedResponse/id",
  "caliper:1.2:def:Organization/id",
  "caliper:1.2:def:OutcomeEvent/id",
  "caliper:1.2:def:Page/id",
  "caliper:1.2:def:Person/id",
  "caliper:1.2:def:Query/id",
  "caliper:1.2:def:Question/id",
  "caliper:1.2:def:Questionnaire/id",
  "caliper:1.2:def:QuestionnaireEvent/id",
  "caliper:1.2:def:QuestionnaireItem/id",
  "caliper:1.2:def:QuestionnaireItemEvent/id",
  "caliper:1.2:def:Rating/id",
  "caliper:1.2:def:RatingScaleQuestion/id",
  "caliper:1.2:def:RatingScaleResponse/id",
  "caliper:1.2:def:Reading/id",
  "caliper:1.2:def:ReadingEvent/id",
  "caliper:1.2:def:ResourceManagementEvent/id",
  "caliper:1.2:def:Response/id",
  "caliper:1.2:def:Result/id",
  "caliper:1.2:def:Scale/id",
  "caliper:1.2:def:Score/id",
  "caliper:1.2:def:SearchEvent/id",
  "caliper:1.2:def:SearchResponse/id",
  "caliper:1.2:def:SelectTextResponse/id",
  "caliper:1.2:def:Session/id",
  "caliper:1.2:def:SessionEvent/id",
  "caliper:1.2:def:SharedAnnotation/id",
  "caliper:1.2:def:SoftwareApplication/id",
  "caliper:1.2:def:Survey/id",
  "caliper:1.2:def:SurveyEvent/id",
  "caliper:1.2:def:SurveyInvitation/id",
  "caliper:1.2:def:SurveyInvitationEvent/id",
  "caliper:1.2:def:TagAnnotation/id",
  "caliper:1.2:def:Thread/id",
  "caliper:1.2:def:ThreadEvent/id",
  "caliper:1.2:def:ToolLaunchEvent/id",
  "caliper:1.2:def:ToolUseEvent/id",
  "caliper:1.2:def:TrueFalseResponse/id",
  "caliper:1.2:def:VideoObject/id",
  "caliper:1.2:def:ViewEvent/id",
  "caliper:1.2:def:WebPage/id",
  "caliper:1.2:def:epubChapter/id",
  "caliper:1.2:def:epubPart/id",
  "caliper:1.2:def:epubSubChapter/id",
  "caliper:1.2:def:epubVolume/id",
];

const conformance: readonly ConformanceRequirement[] = [
  {
    key: "caliper:1.2:conf:envelope/CAL-ENV-1",
    profile: "envelope",
    reqId: "CAL-ENV-1",
    level: "MUST",
    statement:
      "A Caliper Envelope MUST carry the emitting sensor, the dataVersion IRI, a sendTime, and the data payload.",
    constrains: [
      "caliper:1.2:def:Envelope/sensor",
      "caliper:1.2:def:Envelope/dataVersion",
      "caliper:1.2:def:Envelope/sendTime",
      "caliper:1.2:def:Envelope/data",
    ],
    source: "Caliper 1.2 §Envelope — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:event/CAL-EVT-1",
    profile: "event",
    reqId: "CAL-EVT-1",
    level: "MUST",
    statement: "Every Caliper Event MUST identify the actor, the action performed, and the object it was performed on.",
    constrains: ["caliper:1.2:def:Event/actor", "caliper:1.2:def:Event/action", "caliper:1.2:def:Event/object"],
    source: "Caliper 1.2 §Event — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:event/CAL-EVT-2",
    profile: "event",
    reqId: "CAL-EVT-2",
    level: "MUST",
    statement:
      "Every Caliper Event MUST also carry its id, a type matching the Caliper term for the event, and an eventTime expressed in UTC (YYYY-MM-DDTHH:mm:ss.SSSZ).",
    constrains: ["caliper:1.2:def:Event/id", "caliper:1.2:def:Event/type", "caliper:1.2:def:Event/eventTime"],
    source: "Caliper 1.2 §Event (id/type/eventTime) — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:entity/CAL-ENT-1",
    profile: "entity",
    reqId: "CAL-ENT-1",
    level: "MUST",
    statement:
      "Every Caliper Entity MUST carry a type matching the Caliper term for the entity (e.g. Person) and an id that is a unique, persistent IRI.",
    constrains: ["caliper:1.2:def:Entity/type", "caliper:1.2:def:Entity/id"],
    source: "Caliper 1.2 §Entity (type/id) — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    // The schema's only embedded RFC-2119 prose (cf. normativeStatements) is the `id` rule,
    // carried identically on every type's `id` field — so this constrains all 99 (EVERY_TYPE_ID).
    key: "caliper:1.2:conf:identifier/CAL-ID-1",
    profile: "identifier",
    reqId: "CAL-ID-1",
    level: "MUST",
    statement:
      "Every Caliper Event id MUST be a UUID expressed as a urn:uuid:<UUID> (RFC 4122); every Entity id MUST be a unique, persistent IRI.",
    constrains: EVERY_TYPE_ID,
    source: "Caliper 1.2 §Event / §Entity identifier — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    // Anchored to the ADR-0017 value-set denominators: each published action term is safeParse'd
    // against ActionSchema (not merely accepted as a string), so a term conform-ed fails to
    // recognise would surface as a value-set gap.
    key: "caliper:1.2:conf:vocabulary/CAL-VOCAB-1",
    profile: "vocabulary",
    reqId: "CAL-VOCAB-1",
    level: "MUST",
    statement:
      "An Event's action MUST be a term drawn from the Caliper action vocabulary (the term appropriate to the event's metric profile).",
    constrains: ["caliper:1.2:def:Action", "caliper:1.2:def:Event/action"],
    source: "Caliper 1.2 §Actions / metric profiles — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:vocabulary/CAL-VOCAB-2",
    profile: "vocabulary",
    reqId: "CAL-VOCAB-2",
    level: "MUST",
    statement:
      "Caliper's controlled vocabularies MUST be honoured: an AggregateMeasure metric is a Caliper metric term, an entity status is Active or Inactive, and a sensor declares the metric profiles it supports as Caliper profile terms.",
    constrains: [
      "caliper:1.2:def:Metric",
      "caliper:1.2:def:AggregateMeasure/metric",
      "caliper:1.2:def:Status",
      "caliper:1.2:def:Membership/status",
      "caliper:1.2:def:Profile",
    ],
    source: "Caliper 1.2 §Metric / §Status / metric profiles — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    // Anchored to the ADR-0017 role value-set: every published role term (the eight base roles
    // and their Base#Subrole specialisations) is safeParse'd against RoleSchema (CALIPER_ROLES).
    key: "caliper:1.2:conf:vocabulary/CAL-VOCAB-3",
    profile: "vocabulary",
    reqId: "CAL-VOCAB-3",
    level: "MUST",
    statement:
      "A Membership's roles MUST be drawn from the Caliper role vocabulary — the eight base roles (Learner, Instructor, …) and their Base#Subrole specialisations.",
    constrains: ["caliper:1.2:def:Membership/roles", "caliper:1.2:def:Membership/roles/[]"],
    source: "Caliper 1.2 §Role vocabulary / Membership — https://www.imsglobal.org/spec/caliper/v1p2",
  },

  // Sender role — the transport obligations of a conformant Caliper Sensor (Caliper 1.2 §5.4 HTTP
  // Requests). RFC-2119 levels are quoted verbatim from the spec; constrains anchor to the Envelope
  // fields each obligation carries (Caliper has no OpenAPI transport axis to cross-link to).
  {
    key: "caliper:1.2:conf:sender/CAL-SND-1",
    profile: "sender",
    reqId: "CAL-SND-1",
    level: "MUST",
    statement:
      "A Caliper Sensor MUST be capable of transmitting Caliper data successfully to a Caliper Endpoint over HTTP with the connection encrypted using Transport Layer Security (TLS).",
    constrains: ["caliper:1.2:def:Envelope/sensor", "caliper:1.2:def:Envelope/data"],
    source: "Caliper 1.2 §5.4 HTTP Requests — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:sender/CAL-SND-2",
    profile: "sender",
    reqId: "CAL-SND-2",
    level: "MUST",
    statement:
      "Each message request a Sensor sends MUST consist of a single JSON representation of a Caliper Envelope, and messages MUST be sent using the HTTP POST request method.",
    constrains: ["caliper:1.2:def:Envelope/data", "caliper:1.2:def:Envelope/dataVersion"],
    source: "Caliper 1.2 §5.4 HTTP Requests — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:sender/CAL-SND-3",
    profile: "sender",
    reqId: "CAL-SND-3",
    level: "MUST",
    statement:
      'A Sensor MUST set the HTTP Host and Content-Type request header fields; the Content-Type value MUST be the IANA media type "application/json".',
    constrains: ["caliper:1.2:def:Envelope/dataVersion"],
    source: "Caliper 1.2 §5.4 HTTP Requests (request headers) — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:sender/CAL-SND-4",
    profile: "sender",
    reqId: "CAL-SND-4",
    level: "SHOULD",
    statement:
      'A Sensor SHOULD set the Authorization request header field using the "Bearer" authentication scheme (RFC 6750 §2.1); the b64token credential sent MUST be one the Endpoint can validate, although it MAY be opaque to the Sensor.',
    constrains: ["caliper:1.2:def:Envelope/sensor"],
    source: "Caliper 1.2 §5.4 HTTP Requests (Authorization) — https://www.imsglobal.org/spec/caliper/v1p2",
  },

  // Endpoint role — the receipt + response obligations of a conformant Caliper Endpoint (Caliper 1.2
  // §6 Endpoint, §6.1 HTTP Responses).
  {
    key: "caliper:1.2:conf:endpoint/CAL-EP-1",
    profile: "endpoint",
    reqId: "CAL-EP-1",
    level: "MUST",
    statement:
      "A Caliper Endpoint MUST be capable of receiving Caliper data sent over HTTP POST by a Sensor over a TLS-secured connection with a valid certificate, and MUST support Bearer (RFC 6750) authentication on the HTTP Authorization request header.",
    constrains: ["caliper:1.2:def:Envelope/sensor", "caliper:1.2:def:Envelope/data"],
    source: "Caliper 1.2 §6 Endpoint — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:endpoint/CAL-EP-2",
    profile: "endpoint",
    reqId: "CAL-EP-2",
    level: "MUST",
    statement:
      "Following receipt of a Sensor request the Endpoint MUST reply with an HTTP response message, and to signal successful receipt MUST reply with a 2xx class status code.",
    constrains: ["caliper:1.2:def:Envelope/data"],
    source: "Caliper 1.2 §6.1 HTTP Responses — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:endpoint/CAL-EP-3",
    profile: "endpoint",
    reqId: "CAL-EP-3",
    level: "SHOULD",
    statement:
      "On success the Endpoint SHOULD use the 200 OK response and SHOULD send back successful responses with an empty body.",
    constrains: ["caliper:1.2:def:Envelope/data"],
    source: "Caliper 1.2 §6.1 HTTP Responses — https://www.imsglobal.org/spec/caliper/v1p2",
  },
  {
    key: "caliper:1.2:conf:endpoint/CAL-EP-4",
    profile: "endpoint",
    reqId: "CAL-EP-4",
    level: "MUST",
    statement:
      "When an Endpoint replies with a non-2xx response it MUST adhere to the defined status codes: 400 Bad Request for a missing or malformed Envelope, 401 Unauthorized for an unauthorized request, 415 Unsupported Media Type for a non-application/json content type, and 422 Unprocessable Entity when it cannot support the Envelope's dataVersion.",
    constrains: ["caliper:1.2:def:Envelope/data", "caliper:1.2:def:Envelope/dataVersion"],
    source: "Caliper 1.2 §6.1 HTTP Responses (error status codes) — https://www.imsglobal.org/spec/caliper/v1p2",
  },
];

// Every Caliper object type is now a structural binding: each entity / event / Envelope entry point
// (all but the five controlled-vocabulary enums — verified as value-sets — and the two JSON-LD meta
// wrappers CaliperData / CaliperTypeDefinitions) becomes a document root reconciled against its
// deepened conform-ed Zod schema (ADR-0018). Derived from the entry-point map so it cannot drift.
const VALUE_SET_OR_META = new Set([
  "Action",
  "Metric",
  "Profile",
  "Status",
  "Role",
  "CaliperData",
  "CaliperTypeDefinitions",
]);
const bindings: readonly SpecBindingSource[] = Object.entries(CaliperV1P2JsonSchemaEntryPoints)
  .filter(([id]) => !VALUE_SET_OR_META.has(id))
  .map(([id, zod]) => entity(id, zod as SpecBindingSource["zod"]));

export const caliperV1_2: SpecSource = {
  spec: "caliper",
  version: "1.2",
  bindings,
  // Value-set verification (ADR-0017): the five Caliper controlled vocabularies the structural
  // join cannot check, each safeParse'd member-by-member against the conform-ed z.enum that models
  // it. Only identifierType (a lone literal, no multi-member vocabulary) is left out — see the
  // module docstring.
  valueSets: [
    { item: "caliper:1.2:def:Action", element: ActionSchema },
    { item: "caliper:1.2:def:Membership/roles/[]", element: RoleSchema },
    { item: "caliper:1.2:def:Profile", element: ProfileSchema },
    { item: "caliper:1.2:def:Metric", element: MetricSchema },
    { item: "caliper:1.2:def:Status", element: StatusSchema },
  ],
  conformance,
};
