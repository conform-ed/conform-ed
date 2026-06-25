/**
 * A `SpecSource` is the hand-assembled input to {@link buildCoverageMap}: the
 * vendored literal schemas (the denominator), the conform-ed Zod that models each
 * one (for L2), and the hand-curated conformance catalog (the C axis).
 */

import type { ZodType } from "zod";

import type { ConformanceRequirement, SchemaLanguage } from "./types";

/**
 * One documented XSD→Zod rename, applied as a post-pass over the raw reconciliation
 * residues. The structural join matches by property name, so it cannot pair a literal
 * construct that conform-ed deliberately models under a *different* name (`xml:base` ⇄
 * `xmlBase`) or for an *unnamed* literal construct conform-ed gives a name (`xs:any` open
 * content → `extensions`; simpleContent text → `value`). Left alone these surface as false
 * signal in `silentGaps` / `extensions`; an override absorbs them into
 * `residues.normalisations` instead. Matching is by the **final path segment** of the
 * residue key, scoped to this one map — so a per-spec author asserts "in this schema, a
 * Zod `value` extension is always the simpleContent-text rename", and the generated map
 * records exactly which keys each rule absorbed (auditable, and pinned by tests).
 */
export interface SpecRefOverride {
  /** The documented rename, recorded verbatim in the map's `normalisations` entry. */
  readonly note: string;
  /**
   * Absorb `extensions` residues whose final path segment equals this — the conform-ed
   * property name modelling the literal construct the name-join could not pair. Use
   * {@link modelledSegments} when one rename covers several conform-ed property names (e.g. the
   * expression union is reached via both `expression` and `expressions`).
   */
  readonly modelledSegment?: string;
  /** Plural form of {@link modelledSegment}; matched as a set (union with the singular). */
  readonly modelledSegments?: readonly string[];
  /**
   * For a rename of a *named* literal construct only (e.g. `xml:base`): the literal side's
   * final path segment. Silent gaps matching it are flipped to `modelled: "yes"` (conform-ed
   * does model them, under the conform-ed name) and recorded. Omit for unnamed constructs
   * (`xs:any`, simpleContent text), which have no literal item — and crucially omit it where
   * conform-ed does **not** model the construct at all (QTI 2.x names no `xmlBase`, so its
   * `/base` gaps are genuine and must stay). Use {@link literalSegments} when one documented
   * rename covers a whole vocabulary the XSD names per-element but conform-ed folds into one
   * union/array (e.g. the 64 QTI expression operators reached via the Zod `expression` union).
   */
  readonly literalSegment?: string;
  /** Plural form of {@link literalSegment}; matched as a set (union with the singular). */
  readonly literalSegments?: readonly string[];
}

/**
 * A structural alias for the L2 join (conform-ed ADR-0017): bridges a Zod property to one or
 * more **differently-named** literal elements the structural name-join could not otherwise
 * pair, *and descends through it* (unlike a {@link SpecRefOverride}, which only absorbs leaf
 * residue keys). Needed when conform-ed normalises a literal schema's **shape**, not just a
 * name: the cmi5 XSD nests `<au>`/`<block>` as a repeated `choice`, while conform-ed regroups
 * them into one `children: (Au | Block)[]` union array (`{ zodProperty: "children",
 * literalElements: ["au", "block"] }`); likewise its `<langstring>` repeated element becomes a
 * `langstrings` array. The reconciler aligns the Zod property's (array-unwrapped) node against
 * each named literal element, so their subtrees reconcile normally. Author the names in their
 * post-{@link SpecSource.nameNormalizer} form.
 */
export interface StructuralAlias {
  /** The conform-ed Zod property name (its array layer is unwrapped before descent). */
  readonly zodProperty: string;
  /** The literal element name(s) it models — each aligned against the Zod node. */
  readonly literalElements: readonly string[];
}

export interface SpecBindingSource {
  /** Short logical name of the source artifact; becomes the `doc:<binding>` scope. */
  readonly binding: string;
  /** Absolute path to the vendored source schema file. */
  readonly schemaPath: string;
  readonly language: SchemaLanguage;
  /**
   * For XSD bindings only: the name of the global `<xs:element>` to walk as this
   * binding's document root, when it differs from {@link binding}. Lets two bindings
   * over different files share a root element name (e.g. the three CC LOM profiles are
   * all rooted at `<xs:element name="lom">`) while keeping distinct `doc:` labels.
   * Defaults to {@link binding}.
   */
  readonly rootElement?: string;
  /**
   * The conform-ed Zod schema that models this binding's root, for L2
   * reconciliation. Omitted when conform-ed does not (yet) model the binding —
   * the whole binding then reconciles as a silent gap.
   */
  readonly zod?: ZodType;
  /**
   * Mark a curated binding as **value-set-only** (ADR-0017): it contributes its vocabulary
   * items to L1 so a {@link ValueSetSource} can verify their members, but it is NOT a
   * structural document root — its items never enter the structural reconciliation, so a
   * standalone controlled vocabulary (the LTI role list, modelled by a `refine` with no object
   * shape) does not surface as a false silent gap. Such a binding carries no {@link zod}.
   */
  readonly valueSetOnly?: boolean;
}

/**
 * One REST service document to inventory for its **transport surface** (conform-ed
 * ADR-0013). Distinct from {@link SpecBindingSource}, which inventories an OpenAPI
 * document's *information model* (`components.schemas`): this walks its `paths` —
 * the required operations, the reusable query parameters and the security schemes —
 * into L1-only `operation` / `parameter` / `security` items (never reconciled). The
 * same vendored file usually backs both: its schemas via a binding, its paths here.
 */
export interface RestServiceSource {
  /** Logical service name; becomes the `path:<service>/<METHOD> <template>` key scope. */
  readonly service: string;
  /** Absolute path to the vendored OpenAPI document. */
  readonly schemaPath: string;
}

/**
 * One controlled-vocabulary to verify (conform-ed ADR-0017 value-set extension). The
 * structural reconciliation matches property names, never enumerated *values*, so a spec's
 * vocabulary (LTI roles, a status enum) can be "modelled" structurally while conform-ed
 * silently fails to accept some of its members. This pairs a curated L1 item carrying the
 * published members (its `enumValues`) with the conform-ed Zod that models *one* member: the
 * generator `safeParse`s every member, and the rejects become value-set gaps. Reading the
 * real contract this way works for `z.enum` and for `refine`-based schemas alike (the latter
 * vanish under JSON-Schema rendering, which is exactly why the structural join misses them).
 */
export interface ValueSetSource {
  /** The curated L1 item key whose `enumValues` are the published vocabulary to verify. */
  readonly item: string;
  /** conform-ed Zod modelling one vocabulary member; each published member is `safeParse`d. */
  readonly element: ZodType;
}

export interface SpecSource {
  /** Short spec id, e.g. `ob`. */
  readonly spec: string;
  /** Version label used in keys, e.g. `3.0`. */
  readonly version: string;
  readonly bindings: readonly SpecBindingSource[];
  readonly conformance: readonly ConformanceRequirement[];
  /**
   * Optional REST transport surface to inventory: the OpenAPI documents whose `paths`
   * carry the binding's required operations, security and query mechanisms. A distinct
   * axis from the information model (no Zod counterpart, never reconciled), so each
   * operation / query parameter / security scheme becomes an L1-only item a transport
   * conformance requirement can `constrains`. Omitted ⇒ paths not walked (every
   * non-REST map, and OpenAPI maps that curate only the data model).
   */
  readonly restServices?: readonly RestServiceSource[];
  /**
   * Optional controlled-vocabularies to verify against conform-ed's model (ADR-0017 value-set
   * extension). Each references a curated L1 item carrying the published members and the Zod
   * that models one member. Omitted ⇒ no value-set verdicts (most maps; the structural join
   * already covers their information model).
   */
  readonly valueSets?: readonly ValueSetSource[];
  /**
   * Optional canonicalisation of property names for the L2 name-based join, when the
   * literal schema and conform-ed's Zod use *different serialisation bindings* of the
   * same model. QTI is the case: its literal XSD is the XML binding (kebab
   * `qti-response-declaration`) while conform-ed models the QTI JSON binding (camelCase
   * `responseDeclaration`). Applied to both sides before matching; it MUST be idempotent
   * and MUST preserve the `[]` array segment. Item *keys* stay literal — only the join
   * uses the normalised name. Omitted ⇒ identity (names compared verbatim).
   */
  readonly nameNormalizer?: (propertyName: string) => string;
  /**
   * For XSD maps whose bindings span **multiple files**: scope each `def:` key by its
   * source file (`def:<fileBasename>.<TypeName>`) instead of by bare type name. The XSD
   * walker keys definitions by global complexType name, which collides when different
   * files reuse a name for structurally-distinct types (CC's `LOM.Type` across the three
   * LOM profiles; `Text.Type` / `Attachment.Type` in the CC 1.4 `assignment` extension vs
   * Discussion Topic). Source-scoping disambiguates them. Leave off for single-file maps
   * (every QTI version) so their keys stay un-prefixed. The reconciler matches by property
   * name, not def key, so this only affects item identity — never the L2 verdicts.
   */
  readonly scopeXsdDefsBySource?: boolean;
  /**
   * Documented XSD→Zod renames that the structural name-join cannot pair, absorbed out of
   * the residue lists into `residues.normalisations` (see {@link SpecRefOverride}). Omitted
   * ⇒ none (the JSON-family maps need none; their residues are already genuine signal).
   */
  readonly specRefOverrides?: readonly SpecRefOverride[];
  /**
   * Structural aliases bridging Zod properties to differently-named literal elements the
   * name-join cannot pair, where conform-ed normalised the literal *shape* (see
   * {@link StructuralAlias}). Omitted ⇒ none (the structural shapes already line up by name).
   */
  readonly structuralAliases?: readonly StructuralAlias[];
  /**
   * Literal element names that are **transparent repetition wrappers** conform-ed elides:
   * where the literal nests a repeated child element (the cmi5 `<objectives><objective>…`) but
   * conform-ed flattens it into a direct array, the join descends through the wrapper like an
   * array layer so the element's content reconciles against the array's element. Omitted ⇒ none.
   */
  readonly transparentLiteralWrappers?: readonly string[];
}
