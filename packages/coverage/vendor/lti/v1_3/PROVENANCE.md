# LTI 1.3 / AGS 2.0 vendored denominator — provenance ⚠️

The `lti:1.3` Coverage Map is a **hybrid**: only **Assignment & Grade Services (AGS) 2.0**
has any machine-readable denominator. Core 1.3, NRPS 2.0, Deep Linking 2.0 and Proctoring
1.0 publish **no schema** (inline JSON examples + normative prose only, verified
2026-06-21) and are guide-catalogue-only — they are *not* vendored here.

## Source (the AGS OpenAPI)

- **Bibliography reference:** `[AGS-OpenAPI]` — "Learning Tools Interoperability®
  Assignment and Grade Services Version 2.0 OpenAPI Specs", cited by the AGS 2.0 spec at
  §3.2.1 / §3.3.4 / §3.4.3. URL: <https://www.imsglobal.org/spec/lti-ags/v2p0/openapi/>
- **Actual artifact** (the file the `/openapi/` Swagger-UI page loads):
  <https://www.imsglobal.org/sites/default/files/specs/lti/1p3/openapi/openapi_full_0.yaml>
- **Vendored verbatim as:** `ims_lti_ags_v2p0_openapi_source_v1p0.yaml`
  (`openapi: 3.0.0`, `info.title: "Assignment and Grade Services"`, `version 1.0.0`)
- **sha256 (source YAML):** `a18563c2c9cc00c81b1b02dc6a9da6e743eb5cc6aeb6c6f072723d1348dad35f`

This is the **only** machine-readable AGS artifact 1EdTech ships. There is no separate
JSON-Schema distribution: `purl.imsglobal.org/spec/lti-ags/v2p0/schema/json/` and the
`/sites/default/files/spec/lti-ags/v2p0/schema/json/…` paths are soft-404s (HTTP 200 +
empty `text/html`), and the 1EdTech / IMSGlobal GitHub orgs publish none. The AGS spec
itself labels the OpenAPI paths/schemas as "given for illustrative purposes."

## The transform (⚠️ read this — why there are two files)

The published AGS OpenAPI defines its information model **inline under the path media
types** — there is **no `components.schemas` section and no `$ref`s**. The Coverage Map's
OpenAPI walker (`walkOpenApi`) reconciles `components.schemas` against conform-ed's Zod, so
the inline schemas are **lifted into `components.schemas`** in the derived artifact:

- **Derived, walker-facing file:** `ims_lti_ags_v2p0_openapi3_v1p0.json`
- **sha256 (derived JSON):** `853f2783c6db4da23b8ba8b5c5dc9d2ddb5ee684745567fba653619d299041a6`

The transform is **purely mechanical address translation — no schema content is added or
dropped** (the Caliper-bundle precedent in `../../caliper/v1_2/PROVENANCE.md`):

1. YAML → JSON (the walker parses JSON).
2. `info` and `paths` are copied **verbatim** (the `paths` are the transport axis the
   walker reads via `walkOpenApiPaths`; their bodies are untouched).
3. A `components.schemas` section is **added**, holding the five 1EdTech-named media-type
   schemas lifted from the inline path bodies:
   - `LineItem` ← the `application/vnd.ims.lis.v2.lineitem+json` schema. The media type
     appears in two forms — a request form (no `id`) and a response form (`id` present).
     The **response superset** (from `LineItem.GET`) is the canonical `LineItem`; the
     request form is the same object minus `id`, which conform-ed's `LineItemSchema`
     already models as optional. (The lift is byte-asserted: the `lineitemcontainer`'s
     own inline items are identical to this `LineItem`.)
   - `LineItemContainer` ← `…lineitemcontainer+json` — an array of `$ref: LineItem`.
   - `Score` ← `…v1.score+json`.
   - `Result` ← the item schema of `…resultcontainer+json`.
   - `ResultContainer` ← `…resultcontainer+json` — an array of `$ref: Result`.

The names are **1EdTech's own** (the media-type names), not invented; the only editorial
choice (the response-superset form of `LineItem`) is dictated by the spec's text ("`id`
… must be present on all responses"). A reviewer can diff each `components.schemas` entry
against the inline copies still present in `paths` to confirm fidelity.

## Reconciliation notes (what the map shows)

- Every AGS property reconciles `yes` against conform-ed's `LtiAgsV2_0` Zod (`modelledYes`,
  no silent gaps). The residue **extensions** — `gradesReleased`, `submission`,
  `scorePublished`, `scoringUserId` — are fields conform-ed models that the *illustrative*
  OpenAPI omits (honest: conform-ed is the richer contract).
- `normativeStatementsCited` is **0**: the AGS OpenAPI descriptions use prose-case "must",
  not the ALL-CAPS RFC-2119 "MUST" the metric reads (as for the XSD-family CC/QTI maps).
  AGS is "schema-backed" by **L2 reconciliation** (`modelledYes`), not by `cited`.

If 1EdTech later publishes a canonical AGS JSON-Schema distribution (with
`components.schemas` and RFC-2119 prose), re-vendor from there and drop this transform.
