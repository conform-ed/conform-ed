import { expect, test } from "bun:test";

import {
  Qti301DerivedZodTemplates,
  QtiAccessForAllPnpDocumentSchema,
  QtiAsiProfileDocumentSchema,
  QtiAssessmentItemDocumentSchema,
  QtiAssessmentResultDocumentSchema,
  QtiAssessmentSectionDocumentSchema,
  QtiAssessmentStimulusDocumentSchema,
  QtiAssessmentTestDocumentSchema,
  QtiCatalogInfoSchema,
  QtiMetadataDocumentSchema,
  QtiOutcomeDeclarationDocumentSchema,
  QtiOutcomeProcessingDocumentSchema,
  QtiResponseProcessingDocumentSchema,
  QtiUsageDataDocumentSchema,
  QtiXmlExtensionNodeSchema,
} from "../src";

test("QtiMetadataDocumentSchema parses a minimal metadata document", () => {
  const parsed = QtiMetadataDocumentSchema.safeParse({
    qtiMetadata: {
      itemTemplate: false,
      interactionType: ["choiceInteraction"],
      scoringMode: ["responseprocessing"],
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiAccessForAllPnpDocumentSchema parses a minimal preferences document", () => {
  const parsed = QtiAccessForAllPnpDocumentSchema.safeParse({
    accessForAllPnp: {
      languageOfInterface: [{ xmlLang: "en" }],
      magnification: {
        allContent: { zoomAmount: 1.5 },
      },
      dictionaryOnScreen: true,
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiAssessmentResultDocumentSchema parses a minimal result report", () => {
  const parsed = QtiAssessmentResultDocumentSchema.safeParse({
    assessmentResult: {
      context: {
        sessionIdentifiers: [
          {
            sourceId: "https://example.test/delivery",
            identifier: "session-1",
          },
        ],
      },
      itemResults: [
        {
          identifier: "ITEM1",
          datestamp: "2026-05-27T12:00:00Z",
          sessionStatus: "final",
          responseVariables: [
            {
              identifier: "RESPONSE",
              cardinality: "single",
              baseType: "identifier",
              candidateResponse: {
                values: [{ value: "A" }],
              },
              scoreStatus: "scored",
              answeredStatus: "answered",
            },
          ],
          outcomeVariables: [
            {
              identifier: "SCORE",
              cardinality: "single",
              baseType: "float",
              values: [{ value: "1.0" }],
            },
          ],
        },
      ],
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiAssessmentResultDocumentSchema rejects record response values without field identifiers", () => {
  const parsed = QtiAssessmentResultDocumentSchema.safeParse({
    assessmentResult: {
      context: {},
      itemResults: [
        {
          identifier: "ITEM1",
          datestamp: "2026-05-27T12:00:00Z",
          sessionStatus: "final",
          responseVariables: [
            {
              identifier: "RESPONSE",
              cardinality: "record",
              candidateResponse: {
                values: [{ value: "A" }],
              },
            },
          ],
        },
      ],
    },
  });

  expect(parsed.success).toBe(false);
});

test("QtiAssessmentResultDocumentSchema rejects record outcomes with baseType", () => {
  const parsed = QtiAssessmentResultDocumentSchema.safeParse({
    assessmentResult: {
      context: {},
      testResult: {
        identifier: "TEST1",
        datestamp: "2026-05-27T12:00:00Z",
        outcomeVariables: [
          {
            identifier: "SCORE_BREAKDOWN",
            cardinality: "record",
            baseType: "float",
            values: [{ value: "1.0", fieldIdentifier: "PART_A" }],
          },
        ],
      },
    },
  });

  expect(parsed.success).toBe(false);
});

test("QtiUsageDataDocumentSchema parses ordinary and categorized statistics", () => {
  const parsed = QtiUsageDataDocumentSchema.safeParse({
    usageData: {
      glossary: "https://example.test/glossary",
      statistics: [
        {
          kind: "ordinaryStatistic",
          name: "P_VALUE",
          context: "https://example.test/context/FORM_A",
          caseCount: 12345,
          stdError: 0.01,
          lastUpdated: "2026-05-28",
          targetObjects: [
            {
              identifier: "ITEM-1",
              objectType: "item",
            },
          ],
          value: {
            value: "0.65",
          },
        },
        {
          kind: "categorizedStatistic",
          name: "SCORE_CONVERSION",
          context: "https://example.test/context/FORM_A",
          targetObjects: [
            {
              identifier: "TEST-1",
              objectType: "test",
            },
          ],
          mapping: {
            lowerBound: 0,
            upperBound: 2,
            mapEntries: [
              { mapKey: "0", mappedValue: 100 },
              { mapKey: "1", mappedValue: 200 },
              { mapKey: "2", mappedValue: 300 },
            ],
          },
        },
      ],
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiUsageDataDocumentSchema rejects invalid objectType and mapping bounds", () => {
  const parsed = QtiUsageDataDocumentSchema.safeParse({
    usageData: {
      statistics: [
        {
          kind: "categorizedStatistic",
          name: "SCORE_CONVERSION",
          context: "https://example.test/context/FORM_A",
          targetObjects: [
            {
              identifier: "TEST-1",
              objectType: "testPart",
            },
          ],
          mapping: {
            lowerBound: 10,
            upperBound: 1,
            mapEntries: [{ mapKey: "A", mappedValue: 1 }],
          },
        },
      ],
    },
  });

  expect(parsed.success).toBe(false);
});

test("QtiResponseProcessingDocumentSchema parses typed processing operators", () => {
  const parsed = QtiResponseProcessingDocumentSchema.safeParse({
    responseProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: {
            kind: "integerDivide",
            children: [
              { kind: "baseValue", baseType: "integer", value: "6" },
              { kind: "baseValue", baseType: "integer", value: "2" },
            ],
          },
        },
        {
          kind: "setOutcomeValue",
          identifier: "MATCH",
          expression: {
            kind: "substring",
            caseSensitive: false,
            children: [
              { kind: "baseValue", baseType: "string", value: "alpha" },
              { kind: "baseValue", baseType: "string", value: "alphabet" },
            ],
          },
        },
        {
          kind: "setOutcomeValue",
          identifier: "ROUNDED",
          expression: {
            kind: "equalRounded",
            figures: 2,
            children: [
              { kind: "baseValue", baseType: "float", value: "1.23" },
              { kind: "baseValue", baseType: "float", value: "1.2301" },
            ],
          },
        },
      ],
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiOutcomeProcessingDocumentSchema parses typed aggregate operators", () => {
  const parsed = QtiOutcomeProcessingDocumentSchema.safeParse({
    outcomeProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "MEAN_SCORE",
          expression: {
            kind: "statsOperator",
            name: "mean",
            children: [
              {
                kind: "testVariables",
                variableIdentifier: "SCORE",
                baseType: "float",
                includeCategory: ["scorable"],
              },
            ],
          },
        },
        {
          kind: "setOutcomeValue",
          identifier: "NUM_CORRECT",
          expression: {
            kind: "numberCorrect",
            sectionIdentifier: "SECTION1",
          },
        },
        {
          kind: "setOutcomeValue",
          identifier: "MAX_SCORE",
          expression: {
            kind: "outcomeMaximum",
            outcomeIdentifier: "SCORE",
            includeCategory: ["scorable"],
          },
        },
      ],
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiResponseProcessingDocumentSchema rejects invalid operator parameters", () => {
  const parsed = QtiResponseProcessingDocumentSchema.safeParse({
    responseProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "INDEXED",
          expression: {
            kind: "index",
            n: 0,
            children: [{ kind: "variable", identifier: "RESPONSE" }],
          },
        },
        {
          kind: "setOutcomeValue",
          identifier: "ROUNDED",
          expression: {
            kind: "roundTo",
            roundingMode: "decimalPlaces",
            figures: 0,
            children: [{ kind: "baseValue", baseType: "float", value: "1.234" }],
          },
        },
      ],
    },
  });

  expect(parsed.success).toBe(false);
});

test("QtiOutcomeProcessingDocumentSchema rejects invalid operator arity and ranges", () => {
  const parsed = QtiOutcomeProcessingDocumentSchema.safeParse({
    outcomeProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "ANGLE",
          expression: {
            kind: "mathOperator",
            name: "atan2",
            children: [{ kind: "baseValue", baseType: "float", value: "1.0" }],
          },
        },
        {
          kind: "setOutcomeValue",
          identifier: "WINDOW",
          expression: {
            kind: "anyN",
            min: 2,
            max: 1,
            children: [{ kind: "baseValue", baseType: "boolean", value: "true" }],
          },
        },
      ],
    },
  });

  expect(parsed.success).toBe(false);
});

test("QtiAssessmentSectionDocumentSchema parses a minimal standalone section", () => {
  const parsed = QtiAssessmentSectionDocumentSchema.safeParse({
    assessmentSection: {
      identifier: "SECTION1",
      title: "Standalone Section",
      visible: true,
      children: [
        {
          identifier: "ITEMREF1",
          href: "items/item1.xml",
        },
      ],
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiAssessmentStimulusDocumentSchema parses a minimal stimulus", () => {
  const parsed = QtiAssessmentStimulusDocumentSchema.safeParse({
    assessmentStimulus: {
      identifier: "STIM1",
      title: "Shared Stimulus",
      stimulusBody: {
        content: ["Read the passage before answering the questions."],
      },
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiOutcomeDeclarationDocumentSchema parses a minimal outcome declaration", () => {
  const parsed = QtiOutcomeDeclarationDocumentSchema.safeParse({
    outcomeDeclaration: {
      identifier: "SCORE",
      cardinality: "single",
      baseType: "float",
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiAsiProfileDocumentSchema accepts resource-specific QTI documents", () => {
  const parsed = QtiAsiProfileDocumentSchema.safeParse({
    responseProcessing: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: {
            kind: "baseValue",
            baseType: "float",
            value: "1.0",
          },
        },
      ],
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiAssessmentItemDocumentSchema parses a minimal choice item", () => {
  const parsed = QtiAssessmentItemDocumentSchema.safeParse({
    assessmentItem: {
      identifier: "ITEM1",
      title: "Sample Item",
      timeDependent: false,
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "identifier",
        },
      ],
      outcomeDeclarations: [
        {
          identifier: "SCORE",
          cardinality: "single",
          baseType: "float",
        },
      ],
      itemBody: {
        content: [
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            simpleChoices: [
              {
                kind: "simpleChoice",
                identifier: "A",
                content: ["Choice A"],
              },
              {
                kind: "simpleChoice",
                identifier: "B",
                content: ["Choice B"],
              },
            ],
          },
        ],
      },
      responseProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "SCORE",
            expression: {
              kind: "baseValue",
              baseType: "float",
              value: "1.0",
            },
          },
        ],
      },
    },
  });

  expect(parsed.success).toBe(true);
});

test("QtiAssessmentItemDocumentSchema rejects incompatible response declarations", () => {
  const parsed = QtiAssessmentItemDocumentSchema.safeParse({
    assessmentItem: {
      identifier: "ITEM2",
      title: "Invalid Item",
      timeDependent: false,
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "string",
        },
      ],
      outcomeDeclarations: [
        {
          identifier: "SCORE",
          cardinality: "single",
          baseType: "float",
        },
      ],
      itemBody: {
        content: [
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            simpleChoices: [
              { kind: "simpleChoice", identifier: "A", content: ["A"] },
              { kind: "simpleChoice", identifier: "B", content: ["B"] },
            ],
          },
        ],
      },
    },
  });

  expect(parsed.success).toBe(false);
});

test("QtiAssessmentTestDocumentSchema parses a minimal test document", () => {
  const parsed = QtiAssessmentTestDocumentSchema.safeParse({
    assessmentTest: {
      identifier: "TEST1",
      title: "Sample Test",
      outcomeDeclarations: [
        {
          identifier: "SCORE",
          cardinality: "single",
          baseType: "float",
        },
      ],
      testParts: [
        {
          identifier: "PART1",
          navigationMode: "linear",
          submissionMode: "individual",
          children: [
            {
              identifier: "SECTION1",
              title: "Section 1",
              visible: true,
              children: [
                {
                  identifier: "ITEMREF1",
                  href: "items/item1.xml",
                },
              ],
            },
          ],
        },
      ],
    },
  });

  expect(parsed.success).toBe(true);
});

test("Qti301DerivedZodTemplates exposes expected document templates", () => {
  expect(Qti301DerivedZodTemplates.qtiAssessmentItemDocument).toBe(QtiAssessmentItemDocumentSchema);
  expect(Qti301DerivedZodTemplates.qtiAssessmentResultDocument).toBe(QtiAssessmentResultDocumentSchema);
  expect(Qti301DerivedZodTemplates.qtiUsageDataDocument).toBe(QtiUsageDataDocumentSchema);
});

test("QTI barrel exports prefixed XML extension node helpers", () => {
  const parsed = QtiXmlExtensionNodeSchema.safeParse({
    namespace: "urn:test",
    name: "custom",
    value: "x",
  });

  expect(parsed.success).toBe(true);
});

test("built-in outcome completionStatus needs no declaration in processing rules", () => {
  const parsed = QtiAssessmentItemDocumentSchema.safeParse({
    assessmentItem: {
      identifier: "adaptive-1",
      title: "Adaptive item",
      timeDependent: false,
      adaptive: true,
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "identifier" }],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      itemBody: { content: [{ kind: "xml", name: "p", value: "Stem" }] },
      responseProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "completionStatus",
            expression: { kind: "baseValue", baseType: "identifier", value: "completed" },
          },
        ],
      },
    },
  });

  expect(parsed.success).toBe(true);
});

test("an integer SCORE is accepted — the official corpus ships it", () => {
  const parsed = QtiAssessmentItemDocumentSchema.safeParse({
    assessmentItem: {
      identifier: "integer-score-1",
      title: "Integer score",
      timeDependent: false,
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "identifier" }],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "integer" }],
      itemBody: { content: [{ kind: "xml", name: "p", value: "Stem" }] },
    },
  });

  expect(parsed.success).toBe(true);
});

test("a non-numeric or multiple SCORE is still rejected", () => {
  const parsed = QtiAssessmentItemDocumentSchema.safeParse({
    assessmentItem: {
      identifier: "string-score-1",
      title: "String score",
      timeDependent: false,
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "identifier" }],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "string" }],
      itemBody: { content: [{ kind: "xml", name: "p", value: "Stem" }] },
    },
  });

  expect(parsed.success).toBe(false);
});

test("snake_case completion_status is accepted as the built-in's corpus alias", () => {
  const parsed = QtiAssessmentItemDocumentSchema.safeParse({
    assessmentItem: {
      identifier: "adaptive-2",
      title: "Adaptive item (snake_case authoring)",
      timeDependent: false,
      adaptive: true,
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "identifier" }],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      itemBody: { content: [{ kind: "xml", name: "p", value: "Stem" }] },
      responseProcessing: {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "completion_status",
            expression: { kind: "baseValue", baseType: "identifier", value: "completed" },
          },
        ],
      },
    },
  });

  expect(parsed.success).toBe(true);
});

test("maxChoices 0 means unbounded and never conflicts with minChoices", () => {
  const parsed = QtiAssessmentItemDocumentSchema.safeParse({
    assessmentItem: {
      identifier: "multi-1",
      title: "Pick at least two",
      timeDependent: false,
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "multiple", baseType: "identifier" }],
      itemBody: {
        content: [
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            maxChoices: 0,
            minChoices: 2,
            simpleChoices: [
              { kind: "simpleChoice", identifier: "A" },
              { kind: "simpleChoice", identifier: "B" },
              { kind: "simpleChoice", identifier: "C" },
            ],
          },
        ],
      },
    },
  });

  expect(parsed.success).toBe(true);
});

// ---------- Catalog (CatalogInfo/Catalog/Card/CardEntry, §5.26–5.29) ----------

test("QtiCatalogInfoSchema parses cards with language-keyed entries and direct content", () => {
  // Mirrors the official CatalogWithMultipleSupports.xml: a keyword-translation card
  // with per-language entries plus a linguistic-guidance card carrying direct content.
  const parsed = QtiCatalogInfoSchema.safeParse({
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
          {
            support: "linguistic-guidance",
            htmlContent: { content: ["Accurate means correct."] },
          },
        ],
      },
    ],
  });

  expect(parsed.success).toBe(true);
});

test("QtiCatalogInfoSchema accepts data-* discriminators, defaults, and file references", () => {
  // The sharedStimulus exemplars discriminate spoken entries by data-reading-type; the
  // XSD allows file references with a required mime-type (FileHrefCard, §7.15).
  const parsed = QtiCatalogInfoSchema.safeParse({
    catalogs: [
      {
        id: "cat123_1",
        cards: [
          {
            support: "spoken",
            cardEntries: [
              {
                dataAttributes: { "reading-type": "computer-read-aloud" },
                htmlContent: { content: ["Anina saw the crocodile."] },
              },
              {
                default: true,
                fileHrefs: [{ href: "audio/item123.mp3", mimeType: "audio/mpeg" }],
              },
            ],
          },
        ],
      },
    ],
  });

  expect(parsed.success).toBe(true);
});

test("a card is either entries or direct content, never both (XSD choice)", () => {
  const parsed = QtiCatalogInfoSchema.safeParse({
    catalogs: [
      {
        id: "c1",
        cards: [
          {
            support: "braille",
            htmlContent: { content: ["text"] },
            cardEntries: [{ htmlContent: { content: ["entry"] } }],
          },
        ],
      },
    ],
  });

  expect(parsed.success).toBe(false);
});

test("only one card entry may carry the default designation (§5.27.2)", () => {
  const parsed = QtiCatalogInfoSchema.safeParse({
    catalogs: [
      {
        id: "c1",
        cards: [
          {
            support: "sign-language",
            cardEntries: [
              { xmlLang: "ase", default: true, htmlContent: { content: ["a"] } },
              { xmlLang: "fsl", default: true, htmlContent: { content: ["b"] } },
            ],
          },
        ],
      },
    ],
  });

  expect(parsed.success).toBe(false);
});

test("card supports are the SupportEnum tokens or ext: extension strings", () => {
  const card = (support: string) => ({
    catalogs: [{ id: "c1", cards: [{ support, htmlContent: { content: ["x"] } }] }],
  });

  expect(QtiCatalogInfoSchema.safeParse(card("glossary-on-screen")).success).toBe(true);
  expect(QtiCatalogInfoSchema.safeParse(card("ext:my-program-support")).success).toBe(true);
  expect(QtiCatalogInfoSchema.safeParse(card("not-a-support")).success).toBe(false);
});
