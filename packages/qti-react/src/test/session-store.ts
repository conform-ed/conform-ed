/**
 * The Test Session Store: glue between the headless Test Controller (ADR-0005) and
 * per-item Attempt Stores. It holds the controller's JSON session state, creates item
 * stores lazily with key-derived seeds (so every clone is replayable from the test
 * seed alone), and feeds item submissions back into the controller so test outcome
 * processing stays current. React-free — UI layers subscribe like any external store;
 * persistence stays with the consumer (store the seed and `snapshot.state`).
 */

import type { CustomOperatorImplementation, ResponseNormalization, TemplateRuleView } from "../rp";
import type { AssessmentItemView } from "../runtime";
import { createAttemptStore, type AttemptSnapshot, type AttemptStore } from "../store";
import { isResponseRecord } from "../types";
import type { ResponseValue } from "../types";

import type { AssessmentItemRefView, TestController, TestFeedbackView, TestPlanItem, TestSessionState } from "./types";

export interface TestSessionStoreOptions {
  /**
   * Resolve an item ref to its view. Synchronous by design: load the package's items
   * before mounting the session; return null for refs that cannot be delivered.
   */
  readonly resolveItem: (ref: AssessmentItemRefView) => AssessmentItemView | null;
  /** The test seed: drives plan resolution replay and derives per-item clone seeds. */
  readonly seed: number;
  /** Resume a persisted session (item responses are session-local, not part of it). */
  readonly initialState?: TestSessionState;
  readonly normalization?: ResponseNormalization;
  /** Registered vendor `customOperator` implementations by class (opt-in). */
  readonly customOperators?: Readonly<Record<string, CustomOperatorImplementation>>;
}

export interface TestSessionSnapshot {
  readonly state: TestSessionState;
  readonly currentItem: TestPlanItem | null;
  /** The resolved view for the current item, or null when unresolvable. */
  readonly currentItemView: AssessmentItemView | null;
  readonly visibleFeedbacks: readonly TestFeedbackView[];
}

export interface TestSessionStore {
  readonly controller: TestController;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => TestSessionSnapshot;
  /** The item's Attempt Store — created once per key, reused across navigation. */
  readonly itemStore: (itemKey: string) => AttemptStore | null;
  readonly itemView: (itemKey: string) => AssessmentItemView | null;
  readonly next: () => void;
  readonly canMoveTo: (itemKey: string) => boolean;
  readonly moveTo: (itemKey: string) => void;
  readonly end: () => void;
}

/** Identifiers whose correct response arrives via `setCorrectResponse` in templates. */
function collectCorrectResponseTargets(rules: readonly TemplateRuleView[] | undefined, into: Set<string>): void {
  for (const rule of rules ?? []) {
    if (rule.kind === "setCorrectResponse" && rule.identifier !== undefined) {
      into.add(rule.identifier);
    }

    for (const branch of [rule.templateIf, ...(rule.templateElseIfs ?? [])]) {
      if (branch) {
        collectCorrectResponseTargets(branch.rules, into);
      }
    }

    if (rule.templateElse) {
      collectCorrectResponseTargets(rule.templateElse.rules, into);
    }
  }
}

/** The response declarations an attempt can be "correct" about (incl. templated ones). */
function scorableIdentifiers(view: AssessmentItemView): Set<string> {
  const templated = new Set<string>();

  collectCorrectResponseTargets(view.templateProcessing?.rules, templated);

  return new Set(
    view.responseDeclarations
      .filter(
        (declaration) =>
          declaration.correctResponse !== undefined ||
          declaration.mapping !== undefined ||
          declaration.areaMapping !== undefined ||
          templated.has(declaration.identifier),
      )
      .map((declaration) => declaration.identifier),
  );
}

function hasResponse(value: ResponseValue): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  if (isResponseRecord(value)) {
    return Object.values(value).some((member) => member !== null && member !== "");
  }

  return !Array.isArray(value) || value.length > 0;
}

/** Derive the controller-facing correctness flags from a submitted attempt. */
function resultFlags(
  attempt: AttemptSnapshot,
  scorable: ReadonlySet<string>,
): { correct?: boolean; responded: boolean } {
  const relevant = attempt.scores.filter((score) => scorable.has(score.identifier));

  return {
    ...(relevant.length > 0 ? { correct: relevant.every((score) => score.correct) } : {}),
    responded: Object.values(attempt.responses).some(hasResponse),
  };
}

/** FNV-1a over the item key, mixed with the test seed: stable per-item clone seeds. */
function deriveItemSeed(seed: number, itemKey: string): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;

  for (let index = 0; index < itemKey.length; index += 1) {
    hash = Math.imul(hash ^ itemKey.charCodeAt(index), 0x01000193) >>> 0;
  }

  return hash;
}

export function createTestSessionStore(controller: TestController, options: TestSessionStoreOptions): TestSessionStore {
  const listeners = new Set<() => void>();
  const planItemsByKey = new Map<string, TestPlanItem>();

  for (const part of controller.plan.parts) {
    for (const item of part.items) {
      planItemsByKey.set(item.key, item);
    }
  }

  const itemViews = new Map<string, AssessmentItemView | null>();
  const itemStores = new Map<string, AttemptStore | null>();
  /** The last attempt snapshot forwarded per item — dedupes subscription firings. */
  const forwardedAttempts = new Map<string, unknown>();

  let state = options.initialState ?? controller.start();
  let snapshot = buildSnapshot();

  function buildSnapshot(): TestSessionSnapshot {
    const currentItem = controller.currentItem(state);

    return {
      state,
      currentItem,
      currentItemView: currentItem === null ? null : itemView(currentItem.key),
      visibleFeedbacks: controller.visibleTestFeedbacks(state),
    };
  }

  function emit(next: TestSessionState): void {
    state = next;
    snapshot = buildSnapshot();

    for (const listener of listeners) {
      listener();
    }
  }

  function itemView(itemKey: string): AssessmentItemView | null {
    if (!itemViews.has(itemKey)) {
      const planItem = planItemsByKey.get(itemKey);
      itemViews.set(itemKey, planItem ? options.resolveItem(planItem.ref) : null);
    }

    return itemViews.get(itemKey) ?? null;
  }

  function itemStore(itemKey: string): AttemptStore | null {
    if (itemStores.has(itemKey)) {
      return itemStores.get(itemKey) ?? null;
    }

    const view = itemView(itemKey);

    if (!view) {
      itemStores.set(itemKey, null);
      return null;
    }

    const store = createAttemptStore(
      view.responseDeclarations,
      {},
      {
        outcomeDeclarations: view.outcomeDeclarations,
        responseProcessing: view.responseProcessing,
        templateDeclarations: view.templateDeclarations,
        templateProcessing: view.templateProcessing,
        adaptive: view.adaptive,
        seed: deriveItemSeed(options.seed, itemKey),
        normalization: options.normalization,
        customOperators: options.customOperators,
      },
    );

    const scorable = scorableIdentifiers(view);

    // Every submitted snapshot flows into the controller, which decides what it means:
    // an attempt (individual), a pending revision (simultaneous), or a refusal
    // (maxAttempts spent) — refused results never reach session state.
    store.subscribe(() => {
      const attempt = store.getSnapshot();

      if (attempt.submitted && forwardedAttempts.get(itemKey) !== attempt) {
        forwardedAttempts.set(itemKey, attempt);

        const next = controller.submitItem(state, itemKey, {
          outcomes: attempt.outcomes,
          ...resultFlags(attempt, scorable),
          ...(view.adaptive === true ? { adaptive: true } : {}),
        });

        if (next !== state) {
          emit(next);
        }
      }
    });

    itemStores.set(itemKey, store);

    return store;
  }

  return {
    controller,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    itemStore,
    itemView,
    next: () => emit(controller.next(state)),
    canMoveTo: (itemKey) => controller.canMoveTo(state, itemKey),
    moveTo: (itemKey) => emit(controller.moveTo(state, itemKey)),
    end: () => emit(controller.end(state)),
  };
}
