/**
 * Coverage Map types — the published, machine-readable artifact described in
 * conform-ed ADR-0013. A map is generated per `spec:version` against the literal
 * upstream schema (the denominator), reconciled against conform-ed's Zod model,
 * and cross-linked to a hand-curated conformance catalog.
 */

/**
 * Which schema language a vendored source artifact is written in.
 *
 * `curated` is the lowest provenance tier (conform-ed ADR-0017): a **hand-authored**
 * information-model inventory for a family the spec publishes only as prose + inline JSON
 * examples (no XSD/JSON-Schema/OpenAPI to walk). It is written as a JSON Schema and walked
 * by the same json-schema walker, so it reconciles against the Zod model exactly like a
 * machine-vendored schema — but it is labelled distinctly here so a reader never mistakes a
 * curated denominator for a machine-extracted one, and every node must cite its spec section
 * (enforced by `walkers/curated.ts`).
 */
export type SchemaLanguage = "json-schema" | "xsd" | "openapi" | "caliper" | "curated";

/**
 * The kind of node an inventory item represents.
 *
 * - `document` / `definition` / `property` — the **information model** (the data
 *   contracts), reconciled against conform-ed's Zod for an L2 verdict.
 * - `operation` / `parameter` / `security` — the **transport surface** of an OpenAPI
 *   REST binding (a request operation, a reusable query parameter, a security scheme).
 *   A distinct axis with no Zod counterpart: these are L1-only, never reconciled, and
 *   never appear in `silentGaps` / `extensions`. A transport {@link ConformanceRequirement}
 *   cross-links to them. See `walkers/openapi.ts` (`walkOpenApiPaths`).
 */
export type ItemKind = "document" | "definition" | "property" | "operation" | "parameter" | "security";

/** Item kinds that form the transport axis (excluded from L2 reconciliation). */
export const TRANSPORT_KINDS: ReadonlySet<ItemKind> = new Set(["operation", "parameter", "security"]);

/**
 * L2 verdict: is this literal item represented by the conform-ed Zod model?
 * - `yes` — every expanded occurrence of the item is matched by the Zod model.
 * - `partial` — some occurrences matched, some did not.
 * - `no` — no occurrence matched (a candidate silent gap).
 */
export type ModelledStatus = "yes" | "partial" | "no";

/** RFC-2119 normative level of a conformance requirement. */
export type NormativeLevel = "MUST" | "MUST NOT" | "SHOULD" | "SHOULD NOT" | "MAY";

/**
 * One item in the literal information-model inventory (L1).
 *
 * Keyed by the literal schema's own canonical address (ADR-0013, Q5):
 * `spec:version:<scope>:<path>` where `<scope>` is `doc:<binding>` for a source
 * document root or `def:<Name>` for a shared `$defs` definition. Definitions are
 * keyed once; repeated appearances are recorded as {@link UsageEdge}s.
 */
export interface CoverageItem {
  /** Canonical key, e.g. `ob:3.0:doc:achievementcredential/credentialSubject`. */
  readonly key: string;
  readonly kind: ItemKind;
  /** Dotted path within the owning document/definition root (`""` for the root). */
  readonly path: string;
  /** JSON Schema `type`, when present (a single type or a union). */
  readonly jsonType?: string | readonly string[];
  /** True when required by its immediate parent object. */
  readonly required?: boolean;
  /** Enumerated values, when the node is an `enum`/`const`. */
  readonly enumValues?: readonly (string | number | boolean | null)[];
  /** True when description/$comment/title carries RFC-2119 normative prose. */
  readonly normative?: boolean;
  /** Human description carried from the schema (trimmed, single-line). */
  readonly description?: string;
  /** L2 reconciliation verdict (filled by {@link reconcile}). */
  readonly modelled?: ModelledStatus;
}

/** A usage edge: a property references a shared definition via `$ref`. */
export interface UsageEdge {
  /** Item key of the referring node. */
  readonly from: string;
  /** Item key of the referenced definition (`spec:version:def:<Name>`). */
  readonly to: string;
}

/**
 * A normative conformance requirement (the C axis) — hand-curated from a
 * published conformance/certification guide (ADR-0013). No machine source exists.
 */
export interface ConformanceRequirement {
  /** Canonical key: `spec:version:conf:<profile>/<reqId>`. */
  readonly key: string;
  /** Certification profile / level / role this requirement belongs to. */
  readonly profile: string;
  /** Stable id within the profile (the spec's own id where one exists). */
  readonly reqId: string;
  readonly level: NormativeLevel;
  /** The normative statement text. */
  readonly statement: string;
  /** L1 item keys this requirement constrains (many-to-many cross-link). */
  readonly constrains: readonly string[];
  /** Provenance: where in the published material this was extracted from. */
  readonly source: string;
}

/**
 * A normative statement **extracted from the literal schema's own documentation** (the
 * RFC-2119 prose embedded in `xs:documentation` / JSON-Schema `description` / `$comment`).
 *
 * This is the machine-extractable half of the conformance surface, distinct from the
 * hand-curated {@link ConformanceRequirement} catalog (whose source is the published
 * certification *guide*, not the schema). It is regenerated from the denominator on every
 * build — no hand-curation — so it stays exact. `cited` flags whether a curated
 * requirement already references this item, surfacing where curation lags the schema's
 * own declared norms. The XSD-family schemas embed almost no RFC-2119 prose (their norms
 * live in prose guides → curation only); the JSON-family schemas embed a great deal.
 */
export interface NormativeStatement {
  /** The L1 item key whose documentation carries the statement. */
  readonly item: string;
  /** RFC-2119 level parsed from the prose (extraction only detects MUST-family today). */
  readonly level: NormativeLevel;
  /** The normative prose, lifted verbatim from the schema documentation. */
  readonly statement: string;
  /** True when a curated {@link ConformanceRequirement} already `constrains` this item. */
  readonly cited: boolean;
}

/**
 * A documented, deliberate name-mapping between a literal (XSD) construct and the
 * conform-ed property that models it — applied by a `specRefOverride` on the
 * {@link SpecSource}. These are NOT silent gaps or extensions: the structural join
 * can't match them by name (a renamed attribute like `xml:base` ⇄ `xmlBase`, or an
 * *unnamed* XSD construct such as `xs:any` open content / simpleContent text that
 * conform-ed names `extensions` / `value`). The override removes the affected keys
 * from `silentGaps` / `extensions` and records the absorbed keys here for audit, so
 * the residue lists carry only genuine signal.
 */
export interface SpecRefNormalisation {
  /** The documented rename this rule encodes (recorded verbatim from the override). */
  readonly note: string;
  /**
   * Zod-side `extensions` residue keys this rename absorbed — conform-ed models them,
   * but under a name the literal does not use (or for a construct the literal leaves
   * unnamed), so the structural name-join could not pair them.
   */
  readonly modelledKeys: readonly string[];
  /**
   * Literal `silentGap` keys flipped to `modelled: "yes"` because conform-ed models the
   * construct under its own name (only the rename of a *named* literal construct, e.g.
   * `xml:base` ⇄ `xmlBase`, has a literal side; unnamed constructs have none).
   */
  readonly literalKeys: readonly string[];
}

/** The reconciliation residues that are the point of the literal denominator. */
export interface ReconciliationResidues {
  /** Literal expanded paths with no Zod counterpart — candidate silent gaps. */
  readonly silentGaps: readonly string[];
  /** Zod-modelled expanded paths with no literal counterpart — conform-ed extensions. */
  readonly extensions: readonly string[];
  /** Documented XSD→Zod renames absorbed out of the two lists above (see {@link SpecRefNormalisation}). */
  readonly normalisations: readonly SpecRefNormalisation[];
}

/** Computed rollup over the inventory (percentages are derived, never typed). */
export interface CoverageRollup {
  readonly items: number;
  readonly modelledYes: number;
  readonly modelledPartial: number;
  readonly modelledNo: number;
  /** L1 items flagged normative (== {@link CoverageMap.normativeStatements} length). */
  readonly normativeItems: number;
  /** Hand-curated {@link ConformanceRequirement}s (the certification catalog). */
  readonly conformanceRequirements: number;
  /** Statements extracted from the schema's own RFC-2119 prose (the machine half). */
  readonly normativeStatements: number;
  /** Of those, how many a curated requirement already references (`cited`). */
  readonly normativeStatementsCited: number;
  /** Residue keys absorbed by documented `specRef` renames (gaps + extensions). */
  readonly normalisations: number;
}

/** Provenance of a single vendored source artifact in the denominator. */
export interface SourceArtifact {
  readonly binding: string;
  readonly language: SchemaLanguage;
  /** The schema's published `$id`/URL. */
  readonly id: string;
  /** sha256 of the vendored bytes — pins the denominator for reproducibility. */
  readonly sha256: string;
}

export interface CoverageMapMeta {
  readonly spec: string;
  readonly version: string;
  /** ISO-8601 date the map was generated. */
  readonly generatedAt: string;
  readonly sources: readonly SourceArtifact[];
}

/** The published Coverage Map for one `spec:version`. */
export interface CoverageMap {
  readonly meta: CoverageMapMeta;
  readonly items: readonly CoverageItem[];
  readonly edges: readonly UsageEdge[];
  readonly conformance: readonly ConformanceRequirement[];
  /** Normative statements extracted from the schema's own documentation (regenerated). */
  readonly normativeStatements: readonly NormativeStatement[];
  readonly residues: ReconciliationResidues;
  readonly rollup: CoverageRollup;
}
