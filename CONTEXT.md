# conform-ed

Standards-conformance tooling for education interop. The terms below are the
canonical language for this repo; today the glossary covers the **QTI delivery
runtime** context (`packages/qti-react`, `packages/qti-xml`, the QTI parts of
`packages/contracts`). Other contexts (LRS, LTI, cmi5) add their sections as
their language gets resolved.

## Language — QTI delivery runtime

**Headless Core**:
The framework-light QTI runtime: response state, response processing, the
content-tree allowlist walk, and a11y wiring — with no styling and no product
dependencies. Lives in `@conform-ed/qti-react`.
_Avoid_: renderer (that's core + a skin), player.

**Skin**:
A controlled presentational component for one interaction kind, receiving its
state and prop-getters from the Headless Core. A **Skin Registry** maps
interaction kinds to Skins.
_Avoid_: theme, widget.

**Reference Skin**:
The unstyled, semantic-HTML, accessibility-correct Skin set that conform-ed
ships so every interaction can be exercised, demoed, and conformance-tested
without any downstream product. Not a product UI.
_Avoid_: default skin (consumers are expected to bring their own).

**Interaction Descriptor**:
The pure-logic definition of an interaction kind: its identity, validation
schema, and initial-response semantics. Imports no UI.

**Content Model**:
The allowlist of body elements and attributes the Headless Core will emit.
It is the sanitizer: content outside it never reaches the DOM. Its end-state
target is the QTI 3 shared-vocabulary HTML subset, not all of HTML5.
_Avoid_: whitelist, schema (validation is upstream in contracts).

**Capability Report**:
The runtime's answer to "can this content be delivered, and if not, why":
the interaction kinds, content elements, and response-processing operators in
a given item/test that this runtime version does not support. Consumers gate
delivery on it.
_Avoid_: feature flags, version check.

**Unsupported Placeholder**:
The explicit, accessible element rendered where unsupported content would
appear if it reaches rendering anyway. Unsupported content is never silently
dropped.

**Response Processing Interpreter**:
The pure, deterministic evaluator of an item's `responseProcessing` tree.
The QTI standard templates are built-in canonical trees, not a separate
scoring path. Operator coverage grows by milestone and is surfaced in the
Capability Report.
_Avoid_: scorer, grading engine.

**Response Normalization**:
An opt-in, consumer-configured transform of candidate input applied before
response processing (e.g. case/diacritic folding for language learning). Off
by default; always off in conformance runs. A documented deviation, not part
of QTI semantics.
_Avoid_: leniency (in code/docs — use the precise term).

**Test Controller**:
The pure, deterministic engine for `assessmentTest` semantics: navigation
modes, section selection/ordering under a seed, preconditions, branch rules,
outcome processing, and test feedback. It owns the rules; the consumer owns
all persistence and session storage.
_Avoid_: session manager, sequencer-service.

**Attempt**:
One candidate's in-memory engagement with one rendered item inside the
runtime: responses, submission state, scores. Persistence of attempts is the
consumer's concern.
_Avoid_: session (a consumer-side persistence concept).

**Asset Resolver**:
The consumer-supplied hook that maps package-relative media references in
content to real URLs at render time.

**Conformance Ladder**:
The 1EdTech QTI 3 Delivery certification levels, used as the external,
ordered definition of scope for the runtime. "Done" for a milestone means the
corresponding rung's requirements, not a self-defined feature list.

**Corpus**:
The official 1EdTech `qtiv3-examples` set, inventoried by
`@conform-ed/qti-xml`. **Corpus coverage** — the share of the Corpus that is
deliverable (per the Capability Report) and correctly scored — is the
runtime's public progress meter.
