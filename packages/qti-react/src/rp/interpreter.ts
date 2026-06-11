/**
 * The Response Processing Interpreter (ADR-0004): a pure, deterministic evaluator of
 * the contracts-validated `responseProcessing` tree. Operator coverage grows milestone
 * by milestone; anything outside it aborts execution to the declared outcome defaults
 * and is reported as an `unsupported-rp` Capability issue — never partial scoring.
 */

import type { CapabilityIssue } from "../capability";
import { mapResponse, mapResponsePoint } from "../response-processing";
import type { ResponseDeclarationView } from "../types";

import { resolveTemplate } from "./templates";
import type {
  OutcomeDeclarationView,
  ResponseProcessingContext,
  ResponseProcessingResult,
  ResponseProcessingView,
  RpConditionBranch,
  RpExpressionView,
  RpRuleView,
} from "./types";
import {
  booleanValue,
  coerceScalar,
  floatValue,
  fromResponse,
  isNumericBaseType,
  scalarsEqual,
  singleBoolean,
  singleNumber,
  toOutcomeValue,
  valuesMatch,
  type MaybeRpValue,
  type RpValue,
} from "./values";

const supportedRuleKinds = new Set(["responseCondition", "setOutcomeValue", "exitResponse"]);

const supportedExpressionKinds = new Set([
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

class RpUnsupportedError extends Error {
  constructor(readonly kindName: string) {
    super(`Unsupported response-processing construct: ${kindName}`);
  }
}

class ExitResponseSignal extends Error {}

function defaultOutcomes(declarations: readonly OutcomeDeclarationView[]): Map<string, MaybeRpValue> {
  const outcomes = new Map<string, MaybeRpValue>();

  for (const declaration of declarations) {
    if (declaration.defaultValue) {
      outcomes.set(declaration.identifier, {
        cardinality: declaration.cardinality,
        baseType: declaration.baseType,
        values: declaration.defaultValue.values.map((entry) => coerceScalar(entry.value, declaration.baseType)),
      });
      continue;
    }

    // Spec default: numeric outcome variables initialize to 0, everything else to NULL.
    outcomes.set(declaration.identifier, isNumericBaseType(declaration.baseType) ? floatValue(0) : null);
  }

  return outcomes;
}

export function executeResponseProcessing(
  view: ResponseProcessingView | undefined,
  context: ResponseProcessingContext,
): ResponseProcessingResult {
  const issues: CapabilityIssue[] = [];
  const declarationsById = new Map<string, ResponseDeclarationView>(
    context.responseDeclarations.map((declaration) => [declaration.identifier, declaration]),
  );
  let outcomes = defaultOutcomes(context.outcomeDeclarations);

  let rules: readonly RpRuleView[] = view?.rules ?? [];

  if (view && !view.rules && view.template) {
    const resolved = resolveTemplate(view.template);

    if (resolved) {
      rules = resolved;
    } else {
      issues.push({ type: "unsupported-rp", name: view.template, detail: "Unknown response-processing template URI." });
    }
  }

  function evaluate(expression: RpExpressionView): MaybeRpValue {
    switch (expression.kind) {
      case "baseValue": {
        const baseType = expression.baseType;
        const value = expression.value;

        return value === undefined
          ? null
          : { cardinality: "single", baseType, values: [coerceScalar(value, baseType)] };
      }

      case "variable": {
        const identifier = expression.identifier ?? "";
        const declaration = declarationsById.get(identifier);

        if (declaration) {
          return fromResponse(declaration, context.responses[identifier] ?? null);
        }

        return outcomes.get(identifier) ?? null;
      }

      case "correct": {
        const declaration = declarationsById.get(expression.identifier ?? "");

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
        const declaration = declarationsById.get(identifier);

        if (!declaration) {
          return null;
        }

        return floatValue(mapResponse(declaration, context.responses[identifier] ?? null, context.normalization));
      }

      case "mapResponsePoint": {
        const identifier = expression.identifier ?? "";
        const declaration = declarationsById.get(identifier);

        if (!declaration) {
          return null;
        }

        return floatValue(mapResponsePoint(declaration, context.responses[identifier] ?? null));
      }

      case "match": {
        const [a, b] = (expression.expressions ?? []).map(evaluate);

        if (a === undefined || b === undefined || a === null || b === null) {
          return null;
        }

        return booleanValue(valuesMatch(a, b, context.normalization));
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

        return booleanValue(
          container.values.some((member) => scalarsEqual(member, scalar, baseType, context.normalization)),
        );
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

      default:
        throw new RpUnsupportedError(expression.kind);
    }
  }

  function branchTaken(branch: RpConditionBranch): boolean {
    if (singleBoolean(evaluate(branch.expression)) !== true) {
      return false;
    }

    executeRules(branch.rules);

    return true;
  }

  function executeRules(rules_: readonly RpRuleView[]): void {
    for (const rule of rules_) {
      if (!supportedRuleKinds.has(rule.kind)) {
        throw new RpUnsupportedError(rule.kind);
      }

      if (rule.kind === "exitResponse") {
        throw new ExitResponseSignal();
      }

      if (rule.kind === "setOutcomeValue") {
        if (rule.identifier !== undefined && rule.expression !== undefined) {
          outcomes.set(rule.identifier, evaluate(rule.expression));
        }
        continue;
      }

      // responseCondition
      if (rule.responseIf && branchTaken(rule.responseIf)) {
        continue;
      }

      const elseIfTaken = (rule.responseElseIfs ?? []).some((branch) => branchTaken(branch));

      if (!elseIfTaken && rule.responseElse) {
        executeRules(rule.responseElse.rules);
      }
    }
  }

  try {
    executeRules(rules);
  } catch (error) {
    if (error instanceof RpUnsupportedError) {
      issues.push({ type: "unsupported-rp", name: error.kindName });
      outcomes = defaultOutcomes(context.outcomeDeclarations); // abort, never partial scoring
    } else if (!(error instanceof ExitResponseSignal)) {
      throw error;
    }
  }

  return {
    outcomes: Object.fromEntries([...outcomes].map(([identifier, value]) => [identifier, toOutcomeValue(value)])),
    issues,
  };
}

/** Static coverage walk for `canDeliver`: reports constructs the interpreter lacks without executing. */
export function collectRpIssues(view: ResponseProcessingView | undefined): readonly CapabilityIssue[] {
  if (!view) {
    return [];
  }

  const issues: CapabilityIssue[] = [];
  const seen = new Set<string>();

  function report(name: string, detail?: string): void {
    if (!seen.has(name)) {
      seen.add(name);
      issues.push({ type: "unsupported-rp", name, ...(detail === undefined ? {} : { detail }) });
    }
  }

  function walkExpression(expression: RpExpressionView): void {
    if (!supportedExpressionKinds.has(expression.kind)) {
      report(expression.kind);
    }

    for (const child of expression.expressions ?? []) {
      walkExpression(child);
    }
  }

  function walkRules(rules: readonly RpRuleView[]): void {
    for (const rule of rules) {
      if (!supportedRuleKinds.has(rule.kind)) {
        report(rule.kind);
        continue;
      }

      if (rule.expression) {
        walkExpression(rule.expression);
      }

      for (const branch of [rule.responseIf, ...(rule.responseElseIfs ?? [])]) {
        if (branch) {
          walkExpression(branch.expression);
          walkRules(branch.rules);
        }
      }

      if (rule.responseElse) {
        walkRules(rule.responseElse.rules);
      }
    }
  }

  if (view.rules) {
    walkRules(view.rules);
  } else if (view.template) {
    const resolved = resolveTemplate(view.template);

    if (resolved === null) {
      report(view.template, "Unknown response-processing template URI.");
    }
  }

  return issues;
}
