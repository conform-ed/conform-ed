# Generic PCI delivery: hash-pinned module catalog + state persistence

Status: accepted (2026-06-16)

The PCI host is **built and corpus-proven**. `@conform-ed/qti-react` parses a
`portableCustomInteraction` node (module, `customInteractionTypeIdentifier`,
properties, markup, and the `interactionModules` from `module_resolution.js`),
the registry evaluates AMD modules through `qtiCustomInteractionContext`, and
`mountPci` already does **content-driven loading** — `registry.load(id, [primaryPath,
fallbackPath])` over an injectable `fetchText` — then runs the full
`getInstance → onready → getResponse → getState → oncompleted` lifecycle with
`boundTo`/state restore and submit-time response collection (ADR-0006). The
`pci-corpus.local` test loads the real HMH `tap.js` and drives it end to end.
PCI stays opt-in and out of `qtiCoreInteractions` (ADR-0006); the install model
is v1 (ADR-0007).

So "generic PCI" is **not** new host work. The gap is the three deferred
mid-term rungs (`docs/BACKLOG.md`), which graduate now because **emergent is the
named consumer**: it needs corpus PCIs and teacher-authored/imported PCIs to
deliver — i.e. modules it did **not** statically install — and to do so without
blindly evaluating content-declared internet JavaScript in learners' browsers
(the thing ADR-0006/0007 deliberately refused as a default).

## Decision

**1. Hash-pinned catalog — a policy wrapper over the existing `load`/`fetchText`
seam, not a new loader.** A catalog is `{ module id → { url, integrity } }`
(plus an allowlist of permitted URLs). It produces (a) a `paths`/resolver that
maps a content-declared module id to its **vetted** URL (the spec's
module-resolution explicitly anticipates an engine overriding package sources
with vetted copies), and (b) a `fetchText` that **verifies the integrity hash of
fetched source before `evaluate`** and **default-denies** anything not in the
catalog — refused loudly (ADR-0003 capability-gate stance), never blind-eval'd.
The registry and `mountPci` are unchanged: the catalog is injected as the
`paths` + `fetchText` already in `PciModuleRegistryOptions`. Trust becomes an
explicit, verifiable publishing decision (ADR-0006) instead of "whatever the
content points at".

**2. `getState` persistence.** `mountPci` already accepts a restore `state` and
the handle already exposes `getState()`; thread it through the session model so
suspend captures each PCI's state and resume re-mounts with it. Closes the one
lifecycle gap for in-progress custom interactions (BACKLOG #2).

**3. Package module loading (phase 2).** Resolve `interactionModules` + module
bytes from a QTI package zip (`imsmanifest.xml` + `module_resolution.js`), so a
self-contained QTI/CC package's PCI delivers without a separate catalog entry
(BACKLOG #4). The catalog's integrity/allowlist policy still applies to the
bytes the package supplies.

## Trust is layered — three actors, not one

A PCI is browser-side widget JS (`getInstance`/`getResponse`); its item's
**responseProcessing may also reference a `customOperator`** (scoring code that runs
in the RP interpreter, not the sandbox). These have different trust owners:

1. **Engine-side PCIs (developer + product) — the install model, already built.**
   A PCI that ships a bespoke widget and/or a **custom RP operator** (the
   `@conform-ed/pci-math-entry` archetype: the `org.conform-ed.mathEquivalent`
   operator + checker) is written and packaged by a **developer**, installed as a
   dependency, and registered with the runtime — a **product** decision to ship it.
   An admin **cannot** supply this: an operator is scoring code, refused loudly when
   unregistered (ADR-0003/0006/0007), and is never loaded from content.
2. **Content/third-party PCIs (admin, per offering) — the catalog, this ADR.** A
   pure-UI PCI whose response is scored by **standard RP** (no uninstalled
   `customOperator`) — the corpus `tap.js` archetype — can be sanctioned by an org
   admin as a vetted, integrity-pinned catalog entry. The catalog hosts a _widget_;
   it can never grant an _operator_.

So the catalog is **additive on top of the install model**, not a replacement: it
widens delivery to vetted standard-RP content PCIs, while operator-bearing / bespoke
PCIs stay a developer+product install. A content PCI whose RP needs an uninstalled
operator is still refused (capability gate) until that operator is installed —
exactly today's behaviour.

## emergent as the consumer (cross-repo; designed here, built there)

emergent opts in by registering `portableCustomInteraction` + `createPciSkin({ registry })`:

- **Tier 1 (install):** emergent installs PCI packages (math-entry, future first-party
  ones) as dependencies and registers their modules + operators. No catalog involved;
  enabling one in an offering is an admin toggle over an already-shipped capability.
- **Tier 2 (catalog):** for vetted standard-RP content PCIs, the catalog entries are
  **module bundles hosted on the ADR-0023 asset pipeline** — already content-addressed
  (server-authoritative `sha256`), so each asset is a natural entry
  (`id → { signed-url, integrity }`) with no new storage. An org admin uploads/approves
  the bundle; ingest flips a PCI item from **quarantined** to deliverable exactly when
  its module resolves in the catalog **and** its RP needs no uninstalled operator.

Neither tier changes conform-ed beyond the catalog seam (1) being injectable.

## Considered and rejected

- **Content-maximal loading (evaluate whatever `module_resolution` declares,
  incl. public CDNs)** — maximum corpus fidelity, but executes content-author /
  arbitrary-internet JS in learners' browsers by default; reverses ADR-0006/0007.
  The catalog is the safe form of the same capability.
- **Building the catalog ahead of a consumer** — ADR-0007 deferred it for exactly
  this reason; emergent is now that consumer, so it graduates with a real seam to
  satisfy rather than a speculative one.
- **A sandboxed-iframe PCI host** — the spec-blessed isolation story; ADR-0006
  left room for it behind the skin/registry seam. Not required for the corpus
  modules, and orthogonal to the catalog (integrity verification is needed with
  or without an iframe). Revisit if a consumer must run untrusted modules.

## Decisions (Anton, 2026-06-16)

1. **Integrity algorithm = `sha256`** (accepts both a bare hex digest and an SRI
   `sha256-<base64>` string, normalized before compare), so a catalog entry is the
   emergent asset row verbatim — one hash, computed once at finalize. _(accepted)_
2. **Scope = all three rungs in one phase** — hash-pinned catalog + `getState`
   persistence + QTI/CC-package module resolution land together (package loading
   reuses the catalog: a package becomes a set of integrity-pinned entries). _(accepted)_
3. **emergent curation locus is layered, not admin-only** (corrected 2026-06-16
   after review): **(tier 1)** engine-side PCIs that ship a bespoke widget and/or a
   custom RP operator (math-entry archetype) are a **developer + product** install —
   an admin cannot upload an operator; **(tier 2)** vetted standard-RP content PCIs
   are **org-admin-vetted per offering** via the catalog (ADR-0023-asset-backed).
   The catalog is additive on top of the install model. _(accepted, layered)_
