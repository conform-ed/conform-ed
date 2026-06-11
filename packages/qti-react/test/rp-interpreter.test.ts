import { describe, expect, test } from "bun:test";

import { executeResponseProcessing } from "../src/rp";
import type { OutcomeDeclarationView, ResponseProcessingView } from "../src/rp";
import type { ResponseDeclarationView, ResponseValue } from "../src/types";

const scoreOutcome: OutcomeDeclarationView = { identifier: "SCORE", cardinality: "single", baseType: "float" };

const singleChoice: ResponseDeclarationView = {
  identifier: "RESPONSE",
  cardinality: "single",
  baseType: "identifier",
  correctResponse: { values: [{ value: "B" }] },
};

function run(
  responseProcessing: ResponseProcessingView,
  responses: Record<string, ResponseValue>,
  declarations: readonly ResponseDeclarationView[] = [singleChoice],
  outcomes: readonly OutcomeDeclarationView[] = [scoreOutcome],
) {
  return executeResponseProcessing(responseProcessing, {
    responseDeclarations: declarations,
    outcomeDeclarations: outcomes,
    responses,
  });
}

describe("standard template URIs resolve to built-in canonical trees", () => {
  const template: ResponseProcessingView = {
    template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct",
  };

  test("match_correct: correct response scores 1", () => {
    expect(run(template, { RESPONSE: "B" }).outcomes["SCORE"]).toBe(1);
  });

  test("match_correct: wrong or missing response scores 0", () => {
    expect(run(template, { RESPONSE: "A" }).outcomes["SCORE"]).toBe(0);
    expect(run(template, {}).outcomes["SCORE"]).toBe(0);
  });

  test("CC2_match scores 1/0 like match_correct", () => {
    const view: ResponseProcessingView = {
      template: "https://www.imsglobal.org/question/qti_v3p0/rptemplates/CC2_match.xml",
    };

    expect(run(view, { RESPONSE: "B" }).outcomes["SCORE"]).toBe(1);
    expect(run(view, { RESPONSE: "A" }).outcomes["SCORE"]).toBe(0);
  });

  test("CC2_match_basic awards MAXSCORE and sets FEEDBACKBASIC", () => {
    const view: ResponseProcessingView = {
      template: "https://www.imsglobal.org/question/qti_v3p0/rptemplates/CC2_match_basic.xml",
    };
    const outcomes: readonly OutcomeDeclarationView[] = [
      scoreOutcome,
      {
        identifier: "MAXSCORE",
        cardinality: "single",
        baseType: "float",
        defaultValue: { values: [{ value: 10 }] },
      },
      { identifier: "FEEDBACKBASIC", cardinality: "single", baseType: "identifier" },
    ];

    const correct = run(view, { RESPONSE: "B" }, [singleChoice], outcomes);
    expect(correct.outcomes["SCORE"]).toBe(10);
    expect(correct.outcomes["FEEDBACKBASIC"]).toBe("correct");

    const wrong = run(view, { RESPONSE: "A" }, [singleChoice], outcomes);
    expect(wrong.outcomes["FEEDBACKBASIC"]).toBe("incorrect");
  });

  test("CC2_map_response maps the response and derives FEEDBACK from MAXSCORE", () => {
    const view: ResponseProcessingView = {
      template: "https://www.imsglobal.org/question/qti_v3p0/rptemplates/CC2_map_response.xml",
    };
    const mapped: ResponseDeclarationView = {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "string",
      mapping: { defaultValue: 0, mapEntries: [{ mapKey: "york", mappedValue: 1 }] },
    };
    const outcomes: readonly OutcomeDeclarationView[] = [
      scoreOutcome,
      {
        identifier: "MAXSCORE",
        cardinality: "single",
        baseType: "float",
        defaultValue: { values: [{ value: 1 }] },
      },
      { identifier: "FEEDBACK", cardinality: "single", baseType: "identifier" },
    ];

    const full = run(view, { RESPONSE: "york" }, [mapped], outcomes);
    expect(full.outcomes["SCORE"]).toBe(1);
    expect(full.outcomes["FEEDBACK"]).toBe("correct");

    const empty = run(view, { RESPONSE: null }, [mapped], outcomes);
    expect(empty.outcomes["SCORE"]).toBe(0);
    expect(empty.outcomes["FEEDBACK"]).toBe("incorrect");
  });

  test("map_response: maps members, null response scores 0", () => {
    const mapped: ResponseDeclarationView = {
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "identifier",
      mapping: {
        defaultValue: 0,
        mapEntries: [
          { mapKey: "A", mappedValue: 1 },
          { mapKey: "C", mappedValue: 2 },
        ],
      },
    };
    const view: ResponseProcessingView = {
      template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response",
    };

    expect(run(view, { RESPONSE: ["A", "C"] }, [mapped]).outcomes["SCORE"]).toBe(3);
    expect(run(view, {}, [mapped]).outcomes["SCORE"]).toBe(0);
  });

  test("unknown template URI is reported and outcomes keep defaults", () => {
    const result = run({ template: "https://example.com/rptemplates/bespoke" }, { RESPONSE: "B" });

    expect(result.issues[0]?.type).toBe("unsupported-rp");
    expect(result.outcomes["SCORE"]).toBe(0);
  });
});

describe("explicit rule trees", () => {
  test("responseCondition if/elseIf/else with setOutcomeValue", () => {
    const view: ResponseProcessingView = {
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
                expression: { kind: "baseValue", baseType: "float", value: 2 },
              },
            ],
          },
          responseElseIfs: [
            {
              expression: {
                kind: "isNull",
                expressions: [{ kind: "variable", identifier: "RESPONSE" }],
              },
              rules: [
                {
                  kind: "setOutcomeValue",
                  identifier: "SCORE",
                  expression: { kind: "baseValue", baseType: "float", value: 0 },
                },
              ],
            },
          ],
          responseElse: {
            rules: [
              {
                kind: "setOutcomeValue",
                identifier: "SCORE",
                expression: { kind: "baseValue", baseType: "float", value: -1 },
              },
            ],
          },
        },
      ],
    };

    expect(run(view, { RESPONSE: "B" }).outcomes["SCORE"]).toBe(2);
    expect(run(view, {}).outcomes["SCORE"]).toBe(0);
    expect(run(view, { RESPONSE: "A" }).outcomes["SCORE"]).toBe(-1);
  });

  test("logical and numeric operators: and/or/not, sum/gt, member", () => {
    const hottext: ResponseDeclarationView = {
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "identifier",
      correctResponse: { values: [{ value: "H2" }] },
    };
    const view: ResponseProcessingView = {
      rules: [
        {
          kind: "responseCondition",
          responseIf: {
            expression: {
              kind: "and",
              expressions: [
                {
                  kind: "member",
                  expressions: [
                    { kind: "baseValue", baseType: "identifier", value: "H2" },
                    { kind: "variable", identifier: "RESPONSE" },
                  ],
                },
                {
                  kind: "not",
                  expressions: [
                    {
                      kind: "member",
                      expressions: [
                        { kind: "baseValue", baseType: "identifier", value: "H1" },
                        { kind: "variable", identifier: "RESPONSE" },
                      ],
                    },
                  ],
                },
              ],
            },
            rules: [
              {
                kind: "setOutcomeValue",
                identifier: "SCORE",
                expression: {
                  kind: "sum",
                  expressions: [
                    { kind: "baseValue", baseType: "float", value: 0.5 },
                    { kind: "baseValue", baseType: "float", value: 0.5 },
                  ],
                },
              },
            ],
          },
          responseElse: {
            rules: [
              {
                kind: "setOutcomeValue",
                identifier: "SCORE",
                expression: { kind: "baseValue", baseType: "float", value: 0 },
              },
            ],
          },
        },
        {
          kind: "responseCondition",
          responseIf: {
            expression: {
              kind: "gt",
              expressions: [
                { kind: "variable", identifier: "SCORE" },
                { kind: "baseValue", baseType: "float", value: 0.75 },
              ],
            },
            rules: [
              {
                kind: "setOutcomeValue",
                identifier: "FEEDBACK",
                expression: { kind: "baseValue", baseType: "identifier", value: "WELL_DONE" },
              },
            ],
          },
        },
      ],
    };
    const outcomes: readonly OutcomeDeclarationView[] = [
      scoreOutcome,
      { identifier: "FEEDBACK", cardinality: "single", baseType: "identifier" },
    ];

    const correct = run(view, { RESPONSE: ["H2"] }, [hottext], outcomes);

    expect(correct.outcomes["SCORE"]).toBe(1);
    expect(correct.outcomes["FEEDBACK"]).toBe("WELL_DONE");

    const wrong = run(view, { RESPONSE: ["H1", "H2"] }, [hottext], outcomes);

    expect(wrong.outcomes["SCORE"]).toBe(0);
    expect(wrong.outcomes["FEEDBACK"]).toBeNull();
  });

  test("exitResponse stops execution", () => {
    const view: ResponseProcessingView = {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "baseValue", baseType: "float", value: 1 },
        },
        { kind: "exitResponse" },
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "baseValue", baseType: "float", value: 99 },
        },
      ],
    };

    expect(run(view, {}).outcomes["SCORE"]).toBe(1);
  });

  test("outcome defaults: declared defaultValue wins, numeric undeclared default to 0, others null", () => {
    const outcomes: readonly OutcomeDeclarationView[] = [
      scoreOutcome,
      {
        identifier: "THRESHOLD",
        cardinality: "single",
        baseType: "float",
        defaultValue: { values: [{ value: 0.5 }] },
      },
      { identifier: "FEEDBACK", cardinality: "single", baseType: "identifier" },
    ];

    const result = run({ rules: [] }, {}, [singleChoice], outcomes);

    expect(result.outcomes["SCORE"]).toBe(0);
    expect(result.outcomes["THRESHOLD"]).toBe(0.5);
    expect(result.outcomes["FEEDBACK"]).toBeNull();
  });

  test("pair equality applies inside match", () => {
    const pairDeclaration: ResponseDeclarationView = {
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "pair",
      correctResponse: { values: [{ value: "A B" }] },
    };
    const view: ResponseProcessingView = {
      template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct",
    };

    expect(run(view, { RESPONSE: ["B A"] }, [pairDeclaration]).outcomes["SCORE"]).toBe(1);
  });

  test("unsupported operator aborts to defaults and reports", () => {
    const view: ResponseProcessingView = {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "customOperator", expressions: [] },
        },
      ],
    };

    const result = run(view, { RESPONSE: "B" });

    expect(result.issues[0]?.type).toBe("unsupported-rp");
    expect(result.issues[0]?.name).toBe("customOperator");
    expect(result.outcomes["SCORE"]).toBe(0);
  });
});

describe("spec-strict string matching with opt-in normalization (ADR-0004)", () => {
  const textEntry: ResponseDeclarationView = {
    identifier: "RESPONSE",
    cardinality: "single",
    baseType: "string",
    correctResponse: { values: [{ value: "café" }] },
  };
  const template: ResponseProcessingView = {
    template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct",
  };

  test("strict by default: case/diacritics must match exactly", () => {
    expect(run(template, { RESPONSE: "cafe" }, [textEntry]).outcomes["SCORE"]).toBe(0);
    expect(run(template, { RESPONSE: "café" }, [textEntry]).outcomes["SCORE"]).toBe(1);
  });

  test("normalization hook restores leniency when the consumer opts in", () => {
    const result = executeResponseProcessing(template, {
      responseDeclarations: [textEntry],
      outcomeDeclarations: [scoreOutcome],
      responses: { RESPONSE: "CAFE" },
      normalization: (value) =>
        value
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLocaleLowerCase(),
    });

    expect(result.outcomes["SCORE"]).toBe(1);
  });
});
