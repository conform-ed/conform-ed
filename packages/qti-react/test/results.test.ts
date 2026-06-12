/**
 * QTI Results Reporting — the export side (RR spec §6.3): "The system MUST create an
 * instance with all of the REQUIRED properties and values; … The system MUST NOT
 * create an instance that contains any proprietary properties." The builder maps a
 * session (controller state + attempt history) onto the AssessmentResult model;
 * the contracts schema (strict, from the official XSD binding) is the gate.
 */

import { describe, expect, test } from "bun:test";

import { QtiAssessmentResultDocumentSchema } from "@conform-ed/contracts/qti/v3_0_1";

import { createTestController } from "../src/test";
import type { AssessmentTestView } from "../src/test";
import { assessmentResultFromNormalized, buildAssessmentResult } from "../src/test/results";

function itemRef(identifier: string, extra: Record<string, unknown> = {}) {
  return { kind: "assessmentItemRef" as const, identifier, ...extra };
}

const reported: AssessmentTestView = {
  identifier: "T-RR",
  outcomeDeclarations: [{ identifier: "TOTAL", cardinality: "single", baseType: "float" }],
  outcomeProcessing: {
    rules: [
      {
        kind: "setOutcomeValue",
        identifier: "TOTAL",
        expression: { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
      },
    ],
  },
  testParts: [
    {
      identifier: "P1",
      navigationMode: "linear",
      submissionMode: "individual",
      assessmentSections: [
        {
          kind: "assessmentSection",
          identifier: "S1",
          children: [
            itemRef("I1", { itemSessionControl: { maxAttempts: 2, allowComment: true } }),
            itemRef("I2"),
            itemRef("I3"),
          ],
        },
      ],
    },
  ],
};

const itemDetails = () => ({
  responseDeclarations: [
    {
      identifier: "RESPONSE",
      cardinality: "single" as const,
      baseType: "identifier",
      correctResponse: { values: [{ value: "B" }] },
    },
  ],
  outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single" as const, baseType: "float" }],
  correctResponses: { RESPONSE: "B" },
});

function runSession() {
  let nowMs = 1_000;
  const controller = createTestController(reported, { seed: 1, now: () => nowMs });
  let state = controller.start();

  nowMs = 5_000;
  state = controller.submitItem(state, "I1", {
    outcomes: { SCORE: 0, completionStatus: "completed" },
    responses: { RESPONSE: "A" },
    durationSeconds: 4,
  });
  nowMs = 9_000;
  state = controller.submitItem(state, "I1", {
    outcomes: { SCORE: 1, completionStatus: "completed" },
    responses: { RESPONSE: "B" },
    durationSeconds: 8,
  });
  state = controller.setItemComment(state, "I1", "Two tries needed.");
  state = controller.next(state);
  nowMs = 12_000;
  state = controller.submitItem(state, "I2", { outcomes: { SCORE: 1 }, responses: { RESPONSE: "B" } });
  nowMs = 15_000;
  state = controller.end(state); // I3 never presented

  return { controller, state };
}

describe("buildAssessmentResult (export)", () => {
  const { controller, state } = runSession();
  const document = buildAssessmentResult({
    test: reported,
    plan: controller.plan,
    state,
    context: { sourcedId: "learner-1", sessionIdentifiers: [{ sourceId: "https://example.org", identifier: "S-1" }] },
    nowMs: 20_000,
    itemDetails,
  });

  test("the produced document is valid under the strict contracts schema", () => {
    const parsed = QtiAssessmentResultDocumentSchema.safeParse(document);

    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  test("the testResult reports identity, durations, and test outcomes", () => {
    const testResult = document.assessmentResult.testResult!;

    expect(testResult.identifier).toBe("T-RR");
    expect(testResult.datestamp).toBe(new Date(20_000).toISOString());
    // Scope durations ride as responseVariables: bare test, PART.duration, SECTION.duration.
    expect(testResult.responseVariables).toEqual([
      {
        identifier: "duration",
        cardinality: "single",
        baseType: "duration",
        candidateResponse: { values: [{ value: "14" }] },
      },
      {
        identifier: "P1.duration",
        cardinality: "single",
        baseType: "duration",
        candidateResponse: { values: [{ value: "14" }] },
      },
      {
        identifier: "S1.duration",
        cardinality: "single",
        baseType: "duration",
        candidateResponse: { values: [{ value: "14" }] },
      },
    ]);
    expect(testResult.outcomeVariables).toEqual([
      { identifier: "TOTAL", cardinality: "single", baseType: "float", values: [{ value: "2" }] },
    ]);
  });

  test("each committed attempt becomes a final itemResult with its own datestamp", () => {
    const itemResults = document.assessmentResult.itemResults!;
    const first = itemResults.filter((entry) => entry.identifier === "I1");

    expect(first).toHaveLength(2);
    expect(first.map((entry) => entry.datestamp)).toEqual([
      new Date(5_000).toISOString(),
      new Date(9_000).toISOString(),
    ]);
    expect(first.every((entry) => entry.sessionStatus === "final")).toBe(true);
    expect(first.every((entry) => entry.sequenceIndex === 1)).toBe(true);

    const numAttempts = first.map(
      (entry) => entry.responseVariables?.find((variable) => variable.identifier === "numAttempts")?.candidateResponse,
    );

    expect(numAttempts).toEqual([{ values: [{ value: "1" }] }, { values: [{ value: "2" }] }]);

    const responses = first.map((entry) =>
      entry.responseVariables?.find((variable) => variable.identifier === "RESPONSE"),
    );

    expect(responses[0]?.candidateResponse).toEqual({ values: [{ value: "A" }] });
    expect(responses[1]?.candidateResponse).toEqual({ values: [{ value: "B" }] });
    expect(responses[1]?.correctResponse).toEqual({ values: [{ value: "B" }] });
    expect(responses[1]?.baseType).toBe("identifier");

    const durations = first.map(
      (entry) =>
        entry.responseVariables?.find((variable) => variable.identifier === "duration")?.candidateResponse.values,
    );

    expect(durations).toEqual([[{ value: "4" }], [{ value: "8" }]]);

    const scores = first.map(
      (entry) => entry.outcomeVariables?.find((variable) => variable.identifier === "SCORE")?.values,
    );

    expect(scores).toEqual([[{ value: "0" }], [{ value: "1" }]]);
    // The candidate's comment rides the last result for the item.
    expect(first[0]?.candidateComment).toBeUndefined();
    expect(first[1]?.candidateComment).toBe("Two tries needed.");
  });

  test("an item selected but never attempted is reported as 'initial' with numAttempts 0", () => {
    // Completeness (TestResult): "all items selected for presentation should be
    // reported with a corresponding itemResult." sessionStatus "initial" "can only
    // be used to describe sessions for which the response variable numAttempts is 0".
    const last = document.assessmentResult.itemResults!.find((entry) => entry.identifier === "I3")!;

    expect(last.sessionStatus).toBe("initial");
    expect(last.sequenceIndex).toBe(3);
    expect(
      last.responseVariables?.find((variable) => variable.identifier === "numAttempts")?.candidateResponse,
    ).toEqual({ values: [{ value: "0" }] });
    expect(last.outcomeVariables).toBeUndefined();
  });
});

describe("buildAssessmentResult: pending simultaneous submissions", () => {
  test("unflushed results are reported as pendingResponseProcessing, responses only", () => {
    const simultaneous: AssessmentTestView = {
      ...reported,
      outcomeDeclarations: [],
      outcomeProcessing: undefined as never,
      testParts: [{ ...reported.testParts[0]!, submissionMode: "simultaneous" }],
    };
    let nowMs = 0;
    const controller = createTestController(simultaneous, { seed: 1, now: () => nowMs });
    let state = controller.start();

    nowMs = 4_000;
    state = controller.submitItem(state, "I1", { outcomes: { SCORE: 1 }, responses: { RESPONSE: "A" } });

    const document = buildAssessmentResult({ test: simultaneous, plan: controller.plan, state, nowMs: 6_000 });
    const pending = document.assessmentResult.itemResults!.find((entry) => entry.identifier === "I1")!;

    expect(pending.sessionStatus).toBe("pendingResponseProcessing");
    expect(pending.datestamp).toBe(new Date(4_000).toISOString());
    expect(
      pending.responseVariables?.find((variable) => variable.identifier === "RESPONSE")?.candidateResponse,
    ).toEqual({ values: [{ value: "A" }] });
    expect(pending.outcomeVariables).toBeUndefined(); // not committed until the part flushes

    expect(QtiAssessmentResultDocumentSchema.safeParse(document).success).toBe(true);
  });
});

describe("assessmentResultFromNormalized (import)", () => {
  test("reshapes a normalized result document into the typed view", () => {
    const view = assessmentResultFromNormalized({
      assessmentResult: {
        context: { sourcedId: "learner-9" },
        itemResults: [{ identifier: "Q1", datestamp: "2026-06-12T00:00:00.000Z", sessionStatus: "final" }],
      },
    });

    expect(view?.context.sourcedId).toBe("learner-9");
    expect(view?.itemResults?.[0]?.identifier).toBe("Q1");
    expect(assessmentResultFromNormalized({ assessmentItem: {} })).toBeNull();
  });
});
