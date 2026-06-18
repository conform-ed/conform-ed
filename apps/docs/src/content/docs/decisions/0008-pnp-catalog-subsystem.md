---
title: "PNP/AfA and the catalog subsystem: activation in pnp, presentation in the runtime"
description: "Architecture decision record ADR-0008."
sidebar:
  order: 8
  badge: { text: "ADR-0008", variant: note }
---

Status: accepted

QTI 3's accessibility model (§2.13.1) attaches dormant alternative content to
items: "Content inside CatalogInfo is considered 'dormant' and is not included
for delivery to candidates by default. A candidate's profile (or assessment
program settings) will indicate whether the candidate should be presented any
of the possible supports" (§5.29). The candidate's profile is the QTI 3.0
profile of AfA PNP (imsqtiv3p0_afa3p0pnp_v1p0, vendored in tmp/agents for
verbatim citation alongside the ASI XSD). Before this milestone the catalog
was a loose contracts stub and `qti-catalog-info` was silently dropped at
normalization — the same genre as the stimulus silent drop: the corpus's six
catalog carriers (the BPIG catalog items, the unbelievableNight passage, the
sharedStimulus exemplars) "delivered" with their accessibility content gone.

The layer split follows package ownership:

- **contracts** holds XSD-faithful schemas: the card model (support names =
  SupportEnum §8.38 ∪ `ext:` extension strings; the card-entry/direct-content
  choice; "Only one of the CardEntry instances can have a default designation",
  §5.27.2) and the already-present AfA PNP document schemas.
- **qti-xml** normalizes `qti-catalog-info` on every carrier the spec names
  (§5.29: item, stimulus, feedback/template blocks, rubric blocks, modal/test
  feedback, test rubric blocks, PCI) and registers both official PNP roots
  (`access-for-all-pnp`, `access-for-all-pnp-records`) for detection,
  normalization, and strict validation. The corpus has no PNP instances, so
  the normalizer tests are hand-written XSD-faithful fixtures.
- **qti-react's pnp module** owns the two semantic halves: _activation_
  (which supports are in effect) and _matching_ (which card content realises
  an active support). The adapters pool every catalog in a document —
  document-level and nested — because catalog ids are document-unique (xs:ID).
- **the runtime** owns presentation; **the test controller** owns the §2.8.5
  time accommodation; **results reporting** reports the supports in effect.

## Designed policies (spec-silent; flag at review)

1. **Bare preferences activate at initialization.** A preference stated
   outside any activation set (a bare `keyword-translation xml:lang="es"`)
   is honored from the start: the PNP records the need, and without an
   activation policy there is nothing to defer to. Features in
   `activate-as-option-set` are offered but off; `prohibit-set` wins over
   everything, including the `activeSupports` override.
2. **`activeSupports` is the program/candidate channel.** "(or an assessment
   program's settings)" (§5.28) — the delivery engine passes program-enabled
   and candidate-toggled supports there; the runtime never invents toggles.
3. **Entry matching.** An entry matches when every discriminator it declares
   agrees with the candidate's preference for the card's support: xml:lang
   case-insensitively with a primary-subtag fallback (es-MX ↔ es), data-\*
   attributes against the camel-cased preference field (the exemplars'
   `data-reading-type` ↔ `spoken.readingType`). First match in document
   order wins; otherwise "use the content designated as default" (§5.27.2);
   otherwise the support yields nothing. Direct-content cards are
   unconditional once their support is active.
4. **Default presentation.** The authored content renders as-is; each active
   support's resolved content follows in a note-role span marked with the
   catalog idref, support name, and language; file-backed alternatives
   default to an accessible link through the Asset Resolver. Presentation is
   the delivery engine's to replace (`renderCatalogSupport`), and skins/support
   UI reach the same resolution via `useCatalogSupports` — the spec
   deliberately leaves presentation to the platform.
5. **Time accommodation scoping** (§2.8.5: "the durations may be changed
   depending on the relevant accessibility values in the Personal Needs &
   Preferences settings"). A `time-multiplier` is a rate accommodation and
   scales every declared max-time proportionally; `fixed-minutes` is an
   absolute extension of the assessment window and applies to the test scope
   only (applying it at every nested scope would multiply the accommodation);
   `unlimited` removes ceilings. Minimum times are floors, never adjusted.
   This lifts ADR-0005's PNP duration deferral.
6. **Result supports mapping.** Active and optional features report as
   `assignment="assigned"` with their stated detail (language; the
   additional-testing-time value); prohibited features report valueless ("A
   value MUST NOT be present when 'assignment=prohibited'", RR §2.6.4.3) —
   on the testResult, where the session-wide policy lives.

## Considered and rejected

- **Capability-gating items on catalog content** — catalogs are optional
  dormant content; an item without active supports is exactly the authored
  item, so canDeliver is unchanged. A dangling `data-catalog-idref` simply
  resolves to nothing rather than blocking delivery.
- **A PNP serializer** — import is the delivery direction (consume the
  learner's profile); export belongs to profile-management tooling we don't
  have. Staging postponement, like the RR `outcomeInformation` container.
- **Automatic decoration of skin-owned nodes** — the core walk decorates
  generic flow and block nodes; interaction sub-nodes (a choice label's
  idref) are the skin's render, covered by `useCatalogSupports` rather than
  core interference in skin output. Staging postponement for the reference
  skin to adopt where it owns the markup.

## Known unmapped

The PNP binding's `grpStrict.any` extension elements (foreign-namespace
extension points) normalize to nothing — staging postponement, mirroring the
RR `outcomeInformation` decision in ADR-0006.
