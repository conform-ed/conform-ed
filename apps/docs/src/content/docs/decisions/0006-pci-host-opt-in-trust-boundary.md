---
title: "PCI hosting is an opt-in trust boundary with an injectable module registry"
description: "Architecture decision record ADR-0006."
sidebar:
  order: 6
  badge: { text: "ADR-0006", variant: note }
---

Status: accepted

Portable Custom Interactions (IMS PCI v1) are item-supplied JavaScript: an
AMD module the delivery engine loads, instantiates over markup it owns, and
asks for a response. `@conform-ed/qti-react` hosts them, but **never by
default**. The `portableCustomInteraction` descriptor is not part of
`qtiCoreInteractions`; a consumer opts in by registering the descriptor plus
a skin from `createPciSkin({ registry })`, where the **PCI Module Registry**
is the explicit trust decision — it evaluates AMD source (`define`), brokers
`qtiCustomInteractionContext.register`, and loads module URLs with
primary → fallback paths. Until then the capability gate keeps PCI items
undeliverable (ADR-0003), and once enabled, a module that fails to load
renders an explicit error note, never a silent drop.

Two structural choices follow the spec rather than React idiom:

- **PCI markup is module-owned and opaque.** It bypasses the content-model
  element allowlist (the module queries and mutates it directly), is
  serialized to HTML with only the hard floor applied — no event-handler
  attributes, no script elements, no script-scheme URLs — and injected
  outside React's reconciliation. The mount lifecycle (`mountPci`) is
  framework-free; the React skin is a thin wrapper.
- **Responses are collected, not pushed.** PCI v1 has no change events; the
  engine calls `getResponse()` when it needs the value. The attempt store
  gained a response-collector seam: the host registers a collector and
  `submit()` pulls the instance's response (converted from PCI JSON) before
  scoring, so every submit path — UI or headless — sees the same value.

## Considered and rejected

- **Shipping PCI in `qtiCoreInteractions`** — makes "render an item" mean
  "execute arbitrary item JavaScript" for every consumer; the trust decision
  must be visible in the consumer's own code.
- **A sandboxed iframe host** — the spec-blessed isolation story, but it
  changes the rendering contract (sizing, styling, asset resolution) and
  none of the corpus modules require it; the registry seam leaves room for
  an iframe-backed skin later without changing the descriptor.
- **Re-rendering PCI markup through React** — the module mutates DOM it
  expects to own (`outerHTML` swaps in the corpus's tap.js); reconciliation
  would fight it. One-time injection into a ref'd container is the only
  shape that runs real corpus modules unmodified.
- **Polling or DOM-event sniffing for responses** — nondeterministic and
  spec-foreign; submit-time collection matches how the spec's own engines
  drive `getResponse()`.
