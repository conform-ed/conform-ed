/**
 * The response store the headless core owns (ADR-0001): it holds candidate responses
 * keyed by `responseIdentifier`, the submitted flag, and the scored outcomes. Skins are
 * controlled against it; they never own response state (only ephemeral UI state).
 *
 * Backed by an external store so `useSyncExternalStore` can subscribe with narrow,
 * snapshot-stable reads. No React import here — the hook lives in the runtime.
 *
 * Template processing runs once at store creation under the given seed (ADR-0004):
 * the seed is the replay key for a randomized clone. Adaptive items (`adaptive`)
 * support multiple attempts: outcomes carry over between RP runs and the item locks
 * only when `completionStatus` reaches "completed".
 */

import { scoreResponse } from "./response-processing";
import { applyCorrectResponseOverrides, executeResponseProcessing, executeTemplateProcessing } from "./rp";
import type {
  OutcomeDeclarationView,
  OutcomeValue,
  ResponseNormalization,
  ResponseProcessingView,
  TemplateDeclarationView,
  TemplateProcessingView,
} from "./rp";
import type { ResponseDeclarationView, ResponseValue, ScoreResult } from "./types";

export interface AttemptSnapshot {
  readonly responses: Readonly<Record<string, ResponseValue>>;
  readonly submitted: boolean;
  /** Per-response heuristic results backing the per-interaction feedback chrome. */
  readonly scores: readonly ScoreResult[];
  /** Item outcomes of record from the RP interpreter; empty before submit or without RP. */
  readonly outcomes: Readonly<Record<string, OutcomeValue>>;
  /** This clone's template variables (empty without templateProcessing). */
  readonly templateValues: Readonly<Record<string, OutcomeValue>>;
  /** Completed attempts so far (only ever exceeds 1 for adaptive items). */
  readonly attemptCount: number;
}

export interface AttemptStoreOptions {
  readonly outcomeDeclarations?: readonly OutcomeDeclarationView[];
  readonly responseProcessing?: ResponseProcessingView;
  /** The Response Normalization hook (ADR-0004); applies to scores and outcomes alike. */
  readonly normalization?: ResponseNormalization;
  readonly templateDeclarations?: readonly TemplateDeclarationView[];
  readonly templateProcessing?: TemplateProcessingView;
  /** Clone seed for template processing; store it to replay the same clone. */
  readonly seed?: number;
  /** QTI adaptive item: multiple attempts, outcome carry-over, completionStatus lock. */
  readonly adaptive?: boolean;
}

export interface AttemptStore {
  // Function-property signatures (not methods): these are bound arrow functions, safe to
  // pass by reference (e.g. to useSyncExternalStore).
  readonly getSnapshot: () => AttemptSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly setResponse: (responseIdentifier: string, value: ResponseValue) => void;
  /**
   * Imperative interactions (PCI) hold their response internally; a collector pulls it
   * at submit time, before scoring. Returning undefined leaves the response unchanged.
   * Returns the unregister function.
   */
  readonly registerResponseCollector: (
    responseIdentifier: string,
    collector: () => ResponseValue | undefined,
  ) => () => void;
  readonly submit: () => readonly ScoreResult[];
  readonly reset: () => void;
}

export function createAttemptStore(
  declarations: readonly ResponseDeclarationView[],
  initialResponses: Readonly<Record<string, ResponseValue>>,
  options?: AttemptStoreOptions,
): AttemptStore {
  const seed = options?.seed ?? Math.floor(Math.random() * 2 ** 31);
  const templateResult = options?.templateProcessing
    ? executeTemplateProcessing(options.templateProcessing, {
        templateDeclarations: options.templateDeclarations ?? [],
        responseDeclarations: declarations,
        seed,
      })
    : null;
  // The clone's effective declarations: setCorrectResponse overrides applied.
  const effectiveDeclarations = templateResult
    ? applyCorrectResponseOverrides(declarations, templateResult.correctResponseOverrides)
    : declarations;
  const declarationsById = new Map(effectiveDeclarations.map((declaration) => [declaration.identifier, declaration]));
  const listeners = new Set<() => void>();
  const responseCollectors = new Map<string, () => ResponseValue | undefined>();

  let snapshot: AttemptSnapshot = {
    responses: { ...initialResponses },
    submitted: false,
    scores: [],
    outcomes: {},
    templateValues: templateResult?.templateValues ?? {},
    attemptCount: 0,
  };

  function emit(next: AttemptSnapshot): void {
    snapshot = next;

    for (const listener of listeners) {
      listener();
    }
  }

  function computeScores(responses: Readonly<Record<string, ResponseValue>>): readonly ScoreResult[] {
    return [...declarationsById.values()].map((declaration) =>
      scoreResponse(declaration, responses[declaration.identifier] ?? null, options?.normalization),
    );
  }

  function computeOutcomes(
    responses: Readonly<Record<string, ResponseValue>>,
    priorOutcomes?: Readonly<Record<string, OutcomeValue>>,
  ): Readonly<Record<string, OutcomeValue>> {
    if (!options?.responseProcessing) {
      return {};
    }

    return executeResponseProcessing(options.responseProcessing, {
      responseDeclarations: effectiveDeclarations,
      outcomeDeclarations: options.outcomeDeclarations ?? [],
      responses,
      normalization: options.normalization,
      templateDeclarations: options.templateDeclarations,
      templateValues: snapshot.templateValues,
      priorOutcomes,
    }).outcomes;
  }

  // Arrow-function properties: inherently bound, so they can be passed by reference
  // (e.g. to useSyncExternalStore) without `this` hazards.
  return {
    getSnapshot: () => snapshot,

    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    setResponse: (responseIdentifier, value) => {
      if (snapshot.submitted) {
        return;
      }

      emit({
        ...snapshot,
        responses: { ...snapshot.responses, [responseIdentifier]: value },
      });
    },

    registerResponseCollector: (responseIdentifier, collector) => {
      responseCollectors.set(responseIdentifier, collector);

      return () => {
        if (responseCollectors.get(responseIdentifier) === collector) {
          responseCollectors.delete(responseIdentifier);
        }
      };
    },

    submit: () => {
      if (snapshot.submitted) {
        return snapshot.scores;
      }

      // Pull collector-held responses (PCI instances) before scoring.
      let collected = snapshot.responses;

      for (const [responseIdentifier, collector] of responseCollectors) {
        const value = collector();

        if (value !== undefined) {
          collected = { ...collected, [responseIdentifier]: value };
        }
      }

      if (collected !== snapshot.responses) {
        snapshot = { ...snapshot, responses: collected };
      }

      const scores = computeScores(snapshot.responses);
      const priorOutcomes = options?.adaptive && snapshot.attemptCount > 0 ? snapshot.outcomes : undefined;
      const outcomes = computeOutcomes(snapshot.responses, priorOutcomes);
      const completed = !options?.adaptive || outcomes["completionStatus"] === "completed";

      let responses = snapshot.responses;

      if (options?.adaptive && !completed) {
        // Between adaptive attempts, endAttempt-style boolean responses reset (spec:
        // endAttemptInteraction response variables are false at the start of an attempt).
        responses = { ...responses };

        for (const declaration of effectiveDeclarations) {
          if (declaration.baseType === "boolean") {
            responses = { ...responses, [declaration.identifier]: null };
          }
        }
      }

      emit({
        ...snapshot,
        responses,
        submitted: completed,
        scores,
        outcomes,
        attemptCount: snapshot.attemptCount + 1,
      });

      return scores;
    },

    reset: () => {
      emit({
        responses: { ...initialResponses },
        submitted: false,
        scores: [],
        outcomes: {},
        templateValues: snapshot.templateValues,
        attemptCount: 0,
      });
    },
  };
}
