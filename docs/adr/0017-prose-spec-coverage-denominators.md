# Hand-authored denominators for prose-only spec families

Status: accepted (2026-06-22)

ADR-0013 built the Coverage Map on a hard rule: the **denominator is the literal published
schema**, never our own Zod surface. An L1 walker inventories the vendored schema
(XSD / JSON Schema / OpenAPI); L2 reconciles each L1 item against the Zod contracts and reports
`silentGaps` (the spec has it, we never modelled it) and `extensions` (we model more than the
schema). That is precisely what answers "what does the spec contain that we never modelled" — the
silent-omission question a certifier cares about.

The rule has a structural hole: **it only bites where a machine-readable schema exists.** Several
high-value families publish none. Their normative content is prose plus inline JSON examples — there
is no XSD/JSON-Schema/OpenAPI to walk. LTI is the sharp case: of the LTI 1.3 + Advantage families,
**only AGS ships an OpenAPI**; Core 1.3, Deep Linking 2.0, and NRPS 2.0 publish no schema at all.
For those, the Coverage Map models them as a **guide-curated conformance catalogue** (behavioural
MUSTs, hand-extracted from the certification guide) with **no L1 denominator**. So for the
prose-only families the Zod contract is simultaneously the model *and* the only yardstick, and L2
has nothing to diff against. A missing property or an un-modelled controlled vocabulary cannot
surface as a `silentGap` — by construction, not by oversight.

This is not hypothetical. Two real omissions sat undetected behind a green coverage gate:

- **Deep Linking `ContentItemSchema`** was a single permissive object covering all five content-item
  types, missing the `html` item's `html` payload, the `image` item's dimensions, and the `file`
  item's `mediaType`/`expiresAt`. The guide requirement (LTI-DL-3) only asserts the *prose*
  ("content_items: ltiResourceLink, link, file, html or image"), which the contract satisfied at the
  type-name level while silently under-modelling the shapes.
- **The roles claim** was modelled as an array of opaque URIs — it neither classified the LIS role
  vocabulary nor even accepted the simple context-role names the spec retains for LTI 1.1
  compatibility (those failed the URI regex outright).

Both are now fixed in `@conform-ed/contracts/lti` (a per-type discriminated union; a role vocabulary
+ `normalizeRole`/`KnownLtiRoleSchema`). But the coverage analyser could not have caught either, and
nothing stops the next such omission. The fixes treat the symptom; this ADR treats the cause.

## Decision

Introduce a third L1 denominator kind alongside the walked schema and the conformance catalogue: a
**hand-authored information-model denominator** for prose-only families.

- **What it is.** A small, version-pinned, machine-readable inventory (JSON, the same on-disk shape a
  walker emits) of the family's information model curated *from the prose spec*: each object's
  properties (with json-type and required/optional), and each controlled vocabulary's members
  (e.g. the Deep Linking content-item property sets; the LTI role namespaces and role names). It
  lives beside the vendored schemas under `packages/coverage/` and is pinned to the spec
  version/date it was read from.
- **Same keys, same reconciliation.** Items carry the ADR-0013 canonical address
  `spec:version:binding:path`, so they feed the **identical** L2 structural correspondence against
  the Zod contracts. `silentGaps`/`extensions` regain teeth on these families with no new engine —
  only a new source.
- **Distinct, weaker provenance — and labelled as such.** A curated source is tagged
  `source.language = "curated"` and **every item carries a `specRef` citation** to the prose section
  it was lifted from. It is the lowest provenance tier (below a walked schema, distinct from the
  behavioural catalogue) and the render surfaces it that way, so a reader never mistakes a curated
  denominator for a machine-extracted one.
- **Never a substitute where a schema exists.** AGS keeps its OpenAPI; curated denominators are only
  for families with no published machine schema. If a spec later ships one, the walker supersedes the
  curated file.
- **Drift guard.** Because a curated inventory can silently fall behind the prose, it is pinned to a
  spec version + retrieval date and flagged for re-review when the family's spec version bumps —
  the same freshness discipline ADR-0013 applies to vendored schemas.

First targets (LTI, where the hole was found): the Deep Linking 2.0 content-item types, the LTI role
vocabulary, and the NRPS membership container. cmi5 and the credential REST surfaces (OB/CLR/CASE),
which are likewise prose-and-example specs, are candidates once the LTI denominator proves the shape.

## Consequences

- **Closes the blind spot honestly.** The prose-only families gain a real denominator, so the
  "what did we never model" question is answerable for them too — not just for AGS/QTI/OneRoster.
- **Shifts, but does not remove, the trust assumption.** A curated denominator is only as complete as
  its curator; an omission in the *inventory* is still invisible. The mitigation is structural, not
  magical: mandatory per-item `specRef`, ADR-grade review of the curated files, the explicit
  weakest-provenance label, and the drift guard. We are trading an invisible gap for a *cited,
  reviewable* one — strictly better, not perfect.
- **More to maintain.** Each curated file is hand-work that must track its spec version. Scope is
  contained by only writing them for families with no machine schema, and by reusing the existing
  key scheme, renderer, and reconciliation rather than adding a parallel mechanism.
- **Generalises.** The same source kind serves any future prose-only family, and the citations make
  the curated inventories themselves a reviewable artifact a certifier can audit.

The contract fixes that exposed the hole have already landed. Implementation of the curated-denominator
source kind begins with LTI — the Deep Linking content-item types, the role vocabulary, and the NRPS
membership container are its first inventory — and the same source kind then extends to the other
prose-and-example families (cmi5, the credential REST surfaces).
