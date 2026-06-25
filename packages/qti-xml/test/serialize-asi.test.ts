/**
 * ASI / manifest / metadata export round trips on hand-authored instances — the
 * CI-safe complement to the corpus gate (serialize-asi-corpus.local.test.ts), which
 * only runs when the vendored corpus is checked out. Each test ingests a known XML
 * instance, serializes the normalized model back out, and requires the re-ingested
 * document to be byte-for-shape identical. This pins the harder inverse cases —
 * interactions, expressions, response processing, catalogs, foreign namespaces,
 * manifests — independent of the corpus.
 */

import { expect, test } from "bun:test";

import { serializeQtiDocument, validateQtiXmlContent } from "../src";
import type { QtiSchemaSelectionKey } from "../src";

async function roundTrip(xml: string, key: QtiSchemaSelectionKey): Promise<void> {
  const original = await validateQtiXmlContent(xml);
  expect(original.status).toBe("valid");

  const serialized = serializeQtiDocument("3.0.1", key, original.normalizedDocument);
  const reingested = await validateQtiXmlContent(serialized);

  expect(reingested.status).toBe("valid");
  expect(reingested.normalizedDocument).toEqual(original.normalizedDocument);
}

const asiHeader =
  'xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

test("a choice item with response processing round-trips", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item ${asiHeader} identifier="choice" title="Choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>ChoiceA</qti-value>
    </qti-correct-response>
    <qti-mapping default-value="0">
      <qti-map-entry map-key="ChoiceA" mapped-value="1" case-sensitive="true"/>
    </qti-mapping>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float" normal-maximum="1">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>Pick <strong>one</strong>.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1" shuffle="false">
      <qti-prompt>Which letter?</qti-prompt>
      <qti-simple-choice identifier="ChoiceA">A</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB" fixed="true">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://www.imsglobal.org/question/qti_v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;
  await roundTrip(xml, "qtiAssessmentItemDocument");
});

test("WAI-ARIA roles and states authored on an interaction survive emit (ADR-0039 QTI-A11Y-1)", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item ${asiHeader} identifier="aria" title="Aria" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1" role="radiogroup" aria-label="Pick a letter" aria-describedby="hint" aria-orientation="vertical">
      <qti-simple-choice identifier="ChoiceA">A</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://www.imsglobal.org/question/qti_v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;
  // The round-trip asserts deep equality, so ARIA dropped at either parse or serialize would fail it.
  await roundTrip(xml, "qtiAssessmentItemDocument");

  // And assert the ARIA is genuinely present in the emitted XML (not merely symmetric loss).
  const { normalizedDocument } = await validateQtiXmlContent(xml);
  const serialized = serializeQtiDocument("3.0.1", "qtiAssessmentItemDocument", normalizedDocument);
  for (const attr of ['role="radiogroup"', 'aria-label="Pick a letter"', 'aria-describedby="hint"']) {
    expect(serialized).toContain(attr);
  }
});

test("an item with template processing, modal feedback and a catalog round-trips", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item ${asiHeader} identifier="templated" title="Templated" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-template-declaration identifier="A" cardinality="single" base-type="integer" math-variable="true"/>
  <qti-template-processing>
    <qti-set-template-value identifier="A">
      <qti-random-integer min="1" max="9"/>
    </qti-set-template-value>
    <qti-template-condition>
      <qti-template-if>
        <qti-gt>
          <qti-variable identifier="A"/>
          <qti-base-value base-type="integer">5</qti-base-value>
        </qti-gt>
        <qti-set-correct-response identifier="RESPONSE">
          <qti-variable identifier="A"/>
        </qti-set-correct-response>
      </qti-template-if>
      <qti-template-else>
        <qti-exit-template/>
      </qti-template-else>
    </qti-template-condition>
  </qti-template-processing>
  <qti-item-body>
    <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="2"/>
    <qti-feedback-block outcome-identifier="FEEDBACK" identifier="correct" show-hide="show">
      <qti-content-body><p>Well done.</p></qti-content-body>
      <qti-catalog-info>
        <qti-catalog id="cat1">
          <qti-card support="glossary-on-screen">
            <qti-card-entry xml:lang="en" data-reading-type="computer-read-aloud">
              <qti-html-content>A spoken gloss.</qti-html-content>
            </qti-card-entry>
          </qti-card>
        </qti-catalog>
      </qti-catalog-info>
    </qti-feedback-block>
  </qti-item-body>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="correct" show-hide="show" title="Note">
    <p>Modal note.</p>
  </qti-modal-feedback>
</qti-assessment-item>`;
  await roundTrip(xml, "qtiAssessmentItemDocument");
});

test("a stimulus carrying a foreign SSML span round-trips", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-stimulus ${asiHeader} xmlns:ssml="http://www.w3.org/2001/10/synthesis" identifier="stim" title="Stim">
  <qti-stimulus-body>
    <p>Why did <ssml:sub alias="A-nina">Anina</ssml:sub> call?</p>
  </qti-stimulus-body>
</qti-assessment-stimulus>`;
  await roundTrip(xml, "qtiAssessmentStimulusDocument");
});

test("a test with parts, selection, branch rules and outcome processing round-trips", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test ${asiHeader} identifier="test" title="Test">
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-test-part identifier="part1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="sec1" title="Section 1" visible="true">
      <qti-selection select="2" with-replacement="true"/>
      <qti-ordering shuffle="true"/>
      <qti-assessment-item-ref identifier="item1" href="item1.xml" category="math">
        <qti-weight identifier="W" value="2"/>
      </qti-assessment-item-ref>
      <qti-assessment-item-ref identifier="item2" href="item2.xml">
        <qti-branch-rule target="EXIT_TEST">
          <qti-match>
            <qti-variable identifier="SCORE"/>
            <qti-base-value base-type="float">0</qti-base-value>
          </qti-match>
        </qti-branch-rule>
      </qti-assessment-item-ref>
    </qti-assessment-section>
  </qti-test-part>
  <qti-outcome-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-sum>
        <qti-test-variables variable-identifier="SCORE"/>
      </qti-sum>
    </qti-set-outcome-value>
  </qti-outcome-processing>
</qti-assessment-test>`;
  await roundTrip(xml, "qtiAssessmentTestDocument");
});

test("a standalone response-processing template round-trips", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-response-processing ${asiHeader}>
  <qti-response-condition>
    <qti-response-if>
      <qti-match>
        <qti-variable identifier="RESPONSE"/>
        <qti-correct identifier="RESPONSE"/>
      </qti-match>
      <qti-set-outcome-value identifier="SCORE">
        <qti-base-value base-type="float">1</qti-base-value>
      </qti-set-outcome-value>
    </qti-response-if>
    <qti-response-else>
      <qti-set-outcome-value identifier="SCORE">
        <qti-base-value base-type="float">0</qti-base-value>
      </qti-set-outcome-value>
    </qti-response-else>
  </qti-response-condition>
</qti-response-processing>`;
  await roundTrip(xml, "qtiResponseProcessingDocument");
});

test("a content-package manifest with inline qtiMetadata and LOM round-trips", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" xmlns:imsmd="http://ltsc.ieee.org/xsd/LOM" identifier="MANIFEST-1">
  <metadata>
    <schema>QTI Package</schema>
    <schemaversion>3.0.0</schemaversion>
    <imsmd:lom>
      <imsmd:general>
        <imsmd:title>
          <imsmd:string language="en">A package</imsmd:string>
        </imsmd:title>
      </imsmd:general>
    </imsmd:lom>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="item1" type="imsqti_item_xmlv3p0" href="item1.xml">
      <metadata>
        <qtiMetadata>
          <interactionType>choiceInteraction</interactionType>
          <timeDependent>false</timeDependent>
        </qtiMetadata>
      </metadata>
      <file href="item1.xml"/>
      <dependency identifierref="shared1"/>
    </resource>
  </resources>
</manifest>`;
  await roundTrip(xml, "qtiManifestDocument");
});

test("a standalone qtiMetadata document round-trips", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qtiMetadata xmlns="http://www.imsglobal.org/xsd/imsqti_metadata_v3p0">
  <itemTemplate>true</itemTemplate>
  <interactionType>choiceInteraction</interactionType>
  <interactionType>textEntryInteraction</interactionType>
  <feedbackType>nonadaptive</feedbackType>
  <solutionAvailable>true</solutionAvailable>
  <toolName>conform-ed</toolName>
</qtiMetadata>`;
  await roundTrip(xml, "qtiMetadataDocument");
});

test("the universal dispatch covers AfA PNP (read/write parity at the entry point)", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<access-for-all-pnp xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imsafa3p0pnp_v1p0">
  <glossary-on-screen/>
  <additional-testing-time><time-multiplier>1.5</time-multiplier></additional-testing-time>
</access-for-all-pnp>`;
  await roundTrip(xml, "qtiAccessForAllPnpDocument");
});

test("serializeQtiDocument refuses a 2.2 ASI item (import-only legacy lane)", () => {
  expect(() => serializeQtiDocument("2.2", "qtiAssessmentItemDocument", {})).toThrow(
    "Serialization is not implemented for 2.2 qtiAssessmentItemDocument.",
  );
});
