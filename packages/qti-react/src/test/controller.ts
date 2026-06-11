/**
 * The headless Test Controller (ADR-0005): given an assessmentTest view and a seed, it
 * resolves the delivery plan (seeded selection + ordering) once, then answers every
 * navigation, branching, and outcome-processing question as a pure transition over the
 * consumer-persisted session state. It owns no storage and renders nothing.
 */

import type { CapabilityIssue } from "../capability";
import {
  RpUnsupportedError,
  collectExpressionIssues,
  deterministicExpressionKinds,
  evaluateExpression,
  type EvalEnv,
} from "../rp/evaluate";
import { mulberry32 } from "../rp/template-processing";
import type { OutcomeValue, RpExpressionView } from "../rp/types";
import {
  coerceScalar,
  floatValue,
  fromFlatValue,
  isNumericBaseType,
  singleBoolean,
  toOutcomeValue,
  type MaybeRpValue,
  type RpValue,
} from "../rp/values";

import type {
  AssessmentItemRefView,
  AssessmentSectionView,
  AssessmentTestView,
  OutcomeConditionBranch,
  OutcomeRuleView,
  TestController,
  TestPlan,
  TestPlanItem,
  TestSessionState,
} from "./types";

const supportedOutcomeRuleKinds = new Set(["outcomeCondition", "setOutcomeValue", "exitTest"]);

const testExpressionKinds = new Set([...deterministicExpressionKinds, "testVariables"]);

class ExitTestSignal extends Error {}

function inferBaseType(value: unknown): string | undefined {
  if (typeof value === "number") {
    return "float";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  return undefined;
}

/** Lift a persisted flat value back into the typed model (cardinality inferred). */
function liftFlat(value: OutcomeValue): MaybeRpValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return fromFlatValue(value, "multiple", inferBaseType(value[0]));
  }

  return fromFlatValue(value, "single", inferBaseType(value));
}

// ---------- Plan resolution (seeded selection + ordering) ----------

type SectionChild = AssessmentSectionView | AssessmentItemRefView;

function seededPick<T>(pool: readonly T[], count: number, random: () => number): T[] {
  const indices = pool.map((_, index) => index);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));

    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }

  return indices
    .slice(0, Math.min(count, indices.length))
    .sort((a, b) => a - b) // selected children keep document order; ordering shuffles separately
    .map((index) => pool[index]!);
}

function applySelection(children: readonly SectionChild[], select: number, random: () => number): SectionChild[] {
  const required = children.filter((child) => child.required === true);
  const optional = children.filter((child) => child.required !== true);
  const needed = Math.max(0, select - required.length);
  const picked = new Set<SectionChild>([...required, ...seededPick(optional, needed, random)]);

  return children.filter((child) => picked.has(child));
}

function applyOrdering(children: readonly SectionChild[], random: () => number): SectionChild[] {
  // Fixed children keep their positions; the rest shuffle into the remaining slots.
  const result: (SectionChild | null)[] = children.map((child) => (child.fixed === true ? child : null));
  const movable = children.filter((child) => child.fixed !== true);
  const shuffled = seededPick(movable, movable.length, random);
  // seededPick preserves document order after picking; re-shuffle for ordering.
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));

    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  let cursor = 0;

  return result.map((slot) => slot ?? shuffled[cursor++]!);
}

function resolveSection(
  section: AssessmentSectionView,
  partIdentifier: string,
  sectionPath: readonly string[],
  inheritedPreConditions: readonly RpExpressionView[],
  random: () => number,
): TestPlanItem[] {
  const path = [...sectionPath, section.identifier];
  const preConditions = [...inheritedPreConditions, ...(section.preConditions ?? [])];

  let children: readonly SectionChild[] = section.children;

  if (section.selection) {
    children = applySelection(children, section.selection.select, random);
  }

  if (section.ordering?.shuffle) {
    children = applyOrdering(children, random);
  }

  const items: TestPlanItem[] = [];

  for (const child of children) {
    if (child.kind === "assessmentSection") {
      items.push(...resolveSection(child, partIdentifier, path, preConditions, random));
    } else {
      items.push({
        key: child.identifier,
        ref: child,
        partIdentifier,
        sectionPath: path,
        preConditions: [...preConditions, ...(child.preConditions ?? [])],
      });
    }
  }

  return items;
}

function resolvePlan(view: AssessmentTestView, seed: number): TestPlan {
  const random = mulberry32(seed);

  return {
    parts: view.testParts.map((part) => ({
      identifier: part.identifier,
      navigationMode: part.navigationMode,
      submissionMode: part.submissionMode,
      items: part.assessmentSections.flatMap((section) => resolveSection(section, part.identifier, [], [], random)),
    })),
  };
}

// ---------- The controller ----------

export interface TestControllerOptions {
  readonly seed: number;
}

export function createTestController(view: AssessmentTestView, options: TestControllerOptions): TestController {
  const plan = resolvePlan(view, options.seed);
  const allItems: TestPlanItem[] = plan.parts.flatMap((part) => [...part.items]);
  const partIndexByItemKey = new Map<string, number>();

  plan.parts.forEach((part, partIndex) => {
    for (const item of part.items) {
      partIndexByItemKey.set(item.key, partIndex);
    }
  });

  function defaultTestOutcomes(): Map<string, MaybeRpValue> {
    const outcomes = new Map<string, MaybeRpValue>();

    for (const declaration of view.outcomeDeclarations ?? []) {
      if (declaration.defaultValue) {
        outcomes.set(declaration.identifier, {
          cardinality: declaration.cardinality,
          baseType: declaration.baseType,
          values: declaration.defaultValue.values.map((entry) => coerceScalar(entry.value, declaration.baseType)),
        });
        continue;
      }

      outcomes.set(declaration.identifier, isNumericBaseType(declaration.baseType) ? floatValue(0) : null);
    }

    return outcomes;
  }

  function makeEnv(state: TestSessionState, outcomes?: Map<string, MaybeRpValue>): EvalEnv {
    return {
      lookupVariable: (identifier) => {
        const dot = identifier.indexOf(".");

        if (dot !== -1) {
          const itemKey = identifier.slice(0, dot);
          const variableName = identifier.slice(dot + 1);

          return liftFlat(state.itemOutcomes[itemKey]?.[variableName] ?? null);
        }

        if (outcomes?.has(identifier)) {
          return outcomes.get(identifier) ?? null;
        }

        return liftFlat(state.testOutcomes[identifier] ?? null);
      },
      responseDeclaration: () => undefined,
      responseValue: () => null,
      testVariables: (expression) => {
        // Contracts spell the variable `variableIdentifier` and categories as lists;
        // the bare `identifier`/string forms are accepted for hand-built views.
        const loose = expression as {
          variableIdentifier?: string;
          includeCategory?: unknown;
          excludeCategory?: unknown;
        };
        const variableName = loose.variableIdentifier ?? expression.identifier ?? "";
        const asList = (value: unknown): readonly string[] | undefined =>
          typeof value === "string" ? [value] : Array.isArray(value) ? (value as string[]) : undefined;
        const includeCategory = asList(loose.includeCategory);
        const excludeCategory = asList(loose.excludeCategory);
        const members: RpValue["values"][number][] = [];
        let baseType = expression.baseType;

        for (const item of allItems) {
          const categories = item.ref.categories ?? [];

          if (includeCategory !== undefined && !includeCategory.some((category) => categories.includes(category))) {
            continue;
          }

          if (excludeCategory !== undefined && excludeCategory.some((category) => categories.includes(category))) {
            continue;
          }

          const value = state.itemOutcomes[item.key]?.[variableName];

          if (value === undefined || value === null) {
            continue;
          }

          const lifted = liftFlat(value);

          if (lifted === null) {
            continue;
          }

          baseType ??= lifted.baseType;
          members.push(...lifted.values);
        }

        return members.length === 0 ? null : { cardinality: "multiple", baseType, values: members };
      },
    };
  }

  function conditionPasses(expression: RpExpressionView, state: TestSessionState): boolean {
    try {
      return singleBoolean(evaluateExpression(expression, makeEnv(state))) === true;
    } catch (error) {
      if (error instanceof RpUnsupportedError) {
        return true; // unsupported preconditions never hide content; surfaced via issues
      }

      throw error;
    }
  }

  function preConditionsPass(item: TestPlanItem, state: TestSessionState): boolean {
    return item.preConditions.every((expression) => conditionPasses(expression, state));
  }

  function runOutcomeProcessing(state: TestSessionState): Readonly<Record<string, OutcomeValue>> {
    let outcomes = defaultTestOutcomes();
    const env = makeEnv(state, outcomes);

    function branchTaken(branch: OutcomeConditionBranch): boolean {
      if (singleBoolean(evaluateExpression(branch.expression, env)) !== true) {
        return false;
      }

      executeRules(branch.rules);

      return true;
    }

    function executeRules(rules: readonly OutcomeRuleView[]): void {
      for (const rule of rules) {
        if (!supportedOutcomeRuleKinds.has(rule.kind)) {
          throw new RpUnsupportedError(rule.kind);
        }

        if (rule.kind === "exitTest") {
          throw new ExitTestSignal();
        }

        if (rule.kind === "setOutcomeValue") {
          if (rule.identifier !== undefined && rule.expression !== undefined) {
            outcomes.set(rule.identifier, evaluateExpression(rule.expression, env));
          }
          continue;
        }

        // outcomeCondition
        if (rule.outcomeIf && branchTaken(rule.outcomeIf)) {
          continue;
        }

        const elseIfTaken = (rule.outcomeElseIfs ?? []).some((branch) => branchTaken(branch));

        if (!elseIfTaken && rule.outcomeElse) {
          executeRules(rule.outcomeElse.rules);
        }
      }
    }

    try {
      executeRules(view.outcomeProcessing?.rules ?? []);
    } catch (error) {
      if (error instanceof RpUnsupportedError) {
        outcomes = defaultTestOutcomes(); // abort, never partial scoring
      } else if (!(error instanceof ExitTestSignal)) {
        throw error;
      }
    }

    return Object.fromEntries([...outcomes].map(([identifier, value]) => [identifier, toOutcomeValue(value)]));
  }

  /** The first item at or after (partIndex, itemIndex) whose preconditions pass. */
  function firstNavigable(state: TestSessionState, partIndex: number, itemIndex: number): TestPlanItem | null {
    for (let p = partIndex; p < plan.parts.length; p += 1) {
      const items = plan.parts[p]!.items;

      for (let i = p === partIndex ? itemIndex : 0; i < items.length; i += 1) {
        const item = items[i]!;

        if (preConditionsPass(item, state)) {
          return item;
        }
      }
    }

    return null;
  }

  function positionOf(itemKey: string): { partIndex: number; itemIndex: number } | null {
    const partIndex = partIndexByItemKey.get(itemKey);

    if (partIndex === undefined) {
      return null;
    }

    const itemIndex = plan.parts[partIndex]!.items.findIndex((item) => item.key === itemKey);

    return itemIndex === -1 ? null : { partIndex, itemIndex };
  }

  function ended(state: TestSessionState): TestSessionState {
    return { ...state, status: "ended", currentItemKey: null, testOutcomes: runOutcomeProcessing(state) };
  }

  function moveToItem(state: TestSessionState, item: TestPlanItem | null): TestSessionState {
    return item === null ? ended(state) : { ...state, currentItemKey: item.key };
  }

  // ---------- Static capability walk ----------

  const issues: CapabilityIssue[] = [];
  const seenIssues = new Set<string>();

  function report(name: string): void {
    if (!seenIssues.has(name)) {
      seenIssues.add(name);
      issues.push({ type: "unsupported-rp", name });
    }
  }

  function walkOutcomeRules(rules: readonly OutcomeRuleView[]): void {
    for (const rule of rules) {
      if (!supportedOutcomeRuleKinds.has(rule.kind)) {
        report(rule.kind);
        continue;
      }

      if (rule.expression) {
        collectExpressionIssues(rule.expression, testExpressionKinds, report);
      }

      for (const branch of [rule.outcomeIf, ...(rule.outcomeElseIfs ?? [])]) {
        if (branch) {
          collectExpressionIssues(branch.expression, testExpressionKinds, report);
          walkOutcomeRules(branch.rules);
        }
      }

      if (rule.outcomeElse) {
        walkOutcomeRules(rule.outcomeElse.rules);
      }
    }
  }

  walkOutcomeRules(view.outcomeProcessing?.rules ?? []);

  for (const item of allItems) {
    for (const expression of item.preConditions) {
      collectExpressionIssues(expression, testExpressionKinds, report);
    }

    for (const branchRule of item.ref.branchRules ?? []) {
      collectExpressionIssues(branchRule.expression, testExpressionKinds, report);
    }
  }

  // ---------- Public surface ----------

  return {
    plan,
    issues,

    start: () => {
      const initial: TestSessionState = {
        status: "in-progress",
        currentItemKey: null,
        itemOutcomes: {},
        attemptedItems: [],
        testOutcomes: {},
      };

      return moveToItem({ ...initial, testOutcomes: runOutcomeProcessing(initial) }, firstNavigable(initial, 0, 0));
    },

    currentItem: (state) =>
      state.currentItemKey === null ? null : (allItems.find((item) => item.key === state.currentItemKey) ?? null),

    canMoveTo: (state, itemKey) => {
      if (state.status === "ended" || state.currentItemKey === null) {
        return false;
      }

      const current = positionOf(state.currentItemKey);
      const target = positionOf(itemKey);

      if (!current || !target || target.partIndex !== current.partIndex) {
        return false; // part boundaries are one-way; no cross-part jumps
      }

      if (plan.parts[current.partIndex]!.navigationMode !== "nonlinear") {
        return false;
      }

      return preConditionsPass(plan.parts[target.partIndex]!.items[target.itemIndex]!, state);
    },

    moveTo: (state, itemKey) => {
      const current = positionOf(state.currentItemKey ?? "");
      const target = positionOf(itemKey);

      if (
        state.status === "ended" ||
        !current ||
        !target ||
        target.partIndex !== current.partIndex ||
        plan.parts[current.partIndex]!.navigationMode !== "nonlinear"
      ) {
        return state;
      }

      return { ...state, currentItemKey: itemKey };
    },

    next: (state) => {
      if (state.status === "ended" || state.currentItemKey === null) {
        return state;
      }

      const current = positionOf(state.currentItemKey);

      if (!current) {
        return ended(state);
      }

      const currentItem = plan.parts[current.partIndex]!.items[current.itemIndex]!;

      // Branch rules: first matching rule wins.
      for (const branchRule of currentItem.ref.branchRules ?? []) {
        if (!conditionPasses(branchRule.expression, state)) {
          continue;
        }

        if (branchRule.target === "EXIT_TEST") {
          return ended(state);
        }

        if (branchRule.target === "EXIT_TESTPART") {
          return moveToItem(state, firstNavigable(state, current.partIndex + 1, 0));
        }

        if (branchRule.target === "EXIT_SECTION") {
          const items = plan.parts[current.partIndex]!.items;
          const sectionKey = currentItem.sectionPath.join("/");
          let index = current.itemIndex + 1;

          while (index < items.length && items[index]!.sectionPath.join("/") === sectionKey) {
            index += 1;
          }

          return moveToItem(state, firstNavigable(state, current.partIndex, index));
        }

        const target = positionOf(branchRule.target);

        if (target && target.partIndex === current.partIndex) {
          return moveToItem(state, firstNavigable(state, target.partIndex, target.itemIndex));
        }
      }

      return moveToItem(state, firstNavigable(state, current.partIndex, current.itemIndex + 1));
    },

    submitItem: (state, itemKey, result) => {
      if (state.status === "ended") {
        return state;
      }

      const next: TestSessionState = {
        ...state,
        itemOutcomes: { ...state.itemOutcomes, [itemKey]: result.outcomes },
        attemptedItems: state.attemptedItems.includes(itemKey)
          ? state.attemptedItems
          : [...state.attemptedItems, itemKey],
      };

      return { ...next, testOutcomes: runOutcomeProcessing(next) };
    },

    end: (state) => (state.status === "ended" ? state : ended(state)),

    visibleTestFeedbacks: (state) =>
      (view.testFeedbacks ?? []).filter((feedback) => {
        const accessOk = (feedback.access ?? "atEnd") === (state.status === "ended" ? "atEnd" : "during");

        if (!accessOk) {
          return false;
        }

        const outcome = state.testOutcomes[feedback.outcomeIdentifier] ?? null;
        const matched = Array.isArray(outcome)
          ? outcome.map(String).includes(feedback.identifier)
          : outcome !== null && String(outcome) === feedback.identifier;

        return matched !== (feedback.showHide === "hide");
      }),
  };
}
