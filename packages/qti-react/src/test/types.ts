/**
 * Structural views of QTI 3 `assessmentTest` and the Test Controller's session state
 * (ADR-0005). The controller owns the rules; everything in `TestSessionState` is plain
 * JSON so the consumer owns persistence — store the seed and the state, replay the
 * test.
 */

import type { CapabilityIssue } from "../capability";
import type { OutcomeDeclarationView, OutcomeValue, RpExpressionView } from "../rp";
import type { BodyNode } from "../runtime";
import type { ResponseValue } from "../types";

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

/**
 * "The default value of a template variable in an item can be overridden based on
 * the test context in which the template is instantiated." (§5.152) The expression
 * evaluates at test level (it may read other items' variables and test outcomes).
 */
export interface TemplateDefaultView {
  readonly templateIdentifier: string;
  readonly expression: RpExpressionView;
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
  readonly templateDefaults?: readonly TemplateDefaultView[];
}

export interface AssessmentSectionView {
  readonly kind: "assessmentSection";
  readonly identifier: string;
  readonly title?: string;
  readonly visible?: boolean;
  readonly fixed?: boolean;
  readonly required?: boolean;
  /**
   * For an invisible section under a shuffling parent: whether its children are
   * "shuffled as a block or mixed up with the other children of the parent section"
   * (§4.2.7). Default true (block).
   */
  readonly keepTogether?: boolean;
  readonly selection?: { readonly select: number; readonly withReplacement?: boolean };
  readonly ordering?: { readonly shuffle?: boolean };
  readonly preConditions?: readonly RpExpressionView[];
  readonly branchRules?: readonly BranchRuleView[];
  readonly itemSessionControl?: ItemSessionControlView;
  readonly timeLimits?: TimeLimitsView;
  readonly rubricBlocks?: readonly RubricBlockView[];
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
  readonly rubricBlocks?: readonly RubricBlockView[];
  readonly assessmentSections: readonly AssessmentSectionView[];
}

export interface TestFeedbackView {
  readonly access?: "atEnd" | "during";
  readonly outcomeIdentifier: string;
  readonly identifier: string;
  readonly showHide?: "show" | "hide";
  readonly content?: readonly BodyNode[];
}

/**
 * A rubric block (§4.2.4) carried on the test/part/section view: view-restricted rich content
 * (instructions, scoring guidance) shown to the audiences named in `view`. The block round-trips
 * structurally — any node fields beyond these (printedVariable, stylesheets, catalogInfo) pass
 * through the content converter unchanged.
 */
export interface RubricBlockView {
  readonly view: readonly string[];
  readonly use?: string;
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
  readonly rubricBlocks?: readonly RubricBlockView[];
  readonly testParts: readonly TestPartView[];
  readonly outcomeProcessing?: { readonly rules: readonly OutcomeRuleView[] };
  readonly testFeedbacks?: readonly TestFeedbackView[];
}

// ---------- The resolved delivery plan (selection + ordering applied) ----------

export interface TestPlanItem {
  /**
   * The session key: the ref identifier, or `identifier.n` when selection
   * with-replacement instantiates the ref more than once — the spec's own instance
   * addressing, where "a number that denotes the instance's place in the sequence of
   * the item's instantiation is inserted between the item variable identifier and
   * the item variable" (§2.11.1.2). Identifiers cannot contain periods, so the two
   * forms never collide.
   */
  readonly key: string;
  /** 1-based instantiation number; present only when the ref has multiple instances. */
  readonly instance?: number;
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
  /**
   * Whether the responses satisfy the interaction constraints (response-validity).
   * Under effective `validateResponses` in an individual-submission part, `false`
   * makes the controller refuse the submission ("candidates are not allowed to
   * submit the item until they have provided valid responses for all interactions").
   */
  readonly valid?: boolean;
  /**
   * The candidate's responses as submitted — recorded into the attempt history so
   * results reporting can emit `candidateResponse` values from persisted state.
   */
  readonly responses?: Readonly<Record<string, ResponseValue>>;
  /**
   * The submission instant (epoch ms). Controller-stamped: callers never set it;
   * it rides pending simultaneous results so the flush keeps submit-time stamps.
   */
  readonly submittedAtMs?: number;
}

/**
 * One committed attempt, recorded for results reporting: "A report may contain
 * multiple results for the same instance of an item representing multiple attempts
 * … each item result must have a different datestamp."
 */
export interface RecordedAttempt {
  /** Submission instant (epoch ms) — the itemResult datestamp. */
  readonly atMs: number;
  readonly outcomes: Readonly<Record<string, OutcomeValue>>;
  readonly responses?: Readonly<Record<string, ResponseValue>>;
  /** The item session's elapsed seconds at this submission, when reported. */
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
  /**
   * `suspended` stops every scope clock and blocks transitions until `resume()` —
   * the gap never accrues to any duration ("minus any time the session was in the
   * suspended state"). Pre-suspension persisted states only ever carry the other two.
   */
  readonly status: "in-progress" | "suspended" | "ended";
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
  /**
   * Evaluated `templateDefault` values per item key, recorded at the spec's times
   * (§5.152: linear — when the item first becomes current; nonlinear — at testPart
   * start) so item-store creation reads a stable, replayable value.
   */
  readonly templateDefaultValues?: Readonly<Record<string, Readonly<Record<string, OutcomeValue>>>>;
  /** Latest consumer-reported item-session duration per item key (feeds `ITEM.duration`). */
  readonly itemDurationSeconds?: Readonly<Record<string, number>>;
  readonly rejectedSubmissions?: readonly RejectedSubmission[];
  /**
   * Candidate comments per item key (allowComment): "feedback from the candidate to
   * the other actors in the assessment process", never part of the assessed responses.
   */
  readonly itemComments?: Readonly<Record<string, string>>;
  /** Committed attempts per item key, in submission order (results reporting). */
  readonly attemptHistory?: Readonly<Record<string, readonly RecordedAttempt[]>>;
}

export interface TestController {
  /** The assessment test view this controller was created from. */
  readonly test: AssessmentTestView;
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
  /**
   * Post-end review (allowReview): whether the candidate may re-enter the item
   * read-only — the session has ended, the item was presented, and its effective
   * allowReview permits it.
   */
  readonly canReview: (state: TestSessionState, itemKey: string) => boolean;
  /** Navigate review: sets the current item without reopening the ended session. */
  readonly review: (state: TestSessionState, itemKey: string) => TestSessionState;
  /** Whether a comment may be recorded: effective allowComment, session in progress. */
  readonly canComment: (state: TestSessionState, itemKey: string) => boolean;
  readonly setItemComment: (state: TestSessionState, itemKey: string, comment: string) => TestSessionState;
  /**
   * Suspend the session: folds the clock up to this instant (applying any expiry
   * that fold reveals), then stops it. Identity unless in progress.
   */
  readonly suspend: (state: TestSessionState) => TestSessionState;
  /**
   * Resume a suspended session: re-stamps the clock at the current instant without
   * folding the gap — suspended time never accrues. Identity unless suspended.
   */
  readonly resume: (state: TestSessionState) => TestSessionState;
}
