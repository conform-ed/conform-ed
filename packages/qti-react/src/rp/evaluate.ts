/**
 * The shared QTI expression evaluator (ADR-0004), used by both response processing and
 * template processing. The environment supplies variable lookup, declarations, and —
 * only where the spec allows nondeterminism (template processing) — a seeded PRNG.
 * Random operators without a PRNG in the environment are unsupported constructs:
 * response processing must stay deterministic and replayable.
 */

import { compile as compileXsdPattern } from "xspattern";

import { parseCoords, parsePoint, pointInShape } from "../graphic";
import { mapResponse, mapResponsePoint } from "../response-processing";
import type { ResponseDeclarationView, ResponseValue } from "../types";
import type { CustomOperatorImplementation, ResponseNormalization, RpExpressionView } from "./types";
import {
  booleanValue,
  coerceScalar,
  floatValue,
  rpValue,
  scalarsEqual,
  singleBoolean,
  singleNumber,
  valuesMatch,
  type MaybeRpValue,
  type RpValue,
} from "./values";

export interface EvalEnv {
  readonly lookupVariable: (identifier: string) => MaybeRpValue;
  readonly responseDeclaration: (identifier: string) => ResponseDeclarationView | undefined;
  readonly responseValue: (identifier: string) => ResponseValue;
  readonly normalization?: ResponseNormalization | undefined;
  /** Seeded PRNG in [0, 1); present only in template processing. */
  readonly random?: (() => number) | undefined;
  /** `testVariables` aggregation; present only in test-level outcome processing. */
  readonly testVariables?: (expression: RpExpressionView) => MaybeRpValue;
  /** The `number*` item-session aggregates; present only in test-level outcome processing. */
  readonly testAggregate?: (expression: RpExpressionView) => MaybeRpValue;
  /** Declared default of any item variable, for the `default` expression (§2.11.1.3). */
  readonly variableDefault?: (identifier: string) => MaybeRpValue;
  /** Registered vendor operators by class; unregistered classes stay unsupported. */
  readonly customOperators?: Readonly<Record<string, CustomOperatorImplementation>> | undefined;
}

/** Expression kinds legal everywhere (deterministic). */
export const deterministicExpressionKinds: ReadonlySet<string> = new Set([
  "and",
  "anyN",
  "baseValue",
  "containerSize",
  "contains",
  "correct",
  "default",
  "delete",
  "divide",
  "durationGte",
  "durationLt",
  "equal",
  "equalRounded",
  "fieldValue",
  "gcd",
  "gt",
  "gte",
  "index",
  "inside",
  "lcm",
  "integerDivide",
  "integerModulus",
  "integerToFloat",
  "isNull",
  "lt",
  "lte",
  "mapResponse",
  "mapResponsePoint",
  "match",
  "mathConstant",
  "mathOperator",
  "max",
  "member",
  "min",
  "multiple",
  "not",
  "null",
  "or",
  "ordered",
  "patternMatch",
  "power",
  "product",
  "repeat",
  "round",
  "roundTo",
  "statsOperator",
  "stringMatch",
  "substring",
  "subtract",
  "sum",
  "truncate",
  "variable",
]);

/** Expression kinds requiring the seeded PRNG (template processing only). */
export const randomExpressionKinds: ReadonlySet<string> = new Set(["random", "randomFloat", "randomInteger"]);

export class RpUnsupportedError extends Error {
  readonly kindName: string;

  constructor(kindName: string) {
    super(`Unsupported response-processing construct: ${kindName}`);
    this.kindName = kindName;
  }
}

const mathConstants: Readonly<Record<string, number>> = { pi: Math.PI, e: Math.E };

/**
 * Compiled XSD-dialect pattern matchers (`patternMatch` uses the regular expression
 * language of Appendix F of XML Schema, not ECMAScript). null caches a pattern that
 * failed to compile — invalid patterns are refused, never guessed.
 */
const xsdPatternMatchers = new Map<string, ((value: string) => boolean) | null>();

function xsdPatternMatcher(pattern: string): ((value: string) => boolean) | null {
  const cached = xsdPatternMatchers.get(pattern);

  if (cached !== undefined) {
    return cached;
  }

  let matcher: ((value: string) => boolean) | null;

  try {
    matcher = compileXsdPattern(pattern);
  } catch {
    matcher = null;
  }

  xsdPatternMatchers.set(pattern, matcher);

  return matcher;
}

/** The brace-enclosed variable-reference form of string attributes (§7.13). */
const encVariableStringPattern = /^\{[^{}]+\}$/u;

/** The named functions of `mathOperator`; undefined means the name is unknown. */
function applyMathOperator(name: string, x: number, y: number): number | undefined {
  switch (name) {
    case "sin":
      return Math.sin(x);
    case "cos":
      return Math.cos(x);
    case "tan":
      return Math.tan(x);
    case "sec":
      return 1 / Math.cos(x);
    case "csc":
      return 1 / Math.sin(x);
    case "cot":
      return Math.cos(x) / Math.sin(x);
    case "asin":
      return Math.asin(x);
    case "acos":
      return Math.acos(x);
    case "atan":
      return Math.atan(x);
    case "atan2":
      return Math.atan2(x, y);
    case "asec":
      return Math.acos(1 / x);
    case "acsc":
      return Math.asin(1 / x);
    case "acot":
      return Math.atan(1 / x);
    case "sinh":
      return Math.sinh(x);
    case "cosh":
      return Math.cosh(x);
    case "tanh":
      return Math.tanh(x);
    case "sech":
      return 1 / Math.cosh(x);
    case "csch":
      return 1 / Math.sinh(x);
    case "coth":
      return Math.cosh(x) / Math.sinh(x);
    case "log":
      return Math.log10(x);
    case "ln":
      return Math.log(x);
    case "exp":
      return Math.exp(x);
    case "abs":
      return Math.abs(x);
    case "signum":
      return Math.sign(x);
    case "floor":
      return Math.floor(x);
    case "ceil":
      return Math.ceil(x);
    case "toDegrees":
      return (x * 180) / Math.PI;
    case "toRadians":
      return (x * Math.PI) / 180;
    default:
      return undefined;
  }
}

/**
 * A numeric attribute that is either a literal or a variable reference (the spec's
 * IntOrIdentifier / FloatOrVariableRef): "If n is an identifier, it is the value of n
 * at runtime that is used" (QTI 3 info model §2.11.3.6). The brace-enclosed
 * EncVariableString form (§7.13) is accepted alongside bare identifiers. An
 * unresolvable or NULL-valued reference yields null — the operator then results in
 * NULL, never a refusal.
 */
function resolveNumericAttribute(raw: number | string | undefined, env: EvalEnv): number | null | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw === "number") {
    return raw;
  }

  const identifier = raw.startsWith("{") && raw.endsWith("}") ? raw.slice(1, -1) : raw;

  return singleNumber(env.lookupVariable(identifier));
}

function roundToFigures(value: number, mode: "decimalPlaces" | "significantFigures", figures: number): number | null {
  if (mode === "decimalPlaces") {
    const scale = 10 ** figures;
    return Math.round(value * scale) / scale;
  }

  if (figures < 1) {
    return null;
  }

  if (value === 0) {
    return 0;
  }

  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const scale = 10 ** (figures - 1 - magnitude);

  return Math.round(value * scale) / scale;
}

export function evaluateExpression(expression: RpExpressionView, env: EvalEnv): MaybeRpValue {
  function evaluate(child: RpExpressionView): MaybeRpValue {
    return evaluateExpression(child, env);
  }

  switch (expression.kind) {
    case "baseValue": {
      const baseType = expression.baseType;
      const value = expression.value;

      return value === undefined ? null : rpValue("single", [coerceScalar(value, baseType)], baseType);
    }

    case "variable":
      return env.lookupVariable(expression.identifier ?? "");

    case "correct": {
      const declaration = env.responseDeclaration(expression.identifier ?? "");

      if (!declaration?.correctResponse) {
        return null;
      }

      return rpValue(
        declaration.cardinality,
        declaration.correctResponse.values.map((entry) => coerceScalar(entry.value, declaration.baseType)),
        declaration.baseType,
      );
    }

    case "mapResponse": {
      const identifier = expression.identifier ?? "";
      const declaration = env.responseDeclaration(identifier);

      if (!declaration) {
        return null;
      }

      return floatValue(mapResponse(declaration, env.responseValue(identifier), env.normalization));
    }

    case "mapResponsePoint": {
      const identifier = expression.identifier ?? "";
      const declaration = env.responseDeclaration(identifier);

      if (!declaration) {
        return null;
      }

      return floatValue(mapResponsePoint(declaration, env.responseValue(identifier)));
    }

    case "match": {
      const [a, b] = (expression.expressions ?? []).map(evaluate);

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      return booleanValue(valuesMatch(a, b, env.normalization));
    }

    case "isNull": {
      const operand = expression.expressions?.[0];

      return booleanValue(operand === undefined || evaluate(operand) === null);
    }

    case "not": {
      const operand = expression.expressions?.[0];
      const value = operand === undefined ? null : singleBoolean(evaluate(operand));

      return value === null ? null : booleanValue(!value);
    }

    case "fieldValue": {
      const operand = expression.expressions?.[0];
      const value = operand === undefined ? null : evaluate(operand);
      const field = value?.fields?.find((entry) => entry.name === expression.fieldIdentifier);

      return field === undefined ? null : rpValue("single", [field.value], field.baseType);
    }

    case "and":
    case "or": {
      const members = (expression.expressions ?? []).map((child) => singleBoolean(evaluate(child)));

      // Three-valued logic (§2.11.3.10/.15): a decisive operand wins outright; an
      // undecided one ("NULL and all others are true/false") makes the result NULL.
      if (expression.kind === "and") {
        if (members.some((member) => member === false)) {
          return booleanValue(false);
        }

        return members.some((member) => member === null) ? null : booleanValue(true);
      }

      if (members.some((member) => member === true)) {
        return booleanValue(true);
      }

      return members.some((member) => member === null) ? null : booleanValue(false);
    }

    case "sum":
    case "product": {
      let result = expression.kind === "sum" ? 0 : 1;

      for (const child of expression.expressions ?? []) {
        const value = evaluate(child);

        if (value === null) {
          return null;
        }

        for (const member of value.values) {
          if (typeof member !== "number") {
            return null;
          }

          result = expression.kind === "sum" ? result + member : result * member;
        }
      }

      return floatValue(result);
    }

    case "subtract":
    case "divide": {
      const [a, b] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      if (expression.kind === "divide") {
        return b === 0 ? null : floatValue(a / b);
      }

      return floatValue(a - b);
    }

    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const [a, b] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      const comparisons = { gt: a > b, gte: a >= b, lt: a < b, lte: a <= b } as const;

      return booleanValue(comparisons[expression.kind]);
    }

    case "equal": {
      const [a, b] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      const mode = expression.toleranceMode ?? "exact";

      if (mode === "exact") {
        return booleanValue(a === b);
      }

      const t0 = resolveNumericAttribute(expression.tolerance?.[0], env);
      const t1raw = expression.tolerance?.[1];
      const t1 = t1raw === undefined ? t0 : resolveNumericAttribute(t1raw, env);

      if (typeof t0 !== "number" || typeof t1 !== "number") {
        return null; // missing or unresolvable tolerance → NULL
      }

      const lower = mode === "absolute" ? a - t0 : a * (1 - t0 / 100);
      const upper = mode === "absolute" ? a + t1 : a * (1 + t1 / 100);
      const aboveLower = (expression.includeLowerBound ?? true) ? b >= lower : b > lower;
      const belowUpper = (expression.includeUpperBound ?? true) ? b <= upper : b < upper;

      return booleanValue(aboveLower && belowUpper);
    }

    case "round":
    case "truncate": {
      const operand = expression.expressions?.[0];
      const value = operand === undefined ? null : singleNumber(evaluate(operand));

      if (value === null) {
        return null;
      }

      // QTI rounds half toward positive infinity, which is Math.round's behavior.
      const rounded = expression.kind === "round" ? Math.round(value) : Math.trunc(value);

      return { cardinality: "single", baseType: "integer", values: [rounded] };
    }

    case "index": {
      const n = resolveNumericAttribute(expression.n, env);

      if (typeof n !== "number") {
        return null; // missing or unresolvable n → NULL
      }

      const operand = expression.expressions?.[0];
      const container = operand === undefined ? null : evaluate(operand);

      if (container === null) {
        return null;
      }

      const member = container.values[n - 1];

      if (member === undefined) {
        return null; // out of range is null, per spec
      }

      return rpValue("single", [member], container.baseType);
    }

    case "mathConstant": {
      const constant = expression.name === undefined ? undefined : mathConstants[expression.name];

      if (constant === undefined) {
        throw new RpUnsupportedError("mathConstant");
      }

      return floatValue(constant);
    }

    case "mathOperator": {
      const [x, y] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (x === undefined || x === null || (expression.name === "atan2" && (y === undefined || y === null))) {
        return null;
      }

      const result = expression.name === undefined ? undefined : applyMathOperator(expression.name, x, y ?? NaN);

      if (result === undefined) {
        throw new RpUnsupportedError("mathOperator");
      }

      return Number.isFinite(result) ? floatValue(result) : null; // domain errors are NULL
    }

    case "integerDivide":
    case "integerModulus": {
      const [a, b] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (a === undefined || b === undefined || a === null || b === null || b === 0) {
        return null;
      }

      const result = expression.kind === "integerDivide" ? Math.trunc(a / b) : a % b;

      return { cardinality: "single", baseType: "integer", values: [result] };
    }

    case "integerToFloat": {
      const operand = expression.expressions?.[0];
      const value = operand === undefined ? null : singleNumber(evaluate(operand));

      return value === null ? null : floatValue(value);
    }

    case "min":
    case "max": {
      const members: number[] = [];

      for (const child of expression.expressions ?? []) {
        const value = evaluate(child);

        if (value === null) {
          return null;
        }

        for (const member of value.values) {
          if (typeof member !== "number") {
            return null;
          }

          members.push(member);
        }
      }

      if (members.length === 0) {
        return null;
      }

      return floatValue(expression.kind === "min" ? Math.min(...members) : Math.max(...members));
    }

    case "gcd":
    case "lcm": {
      const members: number[] = [];

      for (const child of expression.expressions ?? []) {
        const value = evaluate(child);

        if (value === null) {
          return null;
        }

        for (const member of value.values) {
          if (typeof member !== "number" || !Number.isInteger(member)) {
            return null;
          }

          members.push(Math.abs(member));
        }
      }

      if (members.length === 0) {
        return null;
      }

      const gcdOf = (a: number, b: number): number => (b === 0 ? a : gcdOf(b, a % b));
      const result =
        expression.kind === "gcd"
          ? members.reduce(gcdOf)
          : members.reduce((a, b) => (a === 0 || b === 0 ? 0 : (a / gcdOf(a, b)) * b));

      return { cardinality: "single", baseType: "integer", values: [result] };
    }

    case "roundTo": {
      const figures = resolveNumericAttribute(expression.figures, env);

      if (typeof figures !== "number") {
        return null; // missing or unresolvable figures → NULL
      }

      const operand = expression.expressions?.[0];
      const value = operand === undefined ? null : singleNumber(evaluate(operand));

      if (value === null) {
        return null;
      }

      const rounded = roundToFigures(value, expression.roundingMode ?? "significantFigures", figures);

      return rounded === null ? null : floatValue(rounded);
    }

    case "equalRounded": {
      const figures = resolveNumericAttribute(expression.figures, env);

      if (typeof figures !== "number") {
        return null; // missing or unresolvable figures → NULL
      }

      const [a, b] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      const mode = expression.roundingMode ?? "significantFigures";
      const roundedA = roundToFigures(a, mode, figures);
      const roundedB = roundToFigures(b, mode, figures);

      return roundedA === null || roundedB === null ? null : booleanValue(roundedA === roundedB);
    }

    case "statsOperator": {
      const operand = expression.expressions?.[0];
      const container = operand === undefined ? null : evaluate(operand);

      if (container === null) {
        return null;
      }

      const members: number[] = [];

      for (const member of container.values) {
        if (typeof member !== "number") {
          return null;
        }

        members.push(member);
      }

      const count = members.length;

      if (count === 0) {
        return null;
      }

      const mean = members.reduce((sum, member) => sum + member, 0) / count;
      const sumSquares = members.reduce((sum, member) => sum + (member - mean) ** 2, 0);

      switch (expression.name) {
        case "mean":
          return floatValue(mean);
        case "popVariance":
          return floatValue(sumSquares / count);
        case "popSD":
          return floatValue(Math.sqrt(sumSquares / count));
        case "sampleVariance":
          return count < 2 ? null : floatValue(sumSquares / (count - 1));
        case "sampleSD":
          return count < 2 ? null : floatValue(Math.sqrt(sumSquares / (count - 1)));
        default:
          throw new RpUnsupportedError("statsOperator");
      }
    }

    case "delete": {
      const [valueExpression, containerExpression] = expression.expressions ?? [];

      if (valueExpression === undefined || containerExpression === undefined) {
        return null;
      }

      const value = evaluate(valueExpression);
      const container = evaluate(containerExpression);

      if (value === null || container === null) {
        return null;
      }

      const scalar = value.values[0];

      if (scalar === undefined) {
        return null;
      }

      const baseType = container.baseType ?? value.baseType;
      const remaining = container.values.filter((member) => !scalarsEqual(member, scalar, baseType, env.normalization));

      // An empty container is NULL, per the QTI value model.
      return remaining.length === 0 ? null : rpValue(container.cardinality, remaining, container.baseType);
    }

    case "repeat": {
      const numberRepeats = resolveNumericAttribute(expression.numberRepeats, env);

      // "If qti-number-repeats refers to a variable whose value is less than 1, the
      // value of the whole expression is NULL" (§2.11.3.42); unresolvable refs too.
      if (typeof numberRepeats !== "number" || numberRepeats < 1) {
        return null;
      }

      const members: RpValue["values"][number][] = [];
      let baseType: string | undefined;

      for (let pass = 0; pass < numberRepeats; pass += 1) {
        for (const child of expression.expressions ?? []) {
          const value = evaluate(child);

          if (value === null) {
            continue; // NULL sub-expressions are ignored, per spec
          }

          baseType ??= value.baseType;
          members.push(...value.values);
        }
      }

      return members.length === 0 ? null : rpValue("ordered", members, baseType);
    }

    case "null":
      return null;

    case "durationGte":
    case "durationLt": {
      // Durations are compared as elapsed seconds; "longer (or equal, within the
      // limits imposed by truncation …)" (§2.11.3.20/.21). NULL operands propagate.
      const [a, b] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      return booleanValue(expression.kind === "durationGte" ? a >= b : a < b);
    }

    case "default":
      // "Returns the associated qti-default-value or NULL if no default value was
      // declared" (§2.11.1.3).
      return env.variableDefault?.(expression.identifier ?? "") ?? null;

    case "patternMatch": {
      const operand = expression.expressions?.[0];
      const value = operand === undefined ? null : evaluate(operand);
      const member = value?.values[0];

      if (value === null || typeof member !== "string") {
        return null; // "If the sub-expression is NULL then the operator results in NULL" (§2.11.3.41)
      }

      if (expression.pattern === undefined) {
        throw new RpUnsupportedError("patternMatch");
      }

      // EncVariableString (§7.13): a brace-enclosed reference resolves the pattern
      // from a variable at runtime; anything else is a literal XSD pattern.
      const pattern = encVariableStringPattern.test(expression.pattern)
        ? env.lookupVariable(expression.pattern.slice(1, -1))?.values[0]
        : expression.pattern;

      if (typeof pattern !== "string") {
        return null; // unresolvable pattern reference → NULL
      }

      const matcher = xsdPatternMatcher(pattern);

      if (matcher === null) {
        throw new RpUnsupportedError("patternMatch"); // invalid pattern: refuse, never guess
      }

      return booleanValue(matcher(member));
    }

    case "power": {
      const [a, b] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      const result = a ** b;

      // "If the resulting value is outside the value set defined by float (not
      // including positive and negative infinity) then the operator shall result in
      // NULL" (§2.11.3.30).
      return Number.isFinite(result) ? floatValue(result) : null;
    }

    case "containerSize": {
      const operand = expression.expressions?.[0];
      const container = operand === undefined ? null : evaluate(operand);

      // "If the sub-expression is NULL the result is 0" (§2.11.3.32) — the spec's
      // exception to NULL propagation; an empty container is NULL in this model.
      return {
        cardinality: "single",
        baseType: "integer",
        values: [container === null ? 0 : container.values.length],
      };
    }

    case "contains": {
      const [firstExpression, secondExpression] = expression.expressions ?? [];

      if (firstExpression === undefined || secondExpression === undefined) {
        return null;
      }

      const first = evaluate(firstExpression);
      const second = evaluate(secondExpression);

      if (first === null || second === null || first.cardinality === "record" || second.cardinality === "record") {
        return null;
      }

      const baseType = first.baseType ?? second.baseType;

      if (first.cardinality === "ordered") {
        // "For ordered containers the second sub-expression must be a strict
        // sub-sequence within the first" (§2.11.3.17): a contiguous in-order run.
        const found = first.values.some(
          (_, start) =>
            start + second.values.length <= first.values.length &&
            second.values.every((member, offset) =>
              scalarsEqual(first.values[start + offset]!, member, baseType, env.normalization),
            ),
        );

        return booleanValue(found);
      }

      // Unordered: multiset semantics — "[A,B,C] does not contain [B,B] but
      // [A,B,B,C] does" (§2.11.3.17).
      const remaining = [...first.values];

      for (const member of second.values) {
        const at = remaining.findIndex((candidate) => scalarsEqual(candidate, member, baseType, env.normalization));

        if (at === -1) {
          return booleanValue(false);
        }

        remaining.splice(at, 1);
      }

      return booleanValue(true);
    }

    case "anyN": {
      const min = resolveNumericAttribute(expression.min, env);
      const max = resolveNumericAttribute(expression.max, env);

      if (typeof min !== "number" || typeof max !== "number") {
        return null;
      }

      const members = (expression.expressions ?? []).map((child) => singleBoolean(evaluate(child)));
      const trueCount = members.filter((member) => member === true).length;
      const nullCount = members.filter((member) => member === null).length;

      // The actual count of true lies in [trueCount, trueCount + nullCount]; the
      // result is decided only when that whole interval is inside or outside
      // [min, max] — this reproduces the spec's worked examples (§2.11.3, anyN).
      if (trueCount >= min && trueCount + nullCount <= max) {
        return booleanValue(true);
      }

      if (trueCount + nullCount < min || trueCount > max) {
        return booleanValue(false);
      }

      return null;
    }

    case "stringMatch":
    case "substring": {
      const [a, b] = (expression.expressions ?? []).map((child) => {
        const value = evaluate(child);
        const member = value?.values[0];

        return typeof member === "string" ? member : null;
      });

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      const normalize = (input: string): string => {
        const normalized = env.normalization?.(input) ?? input;

        return expression.caseSensitive === false ? normalized.toLowerCase() : normalized;
      };

      const [left, right] = [normalize(a), normalize(b)];
      const contains = expression.kind === "substring" || expression.substring === true;

      return booleanValue(contains ? right.includes(left) : left === right);
    }

    case "inside": {
      if (typeof expression.shape !== "string" || typeof expression.coords !== "string") {
        throw new RpUnsupportedError("inside");
      }

      const operand = expression.expressions?.[0];
      const value = operand === undefined ? null : evaluate(operand);
      const member = value?.values[0];

      if (value === null || typeof member !== "string") {
        return null;
      }

      const point = parsePoint(member);

      if (point === null) {
        return null;
      }

      return booleanValue(pointInShape(expression.shape, parseCoords(expression.coords), point));
    }

    case "member": {
      const [needleExpression, containerExpression] = expression.expressions ?? [];

      if (needleExpression === undefined || containerExpression === undefined) {
        return null;
      }

      const needle = evaluate(needleExpression);
      const container = evaluate(containerExpression);

      if (needle === null || container === null) {
        return null;
      }

      const scalar = needle.values[0];

      if (scalar === undefined) {
        return null;
      }

      const baseType = container.baseType ?? needle.baseType;

      return booleanValue(container.values.some((member) => scalarsEqual(member, scalar, baseType, env.normalization)));
    }

    case "multiple":
    case "ordered": {
      const members: RpValue["values"][number][] = [];
      let baseType: string | undefined;

      for (const child of expression.expressions ?? []) {
        const value = evaluate(child);

        if (value === null) {
          continue; // spec: NULL sub-expressions are ignored by container constructors
        }

        baseType ??= value.baseType;
        members.push(...value.values);
      }

      if (members.length === 0) {
        return null;
      }

      return rpValue(expression.kind, members, baseType);
    }

    case "randomInteger": {
      if (!env.random) {
        throw new RpUnsupportedError(expression.kind);
      }

      const min = resolveNumericAttribute(expression.min, env) ?? 0;
      const max = resolveNumericAttribute(expression.max, env) ?? min;
      const step = resolveNumericAttribute(expression.step, env) ?? 1;
      const count = Math.max(1, Math.floor((max - min) / step) + 1);

      return { cardinality: "single", baseType: "integer", values: [min + Math.floor(env.random() * count) * step] };
    }

    case "randomFloat": {
      if (!env.random) {
        throw new RpUnsupportedError(expression.kind);
      }

      const min = resolveNumericAttribute(expression.min, env) ?? 0;
      const max = resolveNumericAttribute(expression.max, env) ?? min;

      return floatValue(min + env.random() * (max - min));
    }

    case "testVariables": {
      if (!env.testVariables) {
        throw new RpUnsupportedError(expression.kind);
      }

      return env.testVariables(expression);
    }

    case "customOperator": {
      const implementation = env.customOperators?.[expression.class ?? ""];

      if (!implementation) {
        throw new RpUnsupportedError(expression.kind);
      }

      return implementation((expression.expressions ?? []).map(evaluate), expression);
    }

    case "numberCorrect":
    case "numberIncorrect":
    case "numberPresented":
    case "numberResponded":
    case "numberSelected": {
      if (!env.testAggregate) {
        throw new RpUnsupportedError(expression.kind);
      }

      return env.testAggregate(expression);
    }

    case "random": {
      if (!env.random) {
        throw new RpUnsupportedError(expression.kind);
      }

      const container = expression.expressions?.[0] === undefined ? null : evaluate(expression.expressions[0]);

      if (container === null || container.values.length === 0) {
        return null;
      }

      const pick = container.values[Math.floor(env.random() * container.values.length)]!;

      return rpValue("single", [pick], container.baseType);
    }

    default:
      throw new RpUnsupportedError(expression.kind);
  }
}

/** Walk an expression tree, reporting kinds outside the allowed set. */
export function collectExpressionIssues(
  expression: RpExpressionView,
  allowedKinds: ReadonlySet<string>,
  report: (name: string) => void,
  customOperatorClasses?: ReadonlySet<string>,
): void {
  if (expression.kind === "customOperator") {
    // Supported only for registered classes — a per-class gate, not a kind gate.
    if (!customOperatorClasses?.has(expression.class ?? "")) {
      report(expression.kind);
    }
  } else if (!allowedKinds.has(expression.kind)) {
    report(expression.kind);
  } else if (
    expression.kind === "patternMatch" &&
    expression.pattern !== undefined &&
    !encVariableStringPattern.test(expression.pattern) &&
    xsdPatternMatcher(expression.pattern) === null
  ) {
    // A literal pattern that does not compile can never evaluate: surface it at
    // gate time instead of as a runtime abort.
    report(expression.kind);
  }

  for (const child of expression.expressions ?? []) {
    collectExpressionIssues(child, allowedKinds, report, customOperatorClasses);
  }
}
