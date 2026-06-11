import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { qtiCoreInteractions } from "../src/interactions";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type AssessmentItemView } from "../src/runtime";
import { createAttemptStore } from "../src/store";
import type { ResponseDeclarationView } from "../src/types";

const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });

function render(item: AssessmentItemView): string {
  return renderToStaticMarkup(createElement(runtime.ItemRenderer, { item }));
}

function deliverable(item: AssessmentItemView): boolean {
  return runtime.canDeliver(item).deliverable;
}

describe("extendedTextInteraction", () => {
  const item: AssessmentItemView = {
    responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "string" }],
    itemBody: {
      content: [
        {
          kind: "extendedTextInteraction",
          responseIdentifier: "RESPONSE",
          prompt: { content: [{ kind: "xml", name: "p", value: "Describe your weekend." }] },
          expectedLines: 5,
          placeholderText: "your answer",
        },
      ],
    },
  };

  test("is deliverable and renders a textarea with prompt", () => {
    expect(deliverable(item)).toBe(true);

    const html = render(item);

    expect(html).toContain("<textarea");
    expect(html).toContain('rows="5"');
    expect(html).toContain('placeholder="your answer"');
    expect(html).toContain("Describe your weekend.");
  });
});

describe("orderInteraction", () => {
  const item: AssessmentItemView = {
    responseDeclarations: [
      {
        identifier: "RESPONSE",
        cardinality: "ordered",
        baseType: "identifier",
        correctResponse: { values: [{ value: "FIRST" }, { value: "SECOND" }, { value: "THIRD" }] },
      },
    ],
    itemBody: {
      content: [
        {
          kind: "orderInteraction",
          responseIdentifier: "RESPONSE",
          simpleChoices: [
            { identifier: "SECOND", content: [{ kind: "xml", name: "span", value: "Boil water" }] },
            { identifier: "FIRST", content: [{ kind: "xml", name: "span", value: "Fill kettle" }] },
            { identifier: "THIRD", content: [{ kind: "xml", name: "span", value: "Pour tea" }] },
          ],
        },
      ],
    },
  };

  test("is deliverable and renders an ordered list with move controls", () => {
    expect(deliverable(item)).toBe(true);

    const html = render(item);

    expect(html).toContain("<ol");
    expect(html).toContain("Fill kettle");
    expect(html).toContain('aria-label="Move SECOND up"');
    expect(html).toContain('aria-label="Move SECOND down"');
  });

  test("ordered-cardinality scoring respects order", () => {
    const declarations = item.responseDeclarations;
    const store = createAttemptStore(declarations, {});

    store.setResponse("RESPONSE", ["FIRST", "SECOND", "THIRD"]);
    expect(store.submit()[0]?.correct).toBe(true);

    const wrong = createAttemptStore(declarations, {});

    wrong.setResponse("RESPONSE", ["SECOND", "FIRST", "THIRD"]);
    expect(wrong.submit()[0]?.correct).toBe(false);
  });
});

describe("hottextInteraction", () => {
  const item: AssessmentItemView = {
    responseDeclarations: [
      {
        identifier: "RESPONSE",
        cardinality: "multiple",
        baseType: "identifier",
        correctResponse: { values: [{ value: "H2" }] },
      },
    ],
    itemBody: {
      content: [
        {
          kind: "hottextInteraction",
          responseIdentifier: "RESPONSE",
          maxChoices: 2,
          content: [
            {
              kind: "xml",
              name: "p",
              children: [
                { kind: "xml", name: "span", value: "Click the verb: " },
                { kind: "hottext", identifier: "H1", content: [{ kind: "text", value: "cat" }] },
                { kind: "xml", name: "span", value: " " },
                { kind: "hottext", identifier: "H2", content: [{ kind: "text", value: "runs" }] },
              ],
            },
          ],
        },
      ],
    },
  };

  test("is deliverable and renders hottext spans nested in flow as toggle buttons", () => {
    expect(deliverable(item)).toBe(true);

    const html = render(item);

    expect(html).toContain("Click the verb:");
    // hottext nodes are nested inside a <p>: the override must reach them mid-flow.
    expect(html).toContain(">cat</button>");
    expect(html).toContain(">runs</button>");
    expect(html).toContain('role="checkbox"');
  });
});

describe("matchInteraction", () => {
  const declarations: readonly ResponseDeclarationView[] = [
    {
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "directedPair",
      correctResponse: { values: [{ value: "CAT 猫" }, { value: "DOG 犬" }] },
    },
  ];

  const item: AssessmentItemView = {
    responseDeclarations: declarations,
    itemBody: {
      content: [
        {
          kind: "matchInteraction",
          responseIdentifier: "RESPONSE",
          simpleMatchSets: [
            {
              simpleAssociableChoices: [
                { identifier: "CAT", content: [{ kind: "text", value: "cat" }] },
                { identifier: "DOG", content: [{ kind: "text", value: "dog" }] },
              ],
            },
            {
              simpleAssociableChoices: [
                { identifier: "猫", content: [{ kind: "text", value: "猫" }] },
                { identifier: "犬", content: [{ kind: "text", value: "犬" }] },
              ],
            },
          ],
        },
      ],
    },
  };

  test("is deliverable and renders a table grid of checkboxes", () => {
    expect(deliverable(item)).toBe(true);

    const html = render(item);

    expect(html).toContain("<table");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("cat");
    expect(html).toContain("猫");
  });

  test("directedPair scoring matches source-target pairs", () => {
    const store = createAttemptStore(declarations, {});

    store.setResponse("RESPONSE", ["CAT 猫", "DOG 犬"]);
    expect(store.submit()[0]?.correct).toBe(true);
  });
});

describe("associateInteraction", () => {
  const item: AssessmentItemView = {
    responseDeclarations: [
      {
        identifier: "RESPONSE",
        cardinality: "multiple",
        baseType: "pair",
        correctResponse: { values: [{ value: "A B" }] },
      },
    ],
    itemBody: {
      content: [
        {
          kind: "associateInteraction",
          responseIdentifier: "RESPONSE",
          simpleAssociableChoices: [
            { identifier: "A", content: [{ kind: "text", value: "Alpha" }] },
            { identifier: "B", content: [{ kind: "text", value: "Beta" }] },
            { identifier: "C", content: [{ kind: "text", value: "Gamma" }] },
          ],
        },
      ],
    },
  };

  test("is deliverable and renders a pair builder", () => {
    expect(deliverable(item)).toBe(true);

    const html = render(item);

    expect(html).toContain("<select");
    expect(html).toContain("Alpha");
    expect(html).toContain(">Add pair</button>");
  });
});

describe("gapMatchInteraction", () => {
  const item: AssessmentItemView = {
    responseDeclarations: [
      {
        identifier: "RESPONSE",
        cardinality: "multiple",
        baseType: "directedPair",
        correctResponse: { values: [{ value: "W1 G1" }] },
      },
    ],
    itemBody: {
      content: [
        {
          kind: "gapMatchInteraction",
          responseIdentifier: "RESPONSE",
          gapTexts: [
            { identifier: "W1", content: [{ kind: "text", value: "winter" }] },
            { identifier: "W2", content: [{ kind: "text", value: "summer" }] },
          ],
          content: [
            {
              kind: "xml",
              name: "p",
              children: [
                { kind: "xml", name: "span", value: "Snow falls in " },
                { kind: "gap", identifier: "G1" },
                { kind: "xml", name: "span", value: "." },
              ],
            },
          ],
        },
      ],
    },
  };

  test("is deliverable and renders gaps nested in flow as selects of gap texts", () => {
    expect(deliverable(item)).toBe(true);

    const html = render(item);

    expect(html).toContain("Snow falls in");
    expect(html).toContain("<select");
    expect(html).toContain(">winter</option>");
    expect(html).toContain(">summer</option>");
    expect(html).toContain('data-qti-gap="G1"');
  });
});

describe("registry completeness", () => {
  test("every core interaction has a reference skin", () => {
    for (const descriptor of qtiCoreInteractions) {
      expect(referenceSkin[descriptor.kind]).toBeDefined();
    }

    expect(qtiCoreInteractions.map((descriptor) => descriptor.kind).sort()).toEqual([
      "associateInteraction",
      "choiceInteraction",
      "extendedTextInteraction",
      "gapMatchInteraction",
      "hottextInteraction",
      "inlineChoiceInteraction",
      "matchInteraction",
      "orderInteraction",
      "textEntryInteraction",
    ]);
  });
});
