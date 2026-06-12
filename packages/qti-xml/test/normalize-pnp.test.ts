/**
 * AfA PNP (QTI 3.0 profile) normalization: the candidate-preferences input to catalog
 * delivery. The official binding is imsqtiv3p0_afa3p0pnp_v1p0.xsd (namespace
 * http://www.imsglobal.org/xsd/qti/qtiv3p0/imsafa3p0pnp_v1p0) with two roots —
 * access-for-all-pnp and access-for-all-pnp-records. Each test validates end-to-end
 * (parse → normalize → strict contracts schema), like the rest of the normalizer suite.
 */

import { expect, test } from "bun:test";

import { validateQtiXmlContent } from "../src";

const pnpOpen = '<access-for-all-pnp xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imsafa3p0pnp_v1p0">';

function wrapPnp(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${pnpOpen}\n${inner}\n</access-for-all-pnp>\n`;
}

async function normalizePnp(xml: string): Promise<Record<string, unknown>> {
  const result = await validateQtiXmlContent(xml);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  return (result.normalizedDocument as { accessForAllPnp: Record<string, unknown> }).accessForAllPnp;
}

test("language-keyed supports, additional testing time, and activation sets normalize", async () => {
  const pnp = await normalizePnp(
    wrapPnp(`
  <keyword-translation xml:lang="es"/>
  <additional-testing-time>
    <time-multiplier>1.5</time-multiplier>
  </additional-testing-time>
  <activate-at-initialization-set>
    <keyword-translation/>
    <additional-testing-time/>
  </activate-at-initialization-set>
  <activate-as-option-set>
    <calculator-on-screen/>
  </activate-as-option-set>
  <prohibit-set>
    <spell-checker-on-screen/>
  </prohibit-set>
`),
  );

  expect(pnp["keywordTranslation"]).toEqual({ xmlLang: "es" });
  expect(pnp["additionalTestingTime"]).toEqual({ timeMultiplier: 1.5 });
  expect(pnp["activateAtInitializationSet"]).toEqual({
    features: ["keyword-translation", "additional-testing-time"],
  });
  expect(pnp["activateAsOptionSet"]).toEqual({ features: ["calculator-on-screen"] });
  expect(pnp["prohibitSet"]).toEqual({ features: ["spell-checker-on-screen"] });
});

test("spoken preferences, braille, and on-screen tools normalize", async () => {
  const pnp = await normalizePnp(
    wrapPnp(`
  <spoken>
    <reading-type>computer-read-aloud</reading-type>
    <speech-rate>120</speech-rate>
    <link-indication>speak-link</link-indication>
  </spoken>
  <braille xml:lang="en">
    <delivery-mode>refreshable</delivery-mode>
    <grade>2</grade>
  </braille>
  <glossary-on-screen/>
  <dictionary-on-screen/>
`),
  );

  expect(pnp["spoken"]).toEqual({ readingType: "computer-read-aloud", speechRate: 120, linkIndication: "speak-link" });
  expect(pnp["braille"]).toEqual({ xmlLang: "en", deliveryMode: "refreshable", grade: "2" });
  expect(pnp["glossaryOnScreen"]).toBe(true);
  expect(pnp["dictionaryOnScreen"]).toBe(true);
});

test("replace-access-mode children, display and time variants normalize", async () => {
  const pnp = await normalizePnp(
    wrapPnp(`
  <hazard-avoidance>flashing</hazard-avoidance>
  <hazard-avoidance>motion-simulation</hazard-avoidance>
  <input-requirements>full-keyboard-control</input-requirements>
  <language-of-interface xml:lang="fr"/>
  <linguistic-guidance>
    <replace-access-mode-textual/>
    <replace-access-mode-visual/>
  </linguistic-guidance>
  <invert-display-polarity foreground="#FFFFFF" background="#000000"/>
  <line-reader highlight-color="#FFFF00"/>
  <long-description hide-visually="true"/>
  <magnification>
    <all-content zoom-amount="1.5"/>
  </magnification>
  <calculator-on-screen calculator-type="scientific"/>
  <environment>
    <breaks>true</breaks>
  </environment>
`),
  );

  expect(pnp["hazardAvoidance"]).toEqual(["flashing", "motion-simulation"]);
  expect(pnp["inputRequirements"]).toBe("full-keyboard-control");
  expect(pnp["languageOfInterface"]).toEqual([{ xmlLang: "fr" }]);
  expect(pnp["linguisticGuidance"]).toEqual({ replaceAccessModes: ["textual", "visual"] });
  expect(pnp["invertDisplayPolarity"]).toEqual({ foreground: "#FFFFFF", background: "#000000" });
  expect(pnp["lineReader"]).toEqual({ highlightColor: "#FFFF00" });
  expect(pnp["longDescription"]).toEqual({ hideVisually: true });
  expect(pnp["magnification"]).toEqual({ allContent: { zoomAmount: 1.5 } });
  expect(pnp["calculatorOnScreen"]).toEqual({ calculatorType: "scientific" });
  expect(pnp["environment"]).toEqual({ breaks: true });
});

test("unlimited additional testing time normalizes to the boolean form", async () => {
  const pnp = await normalizePnp(
    wrapPnp(`
  <additional-testing-time>
    <unlimited/>
  </additional-testing-time>
`),
  );

  expect(pnp["additionalTestingTime"]).toEqual({ unlimited: true });
});

test("a PNP records document normalizes person-keyed records", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<access-for-all-pnp-records xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imsafa3p0pnp_v1p0">
  <access-for-all-pnp-record>
    <person-sourced-id source-system="https://sis.example.org">learner-1</person-sourced-id>
    <appointment-id>APPT-1</appointment-id>
    <access-for-all-pnp>
      <keyword-translation xml:lang="de"/>
    </access-for-all-pnp>
  </access-for-all-pnp-record>
</access-for-all-pnp-records>
`;

  const result = await validateQtiXmlContent(xml);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");
  expect(result.normalizedDocument).toEqual({
    accessForAllPnpRecords: {
      records: [
        {
          personSourcedId: { value: "learner-1", sourceSystem: "https://sis.example.org" },
          appointmentId: ["APPT-1"],
          accessForAllPnp: { keywordTranslation: { xmlLang: "de" } },
        },
      ],
    },
  });
});
