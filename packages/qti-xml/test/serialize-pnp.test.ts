/**
 * AfA PNP serialization — the export direction of the QTI 3.0 profile binding
 * (imsqtiv3p0_afa3p0pnp_v1p0). The gate is the round trip: serialize → parse →
 * normalize → strict contracts schema → deep-equal.
 */

import { expect, test } from "bun:test";

import type { QtiAccessForAllPnpDocument, QtiAccessForAllPnpRecordsDocument } from "@conform-ed/contracts/qti/v3_0_1";

import { serializeQtiAccessForAllPnp, serializeQtiAccessForAllPnpRecords, validateQtiXmlContent } from "../src";

const document: QtiAccessForAllPnpDocument = {
  accessForAllPnp: {
    hazardAvoidance: ["flashing", "motion-simulation"],
    inputRequirements: "full-keyboard-control",
    languageOfInterface: [{ xmlLang: "fr" }],
    linguisticGuidance: { replaceAccessModes: ["textual", "visual"] },
    keywordTranslation: { xmlLang: "es" },
    signLanguage: { xmlLang: "ase" },
    additionalTestingTime: { timeMultiplier: 1.5 },
    lineReader: { highlightColor: "#FFFF00" },
    invertDisplayPolarity: { foreground: "#FFFFFF", background: "#000000" },
    magnification: { allContent: { zoomAmount: 1.5 } },
    spoken: { readingType: "computer-read-aloud", speechRate: 120, linkIndication: "speak-link" },
    braille: { xmlLang: "en", deliveryMode: "refreshable", grade: "2" },
    longDescription: { hideVisually: true },
    environment: { breaks: true },
    textAppearance: { fontSize: 18, uniformFontSizing: true, fontFace: { genericFontFace: "sans serif" } },
    calculatorOnScreen: { calculatorType: "scientific" },
    glossaryOnScreen: true,
    dictionaryOnScreen: true,
    activateAtInitializationSet: { features: ["keyword-translation", "additional-testing-time"] },
    activateAsOptionSet: { features: ["calculator-on-screen"] },
    prohibitSet: { features: ["spell-checker-on-screen"] },
  },
};

test("a PNP document round-trips through the serializer and parser", async () => {
  const xml = serializeQtiAccessForAllPnp(document);

  expect(xml).toContain('xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imsafa3p0pnp_v1p0"');

  const verdict = await validateQtiXmlContent(xml);

  expect(verdict.status).toBe("valid");
  expect(verdict.normalizedDocument).toEqual(document);
});

test("unlimited additional testing time serializes as the empty element form", async () => {
  const xml = serializeQtiAccessForAllPnp({
    accessForAllPnp: { additionalTestingTime: { unlimited: true } },
  });

  expect(xml).toContain("<unlimited/>");

  const verdict = await validateQtiXmlContent(xml);

  expect(verdict.status).toBe("valid");
  expect(verdict.normalizedDocument).toEqual({
    accessForAllPnp: { additionalTestingTime: { unlimited: true } },
  });
});

test("a PNP records document round-trips", async () => {
  const records: QtiAccessForAllPnpRecordsDocument = {
    accessForAllPnpRecords: {
      records: [
        {
          personSourcedId: { value: "learner-1", sourceSystem: "https://sis.example.org" },
          appointmentId: ["APPT-1"],
          accessForAllPnp: { keywordTranslation: { xmlLang: "de" } },
        },
      ],
    },
  };

  const xml = serializeQtiAccessForAllPnpRecords(records);
  const verdict = await validateQtiXmlContent(xml);

  expect(verdict.status).toBe("valid");
  expect(verdict.normalizedDocument).toEqual(records);
});
