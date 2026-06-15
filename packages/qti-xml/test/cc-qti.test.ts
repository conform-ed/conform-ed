/**
 * CC QTI 1.2.1 → QTI 3.0.1 bridge (ADR-0022, conform-ed slice 1). Each test feeds a
 * hand-authored Common Cartridge `questestinterop` document through `convertCcQtiV1ToV3`
 * and asserts the emitted QTI 3 XML re-validates via the real engine (`validateQtiXmlContent`)
 * and normalizes to the expected shape — the non-circular gate that the bridge produces
 * genuine QTI 3.
 */

import { expect, test } from "bun:test";

import { convertCcQtiV1ToV3, validateQtiXmlContent } from "../src";

const ccHeader = 'xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2"';

function objectbank(itemXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop ${ccHeader}>
  <objectbank ident="ob-1">
    ${itemXml}
  </objectbank>
</questestinterop>`;
}

const multipleChoiceItem = `<item ident="q-capital" title="Capital of France">
  <itemmetadata>
    <qtimetadata>
      <qtimetadatafield>
        <fieldlabel>cc_profile</fieldlabel>
        <fieldentry>cc.multiple_choice.v0p1</fieldentry>
      </qtimetadatafield>
    </qtimetadata>
  </itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">What is the capital of France?</mattext></material>
    <response_lid ident="RESPONSE" rcardinality="Single">
      <render_choice>
        <response_label ident="ChoiceA"><material><mattext texttype="text/plain">Paris</mattext></material></response_label>
        <response_label ident="ChoiceB"><material><mattext texttype="text/plain">London</mattext></material></response_label>
        <response_label ident="ChoiceC"><material><mattext texttype="text/plain">Berlin</mattext></material></response_label>
      </render_choice>
    </response_lid>
  </presentation>
  <resprocessing>
    <outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="100"/></outcomes>
    <respcondition continue="No">
      <conditionvar><varequal respident="RESPONSE">ChoiceA</varequal></conditionvar>
      <setvar varname="SCORE" action="Set">100</setvar>
    </respcondition>
  </resprocessing>
</item>`;

test("converts a multiple_choice objectbank item to valid QTI 3", async () => {
  const result = convertCcQtiV1ToV3(objectbank(multipleChoiceItem));

  expect(result.status).toBe("converted");
  if (result.status !== "converted") return;

  expect(result.source).toBe("objectbank");
  expect(result.items).toHaveLength(1);
  expect(result.test).toBeUndefined();

  const item = result.items[0]!;
  expect(item.identifier).toBe("q-capital");
  expect(item.title).toBe("Capital of France");
  expect(item.ccProfile).toBe("cc.multiple_choice.v0p1");
  expect(item.interactionKind).toBe("choice");

  const validated = await validateQtiXmlContent(item.xml);
  expect(validated.status).toBe("valid");

  const doc = validated.normalizedDocument as {
    assessmentItem: {
      responseDeclarations: { correctResponse?: { values: { value: string }[] } }[];
      itemBody: { content: { kind: string; simpleChoices?: unknown[] }[] };
      responseProcessing?: { template?: string };
    };
  };
  const assessmentItem = doc.assessmentItem;

  expect(assessmentItem.responseDeclarations[0]?.correctResponse?.values).toEqual([{ value: "ChoiceA" }]);

  const interaction = assessmentItem.itemBody.content.find((node) => node.kind === "choiceInteraction");
  expect(interaction?.simpleChoices).toHaveLength(3);

  expect(assessmentItem.responseProcessing?.template).toBe(
    "https://www.imsglobal.org/question/qti_v3p0/rptemplates/match_correct",
  );
});

test("converts a CC assessment to a QTI 3 test plus its items", async () => {
  const assessment = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop ${ccHeader}>
  <assessment ident="quiz-1" title="Geography Quiz">
    <section ident="root_section">
      ${multipleChoiceItem}
    </section>
  </assessment>
</questestinterop>`;

  const result = convertCcQtiV1ToV3(assessment);
  expect(result.status).toBe("converted");
  if (result.status !== "converted") return;

  expect(result.source).toBe("assessment");
  expect(result.items).toHaveLength(1);
  expect(result.test).toBeDefined();
  expect(result.test?.itemIdentifiers).toEqual(["q-capital"]);

  const validatedTest = await validateQtiXmlContent(result.test!.xml);
  expect(validatedTest.status).toBe("valid");

  const validatedItem = await validateQtiXmlContent(result.items[0]!.xml);
  expect(validatedItem.status).toBe("valid");
});

const trueFalseItem = `<item ident="q-tf" title="True/False">
  <itemmetadata><qtimetadata>
    <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.true_false.v0p1</fieldentry></qtimetadatafield>
  </qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">The sky is blue.</mattext></material>
    <response_lid ident="RESPONSE" rcardinality="Single">
      <render_choice>
        <response_label ident="True"><material><mattext texttype="text/plain">True</mattext></material></response_label>
        <response_label ident="False"><material><mattext texttype="text/plain">False</mattext></material></response_label>
      </render_choice>
    </response_lid>
  </presentation>
  <resprocessing>
    <outcomes><decvar varname="SCORE" vartype="Decimal" maxvalue="100"/></outcomes>
    <respcondition><conditionvar><varequal respident="RESPONSE">True</varequal></conditionvar><setvar varname="SCORE" action="Set">100</setvar></respcondition>
  </resprocessing>
</item>`;

const multipleResponseItem = `<item ident="q-mr" title="Multiple Response">
  <itemmetadata><qtimetadata>
    <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_response.v0p1</fieldentry></qtimetadatafield>
  </qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">Which are primary colours?</mattext></material>
    <response_lid ident="RESPONSE" rcardinality="Multiple">
      <render_choice>
        <response_label ident="Red"><material><mattext texttype="text/plain">Red</mattext></material></response_label>
        <response_label ident="Green"><material><mattext texttype="text/plain">Green</mattext></material></response_label>
        <response_label ident="Blue"><material><mattext texttype="text/plain">Blue</mattext></material></response_label>
        <response_label ident="Purple"><material><mattext texttype="text/plain">Purple</mattext></material></response_label>
      </render_choice>
    </response_lid>
  </presentation>
  <resprocessing>
    <outcomes><decvar varname="SCORE" vartype="Decimal" maxvalue="100"/></outcomes>
    <respcondition>
      <conditionvar>
        <varequal respident="RESPONSE">Red</varequal>
        <varequal respident="RESPONSE">Blue</varequal>
      </conditionvar>
      <setvar varname="SCORE" action="Set">100</setvar>
    </respcondition>
  </resprocessing>
</item>`;

const fibItem = `<item ident="q-fib" title="Fill in the blank">
  <itemmetadata><qtimetadata>
    <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.fib.v0p1</fieldentry></qtimetadatafield>
  </qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">The capital of France is ___.</mattext></material>
    <response_str ident="RESPONSE" rcardinality="Single"><render_fib/></response_str>
  </presentation>
  <resprocessing>
    <outcomes><decvar varname="SCORE" vartype="Decimal" maxvalue="100"/></outcomes>
    <respcondition>
      <conditionvar><varequal respident="RESPONSE" case="No">Paris</varequal></conditionvar>
      <setvar varname="SCORE" action="Set">100</setvar>
    </respcondition>
  </resprocessing>
</item>`;

const essayItem = `<item ident="q-essay" title="Essay">
  <itemmetadata><qtimetadata>
    <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.essay.v0p1</fieldentry></qtimetadatafield>
    <qtimetadatafield><fieldlabel>qmd_computerscored</fieldlabel><fieldentry>No</fieldentry></qtimetadatafield>
  </qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">Discuss the causes of World War I.</mattext></material>
    <response_str ident="RESPONSE" rcardinality="Single"><render_fib rows="10"/></response_str>
  </presentation>
</item>`;

async function convertSingleItem(itemXml: string) {
  const result = convertCcQtiV1ToV3(objectbank(itemXml));
  expect(result.status).toBe("converted");
  if (result.status !== "converted") throw new Error("conversion failed");
  const item = result.items[0]!;
  const validated = await validateQtiXmlContent(item.xml);
  expect(validated.status).toBe("valid");
  return { item, normalized: validated.normalizedDocument as { assessmentItem: Record<string, unknown> } };
}

test("converts a true_false item to a single-choice QTI 3 item", async () => {
  const { item } = await convertSingleItem(trueFalseItem);
  expect(item.interactionKind).toBe("choice");
  expect(item.ccProfile).toBe("cc.true_false.v0p1");
});

test("converts a multiple_response item to a multiple-cardinality choice item", async () => {
  const { item, normalized } = await convertSingleItem(multipleResponseItem);
  expect(item.interactionKind).toBe("choice");
  const decl = (
    normalized.assessmentItem["responseDeclarations"] as {
      cardinality: string;
      correctResponse?: { values: { value: string }[] };
    }[]
  )[0];
  expect(decl?.cardinality).toBe("multiple");
  expect(decl?.correctResponse?.values).toEqual([{ value: "Red" }, { value: "Blue" }]);
});

test("converts a fib item to a text-entry item with a response mapping", async () => {
  const { item, normalized } = await convertSingleItem(fibItem);
  expect(item.interactionKind).toBe("textEntry");
  const decl = (
    normalized.assessmentItem["responseDeclarations"] as {
      baseType: string;
      mapping?: { mapEntries: { mapKey: string }[] };
    }[]
  )[0];
  expect(decl?.baseType).toBe("string");
  expect(decl?.mapping?.mapEntries[0]?.mapKey).toBe("Paris");
  expect((normalized.assessmentItem["responseProcessing"] as { template?: string }).template).toBe(
    "https://www.imsglobal.org/question/qti_v3p0/rptemplates/map_response",
  );
});

test("converts an essay item to a human-scored extended-text item", async () => {
  const { item, normalized } = await convertSingleItem(essayItem);
  expect(item.interactionKind).toBe("extendedText");
  // Essay is human-scored: no response-processing template is emitted.
  expect(normalized.assessmentItem["responseProcessing"]).toBeUndefined();
});

const patternMatchItem = `<item ident="q-pattern" title="Pattern match">
  <itemmetadata><qtimetadata>
    <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.pattern_match.v0p1</fieldentry></qtimetadatafield>
  </qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">Type a greeting.</mattext></material>
    <response_str ident="RESPONSE" rcardinality="Single"><render_fib/></response_str>
  </presentation>
  <resprocessing>
    <outcomes><decvar varname="SCORE" vartype="Decimal" maxvalue="100"/></outcomes>
    <respcondition>
      <conditionvar><varsubstring respident="RESPONSE" case="No">hello</varsubstring></conditionvar>
      <setvar varname="SCORE" action="Set">100</setvar>
    </respcondition>
  </resprocessing>
</item>`;

test("converts a pattern_match item to a text-entry item", async () => {
  const { item, normalized } = await convertSingleItem(patternMatchItem);
  expect(item.interactionKind).toBe("textEntry");
  const decl = (
    normalized.assessmentItem["responseDeclarations"] as { mapping?: { mapEntries: { mapKey: string }[] } }[]
  )[0];
  expect(decl?.mapping?.mapEntries[0]?.mapKey).toBe("hello");
});

// Mirrors the quirks of real Canvas/TopKit exports (verified locally against an AGPL sample,
// reproduced here as a non-AGPL fixture): numeric choice idents, one item ident reused across
// the whole quiz, and a `text/html` stem with inline markup.
const realWorldAssessment = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop ${ccHeader}>
  <assessment ident="quiz-rw" title="Module Quiz">
    <section ident="root_section">
      <item ident="i_dup" title="Q1">
        <itemmetadata><qtimetadata>
          <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.true_false.v0p1</fieldentry></qtimetadatafield>
        </qtimetadata></itemmetadata>
        <presentation>
          <material><mattext texttype="text/html">&lt;div&gt;The sky is &lt;strong&gt;blue&lt;/strong&gt;.&lt;/div&gt;</mattext></material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              <response_label ident="42987"><material><mattext texttype="text/plain">True</mattext></material></response_label>
              <response_label ident="32307"><material><mattext texttype="text/plain">False</mattext></material></response_label>
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes><decvar varname="SCORE" vartype="Decimal" maxvalue="100"/></outcomes>
          <respcondition><conditionvar><varequal respident="response1">42987</varequal></conditionvar><setvar varname="SCORE" action="Set">100</setvar></respcondition>
        </resprocessing>
      </item>
      <item ident="i_dup" title="Q2">
        <itemmetadata><qtimetadata>
          <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        </qtimetadata></itemmetadata>
        <presentation>
          <material><mattext texttype="text/plain">Pick a primary colour.</mattext></material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              <response_label ident="15774"><material><mattext texttype="text/plain">Red</mattext></material></response_label>
              <response_label ident="53203"><material><mattext texttype="text/plain">Mauve</mattext></material></response_label>
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes><decvar varname="SCORE" vartype="Decimal" maxvalue="100"/></outcomes>
          <respcondition><conditionvar><varequal respident="response1">15774</varequal></conditionvar><setvar varname="SCORE" action="Set">100</setvar></respcondition>
        </resprocessing>
      </item>
    </section>
  </assessment>
</questestinterop>`;

test("sanitizes numeric idents and de-duplicates reused item idents (real-world export shape)", async () => {
  const result = convertCcQtiV1ToV3(realWorldAssessment);
  expect(result.status).toBe("converted");
  if (result.status !== "converted") return;

  expect(result.items).toHaveLength(2);

  // Reused "i_dup" ident is de-duplicated into unique QTI identifiers.
  const ids = result.items.map((item) => item.identifier);
  expect(new Set(ids).size).toBe(2);
  expect(ids).toEqual(["i_dup", "i_dup-2"]);

  for (const item of result.items) {
    const validated = await validateQtiXmlContent(item.xml);
    expect(validated.status).toBe("valid");
  }

  // Numeric choice ident 42987 → sanitized identifier, kept consistent with the correct answer.
  const firstItem = await validateQtiXmlContent(result.items[0]!.xml);
  const doc = firstItem.normalizedDocument as {
    assessmentItem: {
      responseDeclarations: { correctResponse?: { values: { value: string }[] } }[];
      itemBody: { content: { kind: string; simpleChoices?: { identifier: string }[] }[] };
    };
  };
  const interaction = doc.assessmentItem.itemBody.content.find((node) => node.kind === "choiceInteraction");
  expect(interaction?.simpleChoices?.map((choice) => choice.identifier)).toEqual(["id_42987", "id_32307"]);
  expect(doc.assessmentItem.responseDeclarations[0]?.correctResponse?.values).toEqual([{ value: "id_42987" }]);

  // The emitted test references the de-duplicated item identifiers.
  expect(result.test?.itemIdentifiers).toEqual(["i_dup", "i_dup-2"]);
  const validatedTest = await validateQtiXmlContent(result.test!.xml);
  expect(validatedTest.status).toBe("valid");
});

test("strict profile mode rejects a non-conformant export (e.g. duplicate item idents)", () => {
  const result = convertCcQtiV1ToV3(realWorldAssessment, { profile: true });
  expect(result.status).toBe("invalid");
});

test("rejects XML that is not questestinterop", () => {
  const result = convertCcQtiV1ToV3('<?xml version="1.0"?><foo/>');
  expect(result.status).toBe("invalid");
});
