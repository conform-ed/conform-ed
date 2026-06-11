/**
 * The shared QTI expression evaluator (ADR-0004), used by both response processing and
 * template processing. The environment supplies variable lookup, declarations, and —
 * only where the spec allows nondeterminism (template processing) — a seeded PRNG.
 * Random operators without a PRNG in the environment are unsupported constructs:
 * response processing must stay deterministic and replayable.
 */

import { parseCoords, parsePoint, pointInShape } from "../graphic";
import { mapResponse, mapResponsePoint } from "../response-processing";
import type { ResponseDeclarationView, ResponseValue } from "../types";

import type { CustomOperatorImplementation, ResponseNormalization, RpExpressionView } from "./types";
import {
  booleanValue,
  coerceScalar,
  floatValue,
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
  readonly normalization?: ResponseNormalization;
  /** Seeded PRNG in [0, 1); present only in template processing. */
  readonly random?: () => number;
  /** `testVariables` aggregation; present only in test-level outcome processing. */
  readonly testVariables?: (expression: RpExpressionView) => MaybeRpValue;
  /** The `number*` item-session aggregates; present only in test-level outcome processing. */
  readonly testAggregate?: (expression: RpExpressionView) => MaybeRpValue;
  /** Registered vendor operators by class; unregistered classes stay unsupported. */
  readonly customOperators?: Readonly<Record<string, CustomOperatorImplementation>>;
}

/** Expression kinds legal everywhere (deterministic). */
export const deterministicExpressionKinds = new Set([
  "and",
  "baseValue",
  "correct",
  "delete",
  "divide",
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
  "or",
  "ordered",
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
export const randomExpressionKinds = new Set(["random", "randomFloat", "randomInteger"]);

export class RpUnsupportedError extends Error {
  constructor(readonly kindName: string) {
    super(`Unsupported response-processing construct: ${kindName}`);
  }
}

const mathConstants: Readonly<Record<string, number>> = { pi: Math.PI, e: Math.E };

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

      return value === undefined ? null : { cardinality: "single", baseType, values: [coerceScalar(value, baseType)] };
    }

    case "variable":
      return env.lookupVariable(expression.identifier ?? "");

    case "correct": {
      const declaration = env.responseDeclaration(expression.identifier ?? "");

      if (!declaration?.correctResponse) {
        return null;
      }

      return {
        cardinality: declaration.cardinality,
        baseType: declaration.baseType,
        values: declaration.correctResponse.values.map((entry) => coerceScalar(entry.value, declaration.baseType)),
      };
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

      return field === undefined
        ? null
        : { cardinality: "single", ...(field.baseType ? { baseType: field.baseType } : {}), values: [field.value] };
    }

    case "and":
    case "or": {
      const members = (expression.expressions ?? []).map((child) => singleBoolean(evaluate(child)));

      // NULL operands are treated as false; sufficient for the supported coverage.
      return booleanValue(
        expression.kind === "and"
          ? members.every((member) => member === true)
          : members.some((member) => member === true),
      );
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

      const t0 = expression.tolerance?.[0];
      const t1 = expression.tolerance?.[1] ?? t0;

      if (typeof t0 !== "number" || typeof t1 !== "number") {
        // Template-variable tolerances (and missing ones) are out of the staged scope.
        throw new RpUnsupportedError("equal");
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
      if (typeof expression.n !== "number") {
        throw new RpUnsupportedError("index"); // template-variable n is out of scope
      }

      const operand = expression.expressions?.[0];
      const container = operand === undefined ? null : evaluate(operand);

      if (container === null) {
        return null;
      }

      const member = container.values[expression.n - 1];

      if (member === undefined) {
        return null; // out of range is null, per spec
      }

      return { cardinality: "single", baseType: container.baseType, values: [member] };
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
      if (typeof expression.figures !== "number") {
        throw new RpUnsupportedError("roundTo"); // template-variable figures
      }

      const operand = expression.expressions?.[0];
      const value = operand === undefined ? null : singleNumber(evaluate(operand));

      if (value === null) {
        return null;
      }

      const rounded = roundToFigures(value, expression.roundingMode ?? "significantFigures", expression.figures);

      return rounded === null ? null : floatValue(rounded);
    }

    case "equalRounded": {
      if (typeof expression.figures !== "number") {
        throw new RpUnsupportedError("equalRounded");
      }

      const [a, b] = (expression.expressions ?? []).map((child) => singleNumber(evaluate(child)));

      if (a === undefined || b === undefined || a === null || b === null) {
        return null;
      }

      const mode = expression.roundingMode ?? "significantFigures";
      const roundedA = roundToFigures(a, mode, expression.figures);
      const roundedB = roundToFigures(b, mode, expression.figures);

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
      return remaining.length === 0
        ? null
        : { cardinality: container.cardinality, baseType: container.baseType, values: remaining };
    }

    case "repeat": {
      if (typeof expression.numberRepeats !== "number") {
        throw new RpUnsupportedError("repeat"); // template-variable count
      }

      if (expression.numberRepeats < 1) {
        return null;
      }

      const members: RpValue["values"][number][] = [];
      let baseType: string | undefined;

      for (let pass = 0; pass < expression.numberRepeats; pass += 1) {
        for (const child of expression.expressions ?? []) {
          const value = evaluate(child);

          if (value === null) {
            continue; // NULL sub-expressions are ignored, per spec
          }

          baseType ??= value.baseType;
          members.push(...value.values);
        }
      }

      return members.length === 0 ? null : { cardinality: "ordered", baseType, values: members };
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

      return { cardinality: expression.kind, baseType, values: members };
    }

    case "randomInteger": {
      if (!env.random) {
        throw new RpUnsupportedError(expression.kind);
      }

      const min = expression.min ?? 0;
      const max = expression.max ?? min;
      const step = expression.step ?? 1;
      const count = Math.max(1, Math.floor((max - min) / step) + 1);

      return { cardinality: "single", baseType: "integer", values: [min + Math.floor(env.random() * count) * step] };
    }

    case "randomFloat": {
      if (!env.random) {
        throw new RpUnsupportedError(expression.kind);
      }

      const min = expression.min ?? 0;
      const max = expression.max ?? min;

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

      return { cardinality: "single", baseType: container.baseType, values: [pick] };
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
  }

  for (const child of expression.expressions ?? []) {
    collectExpressionIssues(child, allowedKinds, report, customOperatorClasses);
  }
}
