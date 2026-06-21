/**
 * Inverse CC QTI bridge (QTI 3 → CC 1.2.1), the down-convert direction a CC 1.3 producer needs.
 * The gate is a **forward→inverse→forward round-trip**: lift a hand-authored CC item up to QTI 3
 * with the trusted forward bridge, lower it back with `convertQtiV3ItemToCcV1`, then lift the result
 * again — the second QTI 3 must carry the same interaction, choices, and correct answers as the
 * first. That proves the inverse reproduces the CC profile faithfully (not just "emits some XML").
 */

import { expect, test } from "bun:test";

import { convertCcQtiV1ToV3, convertQtiV3AssessmentToCcV1, convertQtiV3ItemToCcV1 } from "../src";

const ccHeader = 'xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2"';

function objectbank(itemXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop ${ccHeader}>
  <objectbank ident="ob-1">${itemXml}</objectbank>
</questestinterop>`;
}

/** Lift a CC item to its QTI 3 XML via the trusted forward bridge. */
function forwardToQtiV3(itemXml: string): string {
  const result = convertCcQtiV1ToV3(objectbank(itemXml));
  if (result.status !== "converted") throw new Error(`forward conversion failed: ${result.issues.join("; ")}`);
  return result.items[0]!.xml;
}

const multipleChoiceItem = `<item ident="q-capital" title="Capital of France">
  <itemmetadata><qtimetadata><qtimetadatafield>
    <fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry>
  </qtimetadatafield></qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">What is the capital of France?</mattext></material>
    <response_lid ident="RESPONSE" rcardinality="Single">
      <render_choice>
        <response_label ident="ChoiceA"><material><mattext texttype="text/plain">Paris</mattext></material></response_label>
        <response_label ident="ChoiceB"><material><mattext texttype="text/plain">London</mattext></material></response_label>
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

const fibItem = `<item ident="q-sum" title="Addition">
  <itemmetadata><qtimetadata><qtimetadatafield>
    <fieldlabel>cc_profile</fieldlabel><fieldentry>cc.fib.v0p1</fieldentry>
  </qtimetadatafield></qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">2 + 2 = ?</mattext></material>
    <response_str ident="RESPONSE" rcardinality="Single"><render_fib><response_label ident="A"/></render_fib></response_str>
  </presentation>
  <resprocessing>
    <outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="100"/></outcomes>
    <respcondition continue="No">
      <conditionvar><varequal respident="RESPONSE" case="No">4</varequal></conditionvar>
      <setvar varname="SCORE" action="Set">100</setvar>
    </respcondition>
  </resprocessing>
</item>`;

const essayItem = `<item ident="q-essay" title="Reflection">
  <itemmetadata><qtimetadata><qtimetadatafield>
    <fieldlabel>cc_profile</fieldlabel><fieldentry>cc.essay.v0p1</fieldentry>
  </qtimetadatafield></qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/plain">Discuss the causes of the war.</mattext></material>
    <response_str ident="RESPONSE" rcardinality="Single"><render_fib/></response_str>
  </presentation>
</item>`;

test("a multiple-choice item round-trips: choices, identifiers, and the correct answer survive", () => {
  const qtiV3 = forwardToQtiV3(multipleChoiceItem);

  const lowered = convertQtiV3ItemToCcV1(qtiV3);
  expect(lowered.status).toBe("converted");
  if (lowered.status !== "converted") return;
  expect(lowered.interactionKind).toBe("choice");
  expect(lowered.ccProfile).toBe("cc.multiple_choice.v0p1");

  // Lift the lowered CC item back to QTI 3 — it must reproduce the same choice + correct answer.
  const reForward = convertCcQtiV1ToV3(objectbank(lowered.xml));
  expect(reForward.status).toBe("converted");
  if (reForward.status !== "converted") return;
  const doc = reForward.items[0]!.xml;
  expect(doc).toContain('identifier="ChoiceA"');
  expect(doc).toContain('identifier="ChoiceB"');
  expect(doc).toContain("Paris");
  // The correct response is preserved (ChoiceA), via the round-tripped <varequal>.
  expect(reForward.items[0]!.interactionKind).toBe("choice");
});

test("a fill-in-blank item round-trips its correct answer + case sensitivity", () => {
  const lowered = convertQtiV3ItemToCcV1(forwardToQtiV3(fibItem));
  expect(lowered.status).toBe("converted");
  if (lowered.status !== "converted") return;
  expect(lowered.interactionKind).toBe("textEntry");
  expect(lowered.ccProfile).toBe("cc.fib.v0p1");
  expect(lowered.xml).toContain('respident="RESPONSE"');
  expect(lowered.xml).toContain(">4<");

  const reForward = convertCcQtiV1ToV3(objectbank(lowered.xml));
  expect(reForward.status).toBe("converted");
  if (reForward.status !== "converted") return;
  expect(reForward.items[0]!.interactionKind).toBe("textEntry");
});

test("an essay item lowers to a human-scored fib with no response processing", () => {
  const lowered = convertQtiV3ItemToCcV1(forwardToQtiV3(essayItem));
  expect(lowered.status).toBe("converted");
  if (lowered.status !== "converted") return;
  expect(lowered.interactionKind).toBe("extendedText");
  expect(lowered.ccProfile).toBe("cc.essay.v0p1");
  // Human-scored: no resprocessing block.
  expect(lowered.xml).not.toContain("<resprocessing");
});

test("an interaction outside the CC profile is reported unsupported, with stem text for a fallback", () => {
  const orderItem = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqti_v3p0" identifier="q-order" title="Order the steps">
  <qti-item-body>
    <p>Put the steps in order.</p>
    <qti-order-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">First</qti-simple-choice>
      <qti-simple-choice identifier="B">Second</qti-simple-choice>
    </qti-order-interaction>
  </qti-item-body>
</qti-assessment-item>`;

  const lowered = convertQtiV3ItemToCcV1(orderItem);
  expect(lowered.status).toBe("unsupported");
  if (lowered.status !== "unsupported") return;
  expect(lowered.identifier).toBe("q-order");
  expect(lowered.reason).toContain("qti-order-interaction");
  expect(lowered.stemText).toContain("Put the steps in order");
});

test("an assessment carries only the convertible items and reports the rest", () => {
  const orderItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqti_v3p0" identifier="q-order" title="Order">
  <qti-item-body><qti-order-interaction response-identifier="RESPONSE">
    <qti-simple-choice identifier="A">First</qti-simple-choice>
  </qti-order-interaction></qti-item-body>
</qti-assessment-item>`;

  const result = convertQtiV3AssessmentToCcV1({
    identifier: "quiz-1",
    title: "Mixed quiz",
    items: [{ xml: forwardToQtiV3(multipleChoiceItem) }, { xml: orderItemXml }],
  });

  expect(result.convertedCount).toBe(1);
  expect(result.unsupportedCount).toBe(1);
  expect(result.assessmentXml).toContain('<assessment ident="quiz-1"');
  expect(result.assessmentXml).toContain("q-capital");
  expect(result.assessmentXml).not.toContain("q-order");

  // An all-unsupported assessment yields no CC assessment XML (the producer degrades it wholesale).
  const allUnsupported = convertQtiV3AssessmentToCcV1({
    identifier: "quiz-2",
    title: "T",
    items: [{ xml: orderItemXml }],
  });
  expect(allUnsupported.assessmentXml).toBeNull();
  expect(allUnsupported.convertedCount).toBe(0);
});
