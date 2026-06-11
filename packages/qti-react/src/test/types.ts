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

export interface AssessmentItemRefView {
  readonly kind: "assessmentItemRef";
  readonly identifier: string;
  readonly href?: string;
  readonly categories?: readonly string[];
  readonly fixed?: boolean;
  readonly required?: boolean;
  readonly preConditions?: readonly RpExpressionView[];
  readonly branchRules?: readonly BranchRuleView[];
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
  readonly children: ReadonlyArray<AssessmentSectionView | AssessmentItemRefView>;
}

export interface TestPartView {
  readonly identifier: string;
  readonly navigationMode: "linear" | "nonlinear";
  readonly submissionMode: "individual" | "simultaneous";
  readonly preConditions?: readonly RpExpressionView[];
  readonly branchRules?: readonly BranchRuleView[];
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

/** One outcome rule: outcomeCondition, setOutcomeValue, or exitTest. */
export interface OutcomeRuleView {
  readonly kind: string;
  readonly identifier?: string;
  readonly expression?: RpExpressionView;
  readonly outcomeIf?: OutcomeConditionBranch;
  readonly outcomeElseIfs?: readonly OutcomeConditionBranch[];
  readonly outcomeElse?: { readonly rules: readonly OutcomeRuleView[] };
}

export interface AssessmentTestView {
  readonly identifier: string;
  readonly title?: string;
  readonly outcomeDeclarations?: readonly OutcomeDeclarationView[];
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
}

export interface TestPlanPart {
  readonly identifier: string;
  readonly navigationMode: "linear" | "nonlinear";
  readonly submissionMode: "individual" | "simultaneous";
  readonly items: readonly TestPlanItem[];
}

export interface TestPlan {
  readonly parts: readonly TestPlanPart[];
}

// ---------- Session state (consumer-persisted, plain JSON) ----------

export interface TestItemResult {
  readonly outcomes: Readonly<Record<string, OutcomeValue>>;
}

export interface TestSessionState {
  readonly status: "in-progress" | "ended";
  readonly currentItemKey: string | null;
  readonly itemOutcomes: Readonly<Record<string, Readonly<Record<string, OutcomeValue>>>>;
  readonly attemptedItems: readonly string[];
  readonly testOutcomes: Readonly<Record<string, OutcomeValue>>;
}

export interface TestController {
  readonly plan: TestPlan;
  /** Static capability issues found in outcome processing, preconditions, and branch rules. */
  readonly issues: readonly CapabilityIssue[];
  readonly start: () => TestSessionState;
  readonly currentItem: (state: TestSessionState) => TestPlanItem | null;
  readonly canMoveTo: (state: TestSessionState, itemKey: string) => boolean;
  readonly moveTo: (state: TestSessionState, itemKey: string) => TestSessionState;
  readonly next: (state: TestSessionState) => TestSessionState;
  readonly submitItem: (state: TestSessionState, itemKey: string, result: TestItemResult) => TestSessionState;
  readonly end: (state: TestSessionState) => TestSessionState;
  readonly visibleTestFeedbacks: (state: TestSessionState) => readonly TestFeedbackView[];
}
