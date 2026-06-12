/**
 * Structural views of QTI 3 `responseProcessing` and `outcomeDeclaration` (ADR-0004).
 * Like the rest of the runtime's views, these are narrowed shapes of the
 * `@conform-ed/contracts` schemas: validation happens upstream, the interpreter works
 * against these types and reports anything it does not understand via the Capability
 * Report instead of guessing.
 */

import type { CapabilityIssue } from "../capability";
import type { Cardinality, ResponseDeclarationView, ResponseValue } from "../types";

export type RpScalar = string | number | boolean;

/** An outcome variable's value as exposed to consumers after response processing. */
export type OutcomeValue = RpScalar | readonly RpScalar[] | null;

/** One named member of a record-cardinality value (QTI record containers). */
export interface RpRecordField {
  readonly name: string;
  readonly baseType?: string;
  readonly value: RpScalar;
}

/** The interpreter's typed value model: (baseType, cardinality, members); NULL is null. */
export interface RpValue {
  readonly cardinality: Cardinality;
  readonly baseType?: string;
  readonly values: readonly RpScalar[];
  /** Present only when cardinality is "record"; `values` mirrors the field values. */
  readonly fields?: readonly RpRecordField[];
}

export type MaybeRpValue = RpValue | null;

export interface OutcomeDeclarationView {
  readonly identifier: string;
  readonly cardinality: Cardinality;
  readonly baseType?: string;
  readonly defaultValue?: { readonly values: ReadonlyArray<{ readonly value: RpScalar }> };
}

/**
 * One expression node. Deliberately loose (`kind: string`): kinds the interpreter
 * does not implement yet flow through and surface as `unsupported-rp` issues.
 */
export interface RpExpressionView {
  readonly kind: string;
  readonly identifier?: string;
  readonly baseType?: string;
  readonly value?: RpScalar;
  readonly expressions?: readonly RpExpressionView[];
  /**
   * Bounds/step for the random operators and `anyN`; string values are variable
   * references resolved at runtime (§2.11.3.6), bare or brace-enclosed (§7.13).
   */
  readonly min?: number | string;
  readonly max?: number | string;
  readonly step?: number | string;
  /** `equal` tolerance window; string entries are variable references. */
  readonly toleranceMode?: "exact" | "absolute" | "relative";
  readonly tolerance?: ReadonlyArray<number | string>;
  readonly includeLowerBound?: boolean;
  readonly includeUpperBound?: boolean;
  /** 1-based position for `index`. */
  readonly n?: number | string;
  /** Function/constant name for `mathOperator`, `mathConstant`, `statsOperator`. */
  readonly name?: string;
  /** Rounding controls for `roundTo` and `equalRounded`. */
  readonly roundingMode?: "decimalPlaces" | "significantFigures";
  readonly figures?: number | string;
  /** Pass count for `repeat`. */
  readonly numberRepeats?: number | string;
  /** XSD-dialect pattern for `patternMatch`; "{ref}" resolves from a variable (§7.13). */
  readonly pattern?: string;
  /** String comparison controls for `stringMatch` and `substring`. */
  readonly caseSensitive?: boolean;
  readonly substring?: boolean;
  /** Area for `inside` (QTI shape + coords string). */
  readonly shape?: string;
  readonly coords?: string;
  /** Test-level subset selection (`testVariables` and the `number*` aggregates). */
  readonly variableIdentifier?: string;
  readonly weightIdentifier?: string;
  readonly sectionIdentifier?: string;
  readonly includeCategory?: string | readonly string[];
  readonly excludeCategory?: string | readonly string[];
  /** Vendor identification for `customOperator` (implementation registered by class). */
  readonly class?: string;
  readonly definition?: string;
  /** Named-field selector for `fieldValue` over record-cardinality values. */
  readonly fieldIdentifier?: string;
}

/**
 * A consumer-registered `customOperator` implementation, keyed by its `class`
 * attribute. Receives the already-evaluated child values; returns NULL-or-value like
 * any expression. Vendor operators are by definition engine-specific (the spec leaves
 * them implementation-defined), so nothing ships registered — same opt-in stance as
 * PCI modules.
 */
export type CustomOperatorImplementation = (
  args: readonly MaybeRpValue[],
  expression: RpExpressionView,
) => MaybeRpValue;

export interface RpConditionBranch {
  readonly expression: RpExpressionView;
  readonly rules: readonly RpRuleView[];
}

/** One response rule: responseCondition, setOutcomeValue, or exitResponse. */
export interface RpRuleView {
  readonly kind: string;
  readonly identifier?: string;
  readonly expression?: RpExpressionView;
  readonly responseIf?: RpConditionBranch;
  readonly responseElseIfs?: readonly RpConditionBranch[];
  readonly responseElse?: { readonly rules: readonly RpRuleView[] };
}

/** Either a standard-template URI or an explicit rule tree (rules win if both). */
export interface ResponseProcessingView {
  readonly template?: string;
  readonly rules?: readonly RpRuleView[];
}

/**
 * Response Normalization (ADR-0004): an opt-in, consumer-configured transform of
 * candidate string input applied at comparison time. Off by default; always off in
 * conformance runs. Applied to both sides of string comparisons so keys and candidate
 * input normalize identically.
 */
export type ResponseNormalization = (value: string, declaration?: ResponseDeclarationView) => string;

export interface TemplateDeclarationView {
  readonly identifier: string;
  readonly cardinality: Cardinality;
  readonly baseType?: string;
  readonly defaultValue?: { readonly values: ReadonlyArray<{ readonly value: RpScalar }> };
}

/**
 * Consumer-supplied input. Optional members deliberately admit explicit
 * `undefined` ("undefined means not provided"): callers pass maybe-undefined
 * values straight through, and the interpreter reads every member field-wise
 * (`??`/`?.`) — option bags are never spread-merged over defaults.
 */
export interface ResponseProcessingContext {
  readonly responseDeclarations: readonly ResponseDeclarationView[];
  readonly outcomeDeclarations: readonly OutcomeDeclarationView[];
  readonly responses: Readonly<Record<string, ResponseValue>>;
  readonly normalization?: ResponseNormalization | undefined;
  /** Template variables for this clone (read by `variable` lookups). */
  readonly templateDeclarations?: readonly TemplateDeclarationView[] | undefined;
  readonly templateValues?: Readonly<Record<string, OutcomeValue>> | undefined;
  /** Adaptive carry-over: outcome values from earlier attempts replace declared defaults. */
  readonly priorOutcomes?: Readonly<Record<string, OutcomeValue>> | undefined;
  /**
   * Random source for `random`/`randomInteger`/`randomFloat` in RP (adaptive items,
   * e.g. Monty Hall door reveals). Seed it from the attempt seed: the seed plus the
   * submission sequence then replays the exact same outcomes (ADR-0004 determinism).
   */
  readonly random?: (() => number) | undefined;
  /**
   * Built-in session variables (reserved identifiers; items must not declare them).
   * `duration` is the item session's elapsed seconds; `numAttempts` "increases by 1
   * at the start of each attempt", so it includes the attempt being scored.
   */
  readonly duration?: number | undefined;
  readonly numAttempts?: number | undefined;
  /** Registered vendor `customOperator` implementations by class (opt-in). */
  readonly customOperators?: Readonly<Record<string, CustomOperatorImplementation>> | undefined;
}

export interface ResponseProcessingResult {
  readonly outcomes: Readonly<Record<string, OutcomeValue>>;
  /** Non-empty means execution aborted to declared defaults (never partial scoring). */
  readonly issues: readonly CapabilityIssue[];
}
