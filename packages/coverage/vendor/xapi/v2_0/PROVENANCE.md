# xAPI 2.0 (IEEE 9274.1.1) vendored denominator — provenance

The `xapi:2.0` Coverage Map reconciles the xAPI **Statement information model** — the heart of
the standard — against conform-ed's `XapiV2_0` Zod contracts. xAPI is a **prose** specification:
IEEE Std 9274.1.1-2023 publishes its data model as normative text + inline JSON examples, with
**no** machine-readable schema (no XSD, no JSON Schema, no OpenAPI). So the denominator is a
hand-authored JSON Schema (conform-ed ADR-0017, the lowest provenance tier), walked by
`walkers/curated.ts` under its provenance gate (file-level ADR-0017 + spec URL; every property
node cites its spec clause).

The xAPI **LRS transport surface** — the statement / state / agent-profile / activity-profile
resources, the statement and resource queries, the request/response headers, the error codes and
the concurrency (ETag / If-Match) model — is HTTP semantics + prose, not part of the statement
information model, and is **out of scope** here (the cmi5 precedent: model the clean information
model, leave the runtime/transport as documented prose). conform-ed models those transport
companions in `XapiV2_0.Schemas`, but they are not reconciled by this map.

## Source (the Statement information model)

- **Bibliography reference:** IEEE Std 9274.1.1-2023, *xAPI Base Standard* (Part Two: Data),
  cited by `@conform-ed/contracts/xapi` `XapiV2_0DerivedZodTemplates.specLinks`.
- **Curated denominator:** `curated/statement.schema.json` — hand-authored from the published
  prose, rooted at the Statement object with a `$def` per sub-object (Agent, AgentAccount,
  Group, Verb, Activity, ActivityDefinition, InteractionComponent, StatementRef, SubStatement,
  Result, Score, Context, ContextActivities, ContextAgent, ContextGroup, Attachment).
- **Prose source consulted (the IEEE base-standard mirror the contracts cite):**
  <https://github.com/madebyraygun/xapi-base-standard-documentation/blob/134afd8c108b4d1b98294a1613db38a6b8fe73d8/9274.1.1%20xAPI%20Base%20Standard%20for%20Content.md>

## Reconciliation notes (what the map shows)

The curated denominator and the `XapiV2_0` Zod use the **same JSON binding** (identical property
names, camelCase plus the spec's `mbox_sha1sum` snake-case), so the L2 name-join needs no
`nameNormalizer`, no structural alias and no override. It reconciles with **no silent gaps**.

- The polymorphic `actor` / `object` / `authority` / `instructor` slots are unions (Agent | Group,
  or Activity | Agent | Group | StatementRef | SubStatement). They are modelled as `oneOf` `$ref`s;
  the reconciler resolves the union members transitively, so each branch's subtree reconciles.
- The 2.0-only `contextAgents` / `contextGroups` (and their `ContextAgent` / `ContextGroup`
  objects) are present — this is the IEEE 9274.1.1 information model, not ADL xAPI 1.0.3.

The `interactionType` attribute (the ten CMI interaction types) is additionally checked as a
**value-set** against `InteractionTypeSchema` (10 members, all modelled) — the structural join
matches property *names*, never enumerated *values*.

The Statement object's `actor` requires exactly one Inverse Functional Identifier (and the
Group / Score / SubStatement-nesting constraints) are Zod `superRefine`s — semantic invariants
invisible to JSON-Schema rendering; the curated denominator records them as `$comment` prose and
the conformance catalogue cites the constrained items, but they are not structurally reconciled.

The one residue **extension** is `Attachment.contentBase64`: conform-ed models an inline
base64 body the xAPI Attachment JSON object does not define (the binary travels in the multipart
part, keyed by `sha2` / `X-Experience-API-Hash`) — honest, conform-ed is the richer contract.
