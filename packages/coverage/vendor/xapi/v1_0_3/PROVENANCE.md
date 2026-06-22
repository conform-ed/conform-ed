# xAPI 1.0.3 (ADL Experience API) vendored denominator — provenance

The `xapi:1.0.3` Coverage Map reconciles the xAPI **Statement information model** — the heart of
the standard — against conform-ed's `XapiV1_0_3` Zod contracts. xAPI is a **prose** specification:
ADL's xAPI 1.0.3 publishes its data model as normative text + inline JSON examples, with **no**
machine-readable schema (no XSD, no JSON Schema, no OpenAPI). So the denominator is a hand-authored
JSON Schema (conform-ed ADR-0017, the lowest provenance tier), walked by `walkers/curated.ts` under
its provenance gate (file-level ADR-0017 + spec URL; every property node cites its spec clause).

This is the **1.0.3** sibling of the `xapi:2.0` (IEEE 9274.1.1) map. The only structural difference
is that 1.0.3 has **no** `contextAgents` / `contextGroups` on Context (and so no `ContextAgent` /
`ContextGroup` objects) — those are the IEEE 2.0 additions. The rest of the Statement model is
identical, so the two curated denominators are deliberately near-identical (the 1.0.3 one is the
2.0 one minus the 2.0 context additions).

The xAPI **LRS transport surface** — the statement / state / agent-profile / activity-profile
resources, the queries, the request/response headers, the error codes and the concurrency
(ETag / If-Match) model — is HTTP semantics + prose, not part of the statement information model,
and is **out of scope** here (the cmi5 precedent). conform-ed models those transport companions in
`XapiV1_0_3.Schemas`, but they are not reconciled by this map.

## Source (the Statement information model)

- **Bibliography reference:** ADL Experience API (xAPI) 1.0.3, Part Two: Experience API Data,
  cited by `@conform-ed/contracts/xapi` `XapiV1_0_3DerivedZodTemplates.specLinks`.
- **Curated denominator:** `curated/statement.schema.json` — hand-authored from the published
  prose, rooted at the Statement object with a `$def` per sub-object (Agent, AgentAccount, Group,
  Verb, Activity, ActivityDefinition, InteractionComponent, StatementRef, SubStatement, Result,
  Score, Context, ContextActivities, Attachment).
- **Prose source consulted (the ADL spec the contracts pin):**
  <https://github.com/adlnet/xAPI-Spec/blob/ca782a1129bc6ae848640ff4e8e262334bdd0ba5/xAPI-Data.md>

## Reconciliation notes (what the map shows)

The curated denominator and the `XapiV1_0_3` Zod use the **same JSON binding** (identical property
names, camelCase plus the spec's `mbox_sha1sum` snake-case), so the L2 name-join needs no
`nameNormalizer`, no structural alias and no override. It reconciles with **no silent gaps**.

- The polymorphic `actor` / `object` / `authority` / `instructor` slots are unions (Agent | Group,
  or Activity | Agent | Group | StatementRef | SubStatement), modelled as `oneOf` `$ref`s the
  reconciler resolves transitively, so each branch's subtree reconciles.

The `interactionType` attribute (the ten CMI interaction types) is additionally checked as a
**value-set** against `InteractionTypeSchema` (10 members, all modelled).

The Agent exactly-one-IFI, Group, Score-range and SubStatement-nesting constraints are Zod
`superRefine`s — semantic invariants invisible to JSON-Schema rendering; the curated denominator
records them as `$comment` prose and the conformance catalogue cites the constrained items, but
they are not structurally reconciled.

The one residue **extension** is `Attachment.contentBase64`: conform-ed models an inline base64
body the xAPI Attachment JSON object does not define (the binary travels in the multipart part,
keyed by `sha2` / `X-Experience-API-Hash`) — honest, conform-ed is the richer contract.
