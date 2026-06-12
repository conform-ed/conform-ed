/**
 * QTI Results Reporting — the export builder. Maps a session (test view + resolved
 * plan + persisted state) onto the AssessmentResult model: one final itemResult per
 * recorded attempt ("A report may contain multiple results for the same instance of
 * an item representing multiple attempts … each item result must have a different
 * datestamp"), pendingResponseProcessing for unflushed simultaneous submissions,
 * and initial entries for everything else — "all items selected for presentation
 * should be reported with a corresponding itemResult". The shapes mirror the
 * contracts result schema structurally; serialization to XML lives in qti-xml.
 */

import type { OutcomeDeclarationView, OutcomeValue } from "../rp";
import type { ResponseDeclarationView, ResponseValue } from "../types";
import type { AssessmentTestView, RecordedAttempt, TestPlan, TestPlanItem, TestSessionState } from "./types";

export interface ResultValueView {
  readonly value: string;
  /** Required for record-cardinality members, invalid otherwise (schema rule). */
  readonly fieldIdentifier?: string;
  readonly baseType?: string;
}

export interface ResultResponseVariableView {
  readonly identifier: string;
  readonly cardinality: string;
  readonly baseType?: string;
  readonly candidateResponse: { readonly values: readonly ResultValueView[] };
  readonly correctResponse?: { readonly values: readonly ResultValueView[] };
}

export interface ResultOutcomeVariableView {
  readonly identifier: string;
  readonly cardinality: string;
  readonly baseType?: string;
  readonly values: readonly ResultValueView[];
}

export type ResultSessionStatus =
  | "final"
  | "initial"
  | "pendingExternalScoring"
  | "pendingResponseProcessing"
  | "pendingSubmission";

export interface ItemResultView {
  readonly identifier: string;
  readonly sequenceIndex?: number;
  readonly datestamp: string;
  readonly sessionStatus: ResultSessionStatus;
  readonly responseVariables?: readonly ResultResponseVariableView[];
  readonly outcomeVariables?: readonly ResultOutcomeVariableView[];
  readonly candidateComment?: string;
}

export interface TestResultView {
  readonly identifier: string;
  readonly datestamp: string;
  readonly responseVariables?: readonly ResultResponseVariableView[];
  readonly outcomeVariables?: readonly ResultOutcomeVariableView[];
}

export interface ResultSessionIdentifierView {
  readonly sourceId: string;
  readonly identifier: string;
}

export interface ResultContextView {
  readonly sourcedId?: string;
  readonly sessionIdentifiers?: readonly ResultSessionIdentifierView[];
}

export interface AssessmentResultView {
  readonly context: ResultContextView;
  readonly testResult?: TestResultView;
  readonly itemResults?: readonly ItemResultView[];
}

export interface AssessmentResultDocumentView {
  readonly assessmentResult: AssessmentResultView;
}

export interface AssessmentResultItemDetails {
  readonly responseDeclarations?: readonly ResponseDeclarationView[];
  readonly outcomeDeclarations?: readonly OutcomeDeclarationView[];
  /** The clone's resolved correct responses (`AttemptSnapshot.correctResponses`). */
  readonly correctResponses?: Readonly<Record<string, ResponseValue>>;
}

export interface AssessmentResultInput {
  readonly test: AssessmentTestView;
  readonly plan: TestPlan;
  readonly state: TestSessionState;
  /** Result context (`sourcedId`, session identifiers); the consumer's identifiers. */
  readonly context?: ResultContextView;
  /** Export instant for the testResult datestamp (epoch ms; default Date.now()). */
  readonly nowMs?: number;
  /** Per-item typing and correct responses; omit (or return null) when unresolvable. */
  readonly itemDetails?: (item: TestPlanItem) => AssessmentResultItemDetails | null;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Flatten a stored value into result `value` entries (record members keep fields). */
function valueViews(value: OutcomeValue | ResponseValue): ResultValueView[] {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((member) => member !== null && member !== "").map((member) => ({ value: String(member) }));
  }

  if (typeof value === "object") {
    // Record values (arrays were handled above): members keep their field names.
    return Object.entries(value)
      .filter(([, member]) => member !== null && member !== "")
      .map(([fieldIdentifier, member]) => ({ fieldIdentifier, value: String(member) }));
  }

  return [{ value: String(value) }];
}

function inferBaseType(value: OutcomeValue | ResponseValue, identifier: string): string | undefined {
  const sample = Array.isArray(value) ? value[0] : value;

  if (typeof sample === "number") {
    return "float";
  }

  if (typeof sample === "boolean") {
    return "boolean";
  }

  if (identifier === "completionStatus" || identifier === "completion_status") {
    return "identifier"; // the built-in's declared type (§2.2.2.3)
  }

  return typeof sample === "string" ? "string" : undefined;
}

function outcomeVariablesOf(
  outcomes: Readonly<Record<string, OutcomeValue>>,
  declarations: readonly OutcomeDeclarationView[] | undefined,
): ResultOutcomeVariableView[] {
  return Object.entries(outcomes).map(([identifier, value]) => {
    const declaration = declarations?.find((entry) => entry.identifier === identifier);
    const cardinality = declaration?.cardinality ?? (Array.isArray(value) ? "multiple" : "single");
    const baseType = declaration?.baseType ?? inferBaseType(value, identifier);

    return {
      identifier,
      cardinality,
      // baseType must be omitted for record cardinality (schema rule).
      ...(baseType !== undefined && cardinality !== "record" ? { baseType } : {}),
      values: valueViews(value),
    };
  });
}

/** Durations are "a single float that records time in seconds" (RR base types). */
function durationVariable(identifier: string, seconds: number): ResultResponseVariableView {
  return {
    identifier,
    cardinality: "single",
    baseType: "duration",
    candidateResponse: { values: [{ value: String(seconds) }] },
  };
}

/** numAttempts is reported as the built-in response variable it is. */
function numAttemptsVariable(count: number): ResultResponseVariableView {
  return {
    identifier: "numAttempts",
    cardinality: "single",
    baseType: "integer",
    candidateResponse: { values: [{ value: String(count) }] },
  };
}

function responseVariablesOf(
  responses: Readonly<Record<string, ResponseValue>> | undefined,
  details: AssessmentResultItemDetails | null,
): ResultResponseVariableView[] {
  return Object.entries(responses ?? {}).map(([identifier, value]) => {
    const declaration = details?.responseDeclarations?.find((entry) => entry.identifier === identifier);
    const cardinality = declaration?.cardinality ?? (Array.isArray(value) ? "multiple" : "single");
    const baseType = declaration?.baseType;
    const correct = details?.correctResponses?.[identifier];
    const correctValues = correct === undefined ? [] : valueViews(correct);

    return {
      identifier,
      cardinality,
      ...(baseType !== undefined && cardinality !== "record" ? { baseType } : {}),
      candidateResponse: { values: valueViews(value) },
      // correctResponse requires at least one value (schema); omit when empty.
      ...(correctValues.length > 0 ? { correctResponse: { values: correctValues } } : {}),
    };
  });
}

export function buildAssessmentResult(input: AssessmentResultInput): AssessmentResultDocumentView {
  const { test, plan, state } = input;
  const nowMs = input.nowMs ?? Date.now();
  const timing = state.timing;

  const scopeDurations: ResultResponseVariableView[] = timing
    ? [
        durationVariable("duration", timing.testSeconds),
        ...plan.parts
          .filter((part) => timing.partSeconds[part.identifier] !== undefined)
          .map((part) => durationVariable(`${part.identifier}.duration`, timing.partSeconds[part.identifier]!)),
        ...Object.keys(plan.sections)
          .filter((identifier) => timing.sectionSeconds[identifier] !== undefined)
          .map((identifier) => durationVariable(`${identifier}.duration`, timing.sectionSeconds[identifier]!)),
      ]
    : [];
  const testOutcomes = outcomeVariablesOf(state.testOutcomes, test.outcomeDeclarations);
  const testResult: TestResultView = {
    identifier: test.identifier,
    datestamp: iso(nowMs),
    ...(scopeDurations.length > 0 ? { responseVariables: scopeDurations } : {}),
    ...(testOutcomes.length > 0 ? { outcomeVariables: testOutcomes } : {}),
  };

  const itemResults: ItemResultView[] = [];
  let sequenceIndex = 0;

  for (const part of plan.parts) {
    for (const item of part.items) {
      sequenceIndex += 1;

      const details = input.itemDetails?.(item) ?? null;
      const entries: ItemResultView[] = [];

      // One final itemResult per committed attempt, stamped with its submit instant.
      (state.attemptHistory?.[item.key] ?? []).forEach((attempt: RecordedAttempt, index) => {
        const outcomeVariables = outcomeVariablesOf(attempt.outcomes, details?.outcomeDeclarations);

        entries.push({
          identifier: item.key,
          sequenceIndex,
          datestamp: iso(attempt.atMs),
          sessionStatus: "final",
          responseVariables: [
            numAttemptsVariable(index + 1),
            ...(attempt.durationSeconds !== undefined ? [durationVariable("duration", attempt.durationSeconds)] : []),
            ...responseVariablesOf(attempt.responses, details),
          ],
          ...(outcomeVariables.length > 0 ? { outcomeVariables } : {}),
        });
      });

      // An unflushed simultaneous submission: responses are in, outcomes are not
      // committed until the part flushes — "after submission but before response
      // processing" (SessionStatusEnum).
      const pending = state.pendingItemResults?.[item.key];

      if (pending) {
        entries.push({
          identifier: item.key,
          sequenceIndex,
          datestamp: iso(pending.submittedAtMs ?? nowMs),
          sessionStatus: "pendingResponseProcessing",
          responseVariables: [
            numAttemptsVariable(1),
            ...(pending.durationSeconds !== undefined ? [durationVariable("duration", pending.durationSeconds)] : []),
            ...responseVariablesOf(pending.responses, details),
          ],
        });
      }

      if (entries.length === 0) {
        // "initial … can only be used to describe sessions for which the response
        // variable numAttempts is 0" — selected (in the plan) but never attempted.
        const itemSeconds = timing?.itemSeconds[item.key];

        entries.push({
          identifier: item.key,
          sequenceIndex,
          datestamp: iso(nowMs),
          sessionStatus: "initial",
          responseVariables: [
            numAttemptsVariable(0),
            ...(itemSeconds !== undefined ? [durationVariable("duration", itemSeconds)] : []),
          ],
        });
      }

      // The candidate's comment (allowComment) rides the item's latest result.
      const comment = state.itemComments?.[item.key];

      if (comment !== undefined) {
        entries[entries.length - 1] = { ...entries[entries.length - 1]!, candidateComment: comment };
      }

      itemResults.push(...entries);
    }
  }

  return {
    assessmentResult: {
      context: input.context ?? {},
      testResult,
      ...(itemResults.length > 0 ? { itemResults } : {}),
    },
  };
}

/** Reshape a normalized assessmentResult document into the typed view (import side). */
export function assessmentResultFromNormalized(document: unknown): AssessmentResultView | null {
  const root = (document as { assessmentResult?: AssessmentResultView } | null)?.assessmentResult;

  return root && typeof root === "object" ? root : null;
}
