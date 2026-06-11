/**
 * Client-side response processing for the v0 standard scoring templates.
 *
 * Implements `match_correct` and `map_response` (QTI's two standard RP templates),
 * which cover the v0 interactions (choice, textEntry, inlineChoice). Pure functions:
 * deterministic given (declaration, response), so scoring is replayable and runs
 * fully offline in the headless core. Transitional: ADR-0004 replaces this with a
 * staged RP interpreter, and the case/diacritic folding below moves behind the
 * opt-in Response Normalization hook (spec-strict defaults).
 */

import type { ResponseDeclarationView, ResponseValue, ScoreResult } from "./types";

/** Lowercase + strip combining diacritics, for non-case/accent-sensitive comparison. */
export function foldString(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

function asList(response: ResponseValue): string[] {
  if (response === null) {
    return [];
  }

  return typeof response === "string" ? [response] : [...response];
}

function isStringBaseType(declaration: ResponseDeclarationView): boolean {
  return declaration.baseType === "string" || declaration.baseType === undefined;
}

function valuesEqual(a: string, b: string, fold: boolean): boolean {
  return fold ? foldString(a) === foldString(b) : a === b;
}

/**
 * `match_correct`: true when the response exactly matches `correctResponse`, respecting
 * cardinality. String base types fold case/diacritics (textEntry friendliness);
 * identifier base types compare exactly. Returns false when no correctResponse exists.
 */
export function matchCorrect(declaration: ResponseDeclarationView, response: ResponseValue): boolean {
  const correct = declaration.correctResponse;

  if (!correct) {
    return false;
  }

  const fold = isStringBaseType(declaration);
  const expected = correct.values.map((entry) => entry.value);
  const actual = asList(response);

  if (expected.length !== actual.length) {
    return false;
  }

  if (declaration.cardinality === "ordered") {
    return expected.every((value, index) => valuesEqual(value, actual[index] ?? "", fold));
  }

  // single + multiple: order-independent set match
  const remaining = [...actual];

  for (const value of expected) {
    const matchIndex = remaining.findIndex((candidate) => valuesEqual(candidate, value, fold));

    if (matchIndex === -1) {
      return false;
    }

    remaining.splice(matchIndex, 1);
  }

  return remaining.length === 0;
}

function clamp(value: number, lower: number | undefined, upper: number | undefined): number {
  let result = value;

  if (lower !== undefined && result < lower) {
    result = lower;
  }

  if (upper !== undefined && result > upper) {
    result = upper;
  }

  return result;
}

/**
 * `map_response`: sum the mapped values of the response's members, each member mapped at
 * most once. Honors per-entry `caseSensitive` (default: case/diacritic-insensitive),
 * applies the mapping's `defaultValue` to unmatched members, and clamps to
 * [lowerBound, upperBound]. Returns 0 when no mapping exists.
 */
export function mapResponse(declaration: ResponseDeclarationView, response: ResponseValue): number {
  const mapping = declaration.mapping;

  if (!mapping) {
    return 0;
  }

  const defaultValue = mapping.defaultValue ?? 0;
  let total = 0;

  for (const member of asList(response)) {
    const entry = mapping.mapEntries.find((candidate) =>
      valuesEqual(candidate.mapKey, member, !candidate.caseSensitive),
    );

    total += entry ? entry.mappedValue : defaultValue;
  }

  return clamp(total, mapping.lowerBound, mapping.upperBound);
}

/**
 * Apply the appropriate standard template: `map_response` when a mapping is declared,
 * otherwise `match_correct`. `maxScore` is the mapping upper bound (or the sum of
 * positive mapped values) for mapped items, else 1 for match_correct.
 */
export function scoreResponse(declaration: ResponseDeclarationView, response: ResponseValue): ScoreResult {
  if (declaration.mapping) {
    const score = mapResponse(declaration, response);
    const positiveSum = declaration.mapping.mapEntries.reduce((sum, entry) => sum + Math.max(entry.mappedValue, 0), 0);
    const maxScore = declaration.mapping.upperBound ?? positiveSum;

    return {
      identifier: declaration.identifier,
      score,
      maxScore,
      correct: maxScore > 0 && score >= maxScore,
    };
  }

  const correct = matchCorrect(declaration, response);

  return {
    identifier: declaration.identifier,
    score: correct ? 1 : 0,
    maxScore: 1,
    correct,
  };
}
