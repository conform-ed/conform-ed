/**
 * AfA PNP (QTI 3.0 profile) XML serialization (imsqtiv3p0_afa3p0pnp_v1p0) — the
 * export direction of the candidate-preferences binding, the exact inverse of the
 * import normalizer; gated in tests by the round trip through our own parser,
 * normalizer, and strict contracts schema.
 */

import type {
  QtiAccessForAllPnp,
  QtiAccessForAllPnpDocument,
  QtiAccessForAllPnpRecordsDocument,
  QtiPnpFeatureSet,
  QtiPnpReplaceAccessMode,
} from "@conform-ed/contracts/qti/v3_0_1";

import { XmlWriter, type AttributeValue } from "./xml-writer";

const pnpNamespace = "http://www.imsglobal.org/xsd/qti/qtiv3p0/imsafa3p0pnp_v1p0";
const pnpSchemaLocation = `${pnpNamespace} https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqtiv3p0_afa3p0pnp_v1p0.xsd`;

function writeReplaceModes(writer: XmlWriter, view: QtiPnpReplaceAccessMode | undefined): void {
  for (const mode of view?.replaceAccessModes ?? []) {
    writer.element(`replace-access-mode-${mode}`, []);
  }
}

/** A ReplacesAccessMode container: empty element, or replace-mode children. */
function replaceModeElement(
  writer: XmlWriter,
  name: string,
  view: QtiPnpReplaceAccessMode | undefined,
  attributes: ReadonlyArray<readonly [string, AttributeValue]> = [],
  body?: () => void,
): void {
  if (!view) {
    return;
  }

  const hasChildren = (view.replaceAccessModes?.length ?? 0) > 0 || body !== undefined;

  if (!hasChildren) {
    writer.element(name, attributes);
    return;
  }

  writer.element(name, attributes, () => {
    writeReplaceModes(writer, view);
    body?.();
  });
}

function featureSetElement(writer: XmlWriter, name: string, view: QtiPnpFeatureSet | undefined): void {
  if (!view) {
    return;
  }

  if (!view.features?.length) {
    writer.element(name, []);
    return;
  }

  writer.element(name, [], () => {
    for (const feature of view.features ?? []) {
      writer.element(feature, []);
    }
  });
}

function writePnpBody(writer: XmlWriter, pnp: QtiAccessForAllPnp): void {
  for (const hazard of pnp.hazardAvoidance ?? []) {
    writer.element("hazard-avoidance", [], hazard);
  }

  if (pnp.inputRequirements !== undefined) {
    writer.element("input-requirements", [], pnp.inputRequirements);
  }

  for (const language of pnp.languageOfInterface ?? []) {
    replaceModeElement(writer, "language-of-interface", language, [["xml:lang", language.xmlLang]]);
  }

  replaceModeElement(writer, "linguistic-guidance", pnp.linguisticGuidance);
  replaceModeElement(writer, "keyword-emphasis", pnp.keywordEmphasis);
  replaceModeElement(
    writer,
    "keyword-translation",
    pnp.keywordTranslation,
    pnp.keywordTranslation ? [["xml:lang", pnp.keywordTranslation.xmlLang]] : [],
  );
  replaceModeElement(writer, "simplified-language-portions", pnp.simplifiedLanguagePortions);
  replaceModeElement(writer, "simplified-graphics", pnp.simplifiedGraphics);
  replaceModeElement(
    writer,
    "item-translation",
    pnp.itemTranslation,
    pnp.itemTranslation ? [["xml:lang", pnp.itemTranslation.xmlLang]] : [],
  );
  replaceModeElement(
    writer,
    "sign-language",
    pnp.signLanguage,
    pnp.signLanguage ? [["xml:lang", pnp.signLanguage.xmlLang]] : [],
  );
  replaceModeElement(writer, "encouragement", pnp.encouragement);

  const time = pnp.additionalTestingTime;
  if (time) {
    replaceModeElement(writer, "additional-testing-time", time, [], () => {
      if (time.timeMultiplier !== undefined) {
        writer.element("time-multiplier", [], String(time.timeMultiplier));
      }
      if (time.fixedMinutes !== undefined) {
        writer.element("fixed-minutes", [], String(time.fixedMinutes));
      }
      if (time.unlimited === true) {
        writer.element("unlimited", []);
      }
    });
  }

  replaceModeElement(
    writer,
    "line-reader",
    pnp.lineReader,
    pnp.lineReader ? [["highlight-color", pnp.lineReader.highlightColor]] : [],
  );
  replaceModeElement(
    writer,
    "invert-display-polarity",
    pnp.invertDisplayPolarity,
    pnp.invertDisplayPolarity
      ? [
          ["foreground", pnp.invertDisplayPolarity.foreground],
          ["background", pnp.invertDisplayPolarity.background],
        ]
      : [],
  );

  const magnification = pnp.magnification;
  if (magnification) {
    replaceModeElement(writer, "magnification", magnification, [], () => {
      if (magnification.allContent) {
        writer.element("all-content", [["zoom-amount", magnification.allContent.zoomAmount]]);
      }
      if (magnification.text) {
        writer.element("text", [["zoom-amount", magnification.text.zoomAmount]]);
      }
      if (magnification.nonText) {
        writer.element("non-text", [["zoom-amount", magnification.nonText.zoomAmount]]);
      }
    });
  }

  const spoken = pnp.spoken;
  if (spoken) {
    replaceModeElement(writer, "spoken", spoken, [], () => {
      if (spoken.readingType !== undefined) {
        writer.element("reading-type", [], spoken.readingType);
      }
      for (const restriction of spoken.restrictionTypes ?? []) {
        writer.element("restriction-type", [], restriction);
      }
      if (spoken.speechRate !== undefined) {
        writer.element("speech-rate", [], String(spoken.speechRate));
      }
      if (spoken.pitch !== undefined) {
        writer.element("pitch", [], String(spoken.pitch));
      }
      if (spoken.volume !== undefined) {
        writer.element("volume", [], String(spoken.volume));
      }
      if (spoken.linkIndication !== undefined) {
        writer.element("link-indication", [], spoken.linkIndication);
      }
      if (spoken.typingEcho !== undefined) {
        writer.element("typing-echo", [], spoken.typingEcho);
      }
    });
  }

  replaceModeElement(writer, "tactile", pnp.tactile);

  const braille = pnp.braille;
  if (braille) {
    const hasChildren =
      braille.deliveryMode !== undefined ||
      braille.grade !== undefined ||
      braille.brailleType !== undefined ||
      braille.mathType !== undefined;

    replaceModeElement(
      writer,
      "braille",
      braille,
      [["xml:lang", braille.xmlLang]],
      hasChildren
        ? () => {
            if (braille.deliveryMode !== undefined) {
              writer.element("delivery-mode", [], braille.deliveryMode);
            }
            if (braille.grade !== undefined) {
              writer.element("grade", [], braille.grade);
            }
            if (braille.brailleType !== undefined) {
              writer.element("braille-type", [], braille.brailleType);
            }
            if (braille.mathType !== undefined) {
              writer.element("math-type", [], braille.mathType);
            }
          }
        : undefined,
    );
  }

  replaceModeElement(writer, "answer-masking", pnp.answerMasking);
  replaceModeElement(writer, "keyboard-directions", pnp.keyboardDirections);
  replaceModeElement(writer, "additional-directions", pnp.additionalDirections);
  replaceModeElement(
    writer,
    "long-description",
    pnp.longDescription,
    pnp.longDescription ? [["hide-visually", pnp.longDescription.hideVisually]] : [],
  );
  replaceModeElement(writer, "captions", pnp.captions);

  const environment = pnp.environment;
  if (environment) {
    const hasChildren =
      environment.description !== undefined ||
      environment.medical !== undefined ||
      environment.software !== undefined ||
      environment.hardware !== undefined ||
      environment.breaks !== undefined;

    replaceModeElement(
      writer,
      "environment",
      environment,
      [],
      hasChildren
        ? () => {
            if (environment.description !== undefined) {
              writer.element("description", [], environment.description);
            }
            if (environment.medical !== undefined) {
              writer.element("medical", [], environment.medical);
            }
            if (environment.software !== undefined) {
              writer.element("software", [], environment.software);
            }
            if (environment.hardware !== undefined) {
              writer.element("hardware", [], environment.hardware);
            }
            if (environment.breaks !== undefined) {
              writer.element("breaks", [], String(environment.breaks));
            }
          }
        : undefined,
    );
  }

  replaceModeElement(writer, "transcript", pnp.transcript);
  replaceModeElement(writer, "alternative-text", pnp.alternativeText);
  replaceModeElement(writer, "audio-description", pnp.audioDescription);
  replaceModeElement(writer, "high-contrast", pnp.highContrast);
  replaceModeElement(writer, "layout-single-column", pnp.layoutSingleColumn);

  const textAppearance = pnp.textAppearance;
  if (textAppearance) {
    replaceModeElement(writer, "text-appearance", textAppearance, [], () => {
      if (textAppearance.backgroundColor !== undefined) {
        writer.element("background-color", [], textAppearance.backgroundColor);
      }
      if (textAppearance.fontColor !== undefined) {
        writer.element("font-color", [], textAppearance.fontColor);
      }
      if (textAppearance.fontSize !== undefined) {
        writer.element("font-size", [], String(textAppearance.fontSize));
      }
      if (textAppearance.fontFace) {
        writer.element("font-face", [], () => {
          for (const fontName of textAppearance.fontFace?.fontName ?? []) {
            writer.element("font-name", [], fontName);
          }
          if (textAppearance.fontFace?.genericFontFace !== undefined) {
            writer.element("generic-font-face", [], textAppearance.fontFace.genericFontFace);
          }
        });
      }
      if (textAppearance.lineSpacing !== undefined) {
        writer.element("line-spacing", [], String(textAppearance.lineSpacing));
      }
      if (textAppearance.lineHeight !== undefined) {
        writer.element("line-height", [], String(textAppearance.lineHeight));
      }
      if (textAppearance.letterSpacing !== undefined) {
        writer.element("letter-spacing", [], String(textAppearance.letterSpacing));
      }
      if (textAppearance.uniformFontSizing === true) {
        writer.element("uniform-font-sizing", []);
      }
      if (textAppearance.wordSpacing !== undefined) {
        writer.element("word-spacing", [], String(textAppearance.wordSpacing));
      }
      if (textAppearance.wordWrapping === true) {
        writer.element("word-wrapping", []);
      }
    });
  }

  if (pnp.calculatorOnScreen) {
    writer.element("calculator-on-screen", [["calculator-type", pnp.calculatorOnScreen.calculatorType]]);
  }

  const onScreenFlags: ReadonlyArray<readonly [string, boolean | undefined]> = [
    ["dictionary-on-screen", pnp.dictionaryOnScreen],
    ["glossary-on-screen", pnp.glossaryOnScreen],
    ["thesaurus-on-screen", pnp.thesaurusOnScreen],
    ["homophone-checker-on-screen", pnp.homophoneCheckerOnScreen],
    ["note-taking-on-screen", pnp.noteTakingOnScreen],
    ["visual-organizer-on-screen", pnp.visualOrganizerOnScreen],
    ["outliner-on-screen", pnp.outlinerOnScreen],
    ["peer-interaction-on-screen", pnp.peerInteractionOnScreen],
    ["spell-checker-on-screen", pnp.spellCheckerOnScreen],
  ];
  for (const [name, enabled] of onScreenFlags) {
    if (enabled === true) {
      writer.element(name, []);
    }
  }

  featureSetElement(writer, "activate-at-initialization-set", pnp.activateAtInitializationSet);
  featureSetElement(writer, "activate-as-option-set", pnp.activateAsOptionSet);
  featureSetElement(writer, "prohibit-set", pnp.prohibitSet);
}

/** Serialize a candidate-preferences document against the official QTI 3 profile binding. */
export function serializeQtiAccessForAllPnp(document: QtiAccessForAllPnpDocument): string {
  const writer = new XmlWriter();

  writer.line('<?xml version="1.0" encoding="UTF-8"?>');
  writer.element(
    "access-for-all-pnp",
    [
      ["xmlns", pnpNamespace],
      ["xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"],
      ["xsi:schemaLocation", pnpSchemaLocation],
    ],
    () => writePnpBody(writer, document.accessForAllPnp),
  );

  return writer.toString();
}

/** Serialize a person-keyed PNP records document. */
export function serializeQtiAccessForAllPnpRecords(document: QtiAccessForAllPnpRecordsDocument): string {
  const writer = new XmlWriter();

  writer.line('<?xml version="1.0" encoding="UTF-8"?>');
  writer.element(
    "access-for-all-pnp-records",
    [
      ["xmlns", pnpNamespace],
      ["xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"],
      ["xsi:schemaLocation", pnpSchemaLocation],
    ],
    () => {
      for (const record of document.accessForAllPnpRecords.records) {
        writer.element("access-for-all-pnp-record", [], () => {
          writer.element(
            "person-sourced-id",
            [["source-system", record.personSourcedId.sourceSystem]],
            record.personSourcedId.value,
          );
          for (const appointment of record.appointmentId ?? []) {
            writer.element("appointment-id", [], appointment);
          }
          writer.element("access-for-all-pnp", [], () => writePnpBody(writer, record.accessForAllPnp));
        });
      }
    },
  );

  return writer.toString();
}
