# Capability gate: unsupported content is reported, never silently dropped

Status: accepted

The runtime will always know less QTI than content can express — new
interaction kinds, content-model elements, and RP operators arrive milestone
by milestone, and consumers' skin registries lag behind the core. The original
behavior (silently dropping an interaction with no registered skin, silently
stripping a non-allowlisted element) renders half-items that are unanswerable
with nobody told — an assessment-validity bug. Decision: two layers. (1) The
runtime exposes a **Capability Report** (e.g. `canDeliver(item)`) listing the
unsupported kinds, elements, and RP operators in given content, so consumers
gate items before delivery. (2) If unsupported content reaches rendering
anyway, the runtime renders an explicit, accessible **Unsupported
Placeholder** instead of nothing. This is what lets the core and its consumers
evolve at different speeds safely.

## Considered and rejected

- **Fail loudly at mount** — strictest validity guarantee, but forces every
  consumer into error boundaries and makes previewing newer content harsh.
- **Keep silent drop as the documented contract** — maximally forgiving but
  invisible in telemetry; the validity bug just waits.
