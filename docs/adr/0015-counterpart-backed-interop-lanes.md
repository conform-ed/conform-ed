# Counterpart-backed interop lanes: real-system realism, not a conformance oracle

Status: accepted (2026-06-18)

conform-ed already stands real systems up as interop targets: Moodle (LTI platform)
and LTI.js (LTI tool) via Podman Compose, LRSQL for LRS, and a cmi5 external lane.
The open question was whether to lean into "spin up an OSS LMS/system and validate
against it" as a **first-class, general conform-ed capability** across more specs
(OneRoster, Caliper, …). The answer is yes — but only with a precise division of
labour, because the obvious framing (treat the spun-up system as the reference of
truth, à la LRSQL) does not generalise.

The LRSQL analogy leaks for two reasons. First, xAPI is effectively a **single-party**
API — you POST statements and read them back, so the target is fully observable and
can serve as both peer and checkable target at once. LTI/OneRoster are **two-party**
protocols whose real counterpart (Moodle's internals) is opaque, so you cannot derive
per-requirement conformance from an exchange routed through it. Second, the OSS
counterparts that exist are **off-version, low-provenance, or fill the wrong role**:
Moodle's OneRoster plugin is a rostering **consumer** at **v1.1** (alpha, no gradebook),
its Caliper plugin is an **emitter** at **v1.0**, and the most complete OSS OneRoster
**v1.2 provider** is a single-maintainer project. A disagreement between conform-ed and
such a system adjudicates nothing.

## Approach

The goal is **one defensible, fully-explained set of lanes shipped early** — put
to use in the wild to attract community feedback — not exhaustive coverage on day
one. Every choice below is recorded with its rationale precisely so external users
(and future us) can challenge it; the lanes are expected to **evolve from real
feedback**. The honest scoping that makes that evolution safe — Coverage-Map
denominators, evidence tiers, and "a Counterpart is not an Oracle" — is therefore
a feature, not a hedge.

## Decision

1. **The unit is the Counterpart Catalogue, not a single LMS.** Each `(suite, role)`
   cell maps to the Counterpart(s) that fill the _opposite_ role. A full LMS may fill
   several cells (Moodle as the LTI-platform cell today), but each cell's lane stays
   independently runnable so suites are never coupled to one stack. There is no "the
   target LMS".

2. **`local-reference` is the conformance oracle-of-record; `oss-*` is realism only.**
   `local-reference` (conform-ed implements the opposite role itself) is fully
   observable and deterministic, carries the per-requirement spec-cited assertions, and
   is the **CI gate**. The `oss-*` profiles (real Counterparts) are **opt-in / nightly**,
   emit **Interop Evidence** (coarse "a real, recognizable system completed the
   interaction with the SUT", plus the raw transcript), and are **never the gate and
   never described as conformance or certification**.

3. **Counterparts are not Oracles.** Real-system lanes buy _realism_ and _interop
   demonstration_, not authority. The authoritative oracles remain the 1EdTech certified
   reference implementations / certification suites. This is a permanent boundary, not a
   v1 limitation.

4. **Selection is driven by conform-ed platform value, not emergent readiness.** This is
   a deliberate override of the BACKLOG "named-consumer" principle: a counterpart-backed
   lane graduates when it makes conform-ed more useful to _any_ implementer, even if no
   in-house consumer needs it yet. Both directions of a suite are in scope eventually;
   work proceeds incrementally, feature by feature.

5. **Staged evolution, cheap because lanes are ephemeral.** Lanes re-provision the
   Counterpart from scratch every run, so a future protocol-aware MITM is a drop-in at
   the provisioning seam, not a migration. v1 takes two pieces of cheap insurance —
   **capture raw transcripts even while only asserting coarse success**, and **keep the
   SUT endpoint a single configurable indirection point** — so v2 (per-requirement
   assertion via an observing proxy) is purely additive over the same transcript format.
   **REST/bearer suites first** (OneRoster, Caliper-receive: a MITM is trivial HTTP);
   **LTI last** (its signed JWT / AGS / NRPS flows bind issuer/audience/redirect/JWKS, so
   a proxy is a registered party that must verify against the JWKS — a real project, not
   a pass-through).

## Considered and rejected

- **Treat the spun-up OSS system as the conformance oracle (the LRSQL model).** Fails on
  observability (two-party, opaque counterpart) and on provenance/version (off-version,
  uncertified, wrong-role OSS). Keeps the analogy honest by demoting it.
- **A single mega-LMS (Canvas / Open edX / Moodle) as _the_ validation target.** The
  specs with the weakest OSS-LMS support (OneRoster, Caliper) are exactly the ones we'd
  add; one stack couples all suites and the heaviest LMSes wreck CI determinism. A full
  LMS is one catalogue entry, allowed to fill multiple cells — not the target.
- **`local-reference` only, no real systems.** Loses the realism and interop-demonstration
  value entirely and leaves conform-ed marking its own homework.
- **Build the full both-direction matrix up front.** Rejected in favour of incremental,
  platform-value-ordered delivery; both directions remain in scope.

## Consequences

- **Three CI tiers, and containers never gate a PR.** (1) Scanner/diff correctness
  tests (fixture-based, against the in-repo reference, including crafted bad
  responses) and (2) `local-reference` interop lanes (in-process) are the **PR
  gate**; (3) all `oss-*` lanes — including the `go-oneroster` Scanner-validation
  lane — need Podman and run **nightly / manual only**, with triaged realism
  failures (off-version, plugin quirks) never stopping the line.
- v1 must capture transcripts even without asserting on them — the only non-obvious "do
  it now or pay later" item.
- The catalogue must record each counterpart's **provenance and version** (e.g. "Moodle
  `enrol_oneroster`, OneRoster 1.1 rostering consumer, alpha"), so an Interop Evidence
  consumer knows exactly what a green lane did and did not exercise.
- A claims-discipline obligation: docs and any marketing must keep "tested against
  Moodle" visibly distinct from "1EdTech certified" (separate follow-up), and the GPL/
  AGPL redistribution posture of bundled compose images must be settled before publishing
  them.
- Caliper is parked until a named need; the catalogue scaffolding is built spec-agnostic
  so adding it later is a catalogue entry, not new architecture.
