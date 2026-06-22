/**
 * xAPI 1.0.3 (ADL Experience API) — {@link SpecSource} (conform-ed ADR-0013; curated
 * denominator + value-set extension from ADR-0017). Reconciles the xAPI **Statement
 * information model** — the heart of the standard — against the `XapiV1_0_3` Zod contracts.
 *
 * This is the **1.0.3 sibling** of the `xapi:2.0` (IEEE 9274.1.1) map. xAPI is a prose
 * specification with no machine-readable schema of any kind, so — exactly the ADR-0017 case —
 * the denominator is a hand-authored JSON Schema
 * (`vendor/xapi/v1_0_3/curated/statement.schema.json`), walked by `walkers/curated.ts` under its
 * provenance gate and reconciled against conform-ed's 1.0.3 `StatementSchema` and its sub-object
 * tree. The only structural difference from 2.0 is that 1.0.3 has **no** `contextAgents` /
 * `contextGroups` (and no `ContextAgent` / `ContextGroup` objects) — those are the IEEE 2.0
 * additions; the rest of the model is identical.
 *
 * The curated denominator and the Zod use the **same JSON binding** (identical property names,
 * including the spec's `mbox_sha1sum` snake-case), so the L2 name-join needs no `nameNormalizer`,
 * no structural alias and no override — it reconciles with no silent gaps. The polymorphic
 * `actor` / `object` / `authority` / `instructor` slots are unions modelled as `oneOf` `$ref`s
 * the reconciler resolves transitively. The one residue extension is `Attachment.contentBase64`:
 * conform-ed models an inline base64 body the xAPI Attachment JSON object does not define
 * (honest — the binary travels in the multipart part, keyed by `sha2`).
 *
 * The `interactionType` attribute (the ten CMI interaction types) is checked as a **value-set**
 * against `InteractionTypeSchema` — the structural join matches property names, never values.
 *
 * Out of scope (the cmi5 precedent): the xAPI **LRS transport surface** — the statement /
 * document / agent / activity resources, the queries, the request/response headers, the error
 * codes and the concurrency (ETag / If-Match) model — is HTTP semantics + prose, not part of the
 * statement information model.
 */

import { join } from "node:path";

import { InteractionTypeSchema, StatementSchema } from "@conform-ed/contracts/xapi/v1_0_3";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "xapi", "v1_0_3", file);

/**
 * Statement-model conformance catalogue, curated from the normative ADL xAPI 1.0.3 prose (Part
 * Two: Experience API Data). xAPI defines no certification profiles for the information model
 * itself (the ADL LRS conformance suite tests transport behaviour, which is out of scope here),
 * so the requirements are grouped by the model surface they constrain — `statement`, `context`,
 * `attachment` — and each anchors to the reconciled curated item(s) it governs. The IFI,
 * Score-range and SubStatement-nesting invariants are Zod `superRefine`s (invisible to the
 * structural join); their requirements still cite the constrained items.
 */
const SPEC =
  "ADL xAPI 1.0.3 (Experience API, Part Two: Data) — https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md";

const conformance: readonly ConformanceRequirement[] = [
  {
    key: "xapi:1.0.3:conf:statement/XAPI-STMT-1",
    profile: "statement",
    reqId: "XAPI-STMT-1",
    level: "MUST",
    statement: "A Statement MUST carry an actor, a verb and an object.",
    constrains: ["xapi:1.0.3:doc:Statement/actor", "xapi:1.0.3:doc:Statement/verb", "xapi:1.0.3:doc:Statement/object"],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:statement/XAPI-STMT-2",
    profile: "statement",
    reqId: "XAPI-STMT-2",
    level: "MUST",
    statement:
      "An Agent MUST be identified by exactly one Inverse Functional Identifier — mbox, mbox_sha1sum, openid or account.",
    constrains: [
      "xapi:1.0.3:def:Agent/mbox",
      "xapi:1.0.3:def:Agent/mbox_sha1sum",
      "xapi:1.0.3:def:Agent/openid",
      "xapi:1.0.3:def:Agent/account",
    ],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:statement/XAPI-STMT-3",
    profile: "statement",
    reqId: "XAPI-STMT-3",
    level: "MUST",
    statement: "An identified Group MUST have exactly one IFI; an anonymous Group (no IFI) MUST carry a member list.",
    constrains: [
      "xapi:1.0.3:def:Group/mbox",
      "xapi:1.0.3:def:Group/mbox_sha1sum",
      "xapi:1.0.3:def:Group/openid",
      "xapi:1.0.3:def:Group/account",
      "xapi:1.0.3:def:Group/member",
    ],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:statement/XAPI-STMT-4",
    profile: "statement",
    reqId: "XAPI-STMT-4",
    level: "MUST",
    statement: "A Verb MUST carry an id that is an IRI.",
    constrains: ["xapi:1.0.3:def:Verb/id"],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:statement/XAPI-STMT-5",
    profile: "statement",
    reqId: "XAPI-STMT-5",
    level: "MUST",
    statement: "An Activity object MUST be identified by an id that is an IRI.",
    constrains: ["xapi:1.0.3:def:Activity/id"],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:statement/XAPI-STMT-6",
    profile: "statement",
    reqId: "XAPI-STMT-6",
    level: "MUST",
    statement:
      "An Activity Definition's interactionType MUST be one of the ten CMI interaction types (true-false, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric, other), and the interaction sub-components MUST NOT appear without it.",
    // Anchored to the ADR-0017 value-set denominator: every published interaction type is
    // safeParse'd against InteractionTypeSchema (not merely accepted as a string).
    constrains: ["xapi:1.0.3:def:ActivityDefinition/interactionType"],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:statement/XAPI-STMT-7",
    profile: "statement",
    reqId: "XAPI-STMT-7",
    level: "MUST",
    statement:
      "A Result Score's scaled MUST be a decimal between -1 and 1 inclusive; when present, raw MUST fall within min and max.",
    constrains: [
      "xapi:1.0.3:def:Score/scaled",
      "xapi:1.0.3:def:Score/raw",
      "xapi:1.0.3:def:Score/min",
      "xapi:1.0.3:def:Score/max",
    ],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:statement/XAPI-STMT-8",
    profile: "statement",
    reqId: "XAPI-STMT-8",
    level: "MUST NOT",
    statement: "A SubStatement's object MUST NOT itself be a SubStatement (sub-statements do not nest).",
    constrains: ["xapi:1.0.3:def:SubStatement/object"],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:context/XAPI-CTX-1",
    profile: "context",
    reqId: "XAPI-CTX-1",
    level: "MUST",
    statement:
      "When a Context references an Activity through contextActivities, each of parent, grouping, category and other is a list of Activities.",
    constrains: [
      "xapi:1.0.3:def:Context/contextActivities",
      "xapi:1.0.3:def:ContextActivities/parent",
      "xapi:1.0.3:def:ContextActivities/grouping",
      "xapi:1.0.3:def:ContextActivities/category",
      "xapi:1.0.3:def:ContextActivities/other",
    ],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:context/XAPI-CTX-2",
    profile: "context",
    reqId: "XAPI-CTX-2",
    level: "MUST",
    statement:
      "A Context's instructor is an Agent or Group, team is a Group, registration is a UUID, and a context statement reference is a StatementRef.",
    constrains: [
      "xapi:1.0.3:def:Context/instructor",
      "xapi:1.0.3:def:Context/team",
      "xapi:1.0.3:def:Context/registration",
      "xapi:1.0.3:def:Context/statement",
    ],
    source: SPEC,
  },
  {
    key: "xapi:1.0.3:conf:attachment/XAPI-ATT-1",
    profile: "attachment",
    reqId: "XAPI-ATT-1",
    level: "MUST",
    statement:
      "An Attachment MUST carry a usageType (IRI), a display Language Map, a contentType, a length and the sha2 hash of its contents.",
    constrains: [
      "xapi:1.0.3:def:Attachment/usageType",
      "xapi:1.0.3:def:Attachment/display",
      "xapi:1.0.3:def:Attachment/contentType",
      "xapi:1.0.3:def:Attachment/length",
      "xapi:1.0.3:def:Attachment/sha2",
    ],
    source: SPEC,
  },
];

export const xapiV1_0_3: SpecSource = {
  spec: "xapi",
  version: "1.0.3",
  bindings: [
    // Curated denominator (ADR-0017): xAPI publishes no schema for its information model, so this
    // hand-authored JSON Schema gives the Statement model a spec-cited L2 denominator, reconciled
    // against conform-ed's 1.0.3 StatementSchema and its sub-object tree.
    {
      binding: "Statement",
      schemaPath: vendor("curated/statement.schema.json"),
      language: "curated",
      zod: StatementSchema,
    },
  ],
  // Value-set verification (ADR-0017): every published interaction type is safeParse'd against
  // InteractionTypeSchema, so a member conform-ed fails to accept surfaces as a value-set gap.
  valueSets: [{ item: "xapi:1.0.3:def:ActivityDefinition/interactionType", element: InteractionTypeSchema }],
  conformance,
};
