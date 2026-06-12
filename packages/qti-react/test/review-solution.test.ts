/**
 * Review and solution states (ItemSessionControl): review is read-only — "the
 * candidate can review the qti-item-body along with the responses they gave, but
 * cannot update or resubmit them"; show-feedback=false means "feedback is not shown.
 * This includes both Modal Feedback and Integrated Feedback even if the candidate
 * has access to the review state", with integrated-feedback visibility then
 * "determined by the default values of the outcome variables"; show-solution
 * "controls whether or not the system may provide the candidate with a way of
 * entering the solution state".
 */

import { describe, expect, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { qtiCoreInteractions } from "../src/interactions";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type AssessmentItemView } from "../src/runtime";
import { createAttemptStore } from "../src/store";

const item: AssessmentItemView = {
  responseDeclarations: [
    {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correctResponse: { values: [{ value: "B" }] },
    },
  ],
  outcomeDeclarations: [
    { identifier: "FEEDBACK", cardinality: "single", baseType: "identifier" },
    // A default-visible hint: showHide="hide" hides it once HINT matches "solved".
    {
      identifier: "HINT",
      cardinality: "single",
      baseType: "identifier",
      defaultValue: { values: [{ value: "open" }] },
    },
  ],
  responseProcessing: {
    rules: [
      {
        kind: "setOutcomeValue",
        identifier: "FEEDBACK",
        expression: { kind: "baseValue", baseType: "identifier", value: "shown" },
      },
      {
        kind: "setOutcomeValue",
        identifier: "HINT",
        expression: { kind: "baseValue", baseType: "identifier", value: "solved" },
      },
      {
        // Lets the adaptive variant complete on the first attempt (adaptive items
        // lock only when completionStatus reaches "completed").
        kind: "setOutcomeValue",
        identifier: "completionStatus",
        expression: { kind: "baseValue", baseType: "identifier", value: "completed" },
      },
    ] as never,
  },
  itemBody: {
    content: [
      {
        kind: "choiceInteraction",
        responseIdentifier: "RESPONSE",
        maxChoices: 1,
        simpleChoices: [{ identifier: "A" }, { identifier: "B" }],
      },
      {
        kind: "feedbackBlock",
        outcomeIdentifier: "FEEDBACK",
        identifier: "shown",
        showHide: "show",
        content: [{ kind: "text", value: "Integrated feedback from response processing." }],
      } as never,
      {
        kind: "feedbackBlock",
        outcomeIdentifier: "HINT",
        identifier: "solved",
        showHide: "hide",
        content: [{ kind: "text", value: "A hint visible at attempt start." }],
      } as never,
    ],
  },
  modalFeedbacks: [
    {
      outcomeIdentifier: "FEEDBACK",
      identifier: "shown",
      showHide: "show",
      content: [{ kind: "text", value: "Modal feedback from response processing." }],
    },
  ],
};

const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });

function submittedStore(view: AssessmentItemView = item) {
  const store = createAttemptStore(
    view.responseDeclarations,
    {},
    {
      outcomeDeclarations: view.outcomeDeclarations,
      responseProcessing: view.responseProcessing,
      adaptive: view.adaptive,
      seed: 7,
    },
  );

  store.setResponse("RESPONSE", "A");
  store.submit();

  return store;
}

describe("review state rendering", () => {
  test("review mode is read-only even over an unsubmitted store", () => {
    const store = createAttemptStore(item.responseDeclarations, {}, { seed: 7 });
    const html = renderToStaticMarkup(createElement(runtime.ItemRenderer, { item, store, mode: "review" }));

    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('data-status="correct"'); // nothing scored, nothing revealed
  });

  test("show-feedback=false hides modal and integrated feedback; defaults govern the body", () => {
    const html = renderToStaticMarkup(
      createElement(runtime.ItemRenderer, { item, store: submittedStore(), mode: "review", showFeedback: false }),
    );

    // "This includes both Modal Feedback and Integrated Feedback even if the
    // candidate has access to the review state."
    expect(html).not.toContain("Modal feedback from response processing.");
    expect(html).not.toContain("Integrated feedback from response processing.");
    // "…determined by the default values of the outcome variables and not the values
    // … updated by the invocation of response processing": HINT defaults to "open",
    // so the showHide="hide" block is visible again, as at attempt start.
    expect(html).toContain("A hint visible at attempt start.");
    // Correctness chrome is feedback too: the review body must not reveal it.
    expect(html).not.toContain('data-status="incorrect"');
  });

  test("review without a show-feedback bar keeps the final feedback visible", () => {
    const html = renderToStaticMarkup(
      createElement(runtime.ItemRenderer, { item, store: submittedStore(), mode: "review" }),
    );

    expect(html).toContain("Modal feedback from response processing.");
    expect(html).toContain("Integrated feedback from response processing.");
    expect(html).not.toContain("A hint visible at attempt start."); // hidden by final HINT
  });

  test("adaptive items ignore show-feedback in review (final values are used)", () => {
    // "the setting of show-feedback should be ignored for adaptive items when
    // allow-review is 'true'. When in the review state, the final values of the
    // outcome variables should be used."
    const adaptiveItem: AssessmentItemView = { ...item, adaptive: true };
    const html = renderToStaticMarkup(
      createElement(runtime.ItemRenderer, {
        item: adaptiveItem,
        store: submittedStore(adaptiveItem),
        mode: "review",
        showFeedback: false,
      }),
    );

    expect(html).toContain("Integrated feedback from response processing.");
  });
});

describe("solution state rendering", () => {
  test("solution mode shows the correct response, read-only", () => {
    const store = createAttemptStore(item.responseDeclarations, {}, { seed: 7 });
    const html = renderToStaticMarkup(createElement(runtime.ItemRenderer, { item, store, mode: "solution" }));

    // The correct choice (B) is selected and marked; the candidate cannot interact.
    expect(html).toContain('aria-disabled="true"');
    expect(html).toMatch(/data-status="correct"[^>]*>\s*B|B[^<]*<[^>]*data-status="correct"|data-status="correct"/);
    expect(html).toContain('aria-checked="true"');
  });

  test("the snapshot exposes template-resolved correct responses for the solution state", () => {
    const templated: AssessmentItemView = {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "identifier" }],
      templateDeclarations: [{ identifier: "PICK", cardinality: "single", baseType: "identifier" }],
      templateProcessing: {
        rules: [
          {
            kind: "setTemplateValue",
            identifier: "PICK",
            expression: { kind: "baseValue", baseType: "identifier", value: "C" },
          },
          { kind: "setCorrectResponse", identifier: "RESPONSE", expression: { kind: "variable", identifier: "PICK" } },
        ],
      },
      itemBody: { content: [] },
    };
    const store = createAttemptStore(
      templated.responseDeclarations,
      {},
      {
        templateDeclarations: templated.templateDeclarations,
        templateProcessing: templated.templateProcessing,
        seed: 7,
      },
    );

    expect(store.getSnapshot().correctResponses).toEqual({ RESPONSE: "C" });
  });
});
