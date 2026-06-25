# Caliper 1.2 — full contract modelling, Sender/Endpoint board, and an event validator

Status: accepted (2026-06-25) — extends [ADR-0013](0013-spec-coverage-map.md) (coverage map) and [ADR-0017](0017-prose-spec-coverage-denominators.md) (value-set denominators)

emergent reversed its Caliper deferral and now targets **full Caliper 1.2 conformance in both
roles** (emergent ADR-0041/0042). conform-ed currently models Caliper thinly — 8 Zod bindings,
78/1957 literal items, and 8 cross-cutting data-model MUSTs — deliberately, because no emitter
existed. This ADR records the upstream work to make conform-ed a complete Caliper conformance
library: the full information model, a Sender/Endpoint conformance board, a reusable per-profile
event validator, and a strengthened-but-honest denominator.

## Decisions

1. **Model the full information model by hand, via the existing factories.** Extend
   `createCaliperEntitySchema` / `createCaliperEventSchema` to the ~90 still-unmodelled bootcamp
   types (all 15 metric profiles' Events and the Entities they generate/target), growing the
   `bindings` list from 8 to ~98 and raising coverage from 78/1957 toward complete. **No codegen**
   — conform-ed is hand-curated for every spec, and the curated schemas carry the value-set and
   textual-rule wiring that a draft-04→Zod generator would flatten. The factories make this
   templated, not raw.

2. **Add Sender and Endpoint role profiles to the conformance catalogue.** Beside the 8 existing
   data-model MUSTs (envelope / event / entity / identifier / vocabulary), add a richer,
   **per-transport-detail** set of requirements under `profile: "sender"` and `profile: "endpoint"`
   (the `profile` field already carries role; the board groups by it). Each requirement is graded
   at its **true RFC-2119 level** — genuine `MUST` vs `SHOULD` vs `MAY`, never inflated — and cites
   the Caliper 1.2 transport + certification text. This honours ADR-0013's no-invented-MUSTs rule:
   "richer" means more granular and correctly-levelled (auth header, `application/json`, Envelope
   POST well-formedness, batch `data[]`, accept-conformant / reject-malformed, the sensor's
   per-profile event obligation), not everything promoted to MUST.

3. **Export `validateCaliperEvent` from `@conform-ed/contracts`.** Promote
   `CALIPER_TEXTUAL_EVENT_RULES` (the per-profile supported actors/actions/objects) into a reusable
   validator that checks an event against its metric profile. The rules are **spec-derived and
   generic**, so this belongs upstream (an externalisation candidate per the boundary doc) — unlike
   xAPI, where the consumer-side `validateStatementPayload` is genuine LRS *business* logic.
   emergent's Sensor self-checks pre-emit and the conformance lane both call it.

4. **Keep the bootcamp denominator; strengthen the cross-checks and state the caveat plainly.**
   1EdTech ships no canonical Caliper schema release, so the CaliperBootcamp schemas remain the
   only machine-readable denominator (the ADR-0013 provenance caveat stands). To make a
   full-conformance claim credible: value-set-verify all five vocabularies against the spec's
   **published** term lists (not just the bootcamp copy), cross-check the textual event rules
   against the spec's profile tables, and record the provenance caveat plainly in the certifier
   dossier. We do **not** re-derive a curated prose denominator (a large re-vendoring) — the
   structural denominator stays bootcamp, strengthened by independent vocabulary/profile
   verification.

5. **Score the reference-or-inline duality as N/A, not `partial`.** Caliper lets every entity
   association slot carry its target inline (the full object) or by reference (`CaliperReferenceSchema`
   — `id` / `type` / `@context` / `extensions` only). The L2 join reaches a type's full definition in
   *both* kinds of slot, so a fully-modelled type showed a band of false `partial`s (its deep fields
   "missing" wherever it was referenced). Add a `referenceIdentityProps` option to the ADR-0013 engine:
   in a context where the Zod side is exactly the reference form while the literal is richer, the
   non-identity fields are **not applicable**, not misses. A type is proven at its own document-root
   binding, so this collapses the false band to `yes`; the safeguard restores any field reached *only*
   by reference (never modelled inline anywhere) to a genuine `no`, so the option never hides a gap.
   The option is **opt-in per spec** (empty ⇒ inert), leaving every other map's scoring unchanged.
   Result: the Caliper map reads 1692 modelled / 0 partial / 1 silent gap
   (`NavigationEvent/navigatedFrom`, kept unmodelled to keep the rule `superRefine` strongly typed).

## Considered alternatives

- **Codegen the ~90 types from the bootcamp JSON Schema.** Faster and faithful-by-construction,
  but introduces conform-ed's first codegen path, produces coarse draft-04→Zod, and drops the
  deliberate value-set/textual-rule wiring. Rejected for consistency and fidelity.
- **Single combined Sender/Endpoint requirement each.** Rejected: bundles distinct obligations into
  one row, weakening evidence mapping. (A maximal per-detail board was chosen instead.)
- **Re-derive the denominator from prose + JSON-LD `@context`.** Strongest provenance but a large
  rebuild of the whole map; deferred unless a canonical release appears.
- **Keep the event validator emergent-side (xAPI/LRS pattern).** Rejected: the rules are generic
  spec logic, not consumer business rules — duplicating them downstream helps no one.

## Consequences

- The Caliper map regenerates with a near-complete model and the new role requirements; emergent
  re-pins the map + updates its overlay (emergent ADR-0028/0041).
- The ADR-0013 engine gains a reusable `referenceIdentityProps` option for reference/inline specs;
  Caliper is its first user, every other map opts out and is unchanged.
- `@conform-ed/contracts` gains `validateCaliperEvent` as public API.
- Release flows per ADR-0016: a `main` push publishes the `@dev` build emergent previews; the
  public release rides the next semver tag.
- The provenance caveat remains and is now surfaced in the dossier rather than only in code
  comments — honest disclosure of a denominator built on education material plus independent
  vocabulary verification.
