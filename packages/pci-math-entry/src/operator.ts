/**
 * The math checker exposed to QTI response processing as a `customOperator`
 * (qti-react extension seam, ADR-0007 vocabulary). Positional arguments, all
 * authorable as plain `qti-base-value`:
 *
 *   1. candidate LaTeX (usually `qti-variable` / `qti-field-value`)
 *   2. correct LaTeX
 *   3. optional mode: "equivalent" (default) | "literal"
 *   4. optional absolute tolerance (float)
 *
 * NULL propagates per QTI convention; an unjudgeable verdict is NULL, never a guess.
 */

import type { CustomOperatorImplementation, MaybeRpValue } from "@conform-ed/qti-react";

import { checkMathExpression } from "./checker";
import type { MathCheckMode, MathCheckOptions } from "./checker";

export const mathEquivalentClass = "org.conform-ed.mathEquivalent";

function singleString(value: MaybeRpValue): string | null {
  if (value === null || value.values.length !== 1) {
    return null;
  }

  const member = value.values[0];

  return typeof member === "string" ? member : typeof member === "number" ? String(member) : null;
}

function parseMode(value: MaybeRpValue): MathCheckMode | undefined {
  const mode = singleString(value);

  return mode === "equivalent" || mode === "literal" ? mode : undefined;
}

export const mathEquivalentOperator: CustomOperatorImplementation = (args) => {
  const candidate = singleString(args[0] ?? null);
  const correct = singleString(args[1] ?? null);

  if (candidate === null || correct === null) {
    return null;
  }

  const mode = parseMode(args[2] ?? null);
  const toleranceMember = args[3]?.values[0];
  const tolerance = typeof toleranceMember === "number" ? toleranceMember : undefined;
  const options: MathCheckOptions = {
    ...(mode === undefined ? {} : { mode }),
    ...(tolerance === undefined ? {} : { tolerance }),
  };
  const result = checkMathExpression(candidate, correct, options);

  return result.verdict === null ? null : { cardinality: "single", baseType: "boolean", values: [result.verdict] };
};
