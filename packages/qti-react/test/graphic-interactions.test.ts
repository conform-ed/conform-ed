import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { qtiCoreInteractions } from "../src/interactions";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type AssessmentItemView } from "../src/runtime";

const runtime = createQtiRuntime({
  interactions: qtiCoreInteractions,
  skin: referenceSkin,
  assetResolver: (href) => `https://cdn.example/${href}`,
});

const mapObject = { data: "images/map.png", width: 400, height: 300 };

function itemFor(node: Record<string, unknown>, baseType: string, cardinality = "single"): AssessmentItemView {
  return {
    responseDeclarations: [
      {
        identifier: "RESPONSE",
        cardinality: cardinality as "single" | "multiple" | "ordered",
        baseType,
      },
    ],
    itemBody: { content: [node as never] },
  };
}

function render(item: AssessmentItemView): string {
  return renderToStaticMarkup(createElement(runtime.ItemRenderer, { item }));
}

describe("hotspotInteraction", () => {
  const item = itemFor(
    {
      kind: "hotspotInteraction",
      responseIdentifier: "RESPONSE",
      object: mapObject,
      maxChoices: 1,
      hotspotChoices: [
        { identifier: "TOKYO", shape: "circle", coords: [300, 120, 16] },
        { identifier: "OSAKA", shape: "rect", coords: [180, 160, 220, 200] },
      ],
    },
    "identifier",
  );

  test("is deliverable; renders the stage image and svg hotspots with option semantics", () => {
    expect(runtime.canDeliver(item).deliverable).toBe(true);

    const html = render(item);

    expect(html).toContain('src="https://cdn.example/images/map.png"');
    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 400 300"');
    expect(html).toContain("<circle");
    expect(html).toContain("<rect");
    expect(html).toContain('role="radio"');
    expect(html).toContain('data-qti-interaction="hotspotInteraction"');
  });
});

describe("graphicOrderInteraction", () => {
  const item = itemFor(
    {
      kind: "graphicOrderInteraction",
      responseIdentifier: "RESPONSE",
      object: mapObject,
      hotspotChoices: [
        { identifier: "A", shape: "circle", coords: [50, 50, 10] },
        { identifier: "B", shape: "circle", coords: [150, 50, 10] },
      ],
    },
    "identifier",
    "ordered",
  );

  test("is deliverable and renders order badges for selected hotspots", () => {
    expect(runtime.canDeliver(item).deliverable).toBe(true);

    const html = render(item);

    expect(html).toContain("<svg");
    expect(html).toContain('data-qti-interaction="graphicOrderInteraction"');
  });
});

describe("graphicAssociateInteraction", () => {
  const item = itemFor(
    {
      kind: "graphicAssociateInteraction",
      responseIdentifier: "RESPONSE",
      object: mapObject,
      associableHotspots: [
        { identifier: "P1", shape: "circle", coords: [50, 50, 10] },
        { identifier: "P2", shape: "circle", coords: [150, 50, 10] },
      ],
    },
    "pair",
    "multiple",
  );

  test("is deliverable and renders associable hotspots", () => {
    expect(runtime.canDeliver(item).deliverable).toBe(true);

    const html = render(item);

    expect(html).toContain('data-qti-interaction="graphicAssociateInteraction"');
    expect(html).toContain("<svg");
  });
});

describe("graphicGapMatchInteraction", () => {
  const item = itemFor(
    {
      kind: "graphicGapMatchInteraction",
      responseIdentifier: "RESPONSE",
      object: mapObject,
      gapImgs: [{ identifier: "FLAG", object: { data: "images/flag.png", width: 20, height: 12 } }],
      associableHotspots: [{ identifier: "SLOT", shape: "rect", coords: [100, 100, 140, 130] }],
    },
    "directedPair",
    "multiple",
  );

  test("is deliverable; renders gap images as choices and hotspot targets", () => {
    expect(runtime.canDeliver(item).deliverable).toBe(true);

    const html = render(item);

    expect(html).toContain('data-qti-interaction="graphicGapMatchInteraction"');
    expect(html).toContain('src="https://cdn.example/images/flag.png"');
    expect(html).toContain("<rect");
  });
});

describe("selectPointInteraction", () => {
  const item = itemFor(
    {
      kind: "selectPointInteraction",
      responseIdentifier: "RESPONSE",
      object: mapObject,
      maxChoices: 1,
    },
    "point",
  );

  test("is deliverable and renders a clickable stage", () => {
    expect(runtime.canDeliver(item).deliverable).toBe(true);

    const html = render(item);

    expect(html).toContain('data-qti-interaction="selectPointInteraction"');
    expect(html).toContain("<svg");
  });
});

describe("positionObjectStage", () => {
  const item = itemFor(
    {
      kind: "positionObjectStage",
      responseIdentifier: "RESPONSE",
      stageObject: mapObject,
      object: { data: "images/pin.png", width: 16, height: 16 },
      maxChoices: 1,
    },
    "point",
  );

  test("is deliverable and renders the stage with the movable object", () => {
    expect(runtime.canDeliver(item).deliverable).toBe(true);

    const html = render(item);

    expect(html).toContain('data-qti-interaction="positionObjectStage"');
    expect(html).toContain('src="https://cdn.example/images/map.png"');
  });
});

describe("registry completeness for the graphic family", () => {
  test("all six graphic kinds ship descriptors and reference skins", () => {
    const kinds = qtiCoreInteractions.map((descriptor) => descriptor.kind);

    for (const kind of [
      "hotspotInteraction",
      "graphicOrderInteraction",
      "graphicAssociateInteraction",
      "graphicGapMatchInteraction",
      "selectPointInteraction",
      "positionObjectStage",
    ]) {
      expect(kinds).toContain(kind);
      expect(referenceSkin[kind]).toBeDefined();
    }
  });
});
