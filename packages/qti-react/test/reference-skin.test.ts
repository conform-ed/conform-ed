import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { qtiCoreInteractions } from "../src/interactions";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type AssessmentItemView } from "../src/runtime";

const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });

function render(item: AssessmentItemView): string {
  return renderToStaticMarkup(createElement(runtime.ItemRenderer, { item }));
}

describe("reference skin (ADR-0001): unstyled, semantic, a11y-correct", () => {
  test("registry covers every core interaction", () => {
    for (const descriptor of qtiCoreInteractions) {
      expect(referenceSkin[descriptor.kind]).toBeDefined();
    }
  });

  test("choiceInteraction renders a radiogroup of role=radio buttons with prompt and choice content", () => {
    const html = render({
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "identifier",
          correctResponse: { values: [{ value: "B" }] },
        },
      ],
      itemBody: {
        content: [
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            prompt: { content: [{ kind: "xml", name: "p", value: "Pick the best answer" }] },
            simpleChoices: [
              { identifier: "A", content: [{ kind: "xml", name: "span", value: "First" }] },
              { identifier: "B", content: [{ kind: "xml", name: "span", value: "Second" }] },
            ],
          },
        ],
      },
    });

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Pick the best answer");
    expect(html).toContain("First");
    expect(html).toContain("Second");
    expect(html).toContain('role="radio"');
    expect(html).toContain("<button");
    expect(html).toContain('data-qti-interaction="choiceInteraction"');
  });

  test("multiple-cardinality choice renders role=checkbox in a group", () => {
    const html = render({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "multiple", baseType: "identifier" }],
      itemBody: {
        content: [
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            simpleChoices: [{ identifier: "A" }, { identifier: "B" }],
          },
        ],
      },
    });

    expect(html).toContain('role="group"');
    expect(html).toContain('role="checkbox"');
  });

  test("textEntryInteraction renders a labelled text input", () => {
    const html = render({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "string" }],
      itemBody: {
        content: [
          {
            kind: "textEntryInteraction",
            responseIdentifier: "RESPONSE",
            placeholderText: "type here",
          },
        ],
      },
    });

    expect(html).toContain("<input");
    expect(html).toContain('type="text"');
    expect(html).toContain('placeholder="type here"');
    expect(html).toContain('data-qti-interaction="textEntryInteraction"');
  });

  test("inlineChoiceInteraction renders a select with one option per inline choice", () => {
    const html = render({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "identifier" }],
      itemBody: {
        content: [
          {
            kind: "inlineChoiceInteraction",
            responseIdentifier: "RESPONSE",
            inlineChoices: [
              { identifier: "X", content: [{ kind: "text", value: "ex" }] },
              { identifier: "Y", content: [{ kind: "text", value: "why" }] },
            ],
          },
        ],
      },
    });

    expect(html).toContain("<select");
    expect(html).toContain(">ex</option>");
    expect(html).toContain(">why</option>");
    expect(html).toContain('value="X"');
    expect(html).toContain('value="Y"');
  });
});
