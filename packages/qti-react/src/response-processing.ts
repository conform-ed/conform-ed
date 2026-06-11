/**
 * Standard-template scoring helpers, spec-strict by default (ADR-0004). `match_correct`
 * is an exact match and mapping entries default to caseSensitive=true, per spec. The
 * optional `normalize` parameter is the Response Normalization hook: a consumer-
 * configured transform applied to both sides of string comparisons (off by default,
 * always off in conformance runs). The RP interpreter (`src/rp/`) reuses these for its
 * `mapResponse` operator; `scoreResponse` also backs the per-interaction feedback
 * chrome in the runtime. Pure functions: deterministic given (declaration, response),
 * so scoring is replayable and runs fully offline in the headless core.
 */

import { parsePoint, pointInShape } from "./graphic";
import type { ResponseNormalization } from "./rp/types";
import type { ResponseDeclarationView, ResponseValue, ScoreResult } from "./types";

/**
 * Lowercase + strip combining diacritics. Exported as a ready-made Response
 * Normalization for language-learning leniency ("cafe" ≈ "Café") — a documented
 * deviation a consumer must opt into.
 */
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

  // Records are not list-shaped; heuristic scoring treats them as empty.
  return typeof response === "string" ? [response] : Array.isArray(response) ? [...response] : [];
}

function isStringBaseType(declaration: ResponseDeclarationView): boolean {
  return declaration.baseType === "string" || declaration.baseType === undefined;
}

/**
 * Pair values serialize as two space-separated identifiers ("A B"). A `pair` is
 * unordered within the pair ("A B" ≡ "B A"); a `directedPair` is ordered.
 */
function pairsEqual(a: string, b: string, directed: boolean): boolean {
  const [a1, a2] = a.trim().split(/\s+/u);
  const [b1, b2] = b.trim().split(/\s+/u);

  if (a1 === undefined || a2 === undefined || b1 === undefined || b2 === undefined) {
    return false;
  }

  if (a1 === b1 && a2 === b2) {
    return true;
  }

  return !directed && a1 === b2 && a2 === b1;
}

const numericBaseTypes = new Set(["float", "integer"]);

/** Value equality for one declared baseType, used by both match_correct and map_response. */
function makeValueComparator(
  declaration: ResponseDeclarationView,
  normalize?: ResponseNormalization,
): (a: string, b: string) => boolean {
  if (declaration.baseType === "pair") {
    return (a, b) => pairsEqual(a, b, false);
  }

  if (declaration.baseType === "directedPair") {
    return (a, b) => pairsEqual(a, b, true);
  }

  if (declaration.baseType !== undefined && numericBaseTypes.has(declaration.baseType)) {
    return (a, b) => a.trim() !== "" && b.trim() !== "" && Number(a) === Number(b);
  }

  if (declaration.baseType === "point") {
    return (a, b) => {
      const pointA = parsePoint(a);
      const pointB = parsePoint(b);

      return pointA !== null && pointB !== null && pointA.x === pointB.x && pointA.y === pointB.y;
    };
  }

  if (normalize && isStringBaseType(declaration)) {
    return (a, b) => normalize(a, declaration) === normalize(b, declaration);
  }

  return (a, b) => a === b;
}

/**
 * `match_correct`: true when the response exactly matches `correctResponse`, respecting
 * cardinality and baseType. Spec-strict: no case or diacritic folding unless the
 * consumer passes a Response Normalization. Returns false when no correctResponse
 * exists.
 */
export function matchCorrect(
  declaration: ResponseDeclarationView,
  response: ResponseValue,
  normalize?: ResponseNormalization,
): boolean {
  const correct = declaration.correctResponse;

  if (!correct) {
    return false;
  }

  const equals = makeValueComparator(declaration, normalize);
  const expected = correct.values.map((entry) => entry.value);
  const actual = asList(response);

  if (expected.length !== actual.length) {
    return false;
  }

  if (declaration.cardinality === "ordered") {
    return expected.every((value, index) => equals(value, actual[index] ?? ""));
  }

  // single + multiple: order-independent set match
  const remaining = [...actual];

  for (const value of expected) {
    const matchIndex = remaining.findIndex((candidate) => equals(candidate, value));

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
 * most once. Per spec, entries default to caseSensitive=true; `caseSensitive: false`
 * lowercases both sides. A Response Normalization, when configured, applies on top for
 * string base types. Applies the mapping's `defaultValue` to unmatched members and
 * clamps to [lowerBound, upperBound]. Returns 0 when no mapping exists.
 */
export function mapResponse(
  declaration: ResponseDeclarationView,
  response: ResponseValue,
  normalize?: ResponseNormalization,
): number {
  const mapping = declaration.mapping;

  if (!mapping) {
    return 0;
  }

  const isPairType = declaration.baseType === "pair" || declaration.baseType === "directedPair";
  const applyNormalize = normalize && isStringBaseType(declaration) ? normalize : undefined;
  const defaultValue = mapping.defaultValue ?? 0;
  let total = 0;

  for (const member of asList(response)) {
    const entry = mapping.mapEntries.find((candidate) => {
      if (isPairType) {
        return pairsEqual(candidate.mapKey, member, declaration.baseType === "directedPair");
      }

      let key = candidate.mapKey;
      let candidateMember = member;

      if (candidate.caseSensitive === false) {
        key = key.toLocaleLowerCase();
        candidateMember = candidateMember.toLocaleLowerCase();
      }

      if (applyNormalize) {
        key = applyNormalize(key, declaration);
        candidateMember = applyNormalize(candidateMember, declaration);
      }

      return key === candidateMember;
    });

    total += entry ? entry.mappedValue : defaultValue;
  }

  return clamp(total, mapping.lowerBound, mapping.upperBound);
}

/**
 * `map_response_point`: sum the mapped values of the areas hit by the response's point
 * members. Per spec each area counts at most once regardless of how many points land in
 * it; points hitting no area add the mapping's `defaultValue`. Clamps to
 * [lowerBound, upperBound]. Returns 0 when no areaMapping exists.
 */
export function mapResponsePoint(declaration: ResponseDeclarationView, response: ResponseValue): number {
  const areaMapping = declaration.areaMapping;

  if (!areaMapping) {
    return 0;
  }

  const defaultValue = areaMapping.defaultValue ?? 0;
  const usedAreas = new Set<number>();
  let total = 0;

  for (const member of asList(response)) {
    const point = parsePoint(member);

    if (!point) {
      continue;
    }

    const areaIndex = areaMapping.areaMapEntries.findIndex(
      (entry, index) => !usedAreas.has(index) && pointInShape(entry.shape, entry.coords, point),
    );

    if (areaIndex === -1) {
      total += defaultValue;
    } else {
      usedAreas.add(areaIndex);
      total += areaMapping.areaMapEntries[areaIndex]!.mappedValue;
    }
  }

  return clamp(total, areaMapping.lowerBound, areaMapping.upperBound);
}

/**
 * Apply the appropriate standard template: `map_response_point` when an areaMapping is
 * declared, `map_response` when a mapping is declared, otherwise `match_correct`. `maxScore` is the mapping upper bound (or the sum of
 * positive mapped values) for mapped items, else 1 for match_correct. This heuristic
 * backs the per-interaction feedback chrome; item outcomes of record come from the RP
 * interpreter when the item declares `responseProcessing`.
 */
export function scoreResponse(
  declaration: ResponseDeclarationView,
  response: ResponseValue,
  normalize?: ResponseNormalization,
): ScoreResult {
  if (declaration.areaMapping) {
    const score = mapResponsePoint(declaration, response);
    const positiveSum = declaration.areaMapping.areaMapEntries.reduce(
      (sum, entry) => sum + Math.max(entry.mappedValue, 0),
      0,
    );
    const maxScore = declaration.areaMapping.upperBound ?? positiveSum;

    return {
      identifier: declaration.identifier,
      score,
      maxScore,
      correct: maxScore > 0 && score >= maxScore,
    };
  }

  if (declaration.mapping) {
    const score = mapResponse(declaration, response, normalize);
    const positiveSum = declaration.mapping.mapEntries.reduce((sum, entry) => sum + Math.max(entry.mappedValue, 0), 0);
    const maxScore = declaration.mapping.upperBound ?? positiveSum;

    return {
      identifier: declaration.identifier,
      score,
      maxScore,
      correct: maxScore > 0 && score >= maxScore,
    };
  }

  const correct = matchCorrect(declaration, response, normalize);

  return {
    identifier: declaration.identifier,
    score: correct ? 1 : 0,
    maxScore: 1,
    correct,
  };
}
