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
import { collectResponseViolations } from "./response-validity";
import type { InteractionConstraint, ResponseViolation } from "./response-validity";
import {
  applyCorrectResponseOverrides,
  applyTemplateDefaultOverrides,
  executeResponseProcessing,
  executeTemplateProcessing,
  mulberry32,
} from "./rp";
import type {
  CustomOperatorImplementation,
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
  /**
   * Elapsed session seconds at the latest submit (the built-in `duration` response
   * variable handed to RP); null before the first submit. Persist it alongside the
   * responses for server-side replay parity (ADR-0004).
   */
  readonly durationSeconds: number | null;
  /**
   * Interaction constraints the current responses fail (see response-validity).
   * Always visible so UIs can explain themselves; submission is blocked on them
   * only under `validateResponses`.
   */
  readonly responseViolations: readonly ResponseViolation[];
}

/**
 * Consumer-supplied input. Optional members deliberately admit explicit
 * `undefined` ("undefined means not provided"), so callers can pass
 * maybe-undefined values straight through; the store reads every member
 * field-wise (`??`/`?.`) and never spread-merges options over defaults.
 */
export interface AttemptStoreOptions {
  readonly outcomeDeclarations?: readonly OutcomeDeclarationView[] | undefined;
  readonly responseProcessing?: ResponseProcessingView | undefined;
  /** The Response Normalization hook (ADR-0004); applies to scores and outcomes alike. */
  readonly normalization?: ResponseNormalization | undefined;
  readonly templateDeclarations?: readonly TemplateDeclarationView[] | undefined;
  readonly templateProcessing?: TemplateProcessingView | undefined;
  /**
   * Test-level `templateDefault` values (§5.152) overriding the template
   * declarations' defaults for this clone; the test session store supplies them from
   * the controller's recorded `templateDefaultValues`.
   */
  readonly templateDefaultValues?: Readonly<Record<string, OutcomeValue>> | undefined;
  /** Clone seed for template processing; store it to replay the same clone. */
  readonly seed?: number | undefined;
  /** QTI adaptive item: multiple attempts, outcome carry-over, completionStatus lock. */
  readonly adaptive?: boolean | undefined;
  /** Registered vendor `customOperator` implementations by class (opt-in). */
  readonly customOperators?: Readonly<Record<string, CustomOperatorImplementation>> | undefined;
  /**
   * Millisecond clock backing the built-in `duration` response variable (wall-clock
   * from session start to submit). Injectable for deterministic tests and replays;
   * defaults to Date.now.
   */
  readonly now?: (() => number) | undefined;
  /** The item's interaction constraints (collectInteractionConstraints over the body). */
  readonly constraints?: readonly InteractionConstraint[] | undefined;
  /**
   * ItemSessionControl validate-responses: "candidates are not allowed to submit the
   * item until they have provided valid responses for all interactions". When set,
   * submit() refuses while `responseViolations` is non-empty.
   */
  readonly validateResponses?: boolean | undefined;
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
  // Test-level templateDefault values replace the declared defaults for this clone.
  const templateDeclarations = options?.templateDefaultValues
    ? applyTemplateDefaultOverrides(options.templateDeclarations ?? [], options.templateDefaultValues)
    : (options?.templateDeclarations ?? []);
  const templateResult = options?.templateProcessing
    ? executeTemplateProcessing(options.templateProcessing, {
        templateDeclarations,
        responseDeclarations: declarations,
        seed,
        customOperators: options.customOperators,
      })
    : null;
  // The clone's effective declarations: setCorrectResponse overrides applied.
  const effectiveDeclarations = templateResult
    ? applyCorrectResponseOverrides(declarations, templateResult.correctResponseOverrides)
    : declarations;
  const declarationsById = new Map(effectiveDeclarations.map((declaration) => [declaration.identifier, declaration]));
  const listeners = new Set<() => void>();
  const responseCollectors = new Map<string, () => ResponseValue | undefined>();
  // RP's random stream: seed-derived but independent of template processing's, and
  // continuous across attempts — seed + submission sequence replays exact outcomes.
  const rpRandom = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const now = options?.now ?? Date.now;
  let sessionStartedAtMs = now();

  // The built-in completionStatus "starts with the reserved value 'not_attempted'.
  // At the start of the first attempt it changes to the reserved value 'unknown'."
  // (§2.2.2.3). The store exists only for a presented item, so its creation is the
  // start of the first attempt; "not_attempted" is the state of items that never got
  // a store. Explicit declarations (legacy content) keep the declared path.
  const completionStatusDeclared = (options?.outcomeDeclarations ?? []).some(
    (declaration) => declaration.identifier === "completionStatus",
  );
  const maintainedOutcomes = (): Readonly<Record<string, OutcomeValue>> =>
    completionStatusDeclared ? {} : { completionStatus: "unknown" };

  const violationsOf = (responses: Readonly<Record<string, ResponseValue>>): readonly ResponseViolation[] =>
    options?.constraints ? collectResponseViolations(options.constraints, responses) : [];

  let snapshot: AttemptSnapshot = {
    responses: { ...initialResponses },
    submitted: false,
    scores: [],
    outcomes: maintainedOutcomes(),
    templateValues: templateResult?.templateValues ?? {},
    attemptCount: 0,
    durationSeconds: null,
    responseViolations: violationsOf(initialResponses),
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
    durationSeconds: number,
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
      templateDeclarations,
      templateValues: snapshot.templateValues,
      priorOutcomes,
      random: rpRandom,
      customOperators: options.customOperators,
      // Built-in session variables: numAttempts "increases by 1 at the start of
      // each attempt", so the attempt being scored is included.
      duration: durationSeconds,
      numAttempts: snapshot.attemptCount + 1,
      ...(typeof snapshot.outcomes["completionStatus"] === "string"
        ? { completionStatus: snapshot.outcomes["completionStatus"] }
        : {}),
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

      const responses = { ...snapshot.responses, [responseIdentifier]: value };

      emit({
        ...snapshot,
        responses,
        responseViolations: violationsOf(responses),
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
        snapshot = { ...snapshot, responses: collected, responseViolations: violationsOf(collected) };
      }

      // "candidates are not allowed to submit the item until they have provided
      // valid responses for all interactions" — the refusal is visible through
      // `responseViolations`, never silent (ADR-0003).
      if (options?.validateResponses && snapshot.responseViolations.length > 0) {
        emit(snapshot);

        return snapshot.scores;
      }

      const scores = computeScores(snapshot.responses);
      const durationSeconds = (now() - sessionStartedAtMs) / 1000;
      const priorOutcomes = options?.adaptive && snapshot.attemptCount > 0 ? snapshot.outcomes : undefined;
      const rpOutcomes = computeOutcomes(snapshot.responses, durationSeconds, priorOutcomes);
      // Items without responseProcessing still carry the maintained built-in.
      const outcomes = options?.responseProcessing ? rpOutcomes : { ...maintainedOutcomes(), ...rpOutcomes };
      // completion_status: the corpus's snake_case authoring of the same built-in.
      const completionStatus = outcomes["completionStatus"] ?? outcomes["completion_status"];
      const completed = !options?.adaptive || completionStatus === "completed";

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
        durationSeconds,
      });

      return scores;
    },

    reset: () => {
      sessionStartedAtMs = now();

      emit({
        responses: { ...initialResponses },
        submitted: false,
        scores: [],
        outcomes: maintainedOutcomes(),
        templateValues: snapshot.templateValues,
        attemptCount: 0,
        durationSeconds: null,
        responseViolations: violationsOf(initialResponses),
      });
    },
  };
}
