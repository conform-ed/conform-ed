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

## Language — interop & counterpart validation

**System Under Test (SUT)**:
The target a runner executes conformance flows against, named in the runner
config `sut` section. Vendor-neutral: the runner makes no platform assumptions
about it (see the Runner Contract's non-responsibilities).

**Counterpart**:
A real external system that conform-ed boots (via Podman Compose) or points at
to exercise a suite against a realistic, non-deterministic peer — e.g. Moodle
as an LTI platform, LTI.js as an LTI tool, LRSQL as an LRS. Its purpose is
**development integration** and **interop demonstration**, not adjudication: a
Counterpart is not assumed conformant, so a disagreement between conform-ed and
a Counterpart does not establish which side is wrong.
_Avoid_: reference system, oracle (a Counterpart is neither).

**Oracle**:
A system or suite trusted to be conformant, used to validate conform-ed's own
testers (meta-conformance). The authoritative oracles are the 1EdTech certified
reference implementations and certification suites; an uncertified OSS
Counterpart is not one. (LRSQL approximates an oracle for LRS only because xAPI
has a canonical reference and the ADL suite as an external check.) Holding an
Oracle is an aspiration, not a current gate.
_Avoid_: using "reference" loosely to mean either a Counterpart or an Oracle.

**Interop Profile**:
How a suite's interop lane is targeted: `local-reference` (the deterministic
in-repo adapter — the hermetic default), `oss-platform` (a real OSS platform
Counterpart), or `oss-tool` (a real OSS tool Counterpart). The profile selects
which side of a two-party protocol conform-ed plays and what it validates
against.
_Avoid_: conflating `local-reference` (an Oracle-adjacent deterministic fixture)
with the `oss-*` profiles (Counterparts).

**Counterpart Catalogue**:
The mapping conform-ed maintains from each `(suite, role)` **cell** — a protocol
suite paired with the side under test — to the Counterpart(s) that fill the
_opposite_ role for that cell. The catalogue, not a single system, is the unit:
a given real LMS may fill several cells (e.g. Moodle as the LTI-platform cell),
but each cell's lane stays independently runnable so suites are not coupled.
_Avoid_: "the target LMS" (there is no single target; a full LMS is one
catalogue entry among many).

**Interop Evidence**:
The artifact an `oss-*` lane emits: a record that a real, recognizable
Counterpart completed an interaction with the system under test, plus the raw
message transcript of that interaction. It is **coarse evidence of realism and
interoperability**, not a per-requirement conformance verdict — conformance
assertion of record stays in the `local-reference` path. The transcript is
captured even when only coarse success is asserted, so a later protocol-aware
observer (MITM) can add per-requirement assertions over the same format without
new capture infrastructure.
_Avoid_: calling a green `oss-*` lane "conformance" or "certified" — it is
neither (the Counterpart is not an Oracle).

**Observable direction / Opaque direction**:
For a two-party protocol, the side whose protocol output is on the wire (a
provider's responses; a tool's AGS/NRPS callbacks) is the **observable
direction** — conform-ed plays the opposite role, reads the messages directly,
and asserts per-requirement with no Counterpart and no Adapter. The side that
ingests or acts internally (a consumer; a platform receiving a launch) is the
**opaque direction** — its resulting state is not on the wire, so observation
needs an Adapter (or out-of-band inspection), and not even a MITM recovers it.
The observable direction is cheaper and ships first; the opaque direction is
where Counterparts and Adapters earn their keep.
_Avoid_: assuming a Counterpart is always required — the observable direction
needs none.

**Conformance Scanner**:
conform-ed run in the observable direction directly against a system under test
(no Counterpart): it plays the opposite role, exercises the SUT's surface, and
emits a per-requirement conformance report (e.g. "point conform-ed at your
OneRoster provider, get a report"). The headline first OneRoster deliverable.
Runs in **blind mode** (against any provider's live data — structural and
behavioural assertions only, no fixture) or **fixture mode** (the provider holds
the Fixture Dataset → value-level completeness plus behaviours that need known
data: `since`/delta, soft-deletion, pagination and filter boundaries). Blind
mode ships first; fixture mode follows and is also how the Scanner self-validates.
_Avoid_: conflating the Scanner with an `oss-*` interop lane (the Scanner needs
no spun-up system).

**Fixture Dataset**:
The single canonical, fully-specified dataset conform-ed owns per spec:version
(for OneRoster: known orgs/users/classes/enrollments/grades, including a
soft-deleted record, a multi-page collection, and a filterable subset),
versioned as a repo asset pinned to the spec version. One substrate, reused four
ways: Scanner fixture-mode, Scanner self-validation against a Counterpart, the
consumer lane (served to the SUT and compared against ingest), and the
`local-reference` provider. Seeded **spec-shaped via PUT/upsert** where the
counterpart supports writes (backend-agnostic, and exercises the write surface
for free); each catalogue entry declares its seeding mechanism since spec-shaped
seeding is preferred but not guaranteed (OneRoster REST core is read-only GET).
_Avoid_: per-lane ad-hoc seed data (it drifts and isn't reusable).

**State-observation Adapter**:
The contract by which a system under test in the **opaque direction** (e.g. a
OneRoster consumer) exposes its post-ingest state for assertion. An HTTP+JSON
Adapter (per the Adapter Contract) implementing a `oneroster-consumer-v1`
profile alongside `cmi5-lms-v1` / `lti13-tool-v1`: it triggers the ingest and
returns the SUT's ingested view in normalized OneRoster shape, which conform-ed
diffs against the Fixture Dataset. A consumer's state-observation adapter is
**almost a minimal OneRoster provider** ("expose what you ingested") — that
mapping-back is the irreducible cost of testing the opaque direction. Two
escape hatches: a **spec round-trip** fast-path for SUTs that already serve
OneRoster (read the ingest back via the Scanner, no new surface — emergent's
case), and a **self-report** degradation floor (a structured import report) for
consumers that cannot expose ingested state. The lane records which of three
honesty tiers a SUT reached: full diff → import-report check → coarse
"didn't crash".
_Avoid_: out-of-band DB inspection (the Runner/Adapter contracts disown it).

## Language — ELM / European Digital Credentials

**European Learning Model (ELM)**:
The EU's single multilingual ontology (`data.europa.eu/snb/model/elm`) for describing
learning — the shared vocabulary under every Europass credential/data profile. One
ontology; the profiles only add restrictions. conform-ed targets **v3.3**
(distribution `snb-model/20230928-0`, application-profile version `1.1.0`).
_Avoid_: Europass (the parent brand/platform), EDCI (the retired infrastructure name).

**Application Profile (AP)**:
A SHACL constraint layer over the one ELM ontology, expressing one use case's rules.
v3.3 has exactly four: **EDC**, **LOQ**, **AMS**, **PID**. The AP's SHACL shape graph is
the **authoritative conformance denominator** (a credential even self-declares it via
`credentialSchema: { type: "ShaclValidator2017" }`).
_Avoid_: schema, profile (unqualified), "the ELM schema" (there is no single one).

**ELM Core**:
conform-ed's VC-agnostic Zod model of the shared ontology classes (Agent, Organisation,
Person, Address, the Claim/Specification/Outcome families), reused by all four profile
layers. An architectural term of ours, not an EU one.
_Avoid_: "the EDC model" (the core is profile-neutral; EDC is one layer over it).

**European Digital Credentials for Learning (EDC)**:
The only **sealed, W3C-VC-shaped** ELM profile — root class `EuropeanDigitalCredential`,
a subclass of `VerifiableCredential` (VC Data Model **1.1**). The credential is the
interop artifact conform-ed verifies. Sub-variants: `generic-full`, `generic-no-cv`,
`accredited`, `converted`, `issued-by-mandate`, `diploma-supplement`.
_Avoid_: EDCI (infrastructure), EDCL when you mean the profile, "Europass credential".

**LOQ / AMS / PID**:
The three **unsealed, plain-dataset** ELM profiles (no VC envelope, no seal):
**LOQ** = Learning Opportunities and Qualifications (multi-rooted: `LearningOpportunity`,
`Qualification`, the Specification classes); **AMS** = Accreditation Metadata Schema
(root `Accreditation`); **PID** = Person Identity (root `Person`). conform-ed models and
coverage-maps these; it does **not** verify or seal them.
_Avoid_: "PID = eIDAS Person Identification Data" (a name collision; ELM PID is unrelated).

**e-Seal (JAdES)**:
The mandatory eIDAS electronic seal on an EDC: a **detached JWS** (JAdES, `b64:false`)
in a `signatures` array carrying an X.509 chain (`x5c`) and RFC-3161 timestamp tokens
(`adoTst`). conform-ed verifies it cryptographically (signature + chain + timestamp); the
**trust-root decision and "qualified" status are host-injected resolvers**.
_Avoid_: signature (a seal is legally distinct), proof / Data Integrity proof (that is the
VC cryptosuite path EDC does **not** use).

**Controlled Vocabulary (CV)**:
An EU SKOS value-set (EQF, ISCED-F, NAL country/language, credential/assessment types, …)
constraining ELM coded fields. conform-ed **enforces membership** for the bounded EU
lists and treats large open schemes (**ESCO**) as **opaque IRIs** (scheme-checked only) —
i.e. `edc-generic-full` where tractable, `-no-cv` behaviour only for ESCO.
_Avoid_: enum, code list (use CV).

**EDC Reference Renderer**:
The credential analogue of the QTI **Reference Skin** — a framework-light, accessible
**semantic-HTML** rendering of an EDC driven by its `displayParameter`/`individualDisplay`,
shipped so credentials can be exercised/demoed/conformance-tested without a downstream
product. Not a product UI; no React; no PDF/pixel parity with the EU Viewer.
_Avoid_: viewer, themed/product renderer.
