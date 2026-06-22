# cmi5 v1.0 (Quartz) vendored denominator — provenance

The `cmi5:1.0` Coverage Map reconciles the **course-structure** information model — the part
cmi5 publishes as a normative **XSD** — against conform-ed's `Cmi5V1_0` Zod contracts. The
cmi5 runtime surface (the xAPI launch flow, the nine defined-statement verbs, the LMS launch
data) is **not** modelled here: it is a prose + xAPI-profile surface with no schema, and the
conform-ed contracts model only the course structure.

## Source (the course-structure XSD)

- **Bibliography reference:** the cmi5 specification "Quartz" revision course-structure schema,
  cited by `@conform-ed/contracts/cmi5` `specLinks.courseStructure`.
- **Actual artifact:**
  <https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/v1/CourseStructure.xsd>
- **Vendored verbatim as:** `CourseStructure.xsd` (raw download from
  `https://raw.githubusercontent.com/AICC/CMI-5_Spec_Current/quartz/v1/CourseStructure.xsd`)
- **sha256:** `6a0b04962f5baa4603ee28e84ce4c74a122f322a548c8fdc14d93b2a23781d75` (5730 bytes)

The schema declares a single global element, `<courseStructure>` (type `courseType`); every
other construct is a named or anonymous complexType. There is no `targetNamespace` import
beyond the `##other` extension points (`xs:any` / `xs:anyAttribute`).

## Reconciliation notes (what the map shows)

conform-ed normalises the XSD **shape**, so the L2 join needs two ADR-0017 structural aliases,
one transparent wrapper, and one leaf override (all recorded on the `SpecSource`) — after which
it reconciles with **no silent gaps**:

- `<au>` / `<block>` are a repeated `xs:choice`; conform-ed regroups them into one
  `children: (Au | Block)[]` union array → structural alias `children` ↔ `["au", "block"]`.
- `<langstring>` (repeated) becomes a `langstrings` array → structural alias
  `langstrings` ↔ `["langstring"]`.
- `<objectives>` wraps a repeated `<objective>`; conform-ed flattens it to a direct array →
  `transparentLiteralWrappers: ["objective"]`.
- a `<langstring>` carries its text in `simpleContent`, which conform-ed names `value` →
  `specRefOverride` (`modelledSegment: "value"`).

The `moveOn` and `launchMethod` enum attributes are additionally checked as **value-sets**
against `Cmi5MoveOnSchema` / `Cmi5LaunchMethodSchema` (7 members, all modelled).

The one residue **extension** is the AU `keywords` array: conform-ed models keyword references
that the core `CourseStructure.xsd` does not define (they belong to the separate
`extended-cmi5.xsd` keyword extension) — honest, conform-ed is the richer contract. The XSD's
`##other` extension points (`xs:any` / `xs:anyAttribute`) carry no named members, so they add
no items to reconcile.
