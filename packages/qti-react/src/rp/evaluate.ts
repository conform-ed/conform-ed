/**
 * The shared QTI expression evaluator (ADR-0004), used by both response processing and
 * template processing. The environment supplies variable lookup, declarations, and —
 * only where the spec allows nondeterminism (template processing) — a seeded PRNG.
 * Random operators without a PRNG in the environment are unsupported constructs:
 * response processing must stay deterministic and replayable.
 */

import { mapResponse, mapResponsePoint } from "../response-processing";
import type { ResponseDeclarationView, ResponseValue } from "../types";

import type { ResponseNormalization, RpExpressionView } from "./types";
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
}

/** Expression kinds legal everywhere (deterministic). */
export const deterministicExpressionKinds = new Set([
  "and",
  "baseValue",
  "correct",
  "divide",
  "gt",
  "gte",
  "isNull",
  "lt",
  "lte",
  "mapResponse",
  "mapResponsePoint",
  "match",
  "member",
  "multiple",
  "not",
  "or",
  "ordered",
  "product",
  "subtract",
  "sum",
  "variable",
]);

/** Expression kinds requiring the seeded PRNG (template processing only). */
export const randomExpressionKinds = new Set(["random", "randomFloat", "randomInteger"]);

export class RpUnsupportedError extends Error {
  constructor(readonly kindName: string) {
    super(`Unsupported response-processing construct: ${kindName}`);
  }
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
): void {
  if (!allowedKinds.has(expression.kind)) {
    report(expression.kind);
  }

  for (const child of expression.expressions ?? []) {
    collectExpressionIssues(child, allowedKinds, report);
  }
}
