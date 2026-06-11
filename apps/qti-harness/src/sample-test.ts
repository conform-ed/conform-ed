/**
 * The harness's sample assessment test: one nonlinear part whose section selects three
 * of four items (seeded), test-level outcome processing (TOTAL via testVariables, a
 * pass/fail GRADE), and at-end feedback that prints the total. Items cover a fixed
 * choice, a mapped text entry, a templated arithmetic clone, and a hottext pick.
 */

import type { AssessmentItemView, AssessmentTestView } from "@conform-ed/qti-react";

const matchCorrectUri = "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct";
const mapResponseUri = "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response";

const capitalChoice: AssessmentItemView = {
  responseDeclarations: [
    {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correctResponse: { values: [{ value: "edinburgh" }] },
    },
  ],
  outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
  responseProcessing: { template: matchCorrectUri },
  itemBody: {
    content: [
      {
        kind: "choiceInteraction",
        responseIdentifier: "RESPONSE",
        maxChoices: 1,
        prompt: { content: [{ kind: "text", value: "What is the capital of Scotland?" }] },
        simpleChoices: [
          { identifier: "glasgow", content: [{ kind: "text", value: "Glasgow" }] },
          { identifier: "edinburgh", content: [{ kind: "text", value: "Edinburgh" }] },
          { identifier: "aberdeen", content: [{ kind: "text", value: "Aberdeen" }] },
        ],
      },
    ],
  },
};

const riverEntry: AssessmentItemView = {
  responseDeclarations: [
    {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "string",
      correctResponse: { values: [{ value: "Tay" }] },
      mapping: {
        defaultValue: 0,
        mapEntries: [
          { mapKey: "Tay", mappedValue: 1 },
          { mapKey: "tay", mappedValue: 0.5 },
        ],
      },
    },
  ],
  outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
  responseProcessing: { template: mapResponseUri },
  itemBody: {
    content: [
      {
        kind: "xml",
        name: "p",
        children: [
          { kind: "text", value: "Scotland's longest river is the " },
          { kind: "textEntryInteraction", responseIdentifier: "RESPONSE", expectedLength: 10 },
          { kind: "text", value: "." },
        ],
      },
    ],
  },
};

const additionClone: AssessmentItemView = {
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
  responseProcessing: { template: matchCorrectUri },
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
          { kind: "text", value: "? " },
          { kind: "textEntryInteraction", responseIdentifier: "RESPONSE", expectedLength: 3 },
        ],
      },
    ],
  },
};

const verbHottext: AssessmentItemView = {
  responseDeclarations: [
    {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correctResponse: { values: [{ value: "ran" }] },
    },
  ],
  outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
  responseProcessing: { template: matchCorrectUri },
  itemBody: {
    content: [
      {
        kind: "hottextInteraction",
        responseIdentifier: "RESPONSE",
        maxChoices: 1,
        prompt: { content: [{ kind: "text", value: "Pick the verb:" }] },
        content: [
          {
            kind: "xml",
            name: "p",
            children: [
              { kind: "text", value: "The " },
              { kind: "hottext", identifier: "dog", content: [{ kind: "text", value: "dog" }] },
              { kind: "text", value: " " },
              { kind: "hottext", identifier: "ran", content: [{ kind: "text", value: "ran" }] },
              { kind: "text", value: " " },
              { kind: "hottext", identifier: "home", content: [{ kind: "text", value: "home" }] },
              { kind: "text", value: "." },
            ],
          },
        ],
      },
    ],
  },
};

export const sampleTestItems: Readonly<Record<string, AssessmentItemView>> = {
  "capital-choice": capitalChoice,
  "river-entry": riverEntry,
  "addition-clone": additionClone,
  "verb-hottext": verbHottext,
};

export const sampleTest: AssessmentTestView = {
  identifier: "harness-sample-test",
  title: "Harness sample test",
  outcomeDeclarations: [
    { identifier: "TOTAL", cardinality: "single", baseType: "float" },
    { identifier: "GRADE", cardinality: "single", baseType: "identifier" },
  ],
  testParts: [
    {
      identifier: "PART-1",
      navigationMode: "nonlinear",
      submissionMode: "individual",
      assessmentSections: [
        {
          kind: "assessmentSection",
          identifier: "SECTION-1",
          title: "Three of four (seeded selection)",
          // The seed picks which three deliver — change it in the harness to see
          // selection and the templated clone re-draw together.
          selection: { select: 3 },
          children: [
            { kind: "assessmentItemRef", identifier: "capital-choice" },
            { kind: "assessmentItemRef", identifier: "river-entry" },
            { kind: "assessmentItemRef", identifier: "addition-clone" },
            { kind: "assessmentItemRef", identifier: "verb-hottext" },
          ],
        },
      ],
    },
  ],
  outcomeProcessing: {
    rules: [
      {
        kind: "setOutcomeValue",
        identifier: "TOTAL",
        expression: { kind: "sum", expressions: [{ kind: "testVariables", identifier: "SCORE" }] },
      },
      {
        kind: "outcomeCondition",
        outcomeIf: {
          expression: {
            kind: "gte",
            expressions: [
              { kind: "variable", identifier: "TOTAL" },
              { kind: "baseValue", baseType: "float", value: 2 },
            ],
          },
          rules: [
            {
              kind: "setOutcomeValue",
              identifier: "GRADE",
              expression: { kind: "baseValue", baseType: "identifier", value: "pass" },
            },
          ],
        },
        outcomeElse: {
          rules: [
            {
              kind: "setOutcomeValue",
              identifier: "GRADE",
              expression: { kind: "baseValue", baseType: "identifier", value: "fail" },
            },
          ],
        },
      },
    ],
  },
  testFeedbacks: [
    {
      access: "atEnd",
      outcomeIdentifier: "GRADE",
      identifier: "pass",
      showHide: "show",
      content: [
        {
          kind: "xml",
          name: "p",
          children: [
            { kind: "text", value: "Well done — you scored " } as never,
            { kind: "printedVariable", identifier: "TOTAL" } as never,
            { kind: "text", value: " points." } as never,
          ],
        },
      ],
    },
    {
      access: "atEnd",
      outcomeIdentifier: "GRADE",
      identifier: "fail",
      showHide: "show",
      content: [
        {
          kind: "xml",
          name: "p",
          children: [
            { kind: "text", value: "You scored " } as never,
            { kind: "printedVariable", identifier: "TOTAL" } as never,
            { kind: "text", value: " — two points pass. Try another seed." } as never,
          ],
        },
      ],
    },
  ],
};
