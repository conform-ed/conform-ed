/**
 * The response store the headless core owns (ADR-0001): it holds candidate responses
 * keyed by `responseIdentifier`, the submitted flag, and the scored outcomes. Skins are
 * controlled against it; they never own response state (only ephemeral UI state).
 *
 * Backed by an external store so `useSyncExternalStore` can subscribe with narrow,
 * snapshot-stable reads. No React import here — the hook lives in the runtime.
 */

import { scoreResponse } from "./response-processing";
import type { ResponseDeclarationView, ResponseValue, ScoreResult } from "./types";

export interface AttemptSnapshot {
  readonly responses: Readonly<Record<string, ResponseValue>>;
  readonly submitted: boolean;
  readonly scores: readonly ScoreResult[];
}

export interface AttemptStore {
  // Function-property signatures (not methods): these are bound arrow functions, safe to
  // pass by reference (e.g. to useSyncExternalStore).
  readonly getSnapshot: () => AttemptSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly setResponse: (responseIdentifier: string, value: ResponseValue) => void;
  readonly submit: () => readonly ScoreResult[];
  readonly reset: () => void;
}

export function createAttemptStore(
  declarations: readonly ResponseDeclarationView[],
  initialResponses: Readonly<Record<string, ResponseValue>>,
): AttemptStore {
  const declarationsById = new Map(declarations.map((declaration) => [declaration.identifier, declaration]));
  const listeners = new Set<() => void>();

  let snapshot: AttemptSnapshot = {
    responses: { ...initialResponses },
    submitted: false,
    scores: [],
  };

  function emit(next: AttemptSnapshot): void {
    snapshot = next;

    for (const listener of listeners) {
      listener();
    }
  }

  function computeScores(responses: Readonly<Record<string, ResponseValue>>): readonly ScoreResult[] {
    return [...declarationsById.values()].map((declaration) =>
      scoreResponse(declaration, responses[declaration.identifier] ?? null),
    );
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

    submit: () => {
      const scores = computeScores(snapshot.responses);

      emit({ ...snapshot, submitted: true, scores });

      return scores;
    },

    reset: () => {
      emit({ responses: { ...initialResponses }, submitted: false, scores: [] });
    },
  };
}
