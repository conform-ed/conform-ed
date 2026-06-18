---
title: "Spec Coverage Map: literal-schema denominator, Zod provenance, conformance catalog"
description: "Architecture decision record ADR-0013."
sidebar:
  order: 13
  badge: { text: "ADR-0013", variant: note }
---

Status: accepted (2026-06-17)

conform-ed already ports each targeted spec to a deliberately _normalised_ Zod model (see the
`packages/contracts/*-templates.md` notes, which are explicit that the Zod is not literal
XML/JSON fidelity). That model answers "what did we choose to represent", but it structurally
**cannot** answer "what does the published spec contain that we never modelled" — the silent-omission
question. A standards-driven platform aiming to _just pass_ certification needs the second answer,
and it is reusable conformance knowledge that belongs here, not buried in the closed product
(consumed downstream by emergent ADR-0028).

## Decision

Introduce **`@conform-ed/coverage`**: a package that generates and publishes a versioned,
machine-readable **Coverage Map** per `spec:version`, built against the **literal published schema**
as the denominator — never against our own Zod surface.

- **L1 — information-model inventory.** Walked from the **vendored** upstream schema
  (XSD / JSON Schema / OpenAPI), re-fetched from the published URLs and version-pinned into the repo
  for reproducibility. One walker per schema _language_, not per spec.
- **L2 — "modelled in conform-ed?"** Each L1 item reconciled against the Zod contracts by
  **automated structural correspondence**, with explicit `specRef` overrides only where conform-ed
  normalised (renamed/merged) the element. Overrides are carried inline as Zod v4
  `.meta({ specRef: [...] })` (many-to-many: one normalised field may absorb several literal
  elements). This co-locates provenance with the code so it cannot drift.
- **C — conformance catalog.** The normative behavioural requirements (the MUSTs that map to no
  single element — error handling, sequencing, transport), **hand-extracted once** from each
  published conformance/certification guide (no machine source exists), **tagged by certification
  profile / level / role**, and cross-linked to the L1 keys they constrain. C2 ("enforced in
  conform-ed?" via a Zod `.refine`, `qti-xml` validation, the runtime, or a conform-ed conformance
  test) is auto-derived where the enforcement is a named test.

### Identity and output

- **Item key = the literal schema's own canonical address**, namespaced by version:
  `spec:version:binding:path` (e.g. `qti:3.0.1:asi:assessmentItem/responseDeclaration/correctResponse`).
  Deterministic from the schema (regeneration reproduces identical keys), survives Zod refactors
  (the key is the _spec's_ identity, not ours), and is the vocabulary a certifier already speaks.
- **Conformance key:** `spec:version:conf:profile/reqId`.
- **De-dup:** each type/definition is keyed once; multiple appearances are recorded as **usage edges**
  rather than expanded per-usage (avoids combinatorial explosion of shared types).
- **Each `spec:version` is an independent inventory** — no cross-version evolution linking in v1.
- **Output format: committed JSON** (a machine artifact, diffable so a spec re-fetch or Zod change
  shows up as a reviewable diff).

### The residues are first-class outputs

The reconciliation deliberately surfaces three sets, which are the whole point:

- **L1 without L2** — in the published spec, not modelled = candidate **silent gap** (review queue).
- **L2 without L1** — modelled but maps to no literal element = a conform-ed **extension** (e.g. the
  QTI superset `org.*` additions), legitimately flagged as non-spec.
- **L1 with L2 but normalised** — the documented **deviations**, now machine-traceable instead of
  buried in prose.

## Considered and rejected

- **Key/enumerate off the Zod model.** Cheaper and always-in-sync, but structurally blind to silent
  omissions — defeats the reason for the literal denominator.
- **Hand-transcribe the information model from spec prose.** Unnecessary: the structural axis is
  generatable by walking the machine schema. Hand work is reserved for the prose-only conformance
  catalog.
- **A separate hand-maintained L1↔L2 mapping file.** Decouples provenance from the Zod, double-
  maintained, drifts. The inline `.meta({ specRef })` override stays attached to the code.

## Consequences

- Upstream source schemas must be vendored and version-pinned here — a reproducibility win that
  conform-ed arguably wanted anyway.
- A bounded `specRef` annotation pass over the existing Zod (only the documented deviations). This
  reconciliation _is itself_ much of the value: it forces confronting the literal spec.
- A cross-repo release step: regenerate the Coverage Map here, bump the dependency in emergent.
- Rollout proves the full vertical on **Open Badges 3.0** (JSON Schema — simplest walker, already
  conformance-validated), then fans out by schema-language family.
