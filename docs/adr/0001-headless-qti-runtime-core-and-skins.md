# Headless QTI runtime core with injected skins

Status: accepted

`@conform-ed/qti-react` is a headless core: it owns response state, response
processing, the content-allowlist walk, and the accessibility baseline, and
renders interactions by dispatching each body node by `kind` to a Skin from an
injected Skin Registry. Skins are controlled components that receive a props
bundle and prop-getters (`getOptionProps(id)` etc.) so keyboard/ARIA behavior
stays centralized while skins keep full layout freedom. The runtime is
assembled by a factory — `createQtiRuntime({ interactions, skin })` — and its
interaction-kind union is exactly the injected descriptor set: no global
registry, no module augmentation. An Interaction Descriptor is pure logic
(kind, schema, scoring, initial response) and imports no UI, so downstream
products can define private extension interactions outside this repo.

## Considered and rejected

- **Monolithic styled renderer.** Faster to ship, but extracting a headless
  core from style-coupled code afterwards is real work that tends not to
  happen, and it would lock the MIT runtime to one component library.
- **No skins in conform-ed at all** (the original split: core here, every skin
  downstream). Rejected after practice: with zero skins in-repo, no interaction
  can be seen, demoed, or conformance-tested without a downstream product,
  which serializes development. conform-ed therefore ships an unstyled,
  semantic-HTML **Reference Skin** per interaction plus an example harness.
  The Reference Skin is deliberately not a product UI; consumers are still
  expected to bring their own skins.

## Consequences

- The core never imports a component library or any consumer-private package.
- Every new interaction lands as descriptor + Reference Skin + tests entirely
  inside this repo; downstream skins follow on their own schedule.
