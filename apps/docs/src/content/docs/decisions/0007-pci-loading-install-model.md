---
title: "PCI loading: install model now, hash-pinned catalog as a policy layer later"
description: "Architecture decision record ADR-0007."
sidebar:
  order: 7
  badge: { text: "ADR-0007", variant: note }
---

Status: accepted

How does a PCI implementation get into a running consumer app? The spec's own
packaging examples answer "fetch whatever `module_resolution.js` points at" —
including public CDN URLs (the official pci-simple package loads jquery and
handlebars from the open internet). The ecosystem splits into three models:
spec-maximal content-driven loading (pure players like amp-up.io), an
install-and-register model (TAO, the largest open PCI ecosystem), and vetted
platform catalogs (large vendor engines).

Decision: **v1 is the install model.** Consumers install a PCI package as an
ordinary dependency and register it with the runtime. Descriptors (type
identifier, operator classes) register **eagerly** so `canDeliver` and bulk
content import answer cheaply; implementations (widget code, heavy
dependencies) load **lazily** via `import()` before an item using them mounts.
Content referencing an unregistered `custom-interaction-type-identifier` is
refused loudly — the same detection-and-refusal stance as `customOperator`
(ADR-0003, ADR-0006). Trust is what you installed.

The mid-term target (tracked in `docs/BACKLOG.md`) is a **hash-pinned
catalog**: platform-authoritative entries (`module id → url + integrity hash`)
fetched at delivery time, enabling new PCIs without redeploying the consumer —
the spec's module-resolution design explicitly anticipates engines overriding
package sources with vetted copies. The architecture must stay neutral to this:
the registry already exposes `load(id, candidates)` with an injectable
`fetchText` and a `paths` map, so the catalog is a _policy wrapper_ (allowlist
plus integrity verification before evaluation) in front of an existing seam —
no breaking change to consumers. Nothing in the host may grow an assumption
that all modules are statically registered.

## Considered and rejected

- **Spec-maximal content-driven loading** — maximum corpus fidelity and
  content portability, but it executes JavaScript chosen by content authors
  (and arbitrary internet JS) in learners' browsers by default; reverses
  ADR-0006's "trust is a publishing decision".
- **Hash-pinned catalog now** — the right mature rung, but it front-loads
  fetch/verify/cache infrastructure before any consumer delivers third-party
  PCI content; built ahead of demand it would be designed without a real
  consumer in the loop.
