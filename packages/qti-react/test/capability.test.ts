import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { choiceInteraction } from "../src/interactions";
import { createQtiRuntime, type AssessmentItemView, type InteractionRenderProps } from "../src/runtime";

function NoopSkin(props: InteractionRenderProps): ReturnType<typeof createElement> {
  return createElement("div", { "data-rid": props.responseIdentifier });
}

const runtime = createQtiRuntime({
  interactions: [choiceInteraction],
  skin: { choiceInteraction: NoopSkin },
});

function itemWith(content: AssessmentItemView["itemBody"]["content"]): AssessmentItemView {
  return {
    responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "identifier" }],
    itemBody: { content },
  };
}

const supportedChoiceNode = {
  kind: "choiceInteraction",
  responseIdentifier: "RESPONSE",
  simpleChoices: [{ identifier: "A" }, { identifier: "B" }],
};

describe("canDeliver (the Capability Report, ADR-0003)", () => {
  test("fully supported item: deliverable with no issues", () => {
    const report = runtime.canDeliver(itemWith([{ kind: "xml", name: "p", value: "hi" }, supportedChoiceNode]));

    expect(report.deliverable).toBe(true);
    expect(report.issues).toEqual([]);
  });

  test("interaction kind with no descriptor is reported", () => {
    const report = runtime.canDeliver(itemWith([{ kind: "orderInteraction", responseIdentifier: "RESPONSE" }]));

    expect(report.deliverable).toBe(false);
    expect(report.issues).toEqual([
      { type: "unsupported-interaction", name: "orderInteraction", responseIdentifier: "RESPONSE" },
    ]);
  });

  test("interaction kind with a descriptor but no skin is reported", () => {
    const skinless = createQtiRuntime({ interactions: [choiceInteraction], skin: {} });
    const report = skinless.canDeliver(itemWith([supportedChoiceNode]));

    expect(report.deliverable).toBe(false);
    expect(report.issues[0]?.type).toBe("unsupported-interaction");
    expect(report.issues[0]?.name).toBe("choiceInteraction");
  });

  test("non-allowlisted content elements are reported (and deduplicated)", () => {
    const report = runtime.canDeliver(
      itemWith([
        { kind: "xml", name: "table", children: [{ kind: "xml", name: "td", value: "x" }] },
        { kind: "xml", name: "table", value: "again" },
      ]),
    );

    expect(report.deliverable).toBe(false);
    expect(report.issues).toEqual([
      { type: "unsupported-element", name: "table" },
      { type: "unsupported-element", name: "td" },
    ]);
  });

  test("a supported interaction node that fails its descriptor schema is reported", () => {
    const report = runtime.canDeliver(
      itemWith([{ kind: "choiceInteraction", responseIdentifier: "RESPONSE", simpleChoices: [] }]),
    );

    expect(report.deliverable).toBe(false);
    expect(report.issues[0]?.type).toBe("invalid-interaction");
    expect(report.issues[0]?.name).toBe("choiceInteraction");
    expect(report.issues[0]?.responseIdentifier).toBe("RESPONSE");
  });
});

describe("unsupported placeholder (no silent drops, ADR-0003)", () => {
  test("an unsupported interaction renders an explicit accessible placeholder", () => {
    const html = renderToStaticMarkup(
      createElement(runtime.ItemRenderer, {
        item: itemWith([{ kind: "hotspotInteraction", responseIdentifier: "RESPONSE" }]),
      }),
    );

    expect(html).toContain('data-qti-unsupported="hotspotInteraction"');
    expect(html).toContain('role="note"');
  });

  test("a custom renderUnsupported hook replaces the default placeholder", () => {
    const custom = createQtiRuntime({
      interactions: [],
      skin: {},
      renderUnsupported: (node) => createElement("em", { "data-custom": node.kind }, "todo"),
    });

    const html = renderToStaticMarkup(
      createElement(custom.ItemRenderer, {
        item: itemWith([{ kind: "sliderInteraction", responseIdentifier: "RESPONSE" }]),
      }),
    );

    expect(html).toContain('data-custom="sliderInteraction"');
    expect(html).not.toContain("data-qti-unsupported");
  });

  test("non-allowlisted flow elements are still dropped, not placeheld (sanitizer wins)", () => {
    const html = renderToStaticMarkup(
      createElement(runtime.ItemRenderer, {
        item: itemWith([{ kind: "xml", name: "script", value: "alert(1)" }]),
      }),
    );

    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("data-qti-unsupported");
  });
});
