/**
 * Structural views of QTI 3 `assessmentTest` and the Test Controller's session state
 * (ADR-0005). The controller owns the rules; everything in `TestSessionState` is plain
 * JSON so the consumer owns persistence — store the seed and the state, replay the
 * test.
 */

import type { CapabilityIssue } from "../capability";
import type { OutcomeDeclarationView, OutcomeValue, RpExpressionView } from "../rp";
import type { BodyNode } from "../runtime";

export interface BranchRuleView {
  /** A target identifier in the same test part, or EXIT_TEST / EXIT_TESTPART / EXIT_SECTION. */
  readonly target: string;
  readonly expression: RpExpressionView;
}

/**
 * QTI `itemSessionControl`: per-level overrides cascading testPart → section → itemRef.
 * The controller enforces `maxAttempts` and `allowSkipping`; the rest is surfaced for
 * delivery chrome (review/solution/comment affordances are UI concerns).
 */
export interface ItemSessionControlView {
  /** Attempts allowed per item; 0 means unlimited. Spec default: 1. */
  readonly maxAttempts?: number;
  readonly showFeedback?: boolean;
  readonly allowReview?: boolean;
  readonly showSolution?: boolean;
  readonly allowComment?: boolean;
  /** When false, the candidate must attempt the item before moving past it. */
  readonly allowSkipping?: boolean;
  readonly validateResponses?: boolean;
}

/**
 * QTI `timeLimits` (seconds). The controller enforces these under an injectable clock
 * (`TestControllerOptions.now`): expiry checks fold elapsed time at every transition,
 * and consumers drive their own timers by calling `tick()` (ADR-0005, "Timing and
 * time limits"). The values still surface on the plan for consumer-side countdowns.
 */
export interface TimeLimitsView {
  readonly minTime?: number;
  readonly maxTime?: number;
  readonly allowLateSubmission?: boolean;
}

export interface AssessmentItemRefView {
  readonly kind: "assessmentItemRef";
  readonly identifier: string;
  readonly href?: string;
  readonly categories?: readonly string[];
  readonly fixed?: boolean;
  readonly required?: boolean;
  readonly preConditions?: readonly RpExpressionView[];
  readonly branchRules?: readonly BranchRuleView[];
  readonly itemSessionControl?: ItemSessionControlView;
  readonly timeLimits?: TimeLimitsView;
  /** Named weights for `testVariables`/aggregate weighting (missing names weigh 1). */
  readonly weights?: ReadonlyArray<{ readonly identifier: string; readonly value: number }>;
}

export interface AssessmentSectionView {
  readonly kind: "assessmentSection";
  readonly identifier: string;
  readonly title?: string;
  readonly visible?: boolean;
  readonly fixed?: boolean;
  readonly required?: boolean;
  readonly selection?: { readonly select: number; readonly withReplacement?: boolean };
  readonly ordering?: { readonly shuffle?: boolean };
  readonly preConditions?: readonly RpExpressionView[];
  readonly branchRules?: readonly BranchRuleView[];
  readonly itemSessionControl?: ItemSessionControlView;
  readonly timeLimits?: TimeLimitsView;
  readonly children: ReadonlyArray<AssessmentSectionView | AssessmentItemRefView>;
}

export interface TestPartView {
  readonly identifier: string;
  readonly navigationMode: "linear" | "nonlinear";
  readonly submissionMode: "individual" | "simultaneous";
  readonly preConditions?: readonly RpExpressionView[];
  readonly branchRules?: readonly BranchRuleView[];
  readonly itemSessionControl?: ItemSessionControlView;
  readonly timeLimits?: TimeLimitsView;
  readonly assessmentSections: readonly AssessmentSectionView[];
}

export interface TestFeedbackView {
  readonly access?: "atEnd" | "during";
  readonly outcomeIdentifier: string;
  readonly identifier: string;
  readonly showHide?: "show" | "hide";
  readonly content?: readonly BodyNode[];
}

export interface OutcomeConditionBranch {
  readonly expression: RpExpressionView;
  readonly rules: readonly OutcomeRuleView[];
}

/**
 * One outcome rule: outcomeCondition, setOutcomeValue, lookupOutcomeValue,
 * outcomeProcessingFragment, or exitTest.
 */
export interface OutcomeRuleView {
  readonly kind: string;
  readonly identifier?: string;
  readonly expression?: RpExpressionView;
  /** Nested rules of an `outcomeProcessingFragment` (§5.103). */
  readonly rules?: readonly OutcomeRuleView[];
  readonly outcomeIf?: OutcomeConditionBranch;
  readonly outcomeElseIfs?: readonly OutcomeConditionBranch[];
  readonly outcomeElse?: { readonly rules: readonly OutcomeRuleView[] };
}

export interface AssessmentTestView {
  readonly identifier: string;
  readonly title?: string;
  readonly outcomeDeclarations?: readonly OutcomeDeclarationView[];
  readonly timeLimits?: TimeLimitsView;
  readonly testParts: readonly TestPartView[];
  readonly outcomeProcessing?: { readonly rules: readonly OutcomeRuleView[] };
  readonly testFeedbacks?: readonly TestFeedbackView[];
}

// ---------- The resolved delivery plan (selection + ordering applied) ----------

export interface TestPlanItem {
  /** The item ref identifier — unique within the test, used as the session key. */
  readonly key: string;
  readonly ref: AssessmentItemRefView;
  readonly partIdentifier: string;
  readonly sectionPath: readonly string[];
  /** The item's own preconditions plus its ancestor sections' (all must pass). */
  readonly preConditions: readonly RpExpressionView[];
  /** Effective session control: part → section → itemRef cascade over spec defaults. */
  readonly sessionControl: Required<ItemSessionControlView>;
  /** The item ref's own time limits (part/test limits live on their own levels). */
  readonly timeLimits?: TimeLimitsView;
}

export interface TestPlanPart {
  readonly identifier: string;
  readonly navigationMode: "linear" | "nonlinear";
  readonly submissionMode: "individual" | "simultaneous";
  readonly timeLimits?: TimeLimitsView;
  readonly items: readonly TestPlanItem[];
}

/** A section that survived selection, keyed for duration tracking and time limits. */
export interface TestPlanSection {
  readonly identifier: string;
  readonly timeLimits?: TimeLimitsView;
}

export interface TestPlan {
  readonly timeLimits?: TimeLimitsView;
  readonly parts: readonly TestPlanPart[];
  /** Every planned section by identifier (spec-unique across parts/sections/refs). */
  readonly sections: Readonly<Record<string, TestPlanSection>>;
}

// ---------- Session state (consumer-persisted, plain JSON) ----------

export interface TestItemResult {
  readonly outcomes: Readonly<Record<string, OutcomeValue>>;
  /**
   * Whether every scorable response variable matched (feeds numberCorrect /
   * numberIncorrect). Omit when the item has nothing to be correct about.
   */
  readonly correct?: boolean;
  /** The candidate gave at least one non-empty response (feeds numberResponded). */
  readonly responded?: boolean;
  /** Adaptive items manage their own attempt lifecycle, so maxAttempts is ignored (spec). */
  readonly adaptive?: boolean;
  /**
   * The item session's elapsed seconds (`AttemptSnapshot.durationSeconds`). Resolves
   * the built-in `ITEM.duration` in outcome processing; unreported → NULL.
   */
  readonly durationSeconds?: number;
}

/**
 * Wall-clock accounting folded at every controller transition (and `tick()`).
 * Durations are always "as of" `lastTransitionAtMs` — scoring and enforcement read
 * recorded state only (ADR-0004 determinism). Until a suspend/resume API exists,
 * these include all wall time between transitions.
 */
export interface TestTimingState {
  /** Injected-clock milliseconds at the last fold. */
  readonly lastTransitionAtMs: number;
  /** Whole-test seconds (the bare `duration` built-in, §2.8.5). */
  readonly testSeconds: number;
  /** Seconds per test-part identifier (`P1.duration`). */
  readonly partSeconds: Readonly<Record<string, number>>;
  /** Seconds per section identifier — a leaf accrues to every ancestor (`S2.duration`). */
  readonly sectionSeconds: Readonly<Record<string, number>>;
  /**
   * Seconds each item has been the current item — the enforcement clock for item
   * minTime/maxTime. The `ITEM.duration` variable reads the consumer report instead.
   */
  readonly itemSeconds: Readonly<Record<string, number>>;
}

export type TimingScopeRef =
  | { readonly kind: "test" }
  | { readonly kind: "part"; readonly identifier: string }
  | { readonly kind: "section"; readonly identifier: string }
  | { readonly kind: "item"; readonly key: string };

/** A late submission the controller refused (ADR-0003: no silent drops). */
export interface RejectedSubmission {
  readonly itemKey: string;
  /** The innermost exceeded scope whose allowLateSubmission did not permit it. */
  readonly scope: TimingScopeRef;
  /** Test-scope seconds at rejection (audit stamp on the session clock). */
  readonly atTestSeconds: number;
}

export interface TestSessionState {
  readonly status: "in-progress" | "ended";
  readonly currentItemKey: string | null;
  readonly itemOutcomes: Readonly<Record<string, Readonly<Record<string, OutcomeValue>>>>;
  readonly attemptedItems: readonly string[];
  readonly attemptCounts: Readonly<Record<string, number>>;
  /** Items that have been the current item at least once (feeds numberPresented). */
  readonly presentedItems: readonly string[];
  /** Items whose latest attempt carried a response (feeds numberResponded). */
  readonly respondedItems: readonly string[];
  /** Items whose latest attempt was correct / incorrect (feeds numberCorrect/Incorrect). */
  readonly correctItems: readonly string[];
  readonly incorrectItems: readonly string[];
  /**
   * Results held back in simultaneous-submission parts (QTI: the part's responses are
   * submitted together). They commit when the part is left or the test ends; until
   * then they are invisible to outcome processing and feedback.
   */
  readonly pendingItemResults: Readonly<Record<string, TestItemResult>>;
  readonly testOutcomes: Readonly<Record<string, OutcomeValue>>;
  /** Timing accumulators; absent on pre-timing persisted states (initialized lazily). */
  readonly timing?: TestTimingState;
  /** Latest consumer-reported item-session duration per item key (feeds `ITEM.duration`). */
  readonly itemDurationSeconds?: Readonly<Record<string, number>>;
  readonly rejectedSubmissions?: readonly RejectedSubmission[];
}

export interface TestController {
  readonly plan: TestPlan;
  /** Static capability issues found in outcome processing, preconditions, and branch rules. */
  readonly issues: readonly CapabilityIssue[];
  readonly start: () => TestSessionState;
  readonly currentItem: (state: TestSessionState) => TestPlanItem | null;
  readonly canMoveTo: (state: TestSessionState, itemKey: string) => boolean;
  readonly moveTo: (state: TestSessionState, itemKey: string) => TestSessionState;
  /** Whether `next()` would change state (false when allowSkipping blocks the move). */
  readonly canNext: (state: TestSessionState) => boolean;
  readonly next: (state: TestSessionState) => TestSessionState;
  /** Attempts left for the item under its effective maxAttempts (Infinity when unlimited). */
  readonly remainingAttempts: (state: TestSessionState, itemKey: string) => number;
  readonly canSubmitItem: (state: TestSessionState, itemKey: string) => boolean;
  readonly submitItem: (state: TestSessionState, itemKey: string, result: TestItemResult) => TestSessionState;
  readonly end: (state: TestSessionState) => TestSessionState;
  /**
   * Fold elapsed time into the recorded durations and apply any max-time expiries
   * (forced moves / forced end). Consumers run their own timers and call this;
   * identity once the session has ended (the clock stops at end).
   */
  readonly tick: (state: TestSessionState) => TestSessionState;
  readonly visibleTestFeedbacks: (state: TestSessionState) => readonly TestFeedbackView[];
}
