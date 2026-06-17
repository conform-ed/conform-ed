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
 * Conformance seed — grounded slices of Caliper 1.2 normative rules, cross-linked to the
 * literal L1 items they constrain. Requirement ids synthesised (`CAL-n`); full extraction
 * from the published Caliper 1.2 spec & certification guide is the next hand-curation
 * increment.
 */
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
    // Cites the schema's own embedded MUST prose on `id` (cf. normativeStatements):
    // an Event id MUST be a urn:uuid; an Entity id MUST be a unique, persistent IRI.
    key: "caliper:1.2:conf:identifier/CAL-ID-1",
    profile: "identifier",
    reqId: "CAL-ID-1",
    level: "MUST",
    statement:
      "Every Caliper Event id MUST be a UUID expressed as a urn:uuid:<UUID> (RFC 4122); every Entity id MUST be a unique, persistent IRI.",
    constrains: ["caliper:1.2:def:Event/id", "caliper:1.2:def:Entity/id"],
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
