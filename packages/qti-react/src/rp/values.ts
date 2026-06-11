/**
 * The interpreter's typed value model. QTI runtime values are (baseType, cardinality,
 * members); NULL is represented as `null`. Comparison is baseType-aware: pairs are
 * unordered within the pair, directedPairs ordered, strings normalize through the
 * consumer's Response Normalization hook (identity by default), numbers compare
 * numerically.
 */

import { parsePoint } from "../graphic";
import type { Cardinality, ResponseDeclarationView, ResponseValue } from "../types";
import type { OutcomeValue, ResponseNormalization, RpScalar } from "./types";

export interface RpValue {
  readonly cardinality: Cardinality;
  readonly baseType?: string;
  readonly values: readonly RpScalar[];
}

export type MaybeRpValue = RpValue | null;

const numericBaseTypes = new Set(["float", "integer", "duration"]);

export function isNumericBaseType(baseType: string | undefined): boolean {
  return baseType !== undefined && numericBaseTypes.has(baseType);
}

/** Coerce a raw scalar to its declared baseType (numbers and booleans may arrive as strings). */
export function coerceScalar(value: RpScalar, baseType: string | undefined): RpScalar {
  if (isNumericBaseType(baseType) && typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (baseType === "boolean" && typeof value === "string") {
    return value === "true";
  }

  return value;
}

/** Lift a store ResponseValue into the typed model using its declaration. */
export function fromResponse(declaration: ResponseDeclarationView, response: ResponseValue): MaybeRpValue {
  if (response === null) {
    return null;
  }

  const raw = typeof response === "string" ? [response] : [...response];

  if (raw.length === 0) {
    return null;
  }

  return {
    cardinality: declaration.cardinality,
    baseType: declaration.baseType,
    values: raw.map((value) => coerceScalar(value, declaration.baseType)),
  };
}

export function singleNumber(value: MaybeRpValue): number | null {
  if (value === null || value.values.length !== 1) {
    return null;
  }

  const member = value.values[0];

  return typeof member === "number" ? member : null;
}

export function singleBoolean(value: MaybeRpValue): boolean | null {
  if (value === null || value.values.length !== 1) {
    return null;
  }

  const member = value.values[0];

  return typeof member === "boolean" ? member : null;
}

export function booleanValue(value: boolean): RpValue {
  return { cardinality: "single", baseType: "boolean", values: [value] };
}

export function floatValue(value: number): RpValue {
  return { cardinality: "single", baseType: "float", values: [value] };
}

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

export function scalarsEqual(
  a: RpScalar,
  b: RpScalar,
  baseType: string | undefined,
  normalize?: ResponseNormalization,
): boolean {
  if (baseType === "pair" || baseType === "directedPair") {
    return typeof a === "string" && typeof b === "string" && pairsEqual(a, b, baseType === "directedPair");
  }

  if (baseType === "point") {
    if (typeof a !== "string" || typeof b !== "string") {
      return false;
    }

    const pointA = parsePoint(a);
    const pointB = parsePoint(b);

    return pointA !== null && pointB !== null && pointA.x === pointB.x && pointA.y === pointB.y;
  }

  if (typeof a === "number" || typeof b === "number") {
    return Number(a) === Number(b);
  }

  if (normalize && baseType === "string" && typeof a === "string" && typeof b === "string") {
    return normalize(a) === normalize(b);
  }

  return a === b;
}

/** QTI `match`: same cardinality; ordered compares sequences, containers compare multisets. */
export function valuesMatch(a: RpValue, b: RpValue, normalize?: ResponseNormalization): boolean {
  const baseType = a.baseType ?? b.baseType;

  if (a.values.length !== b.values.length) {
    return false;
  }

  if (a.cardinality === "ordered" || b.cardinality === "ordered") {
    return a.values.every((value, index) => scalarsEqual(value, b.values[index]!, baseType, normalize));
  }

  const remaining = [...b.values];

  for (const value of a.values) {
    const matchIndex = remaining.findIndex((candidate) => scalarsEqual(candidate, value, baseType, normalize));

    if (matchIndex === -1) {
      return false;
    }

    remaining.splice(matchIndex, 1);
  }

  return true;
}

export function toOutcomeValue(value: MaybeRpValue): OutcomeValue {
  if (value === null || value.values.length === 0) {
    return null;
  }

  if (value.cardinality === "single") {
    return value.values[0] ?? null;
  }

  return value.values;
}
