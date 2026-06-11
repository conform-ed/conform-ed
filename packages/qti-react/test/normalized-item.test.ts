/**
 * The adapter from qti-xml's normalized JSON (the contracts vocabulary) to the
 * runtime's AssessmentItemView. The contracts shapes and the descriptor shapes
 * deliberately differ in places (kebab-case XML heritage vs runtime ergonomics);
 * this seam is where they reconcile, so every divergence gets a test.
 */

import { describe, expect, test } from "bun:test";

import { qtiCoreInteractions } from "../src/interactions";
import { assessmentItemViewFromNormalized } from "../src/normalized-item";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime } from "../src/runtime";

const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });

function viewOf(assessmentItem: Record<string, unknown>) {
  const view = assessmentItemViewFromNormalized({ assessmentItem });
  expect(view).not.toBeNull();
  return view!;
}

const baseDeclaration = { identifier: "RESPONSE", cardinality: "single", baseType: "identifier" };

describe("content reshaping", () => {
  test("bare string fragments become text nodes", () => {
    const view = viewOf({
      responseDeclarations: [baseDeclaration],
      itemBody: { content: [{ kind: "xml", name: "p", children: ["hello"] }] },
    });

    expect(view.itemBody.content?.[0]).toEqual({
      kind: "xml",
      name: "p",
      children: [{ kind: "text", value: "hello" }],
    });
  });

  test("hotTextInteraction and nested hotText rename to the runtime kinds", () => {
    const view = viewOf({
      responseDeclarations: [baseDeclaration],
      itemBody: {
        content: [
          {
            kind: "hotTextInteraction",
            responseIdentifier: "RESPONSE",
            maxChoices: 1,
            content: [
              {
                kind: "xml",
                name: "p",
                children: [{ kind: "hotText", identifier: "A", content: ["this"] }, " or that"],
              },
            ],
          },
        ],
      },
    });

    const interaction = view.itemBody.content?.[0] as Record<string, unknown>;
    expect(interaction["kind"]).toBe("hottextInteraction");
    const paragraph = (interaction["content"] as Array<Record<string, unknown>>)[0]!;
    const hottext = (paragraph["children"] as Array<Record<string, unknown>>)[0]!;
    expect(hottext["kind"]).toBe("hottext");

    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("graphic interactions: image becomes object, coords strings become numbers", () => {
    const image = {
      kind: "xml",
      name: "object",
      attributes: { data: "map.png", type: "image/png", width: "206", height: "280" },
    };
    const view = viewOf({
      responseDeclarations: [baseDeclaration],
      itemBody: {
        content: [
          {
            kind: "hotspotInteraction",
            responseIdentifier: "RESPONSE",
            maxChoices: 1,
            image,
            hotspotChoices: [{ kind: "hotspotChoice", identifier: "A", shape: "circle", coords: "77,115,8" }],
          },
        ],
      },
    });

    const interaction = view.itemBody.content?.[0] as Record<string, unknown>;
    expect(interaction["object"]).toEqual({ data: "map.png", type: "image/png", width: 206, height: 280 });
    expect((interaction["hotspotChoices"] as Array<Record<string, unknown>>)[0]).toMatchObject({
      identifier: "A",
      shape: "circle",
      coords: [77, 115, 8],
    });

    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("graphicGapMatch: gapImg choices become gapImgs with converted objects", () => {
    const view = viewOf({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "multiple", baseType: "directedPair" }],
      itemBody: {
        content: [
          {
            kind: "graphicGapMatchInteraction",
            responseIdentifier: "RESPONSE",
            image: { kind: "xml", name: "object", attributes: { data: "board.png", type: "image/png" } },
            gapChoices: [
              {
                kind: "gapImg",
                identifier: "GI",
                matchMax: 1,
                media: { kind: "xml", name: "object", attributes: { data: "piece.png", width: "10", height: "10" } },
              },
            ],
            associableHotspots: [
              { kind: "associableHotspot", identifier: "H1", matchMax: 1, shape: "rect", coords: "0,0,10,10" },
            ],
          },
        ],
      },
    });

    const interaction = view.itemBody.content?.[0] as Record<string, unknown>;
    expect((interaction["gapImgs"] as Array<Record<string, unknown>>)[0]).toMatchObject({
      identifier: "GI",
      object: { data: "piece.png", width: 10, height: 10 },
    });
    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("a picture-wrapped stage image resolves through its img child", () => {
    const view = viewOf({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "multiple", baseType: "pair" }],
      itemBody: {
        content: [
          {
            kind: "graphicAssociateInteraction",
            responseIdentifier: "RESPONSE",
            maxAssociations: 3,
            image: {
              kind: "xml",
              name: "picture",
              children: [
                { kind: "xml", name: "source", attributes: { srcset: "map.svg", type: "image/svg" } },
                { kind: "xml", name: "img", attributes: { src: "map.png", alt: "Map", width: "206", height: "280" } },
              ],
            },
            associableHotspots: [
              { kind: "associableHotspot", identifier: "A", shape: "circle", coords: "78,102,10", matchMax: 3 },
              { kind: "associableHotspot", identifier: "B", shape: "circle", coords: "117,171,10", matchMax: 3 },
            ],
          },
        ],
      },
    });

    const interaction = view.itemBody.content?.[0] as Record<string, unknown>;
    expect(interaction["object"]).toEqual({ data: "map.png", width: 206, height: 280 });
    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("graphicGapMatch: gapText choices become labeled tray entries", () => {
    const view = viewOf({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "multiple", baseType: "directedPair" }],
      itemBody: {
        content: [
          {
            kind: "graphicGapMatchInteraction",
            responseIdentifier: "RESPONSE",
            image: { kind: "xml", name: "object", attributes: { data: "tags.png", type: "image/png" } },
            gapChoices: [
              {
                kind: "gapText",
                identifier: "CBG",
                matchMax: 1,
                content: [{ kind: "xml", name: "strong", children: ["CBG"] }],
              },
            ],
            associableHotspots: [
              { kind: "associableHotspot", identifier: "A", matchMax: 1, shape: "rect", coords: "8,84,30,99" },
            ],
          },
        ],
      },
    });

    const interaction = view.itemBody.content?.[0] as Record<string, unknown>;
    expect((interaction["gapImgs"] as Array<Record<string, unknown>>)[0]).toMatchObject({
      identifier: "CBG",
      label: "CBG",
    });
    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("gapMatch: gapText choices become gapTexts", () => {
    const view = viewOf({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "multiple", baseType: "directedPair" }],
      itemBody: {
        content: [
          {
            kind: "gapMatchInteraction",
            responseIdentifier: "RESPONSE",
            gapChoices: [{ kind: "gapText", identifier: "W", matchMax: 1, content: ["winter"] }],
            content: [{ kind: "xml", name: "p", children: [{ kind: "gap", identifier: "G1" }] }],
          },
        ],
      },
    });

    const interaction = view.itemBody.content?.[0] as Record<string, unknown>;
    expect((interaction["gapTexts"] as Array<Record<string, unknown>>)[0]).toMatchObject({
      identifier: "W",
      matchMax: 1,
    });
    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("media: the media node becomes content; upload: acceptedTypes become type", () => {
    const view = viewOf({
      responseDeclarations: [
        { identifier: "R1", cardinality: "single", baseType: "integer" },
        { identifier: "R2", cardinality: "single", baseType: "file" },
      ],
      itemBody: {
        content: [
          {
            kind: "mediaInteraction",
            responseIdentifier: "R1",
            autostart: false,
            maxPlays: 2,
            media: { kind: "xml", name: "object", attributes: { data: "tree.mp3", type: "audio/mpeg" } },
          },
          { kind: "uploadInteraction", responseIdentifier: "R2", acceptedTypes: ["image/png"] },
        ],
      },
    });

    const [media, upload] = view.itemBody.content as Array<Record<string, unknown>>;
    expect((media!["content"] as unknown[])[0]).toMatchObject({ kind: "xml", name: "object" });
    expect(upload!["type"]).toBe("image/png");
    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("positionObjectStage with one interaction flattens to the runtime stage shape", () => {
    const view = viewOf({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "point" }],
      itemBody: {
        content: [
          {
            kind: "positionObjectStage",
            image: { kind: "xml", name: "object", attributes: { data: "map.png", width: "100", height: "100" } },
            positionObjectInteractions: [
              {
                kind: "positionObjectInteraction",
                responseIdentifier: "RESPONSE",
                image: { kind: "xml", name: "object", attributes: { data: "pin.png", width: "10", height: "10" } },
                maxChoices: 1,
              },
            ],
          },
        ],
      },
    });

    expect(view.itemBody.content?.[0]).toMatchObject({
      kind: "positionObjectStage",
      responseIdentifier: "RESPONSE",
      stageObject: { data: "map.png", width: 100, height: 100 },
      object: { data: "pin.png", width: 10, height: 10 },
      maxChoices: 1,
    });
    expect(runtime.canDeliver(view).issues).toEqual([]);
  });
});

describe("processing reshaping", () => {
  test("RP rules: children become expressions, actions become rules, responseElseIf pluralizes", () => {
    const view = viewOf({
      responseDeclarations: [baseDeclaration],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      itemBody: { content: [] },
      responseProcessing: {
        rules: [
          {
            kind: "responseCondition",
            responseIf: {
              kind: "responseIf",
              expression: {
                kind: "match",
                children: [
                  { kind: "variable", identifier: "RESPONSE" },
                  { kind: "correct", identifier: "RESPONSE" },
                ],
              },
              actions: [
                {
                  kind: "setOutcomeValue",
                  identifier: "SCORE",
                  expression: { kind: "baseValue", baseType: "float", value: "1" },
                },
              ],
            },
            responseElseIf: [
              {
                kind: "responseIf",
                expression: { kind: "isNull", children: [{ kind: "variable", identifier: "RESPONSE" }] },
                actions: [{ kind: "exitResponse" }],
              },
            ],
            responseElse: {
              kind: "responseElse",
              actions: [
                {
                  kind: "setOutcomeValue",
                  identifier: "SCORE",
                  expression: { kind: "baseValue", baseType: "float", value: "0" },
                },
              ],
            },
          },
        ],
      },
    });

    const rule = view.responseProcessing?.rules?.[0];
    expect(rule?.responseIf?.expression).toEqual({
      kind: "match",
      expressions: [
        { kind: "variable", identifier: "RESPONSE" },
        { kind: "correct", identifier: "RESPONSE" },
      ],
    });
    expect(rule?.responseIf?.rules).toEqual([
      {
        kind: "setOutcomeValue",
        identifier: "SCORE",
        expression: { kind: "baseValue", baseType: "float", value: "1" },
      },
    ]);
    expect(rule?.responseElseIfs?.[0]?.expression).toEqual({
      kind: "isNull",
      expressions: [{ kind: "variable", identifier: "RESPONSE" }],
    });
    expect(rule?.responseElse?.rules).toEqual([
      {
        kind: "setOutcomeValue",
        identifier: "SCORE",
        expression: { kind: "baseValue", baseType: "float", value: "0" },
      },
    ]);
    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("template processing converts the same way; declarations and modal feedbacks pass through", () => {
    const view = viewOf({
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "integer" }],
      outcomeDeclarations: [{ identifier: "FEEDBACK", cardinality: "single", baseType: "identifier" }],
      templateDeclarations: [{ identifier: "X", cardinality: "single", baseType: "integer" }],
      templateProcessing: {
        rules: [
          { kind: "setTemplateValue", identifier: "X", expression: { kind: "randomInteger", min: 1, max: 6 } },
          {
            kind: "templateCondition",
            templateIf: {
              kind: "templateIf",
              expression: {
                kind: "match",
                children: [
                  { kind: "variable", identifier: "X" },
                  { kind: "baseValue", baseType: "integer", value: "6" },
                ],
              },
              actions: [{ kind: "exitTemplate" }],
            },
          },
        ],
      },
      itemBody: { content: [] },
      modalFeedbacks: [
        {
          kind: "modalFeedback",
          outcomeIdentifier: "FEEDBACK",
          identifier: "A",
          showHide: "show",
          content: [{ kind: "xml", name: "p", children: ["Well done"] }],
        },
      ],
    });

    expect(view.templateDeclarations?.[0]?.identifier).toBe("X");
    const condition = view.templateProcessing?.rules[1];
    expect(condition?.templateIf?.expression.expressions?.[0]).toEqual({ kind: "variable", identifier: "X" });
    expect(condition?.templateIf?.rules).toEqual([{ kind: "exitTemplate" }]);
    expect(view.modalFeedbacks?.[0]?.identifier).toBe("A");
    expect(view.modalFeedbacks?.[0]?.content?.[0]).toMatchObject({ kind: "xml", name: "p" });
    expect(runtime.canDeliver(view).issues).toEqual([]);
  });

  test("areaMapping coords convert to numbers on response declarations", () => {
    const view = viewOf({
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "point",
          areaMapping: {
            defaultValue: 0,
            areaMapEntries: [{ shape: "circle", coords: "10,10,5", mappedValue: 2 }],
          },
        },
      ],
      itemBody: { content: [] },
    });

    expect(view.responseDeclarations[0]?.areaMapping?.areaMapEntries[0]).toEqual({
      shape: "circle",
      coords: [10, 10, 5],
      mappedValue: 2,
    });
  });
});
