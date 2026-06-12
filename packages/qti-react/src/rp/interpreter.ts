/**
 * The Response Processing Interpreter (ADR-0004): a pure, deterministic evaluator of
 * the contracts-validated `responseProcessing` tree. Operator coverage grows milestone
 * by milestone; anything outside it aborts execution to the declared outcome defaults
 * and is reported as an `unsupported-rp` Capability issue — never partial scoring.
 */

import type { CapabilityIssue } from "../capability";
import type { ResponseDeclarationView } from "../types";
import {
  RpUnsupportedError,
  collectExpressionIssues,
  deterministicExpressionKinds,
  evaluateExpression,
  type EvalEnv,
} from "./evaluate";
import { resolveTemplate } from "./templates";
import type {
  OutcomeDeclarationView,
  ResponseProcessingContext,
  ResponseProcessingResult,
  ResponseProcessingView,
  RpConditionBranch,
  RpRuleView,
} from "./types";
import {
  coerceScalar,
  floatValue,
  fromFlatValue,
  fromResponse,
  isNumericBaseType,
  rpValue,
  singleBoolean,
  toOutcomeValue,
  type MaybeRpValue,
} from "./values";

const supportedRuleKinds = new Set(["responseCondition", "setOutcomeValue", "exitResponse"]);

/**
 * RP additionally supports the random operators: the attempt store always provides a
 * seed-derived source, so they stay deterministic per clone (seed = replay key).
 */
const rpExpressionKinds = new Set([...deterministicExpressionKinds, "random", "randomInteger", "randomFloat"]);

class ExitResponseSignal extends Error {}

function defaultOutcomes(declarations: readonly OutcomeDeclarationView[]): Map<string, MaybeRpValue> {
  const outcomes = new Map<string, MaybeRpValue>();

  for (const declaration of declarations) {
    if (declaration.defaultValue) {
      outcomes.set(
        declaration.identifier,
        rpValue(
          declaration.cardinality,
          declaration.defaultValue.values.map((entry) => coerceScalar(entry.value, declaration.baseType)),
          declaration.baseType,
        ),
      );
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
  const templateDeclarationsById = new Map(
    (context.templateDeclarations ?? []).map((declaration) => [declaration.identifier, declaration]),
  );

  function initialOutcomes(): Map<string, MaybeRpValue> {
    const outcomes = defaultOutcomes(context.outcomeDeclarations);

    // Adaptive carry-over: prior outcome values (from earlier attempts in the same
    // item session) replace the declared defaults.
    for (const [identifier, prior] of Object.entries(context.priorOutcomes ?? {})) {
      const declaration = context.outcomeDeclarations.find((entry) => entry.identifier === identifier);

      outcomes.set(identifier, fromFlatValue(prior, declaration?.cardinality ?? "single", declaration?.baseType));
    }

    return outcomes;
  }

  let outcomes = initialOutcomes();

  let rules: readonly RpRuleView[] = view?.rules ?? [];

  if (view && !view.rules && view.template) {
    const resolved = resolveTemplate(view.template);

    if (resolved) {
      rules = resolved;
    } else {
      issues.push({ type: "unsupported-rp", name: view.template, detail: "Unknown response-processing template URI." });
    }
  }

  const env: EvalEnv = {
    lookupVariable: (identifier) => {
      // Built-in session variables (reserved identifiers; items must not declare
      // them): duration in seconds, numAttempts including the current attempt.
      if (identifier === "duration") {
        return context.duration === undefined ? null : rpValue("single", [context.duration], "duration");
      }

      if (identifier === "numAttempts") {
        return context.numAttempts === undefined ? null : rpValue("single", [context.numAttempts], "integer");
      }

      const declaration = declarationsById.get(identifier);

      if (declaration) {
        return fromResponse(declaration, context.responses[identifier] ?? null);
      }

      const templateDeclaration = templateDeclarationsById.get(identifier);

      if (templateDeclaration) {
        return fromFlatValue(
          context.templateValues?.[identifier] ?? null,
          templateDeclaration.cardinality,
          templateDeclaration.baseType,
        );
      }

      return outcomes.get(identifier) ?? null;
    },
    responseDeclaration: (identifier) => declarationsById.get(identifier),
    responseValue: (identifier) => context.responses[identifier] ?? null,
    variableDefault: (identifier) => {
      const declaration =
        declarationsById.get(identifier) ??
        context.outcomeDeclarations.find((entry) => entry.identifier === identifier) ??
        templateDeclarationsById.get(identifier);

      if (!declaration?.defaultValue) {
        return null; // "NULL if no default value was declared" (§2.11.1.3)
      }

      return rpValue(
        declaration.cardinality,
        declaration.defaultValue.values.map((entry) => coerceScalar(entry.value, declaration.baseType)),
        declaration.baseType,
      );
    },
    normalization: context.normalization,
    random: context.random,
    customOperators: context.customOperators,
  };

  function branchTaken(branch: RpConditionBranch): boolean {
    if (singleBoolean(evaluateExpression(branch.expression, env)) !== true) {
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
          outcomes.set(rule.identifier, evaluateExpression(rule.expression, env));
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
      outcomes = initialOutcomes(); // abort, never partial scoring
    } else if (!(error instanceof ExitResponseSignal)) {
      throw error;
    }
  }

  return {
    outcomes: Object.fromEntries([...outcomes].map(([identifier, value]) => [identifier, toOutcomeValue(value)])),
    issues,
  };
}

export interface RpIssueOptions {
  /** `customOperator` classes the consumer has registered implementations for. */
  readonly customOperatorClasses?: ReadonlySet<string>;
}

/** Static coverage walk for `canDeliver`: reports constructs the interpreter lacks without executing. */
export function collectRpIssues(
  view: ResponseProcessingView | undefined,
  options?: RpIssueOptions,
): readonly CapabilityIssue[] {
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

  function walkRules(rules: readonly RpRuleView[]): void {
    for (const rule of rules) {
      if (!supportedRuleKinds.has(rule.kind)) {
        report(rule.kind);
        continue;
      }

      if (rule.expression) {
        collectExpressionIssues(rule.expression, rpExpressionKinds, report, options?.customOperatorClasses);
      }

      for (const branch of [rule.responseIf, ...(rule.responseElseIfs ?? [])]) {
        if (branch) {
          collectExpressionIssues(branch.expression, rpExpressionKinds, report, options?.customOperatorClasses);
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
