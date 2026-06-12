/**
 * QTI 3.0.1 assessment-item normalization: every content element the official corpus
 * uses maps to the `@conform-ed/contracts` vocabulary. Each test validates end-to-end
 * (parse → normalize → contracts schema), so a passing test proves the emitted JSON is
 * contract-legal, not just present.
 */

import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateQtiXmlFile } from "../src";

const createdDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

const itemOpen =
  '<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1" title="Item" adaptive="false" time-dependent="false">';

function wrapItem(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${itemOpen}\n${inner}\n</qti-assessment-item>\n`;
}

async function normalizeItem(xml: string): Promise<Record<string, unknown>> {
  const directory = await mkdtemp(path.join(tmpdir(), "conform-ed-normalize-v3-"));
  createdDirectories.push(directory);
  const filePath = path.join(directory, "item.xml");
  await writeFile(filePath, xml, "utf8");

  const result = await validateQtiXmlFile(filePath);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  return (result.normalizedDocument as { assessmentItem: Record<string, unknown> }).assessmentItem;
}

function bodyContent(item: Record<string, unknown>): unknown[] {
  return (item["itemBody"] as { content: unknown[] }).content;
}

test("textEntry: interaction attributes, mapping on the declaration, custom RP rules", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string">
    <qti-correct-response><qti-value>york</qti-value></qti-correct-response>
    <qti-mapping default-value="0" upper-bound="2">
      <qti-map-entry map-key="york" mapped-value="2"/>
      <qti-map-entry map-key="YORK" mapped-value="1" case-sensitive="true"/>
    </qti-mapping>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>Capital: <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="10" placeholder-text="city" pattern-mask="[a-z]+"/></p>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-not><qti-is-null><qti-variable identifier="RESPONSE"/></qti-is-null></qti-not>
        <qti-set-outcome-value identifier="SCORE">
          <qti-sum><qti-variable identifier="SCORE"/><qti-map-response identifier="RESPONSE"/></qti-sum>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">0</qti-base-value></qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>`),
  );

  const declaration = (item["responseDeclarations"] as Array<Record<string, unknown>>)[0]!;
  expect(declaration["mapping"]).toEqual({
    defaultValue: 0,
    upperBound: 2,
    mapEntries: [
      { mapKey: "york", mappedValue: 2 },
      { mapKey: "YORK", mappedValue: 1, caseSensitive: true },
    ],
  });

  const paragraph = bodyContent(item)[0] as { kind: string; children: Array<Record<string, unknown>> };
  expect(paragraph.kind).toBe("xml");
  const interaction = paragraph.children.find((child) => child["kind"] === "textEntryInteraction")!;
  expect(interaction).toMatchObject({
    responseIdentifier: "RESPONSE",
    expectedLength: 10,
    placeholderText: "city",
    patternMask: "[a-z]+",
  });

  const rp = item["responseProcessing"] as { rules: Array<Record<string, unknown>> };
  const condition = rp.rules[0]!;
  expect(condition["kind"]).toBe("responseCondition");
  const responseIf = condition["responseIf"] as Record<string, unknown>;
  expect(responseIf["expression"]).toEqual({
    kind: "not",
    children: [{ kind: "isNull", children: [{ kind: "variable", identifier: "RESPONSE" }] }],
  });
  expect(responseIf["actions"]).toEqual([
    {
      kind: "setOutcomeValue",
      identifier: "SCORE",
      expression: {
        kind: "sum",
        children: [
          { kind: "variable", identifier: "SCORE" },
          { kind: "mapResponse", identifier: "RESPONSE" },
        ],
      },
    },
  ]);
  const responseElse = condition["responseElse"] as Record<string, unknown>;
  expect(responseElse["actions"]).toEqual([
    {
      kind: "setOutcomeValue",
      identifier: "SCORE",
      expression: { kind: "baseValue", baseType: "float", value: "0" },
    },
  ]);
});

test("extendedText with prompt and format", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" expected-lines="5" format="plain">
      <qti-prompt>Describe your day.</qti-prompt>
    </qti-extended-text-interaction>
  </qti-item-body>`),
  );

  expect(bodyContent(item)[0]).toMatchObject({
    kind: "extendedTextInteraction",
    responseIdentifier: "RESPONSE",
    expectedLines: 5,
    format: "plain",
    prompt: { kind: "prompt", content: ["Describe your day."] },
  });
});

test("inlineChoice interaction with inline choices", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>Y</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <p>Pick <qti-inline-choice-interaction response-identifier="RESPONSE" shuffle="false">
      <qti-inline-choice identifier="Y">yes</qti-inline-choice>
      <qti-inline-choice identifier="N">no</qti-inline-choice>
    </qti-inline-choice-interaction>.</p>
  </qti-item-body>`),
  );

  const paragraph = bodyContent(item)[0] as { children: Array<Record<string, unknown>> };
  const interaction = paragraph.children.find((child) => child["kind"] === "inlineChoiceInteraction")!;
  expect(interaction).toMatchObject({
    responseIdentifier: "RESPONSE",
    shuffle: false,
    inlineChoices: [
      { kind: "inlineChoice", identifier: "Y", content: ["yes"] },
      { kind: "inlineChoice", identifier: "N", content: ["no"] },
    ],
  });
});

test("feedbackInline in choice content, feedbackBlock in body, modalFeedback on the item", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">A
        <qti-feedback-inline outcome-identifier="FEEDBACK" identifier="A" show-hide="show">Correct!</qti-feedback-inline>
      </qti-simple-choice>
    </qti-choice-interaction>
    <qti-feedback-block outcome-identifier="FEEDBACK" identifier="A" show-hide="show">
      <p>Block feedback.</p>
    </qti-feedback-block>
  </qti-item-body>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="A" show-hide="show" title="Result">
    <p>Modal feedback.</p>
  </qti-modal-feedback>`),
  );

  const interaction = bodyContent(item)[0] as { simpleChoices: Array<{ content: unknown[] }> };
  const feedbackInline = interaction.simpleChoices[0]!.content.find(
    (child) => (child as Record<string, unknown>)["kind"] === "feedbackInline",
  );
  expect(feedbackInline).toMatchObject({
    outcomeIdentifier: "FEEDBACK",
    identifier: "A",
    showHide: "show",
    content: ["Correct!"],
  });

  const feedbackBlock = bodyContent(item)[1] as Record<string, unknown>;
  expect(feedbackBlock).toMatchObject({ kind: "feedbackBlock", outcomeIdentifier: "FEEDBACK", identifier: "A" });

  const modalFeedbacks = item["modalFeedbacks"] as Array<Record<string, unknown>>;
  expect(modalFeedbacks[0]).toMatchObject({
    kind: "modalFeedback",
    outcomeIdentifier: "FEEDBACK",
    identifier: "A",
    showHide: "show",
    title: "Result",
  });
});

test("printedVariable, template declarations, and template processing rules", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-template-declaration identifier="X" cardinality="single" base-type="integer" math-variable="false"/>
  <qti-template-processing>
    <qti-set-template-value identifier="X">
      <qti-random-integer min="1" max="6"/>
    </qti-set-template-value>
    <qti-template-condition>
      <qti-template-if>
        <qti-match><qti-variable identifier="X"/><qti-base-value base-type="integer">6</qti-base-value></qti-match>
        <qti-exit-template/>
      </qti-template-if>
    </qti-template-condition>
    <qti-set-correct-response identifier="RESPONSE">
      <qti-variable identifier="X"/>
    </qti-set-correct-response>
  </qti-template-processing>
  <qti-item-body>
    <p>You rolled <qti-printed-variable identifier="X" format="%d"/>.</p>
  </qti-item-body>`),
  );

  expect((item["templateDeclarations"] as unknown[])[0]).toMatchObject({
    identifier: "X",
    cardinality: "single",
    baseType: "integer",
    mathVariable: false,
  });

  const templateProcessing = item["templateProcessing"] as { rules: Array<Record<string, unknown>> };
  expect(templateProcessing.rules[0]).toEqual({
    kind: "setTemplateValue",
    identifier: "X",
    expression: { kind: "randomInteger", min: 1, max: 6 },
  });
  expect(templateProcessing.rules[1]).toMatchObject({ kind: "templateCondition" });
  expect(templateProcessing.rules[2]).toMatchObject({ kind: "setCorrectResponse", identifier: "RESPONSE" });

  const paragraph = bodyContent(item)[0] as { children: Array<Record<string, unknown>> };
  const printed = paragraph.children.find((child) => child["kind"] === "printedVariable");
  expect(printed).toMatchObject({ identifier: "X", format: "%d" });
});

test("match interaction with two simple match sets", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-match-interaction response-identifier="RESPONSE" shuffle="false" max-associations="2">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="C" match-max="1">Capulet</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="M" match-max="2">Montague</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
  </qti-item-body>`),
  );

  expect(bodyContent(item)[0]).toMatchObject({
    kind: "matchInteraction",
    responseIdentifier: "RESPONSE",
    maxAssociations: 2,
    simpleMatchSets: [
      {
        kind: "simpleMatchSet",
        simpleAssociableChoices: [{ kind: "simpleAssociableChoice", identifier: "C", matchMax: 1 }],
      },
      {
        kind: "simpleMatchSet",
        simpleAssociableChoices: [{ kind: "simpleAssociableChoice", identifier: "M", matchMax: 2 }],
      },
    ],
  });
});

test("gapMatch interaction with gapTexts and embedded gaps", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-gap-match-interaction response-identifier="RESPONSE" shuffle="false">
      <qti-gap-text identifier="W" match-max="1">winter</qti-gap-text>
      <blockquote><p>Now is the <qti-gap identifier="G1"/> of our discontent.</p></blockquote>
    </qti-gap-match-interaction>
  </qti-item-body>`),
  );

  const interaction = bodyContent(item)[0] as Record<string, unknown>;
  expect(interaction).toMatchObject({
    kind: "gapMatchInteraction",
    responseIdentifier: "RESPONSE",
    gapChoices: [{ kind: "gapText", identifier: "W", matchMax: 1, content: ["winter"] }],
  });

  const [blockquote] = interaction["content"] as Array<{ kind: string; children: Array<Record<string, unknown>> }>;
  const paragraph = blockquote!.children[0] as { children: Array<Record<string, unknown>> };
  expect(paragraph.children.some((child) => child["kind"] === "gap" && child["identifier"] === "G1")).toBe(true);
});

test("hottext interaction uses the corpus element names", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-hottext-interaction response-identifier="RESPONSE" max-choices="1">
      <p>Pick <qti-hottext identifier="A">this</qti-hottext> or <qti-hottext identifier="B">that</qti-hottext>.</p>
    </qti-hottext-interaction>
  </qti-item-body>`),
  );

  const interaction = bodyContent(item)[0] as Record<string, unknown>;
  expect(interaction["kind"]).toBe("hotTextInteraction");
  expect(interaction["maxChoices"]).toBe(1);
  const [paragraph] = interaction["content"] as Array<{ children: Array<Record<string, unknown>> }>;
  const hotTexts = paragraph!.children.filter((child) => child["kind"] === "hotText");
  expect(hotTexts.map((node) => node["identifier"])).toEqual(["A", "B"]);
});

test("hotspot interaction: object image and shape/coords choices", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-hotspot-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>Which one?</qti-prompt>
      <object type="image/png" width="206" height="280" data="images/map.png">Map</object>
      <qti-hotspot-choice shape="circle" coords="77,115,8" identifier="A"/>
    </qti-hotspot-interaction>
  </qti-item-body>`),
  );

  const interaction = bodyContent(item)[0] as Record<string, unknown>;
  expect(interaction["kind"]).toBe("hotspotInteraction");
  expect(interaction["image"]).toMatchObject({ kind: "xml", name: "object" });
  expect(interaction["hotspotChoices"]).toEqual([
    { kind: "hotspotChoice", identifier: "A", shape: "circle", coords: "77,115,8" },
  ]);
});

test("graphicGapMatch with gapImg choices and associable hotspots", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object type="image/png" width="100" height="100" data="board.png">Board</object>
      <qti-gap-img identifier="GI" match-max="1">
        <object type="image/png" data="piece.png" width="10" height="10">Piece</object>
      </qti-gap-img>
      <qti-associable-hotspot identifier="H1" match-max="1" shape="rect" coords="0,0,10,10"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>`),
  );

  const interaction = bodyContent(item)[0] as Record<string, unknown>;
  expect(interaction["kind"]).toBe("graphicGapMatchInteraction");
  expect(interaction["gapChoices"]).toEqual([
    {
      kind: "gapImg",
      identifier: "GI",
      matchMax: 1,
      media: expect.objectContaining({ kind: "xml", name: "object" }),
    },
  ]);
  expect(interaction["associableHotspots"]).toEqual([
    { kind: "associableHotspot", identifier: "H1", matchMax: 1, shape: "rect", coords: "0,0,10,10" },
  ]);
});

test("associate, graphicOrder, graphicAssociate, and selectPoint interactions", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="R1" cardinality="multiple" base-type="pair"/>
  <qti-response-declaration identifier="R2" cardinality="ordered" base-type="identifier"/>
  <qti-response-declaration identifier="R3" cardinality="multiple" base-type="pair"/>
  <qti-response-declaration identifier="R4" cardinality="single" base-type="point"/>
  <qti-item-body>
    <qti-associate-interaction response-identifier="R1" max-associations="1">
      <qti-simple-associable-choice identifier="A" match-max="1">Antonio</qti-simple-associable-choice>
      <qti-simple-associable-choice identifier="P" match-max="1">Prospero</qti-simple-associable-choice>
    </qti-associate-interaction>
    <qti-graphic-order-interaction response-identifier="R2">
      <object type="image/png" data="uk.png" width="206" height="280">UK</object>
      <qti-hotspot-choice shape="circle" coords="77,115,8" identifier="A"/>
    </qti-graphic-order-interaction>
    <qti-graphic-associate-interaction response-identifier="R3" max-associations="3">
      <object type="image/png" data="uk.png" width="206" height="280">UK</object>
      <qti-associable-hotspot identifier="B" match-max="3" shape="circle" coords="55,113,16"/>
    </qti-graphic-associate-interaction>
    <qti-select-point-interaction response-identifier="R4" max-choices="1">
      <object type="image/png" data="uk.png" width="206" height="280">UK</object>
    </qti-select-point-interaction>
  </qti-item-body>`),
  );

  const kinds = bodyContent(item).map((node) => (node as Record<string, unknown>)["kind"]);
  expect(kinds).toEqual([
    "associateInteraction",
    "graphicOrderInteraction",
    "graphicAssociateInteraction",
    "selectPointInteraction",
  ]);
});

test("slider, upload, media, and endAttempt interactions", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="R1" cardinality="single" base-type="integer"/>
  <qti-response-declaration identifier="R2" cardinality="single" base-type="file"/>
  <qti-response-declaration identifier="R3" cardinality="single" base-type="integer"/>
  <qti-response-declaration identifier="R4" cardinality="single" base-type="boolean"/>
  <qti-item-body>
    <qti-slider-interaction response-identifier="R1" lower-bound="0" upper-bound="100" step="5" step-label="true"/>
    <qti-upload-interaction response-identifier="R2" type="image/png"/>
    <qti-media-interaction response-identifier="R3" autostart="false" max-plays="2">
      <object type="audio/mpeg" data="tree.mp3"/>
    </qti-media-interaction>
    <qti-end-attempt-interaction response-identifier="R4" title="Hint please"/>
  </qti-item-body>`),
  );

  const [slider, upload, media, endAttempt] = bodyContent(item) as Array<Record<string, unknown>>;
  expect(slider).toMatchObject({ kind: "sliderInteraction", lowerBound: 0, upperBound: 100, step: 5, stepLabel: true });
  expect(upload).toMatchObject({ kind: "uploadInteraction", acceptedTypes: ["image/png"] });
  expect(media).toMatchObject({ kind: "mediaInteraction", autostart: false, maxPlays: 2 });
  expect((media!["media"] as Record<string, unknown>)["name"]).toBe("object");
  expect(endAttempt).toMatchObject({ kind: "endAttemptInteraction", responseIdentifier: "R4", title: "Hint please" });
});

test("rubricBlock, templateInline, and templateBlock content", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-template-declaration identifier="T" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-rubric-block view="candidate" use="instructions"><p>Answer carefully.</p></qti-rubric-block>
    <p>Hello <qti-template-inline template-identifier="T" identifier="x" show-hide="show">world</qti-template-inline></p>
    <qti-template-block template-identifier="T" identifier="y" show-hide="hide"><p>Hidden block.</p></qti-template-block>
  </qti-item-body>`),
  );

  const [rubric, paragraph, templateBlock] = bodyContent(item) as Array<Record<string, unknown>>;
  expect(rubric).toMatchObject({ kind: "rubricBlock", use: "instructions", view: ["candidate"] });
  const inline = (paragraph!["children"] as Array<Record<string, unknown>>).find(
    (child) => child["kind"] === "templateInline",
  );
  expect(inline).toMatchObject({ templateIdentifier: "T", identifier: "x", showHide: "show", content: ["world"] });
  expect(templateBlock).toMatchObject({ kind: "templateBlock", templateIdentifier: "T", identifier: "y" });
});

test("block content wrapped in qti-content-body unwraps to plain content", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Stem.</p>
    <qti-feedback-block outcome-identifier="FEEDBACK" identifier="A" show-hide="show">
      <qti-content-body><p>Wrapped feedback.</p></qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="A" show-hide="show">
    <qti-content-body><p>Wrapped modal.</p></qti-content-body>
  </qti-modal-feedback>`),
  );

  const feedbackBlock = bodyContent(item)[1] as { content: Array<Record<string, unknown>> };
  expect(feedbackBlock.content).toHaveLength(1);
  expect(feedbackBlock.content[0]).toMatchObject({ kind: "xml", name: "p", children: ["Wrapped feedback."] });

  const modal = (item["modalFeedbacks"] as Array<{ content: Array<Record<string, unknown>> }>)[0]!;
  expect(modal.content[0]).toMatchObject({ kind: "xml", name: "p", children: ["Wrapped modal."] });
});

test("portable custom interaction maps to its contracts kind", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-portable-custom-interaction response-identifier="RESPONSE" custom-interaction-type-identifier="urn:example:pci" module="example">
      <qti-interaction-markup><div>stage</div></qti-interaction-markup>
    </qti-portable-custom-interaction>
  </qti-item-body>`),
  );

  expect(bodyContent(item)[0]).toMatchObject({
    kind: "portableCustomInteraction",
    responseIdentifier: "RESPONSE",
    customInteractionTypeIdentifier: "urn:example:pci",
    interactionMarkup: { kind: "interactionMarkup" },
  });
});

test("portable custom interaction carries data-* properties, class, and modules", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-item-body>
    <qti-portable-custom-interaction response-identifier="RESPONSE"
        custom-interaction-type-identifier="urn:example:pci:shading"
        class="hmh-tap-border-rounded compact" data-catalog-idref="cat-1"
        data-toggle="true" data-tap-message="Tap to reveal" data-selected_color="red">
      <qti-interaction-modules primary-configuration="modules/module_resolution.js">
        <qti-interaction-module id="shading" primary-path="modules/shadingXX.js" fallback-path="modules/shading.js"/>
      </qti-interaction-modules>
      <qti-interaction-markup><div>stage</div></qti-interaction-markup>
    </qti-portable-custom-interaction>
  </qti-item-body>`),
  );

  expect(bodyContent(item)[0]).toMatchObject({
    kind: "portableCustomInteraction",
    customInteractionTypeIdentifier: "urn:example:pci:shading",
    class: ["hmh-tap-border-rounded", "compact"],
    dataCatalogIdref: "cat-1", // reserved QTI data- attribute, not a PCI property
    properties: { toggle: "true", "tap-message": "Tap to reveal", selected_color: "red" },
    interactionModules: {
      kind: "interactionModules",
      primaryConfiguration: "modules/module_resolution.js",
      modules: [
        {
          kind: "interactionModule",
          id: "shading",
          primaryPath: "modules/shadingXX.js",
          fallbackPath: "modules/shading.js",
        },
      ],
    },
  });

  const pci = bodyContent(item)[0] as { properties: Record<string, string> };
  expect(pci.properties["catalog-idref"]).toBeUndefined();
});

test("qti-equal carries its tolerance window", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body><p>Estimate pi: <qti-text-entry-interaction response-identifier="RESPONSE"/></p></qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-equal tolerance-mode="absolute" tolerance="0.01" include-upper-bound="false">
          <qti-variable identifier="RESPONSE"/>
          <qti-base-value base-type="float">3.1416</qti-base-value>
        </qti-equal>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>`),
  );

  const rp = item["responseProcessing"] as { rules: Array<Record<string, unknown>> };
  const responseIf = rp.rules[0]!["responseIf"] as { expression: Record<string, unknown> };
  expect(responseIf.expression).toMatchObject({
    kind: "equal",
    toleranceMode: "absolute",
    tolerance: [0.01],
    includeUpperBound: false,
  });
});

test("assessment tests: outcome processing, feedback, branch rules, selection/ordering, itemRef metadata", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "conform-ed-normalize-v3-"));
  createdDirectories.push(directory);
  const filePath = path.join(directory, "test.xml");
  await writeFile(
    filePath,
    `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="TEST-1" title="Unit Test">
  <qti-outcome-declaration identifier="TOTAL" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="GRADE" cardinality="single" base-type="identifier"/>
  <qti-test-part identifier="PART-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="SECTION-1" title="Pool" visible="true">
      <qti-selection select="2" with-replacement="false"/>
      <qti-ordering shuffle="true"/>
      <qti-rubric-block view="candidate" use="instructions"><p>Answer two questions.</p></qti-rubric-block>
      <qti-assessment-item-ref identifier="ITEM-1" href="items/one.xml" category="easy practice">
        <qti-weight identifier="W1" value="2"/>
      </qti-assessment-item-ref>
      <qti-assessment-item-ref identifier="ITEM-2" href="items/two.xml" fixed="true">
        <qti-pre-condition>
          <qti-match>
            <qti-variable identifier="ITEM-1.SCORE"/>
            <qti-base-value base-type="float">1</qti-base-value>
          </qti-match>
        </qti-pre-condition>
        <qti-branch-rule target="EXIT_TEST">
          <qti-is-null><qti-variable identifier="ITEM-1.RESPONSE"/></qti-is-null>
        </qti-branch-rule>
      </qti-assessment-item-ref>
    </qti-assessment-section>
  </qti-test-part>
  <qti-outcome-processing>
    <qti-set-outcome-value identifier="TOTAL">
      <qti-sum><qti-test-variables variable-identifier="SCORE"/></qti-sum>
    </qti-set-outcome-value>
    <qti-outcome-condition>
      <qti-outcome-if>
        <qti-gte><qti-variable identifier="TOTAL"/><qti-base-value base-type="float">1</qti-base-value></qti-gte>
        <qti-set-outcome-value identifier="GRADE"><qti-base-value base-type="identifier">pass</qti-base-value></qti-set-outcome-value>
      </qti-outcome-if>
      <qti-outcome-else>
        <qti-set-outcome-value identifier="GRADE"><qti-base-value base-type="identifier">fail</qti-base-value></qti-set-outcome-value>
      </qti-outcome-else>
    </qti-outcome-condition>
  </qti-outcome-processing>
  <qti-test-feedback access="atEnd" outcome-identifier="GRADE" show-hide="show" identifier="pass" title="Done">
    <qti-content-body><p>You passed.</p></qti-content-body>
  </qti-test-feedback>
</qti-assessment-test>
`,
    "utf8",
  );

  const result = await validateQtiXmlFile(filePath);
  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  const test = (result.normalizedDocument as { assessmentTest: Record<string, unknown> }).assessmentTest;
  const part = (test["testParts"] as Array<Record<string, unknown>>)[0]!;
  const section = (part["children"] as Array<Record<string, unknown>>)[0]!;

  expect(section["selection"]).toEqual({ select: 2, withReplacement: false });
  expect(section["ordering"]).toEqual({ shuffle: true });
  expect((section["rubricBlocks"] as Array<Record<string, unknown>>)[0]).toMatchObject({
    kind: "testRubricBlock",
    view: ["candidate"],
    use: "instructions",
  });

  const [refOne, refTwo] = section["children"] as Array<Record<string, unknown>>;
  expect(refOne).toMatchObject({
    identifier: "ITEM-1",
    category: ["easy", "practice"],
    weights: [{ identifier: "W1", value: 2 }],
  });
  expect(refTwo).toMatchObject({ identifier: "ITEM-2", fixed: true });
  expect((refTwo!["preConditions"] as unknown[]).length).toBe(1);
  expect((refTwo!["branchRules"] as Array<Record<string, unknown>>)[0]).toMatchObject({
    kind: "branchRule",
    target: "EXIT_TEST",
  });

  const outcomeProcessing = test["outcomeProcessing"] as { rules: Array<Record<string, unknown>> };
  expect(outcomeProcessing.rules[0]).toMatchObject({ kind: "setOutcomeValue", identifier: "TOTAL" });
  const condition = outcomeProcessing.rules[1]!;
  expect(condition["kind"]).toBe("outcomeCondition");
  expect((condition["outcomeIf"] as Record<string, unknown>)["kind"]).toBe("outcomeIf");
  expect((condition["outcomeElse"] as Record<string, unknown>)["kind"]).toBe("outcomeElse");

  expect((test["testFeedbacks"] as Array<Record<string, unknown>>)[0]).toMatchObject({
    kind: "testFeedback",
    access: "atEnd",
    outcomeIdentifier: "GRADE",
    identifier: "pass",
    title: "Done",
  });
});

test("outcome declarations carry lookup tables; stylesheets map on the item", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="GRADE" cardinality="single" base-type="identifier">
    <qti-match-table default-value="F">
      <qti-match-table-entry source-value="1" target-value="A"/>
    </qti-match-table>
  </qti-outcome-declaration>
  <qti-stylesheet href="style.css" type="text/css"/>
  <qti-item-body><p>Body.</p></qti-item-body>`),
  );

  const outcome = (item["outcomeDeclarations"] as Array<Record<string, unknown>>)[0]!;
  expect(outcome["matchTable"]).toEqual({
    defaultValue: "F",
    matchTableEntries: [{ sourceValue: 1, targetValue: "A" }],
  });
  expect(item["stylesheets"]).toEqual([{ href: "style.css", type: "text/css" }]);
});

test("assessment-stimulus-ref children normalize onto the item", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-assessment-stimulus-ref identifier="STIM-1" href="shared/passage.xml" title="The passage"/>
  <qti-item-body><p>Body.</p></qti-item-body>`),
  );

  expect(item["assessmentStimulusRefs"]).toEqual([
    { identifier: "STIM-1", href: "shared/passage.xml", title: "The passage" },
  ]);
});

test("qti-assessment-stimulus documents normalize and validate", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "conform-ed-normalize-v3-"));
  createdDirectories.push(directory);
  const filePath = path.join(directory, "stimulus.xml");
  await writeFile(
    filePath,
    `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-stimulus xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="STIM-1" title="The passage">
  <qti-stimulus-body><p>Read this carefully.</p></qti-stimulus-body>
</qti-assessment-stimulus>
`,
    "utf8",
  );

  const result = await validateQtiXmlFile(filePath);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  const document = result.normalizedDocument as { assessmentStimulus: Record<string, unknown> };

  expect(document.assessmentStimulus["identifier"]).toBe("STIM-1");
  expect(document.assessmentStimulus["title"]).toBe("The passage");

  const body = document.assessmentStimulus["stimulusBody"] as { content: unknown[] };

  expect(body.content.length).toBeGreaterThan(0);
});

// ---------- Catalogs (qti-catalog-info, §5.26–5.29) ----------

test("item-level qti-catalog-info: entry cards and direct-content cards normalize", async () => {
  // The CatalogWithMultipleSupports.xml shape: keyword-translation entries keyed by
  // xml:lang plus a linguistic-guidance card with direct qti-html-content.
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Indicate which statements are <span data-catalog-idref="catalog1">accurate.</span></p>
  </qti-item-body>
  <qti-catalog-info>
    <qti-catalog id="catalog1">
      <qti-card support="keyword-translation">
        <qti-card-entry xml:lang="es"><qti-html-content>preciso</qti-html-content></qti-card-entry>
        <qti-card-entry xml:lang="de"><qti-html-content>genau</qti-html-content></qti-card-entry>
      </qti-card>
      <qti-card support="linguistic-guidance">
        <qti-html-content>Accurate means correct.</qti-html-content>
      </qti-card>
    </qti-catalog>
  </qti-catalog-info>
`),
  );

  expect(item["catalogInfo"]).toEqual({
    catalogs: [
      {
        id: "catalog1",
        cards: [
          {
            support: "keyword-translation",
            cardEntries: [
              { xmlLang: "es", htmlContent: { content: ["preciso"] } },
              { xmlLang: "de", htmlContent: { content: ["genau"] } },
            ],
          },
          { support: "linguistic-guidance", htmlContent: { content: ["Accurate means correct."] } },
        ],
      },
    ],
  });
});

test("catalog cards: data-* discriminators, defaults, and file references normalize", async () => {
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p data-catalog-idref="content2">Put the sentences in order.</p>
  </qti-item-body>
  <qti-catalog-info>
    <qti-catalog id="content2">
      <qti-card support="spoken">
        <qti-card-entry data-reading-type="computer-read-aloud">
          <qti-html-content>Put the following sentences in order.</qti-html-content>
        </qti-card-entry>
        <qti-card-entry default="true">
          <qti-file-href mime-type="audio/mpeg">audio/directions.mp3</qti-file-href>
        </qti-card-entry>
      </qti-card>
    </qti-catalog>
  </qti-catalog-info>
`),
  );

  expect(item["catalogInfo"]).toEqual({
    catalogs: [
      {
        id: "content2",
        cards: [
          {
            support: "spoken",
            cardEntries: [
              {
                dataAttributes: { "reading-type": "computer-read-aloud" },
                htmlContent: { content: ["Put the following sentences in order."] },
              },
              {
                default: true,
                fileHrefs: [{ href: "audio/directions.mp3", mimeType: "audio/mpeg" }],
              },
            ],
          },
        ],
      },
    ],
  });
});

test("a rubric block carries its own qti-catalog-info alongside its content body", async () => {
  // CatalogsAcrossContentNodes.xml: "A rubric block contains its own qti-catalog-info node".
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-rubric-block view="candidate" use="instructions">
      <qti-content-body>
        <p data-catalog-idref="rb_cat1">Choose the best option.</p>
      </qti-content-body>
      <qti-catalog-info>
        <qti-catalog id="rb_cat1">
          <qti-card support="keyword-translation">
            <qti-card-entry xml:lang="es"><qti-html-content>Elija la mejor.</qti-html-content></qti-card-entry>
          </qti-card>
        </qti-catalog>
      </qti-catalog-info>
    </qti-rubric-block>
  </qti-item-body>
`),
  );

  const rubric = bodyContent(item)[0] as Record<string, unknown>;

  expect(rubric["kind"]).toBe("rubricBlock");
  expect((rubric["catalogInfo"] as { catalogs: unknown[] }).catalogs).toHaveLength(1);
  expect(rubric["content"]).toEqual([
    {
      kind: "xml",
      namespace: "http://www.imsglobal.org/xsd/imsqtiasi_v3p0",
      name: "p",
      attributes: { "data-catalog-idref": "rb_cat1" },
      children: ["Choose the best option."],
    },
  ]);
});

test("qti-catalog-info inside an unwrapped block never leaks into its content", async () => {
  // Without a qti-content-body wrapper the catalog-info sibling must still map to
  // catalogInfo, not into the flow content (where it would be an unsupported element).
  const item = await normalizeItem(
    wrapItem(`
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-feedback-block outcome-identifier="FEEDBACK" identifier="CORRECT" show-hide="show">
      <p>Well done.</p>
      <qti-catalog-info>
        <qti-catalog id="fb_cat">
          <qti-card support="keyword-translation">
            <qti-card-entry xml:lang="es"><qti-html-content>Bien hecho.</qti-html-content></qti-card-entry>
          </qti-card>
        </qti-catalog>
      </qti-catalog-info>
    </qti-feedback-block>
  </qti-item-body>
`),
  );

  const feedback = bodyContent(item)[0] as Record<string, unknown>;

  expect(feedback["kind"]).toBe("feedbackBlock");
  expect((feedback["catalogInfo"] as { catalogs: unknown[] }).catalogs).toHaveLength(1);
  expect(feedback["content"]).toEqual([
    {
      kind: "xml",
      namespace: "http://www.imsglobal.org/xsd/imsqtiasi_v3p0",
      name: "p",
      children: ["Well done."],
    },
  ]);
});
