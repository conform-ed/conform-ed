/**
 * Coverage Map types — the published, machine-readable artifact described in
 * conform-ed ADR-0013. A map is generated per `spec:version` against the literal
 * upstream schema (the denominator), reconciled against conform-ed's Zod model,
 * and cross-linked to a hand-curated conformance catalog.
 */

/** Which schema language a vendored source artifact is written in. */
export type SchemaLanguage = "json-schema" | "xsd" | "openapi";

/** The kind of node an information-model inventory item represents. */
export type ItemKind = "document" | "definition" | "property";

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

/** The three reconciliation residues that are the point of the literal denominator. */
export interface ReconciliationResidues {
  /** Literal expanded paths with no Zod counterpart — candidate silent gaps. */
  readonly silentGaps: readonly string[];
  /** Zod-modelled expanded paths with no literal counterpart — conform-ed extensions. */
  readonly extensions: readonly string[];
}

/** Computed rollup over the inventory (percentages are derived, never typed). */
export interface CoverageRollup {
  readonly items: number;
  readonly modelledYes: number;
  readonly modelledPartial: number;
  readonly modelledNo: number;
  readonly normativeItems: number;
  readonly conformanceRequirements: number;
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
  readonly residues: ReconciliationResidues;
  readonly rollup: CoverageRollup;
}
