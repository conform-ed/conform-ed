/**
 * Sample items for the harness: one per supported interaction, plus one deliberately
 * unsupported item so the Capability Report and the Unsupported Placeholder (ADR-0003)
 * are visible in the browser.
 */

import type { AssessmentItemView } from "@conform-ed/qti-react";

export interface HarnessItem {
  readonly id: string;
  readonly title: string;
  readonly item: AssessmentItemView;
}

/** An inline two-island "map" so graphic stages display without packaged assets. */
const harnessStageImage = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
    <rect width="400" height="300" fill="#bfdbfe"/>
    <circle cx="110" cy="150" r="55" fill="#86efac"/>
    <circle cx="290" cy="150" r="55" fill="#fcd34d"/>
  </svg>`,
)}`;

export const harnessItems: readonly HarnessItem[] = [
  {
    id: "choice-single",
    title: "choiceInteraction — single cardinality",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "identifier",
          correctResponse: { values: [{ value: "TOKYO" }] },
        },
      ],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      responseProcessing: { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct" },
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Which city is the capital of Japan?" },
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            prompt: { content: [{ kind: "xml", name: "p", value: "Pick exactly one." }] },
            simpleChoices: [
              { identifier: "OSAKA", content: [{ kind: "xml", name: "span", value: "Osaka" }] },
              { identifier: "TOKYO", content: [{ kind: "xml", name: "span", value: "Tokyo" }] },
              { identifier: "KYOTO", content: [{ kind: "xml", name: "span", value: "Kyoto" }] },
            ],
          },
        ],
      },
    },
  },
  {
    id: "choice-multiple",
    title: "choiceInteraction — multiple cardinality (mapped scoring)",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "multiple",
          baseType: "identifier",
          correctResponse: { values: [{ value: "HIRAGANA" }, { value: "KATAKANA" }] },
          mapping: {
            lowerBound: 0,
            upperBound: 2,
            defaultValue: -1,
            mapEntries: [
              { mapKey: "HIRAGANA", mappedValue: 1 },
              { mapKey: "KATAKANA", mappedValue: 1 },
              { mapKey: "HANGUL", mappedValue: -1 },
            ],
          },
        },
      ],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      responseProcessing: { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response" },
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Which scripts are Japanese syllabaries?" },
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            simpleChoices: [
              { identifier: "HIRAGANA", content: [{ kind: "xml", name: "span", value: "Hiragana" }] },
              { identifier: "KATAKANA", content: [{ kind: "xml", name: "span", value: "Katakana" }] },
              { identifier: "HANGUL", content: [{ kind: "xml", name: "span", value: "Hangul" }] },
            ],
          },
        ],
      },
    },
  },
  {
    id: "text-entry",
    title: "textEntryInteraction — string response",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "string",
          correctResponse: { values: [{ value: "kawa" }] },
        },
      ],
      itemBody: {
        content: [
          {
            kind: "xml",
            name: "p",
            children: [
              { kind: "xml", name: "span", value: "The Japanese word " },
              {
                kind: "xml",
                name: "ruby",
                children: [
                  { kind: "xml", name: "span", value: "川" },
                  { kind: "xml", name: "rt", value: "かわ" },
                ],
              },
              { kind: "xml", name: "span", value: " is romanized as:" },
            ],
          },
          {
            kind: "textEntryInteraction",
            responseIdentifier: "RESPONSE",
            expectedLength: 10,
            placeholderText: "romaji",
          },
        ],
      },
    },
  },
  {
    id: "inline-choice",
    title: "inlineChoiceInteraction — select within flow",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "identifier",
          correctResponse: { values: [{ value: "GA" }] },
        },
      ],
      itemBody: {
        content: [
          {
            kind: "xml",
            name: "p",
            children: [{ kind: "xml", name: "span", value: "ねこ ___ すき です。 (Choose the particle.)" }],
          },
          {
            kind: "inlineChoiceInteraction",
            responseIdentifier: "RESPONSE",
            inlineChoices: [
              { identifier: "GA", content: [{ kind: "text", value: "が" }] },
              { identifier: "WO", content: [{ kind: "text", value: "を" }] },
              { identifier: "NI", content: [{ kind: "text", value: "に" }] },
            ],
          },
        ],
      },
    },
  },
  {
    id: "extended-text",
    title: "extendedTextInteraction — free text",
    item: {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "string" }],
      itemBody: {
        content: [
          {
            kind: "extendedTextInteraction",
            responseIdentifier: "RESPONSE",
            prompt: { content: [{ kind: "xml", name: "p", value: "Describe your favourite meal in Japanese." }] },
            expectedLines: 5,
            placeholderText: "自由に書いてください",
          },
        ],
      },
    },
  },
  {
    id: "order",
    title: "orderInteraction — sequence the steps",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "ordered",
          baseType: "identifier",
          correctResponse: { values: [{ value: "FILL" }, { value: "BOIL" }, { value: "POUR" }] },
        },
      ],
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Put the tea-making steps in order." },
          {
            kind: "orderInteraction",
            responseIdentifier: "RESPONSE",
            simpleChoices: [
              { identifier: "BOIL", content: [{ kind: "xml", name: "span", value: "Boil the water" }] },
              { identifier: "POUR", content: [{ kind: "xml", name: "span", value: "Pour over the leaves" }] },
              { identifier: "FILL", content: [{ kind: "xml", name: "span", value: "Fill the kettle" }] },
            ],
          },
        ],
      },
    },
  },
  {
    id: "hottext",
    title: "hottextInteraction — select words in prose",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "multiple",
          baseType: "identifier",
          correctResponse: { values: [{ value: "RUNS" }] },
        },
      ],
      itemBody: {
        content: [
          {
            kind: "hottextInteraction",
            responseIdentifier: "RESPONSE",
            maxChoices: 2,
            prompt: { content: [{ kind: "xml", name: "p", value: "Select the verb." }] },
            content: [
              {
                kind: "xml",
                name: "p",
                children: [
                  { kind: "xml", name: "span", value: "The " },
                  { kind: "hottext", identifier: "CAT", content: [{ kind: "text", value: "cat" }] },
                  { kind: "xml", name: "span", value: " " },
                  { kind: "hottext", identifier: "RUNS", content: [{ kind: "text", value: "runs" }] },
                  { kind: "xml", name: "span", value: " quickly." },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "match",
    title: "matchInteraction — vocabulary grid",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "multiple",
          baseType: "directedPair",
          correctResponse: { values: [{ value: "CAT 猫" }, { value: "DOG 犬" }] },
        },
      ],
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Match each English word to its Japanese equivalent." },
          {
            kind: "matchInteraction",
            responseIdentifier: "RESPONSE",
            simpleMatchSets: [
              {
                simpleAssociableChoices: [
                  { identifier: "CAT", content: [{ kind: "text", value: "cat" }] },
                  { identifier: "DOG", content: [{ kind: "text", value: "dog" }] },
                ],
              },
              {
                simpleAssociableChoices: [
                  { identifier: "猫", content: [{ kind: "text", value: "猫" }] },
                  { identifier: "犬", content: [{ kind: "text", value: "犬" }] },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "associate",
    title: "associateInteraction — build pairs",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "multiple",
          baseType: "pair",
          correctResponse: { values: [{ value: "SUN 日" }, { value: "MOON 月" }] },
        },
      ],
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Pair each word with its kanji." },
          {
            kind: "associateInteraction",
            responseIdentifier: "RESPONSE",
            simpleAssociableChoices: [
              { identifier: "SUN", content: [{ kind: "text", value: "sun" }] },
              { identifier: "MOON", content: [{ kind: "text", value: "moon" }] },
              { identifier: "日", content: [{ kind: "text", value: "日" }] },
              { identifier: "月", content: [{ kind: "text", value: "月" }] },
            ],
          },
        ],
      },
    },
  },
  {
    id: "gap-match",
    title: "gapMatchInteraction — fill the gaps from a word bank",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "multiple",
          baseType: "directedPair",
          correctResponse: { values: [{ value: "WINTER G1" }, { value: "SUMMER G2" }] },
        },
      ],
      itemBody: {
        content: [
          {
            kind: "gapMatchInteraction",
            responseIdentifier: "RESPONSE",
            gapTexts: [
              { identifier: "WINTER", content: [{ kind: "text", value: "winter" }] },
              { identifier: "SUMMER", content: [{ kind: "text", value: "summer" }] },
            ],
            content: [
              {
                kind: "xml",
                name: "p",
                children: [
                  { kind: "xml", name: "span", value: "Snow falls in " },
                  { kind: "gap", identifier: "G1" },
                  { kind: "xml", name: "span", value: " and cicadas sing in " },
                  { kind: "gap", identifier: "G2" },
                  { kind: "xml", name: "span", value: "." },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "feedback",
    title: "choiceInteraction — custom RP with feedback (ADR-0004)",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "identifier",
          correctResponse: { values: [{ value: "GA" }] },
        },
      ],
      outcomeDeclarations: [
        { identifier: "SCORE", cardinality: "single", baseType: "float" },
        { identifier: "FEEDBACK", cardinality: "single", baseType: "identifier" },
      ],
      responseProcessing: {
        rules: [
          {
            kind: "responseCondition",
            responseIf: {
              expression: {
                kind: "match",
                expressions: [
                  { kind: "variable", identifier: "RESPONSE" },
                  { kind: "correct", identifier: "RESPONSE" },
                ],
              },
              rules: [
                {
                  kind: "setOutcomeValue",
                  identifier: "SCORE",
                  expression: { kind: "baseValue", baseType: "float", value: 1 },
                },
                {
                  kind: "setOutcomeValue",
                  identifier: "FEEDBACK",
                  expression: { kind: "baseValue", baseType: "identifier", value: "CORRECT" },
                },
              ],
            },
            responseElse: {
              rules: [
                {
                  kind: "setOutcomeValue",
                  identifier: "FEEDBACK",
                  expression: { kind: "baseValue", baseType: "identifier", value: "INCORRECT" },
                },
              ],
            },
          },
        ],
      },
      modalFeedbacks: [
        {
          outcomeIdentifier: "FEEDBACK",
          identifier: "CORRECT",
          showHide: "show",
          content: [{ kind: "xml", name: "p", value: "正解！ が marks the subject of すき." }],
        },
      ],
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "ねこ ___ すき です。 (Choose the particle.)" },
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            simpleChoices: [
              { identifier: "GA", content: [{ kind: "xml", name: "span", value: "が" }] },
              { identifier: "WO", content: [{ kind: "xml", name: "span", value: "を" }] },
            ],
          },
          {
            kind: "feedbackBlock",
            outcomeIdentifier: "FEEDBACK",
            identifier: "INCORRECT",
            showHide: "show",
            content: [{ kind: "xml", name: "p", value: "Not quite — すき takes が for its object." }],
          },
        ],
      },
    },
  },
  {
    id: "slider",
    title: "sliderInteraction — numeric scale",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "integer",
          correctResponse: { values: [{ value: "5" }] },
        },
      ],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      responseProcessing: { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct" },
      itemBody: {
        content: [
          {
            kind: "sliderInteraction",
            responseIdentifier: "RESPONSE",
            lowerBound: 0,
            upperBound: 10,
            step: 1,
            prompt: {
              content: [{ kind: "xml", name: "p", value: "日本語 has how many vowel sounds? (Slide to answer.)" }],
            },
          },
        ],
      },
    },
  },
  {
    id: "upload",
    title: "uploadInteraction — file response",
    item: {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "file" }],
      itemBody: {
        content: [
          {
            kind: "uploadInteraction",
            responseIdentifier: "RESPONSE",
            type: "application/pdf",
            prompt: { content: [{ kind: "xml", name: "p", value: "Upload your handwriting practice sheet (PDF)." }] },
          },
        ],
      },
    },
  },
  {
    id: "media",
    title: "mediaInteraction — limited-play audio",
    item: {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "integer" }],
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Listen to the dialogue (at most 2 plays), then move on." },
          {
            kind: "mediaInteraction",
            responseIdentifier: "RESPONSE",
            maxPlays: 2,
            content: [{ kind: "xml", name: "audio", attributes: { src: "audio/dialogue.mp3" } }],
          },
        ],
      },
    },
  },
  {
    id: "hotspot",
    title: "hotspotInteraction — click a region",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "identifier",
          correctResponse: { values: [{ value: "EAST" }] },
        },
      ],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      responseProcessing: { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct" },
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Click the eastern island." },
          {
            kind: "hotspotInteraction",
            responseIdentifier: "RESPONSE",
            object: { data: harnessStageImage, width: 400, height: 300 },
            maxChoices: 1,
            hotspotChoices: [
              { identifier: "WEST", shape: "circle", coords: [110, 150, 60] },
              { identifier: "EAST", shape: "circle", coords: [290, 150, 60] },
            ],
          },
        ],
      },
    },
  },
  {
    id: "select-point",
    title: "selectPointInteraction — areaMapping scoring",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "point",
          areaMapping: {
            defaultValue: 0,
            areaMapEntries: [{ shape: "circle", coords: [290, 150, 60], mappedValue: 1 }],
          },
        },
      ],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      responseProcessing: { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response_point" },
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Mark the eastern island by clicking it." },
          {
            kind: "selectPointInteraction",
            responseIdentifier: "RESPONSE",
            object: { data: harnessStageImage, width: 400, height: 300 },
            maxChoices: 1,
          },
        ],
      },
    },
  },
  {
    id: "templated",
    title: "textEntryInteraction — templated clone (seeded randomInteger)",
    item: {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "integer" }],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      templateDeclarations: [
        { identifier: "A", cardinality: "single", baseType: "integer" },
        { identifier: "B", cardinality: "single", baseType: "integer" },
      ],
      templateProcessing: {
        rules: [
          { kind: "setTemplateValue", identifier: "A", expression: { kind: "randomInteger", min: 2, max: 9 } },
          { kind: "setTemplateValue", identifier: "B", expression: { kind: "randomInteger", min: 2, max: 9 } },
          {
            kind: "setCorrectResponse",
            identifier: "RESPONSE",
            expression: {
              kind: "sum",
              expressions: [
                { kind: "variable", identifier: "A" },
                { kind: "variable", identifier: "B" },
              ],
            },
          },
        ],
      },
      responseProcessing: { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct" },
      itemBody: {
        content: [
          {
            kind: "xml",
            name: "p",
            children: [
              { kind: "text", value: "What is " },
              { kind: "printedVariable", identifier: "A" },
              { kind: "text", value: " + " },
              { kind: "printedVariable", identifier: "B" },
              { kind: "text", value: "? (Reload to get a new clone.)" },
            ],
          },
          { kind: "textEntryInteraction", responseIdentifier: "RESPONSE", expectedLength: 3 },
        ],
      },
    },
  },
  {
    id: "adaptive",
    title: "choiceInteraction — adaptive with hint (endAttemptInteraction)",
    item: {
      adaptive: true,
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "identifier",
          correctResponse: { values: [{ value: "DESU" }] },
        },
        { identifier: "HINT", cardinality: "single", baseType: "boolean" },
      ],
      outcomeDeclarations: [
        { identifier: "SCORE", cardinality: "single", baseType: "float" },
        { identifier: "FEEDBACK", cardinality: "single", baseType: "identifier" },
      ],
      responseProcessing: {
        rules: [
          {
            kind: "responseCondition",
            responseIf: {
              expression: {
                kind: "match",
                expressions: [
                  { kind: "variable", identifier: "RESPONSE" },
                  { kind: "correct", identifier: "RESPONSE" },
                ],
              },
              rules: [
                {
                  kind: "setOutcomeValue",
                  identifier: "SCORE",
                  expression: {
                    kind: "sum",
                    expressions: [
                      { kind: "variable", identifier: "SCORE" },
                      { kind: "baseValue", baseType: "float", value: 2 },
                    ],
                  },
                },
                {
                  kind: "setOutcomeValue",
                  identifier: "completionStatus",
                  expression: { kind: "baseValue", baseType: "identifier", value: "completed" },
                },
              ],
            },
            responseElseIfs: [
              {
                expression: {
                  kind: "match",
                  expressions: [
                    { kind: "variable", identifier: "HINT" },
                    { kind: "baseValue", baseType: "boolean", value: true },
                  ],
                },
                rules: [
                  {
                    kind: "setOutcomeValue",
                    identifier: "SCORE",
                    expression: {
                      kind: "subtract",
                      expressions: [
                        { kind: "variable", identifier: "SCORE" },
                        { kind: "baseValue", baseType: "float", value: 1 },
                      ],
                    },
                  },
                  {
                    kind: "setOutcomeValue",
                    identifier: "FEEDBACK",
                    expression: { kind: "baseValue", baseType: "identifier", value: "HINT" },
                  },
                  {
                    kind: "setOutcomeValue",
                    identifier: "completionStatus",
                    expression: { kind: "baseValue", baseType: "identifier", value: "incomplete" },
                  },
                ],
              },
            ],
            responseElse: {
              rules: [
                {
                  kind: "setOutcomeValue",
                  identifier: "FEEDBACK",
                  expression: { kind: "baseValue", baseType: "identifier", value: "WRONG" },
                },
                {
                  kind: "setOutcomeValue",
                  identifier: "completionStatus",
                  expression: { kind: "baseValue", baseType: "identifier", value: "incomplete" },
                },
              ],
            },
          },
        ],
      },
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "ねこ ___ かわいい。 (Pick the copula. Wrong answers let you retry.)" },
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            simpleChoices: [
              { identifier: "DESU", content: [{ kind: "xml", name: "span", value: "です" }] },
              { identifier: "MASU", content: [{ kind: "xml", name: "span", value: "ます" }] },
            ],
          },
          {
            kind: "feedbackBlock",
            outcomeIdentifier: "FEEDBACK",
            identifier: "HINT",
            showHide: "show",
            content: [{ kind: "xml", name: "p", value: "Hint: the polite copula ends a noun-adjective sentence." }],
          },
          {
            kind: "feedbackBlock",
            outcomeIdentifier: "FEEDBACK",
            identifier: "WRONG",
            showHide: "show",
            content: [{ kind: "xml", name: "p", value: "Not quite — try again." }],
          },
          { kind: "endAttemptInteraction", responseIdentifier: "HINT", title: "Show hint (−1 point)" },
        ],
      },
    },
  },
  {
    id: "pci-dice-roller",
    title: "portableCustomInteraction — dice roller PCI (opt-in host)",
    item: {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "integer" }],
      outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
      // Scored by custom rules: any landed six counts (the roll count is the response).
      responseProcessing: {
        rules: [
          {
            kind: "responseCondition",
            responseIf: {
              expression: { kind: "isNull", expressions: [{ kind: "variable", identifier: "RESPONSE" }] },
              rules: [
                {
                  kind: "setOutcomeValue",
                  identifier: "SCORE",
                  expression: { kind: "baseValue", baseType: "float", value: 0 },
                },
              ],
            },
            responseElse: {
              rules: [
                {
                  kind: "setOutcomeValue",
                  identifier: "SCORE",
                  expression: { kind: "baseValue", baseType: "float", value: 1 },
                },
              ],
            },
          },
        ],
      },
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Roll the die until you land a six, then submit." },
          {
            kind: "portableCustomInteraction",
            responseIdentifier: "RESPONSE",
            customInteractionTypeIdentifier: "urn:conform-ed:pci:dice-roller",
            module: "dice-roller",
            properties: { target: "6" },
            interactionMarkup: {
              content: [
                {
                  kind: "xml",
                  name: "section",
                  attributes: { class: "dice" },
                  children: [
                    { kind: "xml", name: "button", attributes: { class: "roll", type: "button" }, value: "Roll" },
                    { kind: "xml", name: "output", attributes: { class: "face" } },
                  ],
                },
              ],
            },
          } as never,
        ],
      },
    },
  },
  {
    id: "unsupported",
    title: "drawingInteraction — not yet supported (capability gate demo)",
    item: {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "file" }],
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Sketch the kanji stroke order." },
          {
            kind: "drawingInteraction",
            responseIdentifier: "RESPONSE",
            object: { data: "images/grid.png", width: 200, height: 200 },
          },
        ],
      },
    },
  },
];
