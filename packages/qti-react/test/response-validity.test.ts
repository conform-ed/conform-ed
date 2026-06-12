/**
 * Response validity (ItemSessionControl validate-responses): "An invalid response is
 * defined to be a response which does not satisfy the constraints imposed by the
 * interaction with which it is associated. When validate-responses is turned on
 * (true) then the candidates are not allowed to submit the item until they have
 * provided valid responses for all interactions."
 */

import { describe, expect, test } from "bun:test";

import { collectInteractionConstraints, collectResponseViolations } from "../src/response-validity";
import type { InteractionConstraint } from "../src/response-validity";
import type { BodyNode } from "../src/runtime";
import { createAttemptStore } from "../src/store";

const body = (nodes: unknown[]) => nodes as readonly BodyNode[];

describe("interaction constraint collection", () => {
  test("collects authored constraint attributes, including nested interactions", () => {
    const constraints = collectInteractionConstraints(
      body([
        {
          kind: "choiceInteraction",
          responseIdentifier: "R1",
          minChoices: 2,
          maxChoices: 3,
          simpleChoices: [{ identifier: "A" }, { identifier: "B" }, { identifier: "C" }, { identifier: "D" }],
        },
        {
          kind: "xml",
          name: "div",
          children: [{ kind: "textEntryInteraction", responseIdentifier: "R2", patternMask: "[A-Z]{3}" }],
        },
        {
          kind: "feedbackBlock",
          outcomeIdentifier: "FB",
          identifier: "x",
          content: [{ kind: "associateInteraction", responseIdentifier: "R3", minAssociations: 1 }],
        },
      ]),
    );

    expect(constraints).toEqual([
      { responseIdentifier: "R1", kind: "minChoices", bound: 2 },
      { responseIdentifier: "R1", kind: "maxChoices", bound: 3 },
      { responseIdentifier: "R2", kind: "patternMask", bound: "[A-Z]{3}" },
      { responseIdentifier: "R3", kind: "minAssociations", bound: 1 },
    ]);
  });

  test("zero bounds impose nothing: max* 0 is 'no restriction', min* 0 is 'not required'", () => {
    // "If max-choices is 0 then there is no restriction." / "If min-choices is 0 then
    // the candidate is not required to select any choices."
    const constraints = collectInteractionConstraints(
      body([
        {
          kind: "choiceInteraction",
          responseIdentifier: "R1",
          minChoices: 0,
          maxChoices: 0,
          simpleChoices: [{ identifier: "A" }],
        },
      ]),
    );

    expect(constraints).toEqual([]);
  });
});

describe("response violations", () => {
  const violationsFor = (
    constraint: Omit<InteractionConstraint, "responseIdentifier">,
    value: unknown,
  ): readonly unknown[] =>
    collectResponseViolations([{ responseIdentifier: "R", ...constraint }], { R: value as never });

  test("minChoices: 'the minimum number of choices that the candidate is required to select'", () => {
    expect(violationsFor({ kind: "minChoices", bound: 2 }, null)).toHaveLength(1);
    expect(violationsFor({ kind: "minChoices", bound: 2 }, ["A"])).toHaveLength(1);
    expect(violationsFor({ kind: "minChoices", bound: 2 }, ["A", "B"])).toEqual([]);
    expect(violationsFor({ kind: "minChoices", bound: 1 }, "A")).toEqual([]); // single cardinality
  });

  test("maxChoices: 'the maximum number of choices that the candidate is allowed to select'", () => {
    expect(violationsFor({ kind: "maxChoices", bound: 2 }, ["A", "B", "C"])).toHaveLength(1);
    expect(violationsFor({ kind: "maxChoices", bound: 2 }, ["A", "B"])).toEqual([]);
    expect(violationsFor({ kind: "maxChoices", bound: 2 }, null)).toEqual([]); // unanswered ≠ over the limit
  });

  test("minStrings counts 'separate (non-empty) strings'", () => {
    // "If the interaction is not bound to a container then … the candidate must
    // enter a non-empty string to form a valid response."
    expect(violationsFor({ kind: "minStrings", bound: 1 }, "")).toHaveLength(1);
    expect(violationsFor({ kind: "minStrings", bound: 1 }, "an answer")).toEqual([]);
    expect(violationsFor({ kind: "minStrings", bound: 2 }, ["a", "", "b"])).toEqual([]);
    expect(violationsFor({ kind: "minStrings", bound: 3 }, ["a", "", "b"])).toHaveLength(1);
  });

  test("patternMask: 'a regular expression that the candidate's response must match'", () => {
    expect(violationsFor({ kind: "patternMask", bound: "[A-Z]{3}" }, "AB1")).toHaveLength(1);
    expect(violationsFor({ kind: "patternMask", bound: "[A-Z]{3}" }, "ABC")).toEqual([]);
    // An unanswered interaction is governed by the min* constraints, not the pattern.
    expect(violationsFor({ kind: "patternMask", bound: "[A-Z]{3}" }, null)).toEqual([]);
    expect(violationsFor({ kind: "patternMask", bound: "[A-Z]{3}" }, "")).toEqual([]);
    // Every member of a container response must match.
    expect(violationsFor({ kind: "patternMask", bound: "[A-Z]{3}" }, ["ABC", "no"])).toHaveLength(1);
  });

  test("an uncompilable XSD pattern never blocks the candidate", () => {
    expect(violationsFor({ kind: "patternMask", bound: "[unclosed" }, "anything")).toEqual([]);
  });

  test("min/maxAssociations count the pairs the candidate made", () => {
    expect(violationsFor({ kind: "minAssociations", bound: 1 }, null)).toHaveLength(1);
    expect(violationsFor({ kind: "minAssociations", bound: 2 }, ["A B", "C D"])).toEqual([]);
    expect(violationsFor({ kind: "maxAssociations", bound: 1 }, ["A B", "C D"])).toHaveLength(1);
  });

  test("minPlays: 'failure to play the media object the minimum number of times constitutes an invalid response'", () => {
    expect(violationsFor({ kind: "minPlays", bound: 2 }, 1)).toHaveLength(1);
    expect(violationsFor({ kind: "minPlays", bound: 2 }, 2)).toEqual([]);
    expect(violationsFor({ kind: "minPlays", bound: 2 }, null)).toHaveLength(1);
  });
});

describe("attempt store validate-responses enforcement", () => {
  const declarations = [{ identifier: "R1", cardinality: "multiple" as const, baseType: "identifier" }];
  const constraints: readonly InteractionConstraint[] = [{ responseIdentifier: "R1", kind: "minChoices", bound: 2 }];

  test("submit refuses while a constraint is violated; violations stay visible", () => {
    const store = createAttemptStore(declarations, {}, { constraints, validateResponses: true });

    store.setResponse("R1", ["A"]);
    expect(store.getSnapshot().responseViolations).toEqual([
      { responseIdentifier: "R1", kind: "minChoices", bound: 2 },
    ]);

    store.submit();
    expect(store.getSnapshot().submitted).toBe(false); // "not allowed to submit … until valid"
    expect(store.getSnapshot().attemptCount).toBe(0);

    store.setResponse("R1", ["A", "B"]);
    expect(store.getSnapshot().responseViolations).toEqual([]);

    store.submit();
    expect(store.getSnapshot().submitted).toBe(true);
  });

  test("without validateResponses, violations are reported but never block", () => {
    const store = createAttemptStore(declarations, {}, { constraints });

    store.setResponse("R1", ["A"]);
    expect(store.getSnapshot().responseViolations).toHaveLength(1);

    store.submit();
    expect(store.getSnapshot().submitted).toBe(true); // "invalid responses may be accepted"
  });

  test("reset restores the initial responses' violations", () => {
    const store = createAttemptStore(declarations, {}, { constraints, validateResponses: true });

    store.setResponse("R1", ["A", "B"]);
    store.submit();
    store.reset();

    expect(store.getSnapshot().responseViolations).toHaveLength(1); // empty initial responses
  });
});
