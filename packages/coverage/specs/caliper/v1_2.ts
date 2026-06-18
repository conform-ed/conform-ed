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
 */

import { join } from "node:path";

import {
  AgentSchema,
  AssessmentEventSchema,
  EntitySchema,
  EnvelopeSchema,
  EventSchema,
  PersonSchema,
  SessionSchema,
  SoftwareApplicationSchema,
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
 * NB this is the conform-ed side only: emergent emits no Caliper today, so there is deliberately
 * no ADR-0028 product overlay pinning this map yet (it would be entirely deferred/not-applicable
 * until an analytics emitter exists).
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
];

export const caliperV1_2: SpecSource = {
  spec: "caliper",
  version: "1.2",
  bindings: [
    entity("Envelope", EnvelopeSchema),
    entity("Event", EventSchema),
    entity("AssessmentEvent", AssessmentEventSchema),
    entity("Entity", EntitySchema),
    entity("Person", PersonSchema),
    entity("SoftwareApplication", SoftwareApplicationSchema),
    entity("Session", SessionSchema),
    entity("Agent", AgentSchema),
  ],
  conformance,
};
