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
    id: "unsupported",
    title: "hotspotInteraction — not yet supported (capability gate demo)",
    item: {
      responseDeclarations: [
        {
          identifier: "RESPONSE",
          cardinality: "single",
          baseType: "identifier",
          correctResponse: { values: [{ value: "A" }] },
        },
      ],
      itemBody: {
        content: [
          { kind: "xml", name: "p", value: "Click the region on the image." },
          {
            kind: "hotspotInteraction",
            responseIdentifier: "RESPONSE",
            hotspotChoices: [{ identifier: "A" }, { identifier: "B" }],
          },
        ],
      },
    },
  },
];
