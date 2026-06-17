/**
 * A `SpecSource` is the hand-assembled input to {@link buildCoverageMap}: the
 * vendored literal schemas (the denominator), the conform-ed Zod that models each
 * one (for L2), and the hand-curated conformance catalog (the C axis).
 */

import type { ZodType } from "zod";

import type { ConformanceRequirement, SchemaLanguage } from "./types";

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
}

export interface SpecSource {
  /** Short spec id, e.g. `ob`. */
  readonly spec: string;
  /** Version label used in keys, e.g. `3.0`. */
  readonly version: string;
  readonly bindings: readonly SpecBindingSource[];
  readonly conformance: readonly ConformanceRequirement[];
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
}
