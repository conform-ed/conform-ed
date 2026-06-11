import { describe, expect, test } from "bun:test";

import { applyCorrectResponseOverrides, executeResponseProcessing, executeTemplateProcessing } from "../src/rp";
import type { TemplateProcessingView } from "../src/rp";
import { matchCorrect } from "../src/response-processing";
import type { ResponseDeclarationView } from "../src/types";

const addendDeclarations = [
  { identifier: "A", cardinality: "single" as const, baseType: "integer" },
  { identifier: "B", cardinality: "single" as const, baseType: "integer" },
];

const sumTemplate: TemplateProcessingView = {
  rules: [
    {
      kind: "setTemplateValue",
      identifier: "A",
      expression: { kind: "randomInteger", min: 1, max: 9 },
    },
    {
      kind: "setTemplateValue",
      identifier: "B",
      expression: { kind: "randomInteger", min: 1, max: 9 },
    },
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
};

const responseDeclarations: readonly ResponseDeclarationView[] = [
  { identifier: "RESPONSE", cardinality: "single", baseType: "integer" },
];

function runSum(seed: number) {
  return executeTemplateProcessing(sumTemplate, {
    templateDeclarations: addendDeclarations,
    responseDeclarations,
    seed,
  });
}

describe("template processing (seeded, deterministic)", () => {
  test("randomInteger stays in range and the same seed reproduces the same clone", () => {
    const first = runSum(42);
    const again = runSum(42);

    expect(first.templateValues).toEqual(again.templateValues);

    const a = first.templateValues["A"];
    const b = first.templateValues["B"];

    expect(typeof a).toBe("number");
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(9);
    expect(typeof b).toBe("number");
  });

  test("different seeds eventually produce different clones", () => {
    const values = new Set<string>();

    for (let seed = 0; seed < 16; seed += 1) {
      const result = runSum(seed);

      values.add(`${String(result.templateValues["A"])} ${String(result.templateValues["B"])}`);
    }

    expect(values.size).toBeGreaterThan(1);
  });

  test("setCorrectResponse override scores the clone correctly", () => {
    const result = runSum(7);
    const a = result.templateValues["A"] as number;
    const b = result.templateValues["B"] as number;
    const effective = applyCorrectResponseOverrides(responseDeclarations, result.correctResponseOverrides);
    const declaration = effective.find((entry) => entry.identifier === "RESPONSE")!;

    expect(matchCorrect(declaration, String(a + b))).toBe(true);
    expect(matchCorrect(declaration, String(a + b + 1))).toBe(false);
  });

  test("templateCondition branches on template values; exitTemplate stops execution", () => {
    const view: TemplateProcessingView = {
      rules: [
        { kind: "setTemplateValue", identifier: "A", expression: { kind: "baseValue", baseType: "integer", value: 3 } },
        {
          kind: "templateCondition",
          templateIf: {
            expression: {
              kind: "gt",
              expressions: [
                { kind: "variable", identifier: "A" },
                { kind: "baseValue", baseType: "integer", value: 2 },
              ],
            },
            rules: [
              {
                kind: "setTemplateValue",
                identifier: "B",
                expression: { kind: "baseValue", baseType: "integer", value: 100 },
              },
              { kind: "exitTemplate" },
            ],
          },
          templateElse: {
            rules: [
              {
                kind: "setTemplateValue",
                identifier: "B",
                expression: { kind: "baseValue", baseType: "integer", value: -1 },
              },
            ],
          },
        },
        { kind: "setTemplateValue", identifier: "A", expression: { kind: "baseValue", baseType: "integer", value: 0 } },
      ],
    };

    const result = executeTemplateProcessing(view, {
      templateDeclarations: addendDeclarations,
      responseDeclarations,
      seed: 1,
    });

    expect(result.templateValues["B"]).toBe(100);
    expect(result.templateValues["A"]).toBe(3); // exitTemplate prevented the reset to 0
  });

  test("random picks a member from a container deterministically per seed", () => {
    const view: TemplateProcessingView = {
      rules: [
        {
          kind: "setTemplateValue",
          identifier: "A",
          expression: {
            kind: "random",
            expressions: [
              {
                kind: "multiple",
                expressions: [
                  { kind: "baseValue", baseType: "identifier", value: "X" },
                  { kind: "baseValue", baseType: "identifier", value: "Y" },
                  { kind: "baseValue", baseType: "identifier", value: "Z" },
                ],
              },
            ],
          },
        },
      ],
    };
    const context = { templateDeclarations: addendDeclarations, responseDeclarations, seed: 5 };

    const pick = String(executeTemplateProcessing(view, context).templateValues["A"]);

    expect(["X", "Y", "Z"]).toContain(pick);
    expect(executeTemplateProcessing(view, context).templateValues["A"]).toBe(pick);
  });

  test("unsupported template constructs abort to empty values and report", () => {
    const view: TemplateProcessingView = {
      rules: [{ kind: "setTemplateValue", identifier: "A", expression: { kind: "customOperator" } }],
    };

    const result = executeTemplateProcessing(view, {
      templateDeclarations: addendDeclarations,
      responseDeclarations,
      seed: 1,
    });

    expect(result.issues[0]?.type).toBe("unsupported-rp");
    expect(result.issues[0]?.name).toBe("customOperator");
  });

  test("random operators remain unsupported in response processing (determinism)", () => {
    const result = executeResponseProcessing(
      {
        rules: [
          { kind: "setOutcomeValue", identifier: "SCORE", expression: { kind: "randomInteger", min: 0, max: 9 } },
        ],
      },
      {
        responseDeclarations,
        outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
        responses: {},
      },
    );

    expect(result.issues[0]?.type).toBe("unsupported-rp");
    expect(result.issues[0]?.name).toBe("randomInteger");
  });
});

describe("templateConstraint (redraw until satisfied, ADR-0004)", () => {
  const constrainedDeclarations = [
    {
      identifier: "X",
      cardinality: "single" as const,
      baseType: "integer",
      defaultValue: { values: [{ value: 0 }] },
    },
  ];

  function constrainedView(minimum: string): TemplateProcessingView {
    return {
      rules: [
        { kind: "setTemplateValue", identifier: "X", expression: { kind: "randomInteger", min: 1, max: 6 } },
        {
          kind: "templateConstraint",
          expression: {
            kind: "gte",
            expressions: [
              { kind: "variable", identifier: "X" },
              { kind: "baseValue", baseType: "integer", value: minimum },
            ],
          },
        },
      ],
    };
  }

  test("redraws until the constraint holds, deterministically per seed", () => {
    const context = { templateDeclarations: constrainedDeclarations, responseDeclarations: [], seed: 7 };
    const first = executeTemplateProcessing(constrainedView("5"), context);
    const second = executeTemplateProcessing(constrainedView("5"), context);

    expect(first.issues).toEqual([]);
    expect(first.templateValues["X"] as number).toBeGreaterThanOrEqual(5);
    expect(second.templateValues["X"]).toBe(first.templateValues["X"]);
  });

  test("an unsatisfiable constraint falls back to declared defaults", () => {
    const result = executeTemplateProcessing(constrainedView("99"), {
      templateDeclarations: constrainedDeclarations,
      responseDeclarations: [],
      seed: 7,
    });

    expect(result.issues).toEqual([]);
    expect(result.templateValues["X"]).toBe(0);
  });
});
