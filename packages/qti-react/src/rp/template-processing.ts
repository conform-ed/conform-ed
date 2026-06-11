/**
 * Template processing (ADR-0004): the seeded, deterministic engine that produces an
 * item clone. Given the same seed, the same template values and correctResponse
 * overrides come out — replayability survives randomized items because the seed, not
 * the outcome, is what gets stored. Supported rules: setTemplateValue,
 * templateCondition, setCorrectResponse, exitTemplate.
 */

import type { CapabilityIssue } from "../capability";
import type { CorrectResponseView, ResponseDeclarationView } from "../types";

import {
  RpUnsupportedError,
  collectExpressionIssues,
  deterministicExpressionKinds,
  evaluateExpression,
  randomExpressionKinds,
  type EvalEnv,
} from "./evaluate";
import type { OutcomeValue, RpExpressionView, TemplateDeclarationView } from "./types";
import { coerceScalar, singleBoolean, toOutcomeValue, type MaybeRpValue } from "./values";

export interface TemplateConditionBranch {
  readonly expression: RpExpressionView;
  readonly rules: readonly TemplateRuleView[];
}

export interface TemplateRuleView {
  readonly kind: string;
  readonly identifier?: string;
  readonly expression?: RpExpressionView;
  readonly templateIf?: TemplateConditionBranch;
  readonly templateElseIfs?: readonly TemplateConditionBranch[];
  readonly templateElse?: { readonly rules: readonly TemplateRuleView[] };
}

export interface TemplateProcessingView {
  readonly rules: readonly TemplateRuleView[];
}

export interface TemplateProcessingContext {
  readonly templateDeclarations: readonly TemplateDeclarationView[];
  readonly responseDeclarations: readonly ResponseDeclarationView[];
  readonly seed: number;
}

export interface TemplateProcessingResult {
  readonly templateValues: Readonly<Record<string, OutcomeValue>>;
  /** correctResponse values set by setCorrectResponse, keyed by response identifier. */
  readonly correctResponseOverrides: Readonly<Record<string, CorrectResponseView>>;
  readonly issues: readonly CapabilityIssue[];
}

const supportedTemplateRuleKinds = new Set([
  "setTemplateValue",
  "templateCondition",
  "templateConstraint",
  "setCorrectResponse",
  "exitTemplate",
]);

const templateExpressionKinds = new Set([...deterministicExpressionKinds, ...randomExpressionKinds]);

class ExitTemplateSignal extends Error {}

class TemplateConstraintSignal extends Error {}

/** Redraw budget before an unsatisfied templateConstraint falls back to defaults. */
const maxConstraintAttempts = 100;

/** mulberry32: a tiny, fast, seeded PRNG — deterministic across platforms. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function executeTemplateProcessing(
  view: TemplateProcessingView | undefined,
  context: TemplateProcessingContext,
): TemplateProcessingResult {
  const issues: CapabilityIssue[] = [];
  const declarationsById = new Map(context.templateDeclarations.map((entry) => [entry.identifier, entry]));
  const responseDeclarationsById = new Map(context.responseDeclarations.map((entry) => [entry.identifier, entry]));
  const correctResponseOverrides: Record<string, CorrectResponseView> = {};

  function initialValues(): Map<string, MaybeRpValue> {
    const values = new Map<string, MaybeRpValue>();

    for (const declaration of context.templateDeclarations) {
      values.set(
        declaration.identifier,
        declaration.defaultValue
          ? {
              cardinality: declaration.cardinality,
              baseType: declaration.baseType,
              values: declaration.defaultValue.values.map((entry) => coerceScalar(entry.value, declaration.baseType)),
            }
          : null,
      );
    }

    return values;
  }

  let templateValues = initialValues();

  const env: EvalEnv = {
    lookupVariable: (identifier) => templateValues.get(identifier) ?? null,
    responseDeclaration: (identifier) => responseDeclarationsById.get(identifier),
    responseValue: () => null, // no candidate responses exist at template-processing time
    random: mulberry32(context.seed),
  };

  function branchTaken(branch: TemplateConditionBranch): boolean {
    if (singleBoolean(evaluateExpression(branch.expression, env)) !== true) {
      return false;
    }

    executeRules(branch.rules);

    return true;
  }

  function executeRules(rules: readonly TemplateRuleView[]): void {
    for (const rule of rules) {
      if (!supportedTemplateRuleKinds.has(rule.kind)) {
        throw new RpUnsupportedError(rule.kind);
      }

      if (rule.kind === "exitTemplate") {
        throw new ExitTemplateSignal();
      }

      if (rule.kind === "setTemplateValue") {
        if (rule.identifier !== undefined && rule.expression !== undefined) {
          const declaration = declarationsById.get(rule.identifier);
          const value = evaluateExpression(rule.expression, env);

          // Keep the declared typing on the stored value when one exists.
          templateValues.set(
            rule.identifier,
            value === null || !declaration
              ? value
              : {
                  cardinality: declaration.cardinality,
                  baseType: declaration.baseType ?? value.baseType,
                  values: value.values,
                },
          );
        }
        continue;
      }

      if (rule.kind === "setCorrectResponse") {
        if (rule.identifier !== undefined && rule.expression !== undefined) {
          const value = evaluateExpression(rule.expression, env);

          if (value !== null) {
            correctResponseOverrides[rule.identifier] = {
              values: value.values.map((member) => ({ value: String(member) })),
            };
          }
        }
        continue;
      }

      if (rule.kind === "templateConstraint") {
        if (rule.expression !== undefined && singleBoolean(evaluateExpression(rule.expression, env)) !== true) {
          throw new TemplateConstraintSignal();
        }
        continue;
      }

      // templateCondition
      if (rule.templateIf && branchTaken(rule.templateIf)) {
        continue;
      }

      const elseIfTaken = (rule.templateElseIfs ?? []).some((branch) => branchTaken(branch));

      if (!elseIfTaken && rule.templateElse) {
        executeRules(rule.templateElse.rules);
      }
    }
  }

  for (let attempt = 0; attempt < maxConstraintAttempts; attempt += 1) {
    try {
      executeRules(view?.rules ?? []);
      break;
    } catch (error) {
      if (error instanceof TemplateConstraintSignal) {
        // Unsatisfied constraint: discard the partial clone and redraw — the PRNG
        // advances, so each attempt is a fresh deterministic draw. If the budget
        // runs out, the declared defaults stand (the spec's fallback).
        templateValues = initialValues();

        for (const key of Object.keys(correctResponseOverrides)) {
          delete correctResponseOverrides[key];
        }

        continue;
      }

      if (error instanceof RpUnsupportedError) {
        issues.push({ type: "unsupported-rp", name: error.kindName });
        templateValues = initialValues(); // abort, never a partial clone
      } else if (!(error instanceof ExitTemplateSignal)) {
        throw error;
      }

      break;
    }
  }

  return {
    templateValues: Object.fromEntries(
      [...templateValues].map(([identifier, value]) => [identifier, toOutcomeValue(value)]),
    ),
    correctResponseOverrides,
    issues,
  };
}

/** The effective response declarations for a clone: setCorrectResponse overrides applied. */
export function applyCorrectResponseOverrides(
  declarations: readonly ResponseDeclarationView[],
  overrides: Readonly<Record<string, CorrectResponseView>>,
): readonly ResponseDeclarationView[] {
  return declarations.map((declaration) => {
    const override = overrides[declaration.identifier];

    return override ? { ...declaration, correctResponse: override } : declaration;
  });
}

/** Static coverage walk for `canDeliver` over a templateProcessing tree. */
export function collectTemplateIssues(view: TemplateProcessingView | undefined): readonly CapabilityIssue[] {
  if (!view) {
    return [];
  }

  const issues: CapabilityIssue[] = [];
  const seen = new Set<string>();

  function report(name: string): void {
    if (!seen.has(name)) {
      seen.add(name);
      issues.push({ type: "unsupported-rp", name });
    }
  }

  function walkRules(rules: readonly TemplateRuleView[]): void {
    for (const rule of rules) {
      if (!supportedTemplateRuleKinds.has(rule.kind)) {
        report(rule.kind);
        continue;
      }

      if (rule.expression) {
        collectExpressionIssues(rule.expression, templateExpressionKinds, report);
      }

      for (const branch of [rule.templateIf, ...(rule.templateElseIfs ?? [])]) {
        if (branch) {
          collectExpressionIssues(branch.expression, templateExpressionKinds, report);
          walkRules(branch.rules);
        }
      }

      if (rule.templateElse) {
        walkRules(rule.templateElse.rules);
      }
    }
  }

  walkRules(view.rules);

  return issues;
}
