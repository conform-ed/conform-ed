/**
 * The org.conform-ed.mathEquivalent customOperator: the checker exposed to QTI
 * response processing through the qti-react extension seam. Positional arguments
 * (all authorable as plain qti-base-value): candidate LaTeX, correct LaTeX, optional
 * mode ("equivalent" | "literal"), optional absolute tolerance. NULL in, NULL out;
 * unjudgeable input is NULL, never a guess.
 */

import { describe, expect, test } from "bun:test";

import { executeResponseProcessing } from "@conform-ed/qti-react";
import type { OutcomeDeclarationView, ResponseProcessingView, RpExpressionView } from "@conform-ed/qti-react";

import { mathEquivalentClass, mathEquivalentOperator } from "../src/operator";

const outDeclaration: OutcomeDeclarationView = { identifier: "OUT", cardinality: "single", baseType: "boolean" };

function baseValue(baseType: string, value: string): RpExpressionView {
  return { kind: "baseValue", baseType, value };
}

function run(children: readonly RpExpressionView[], responses: Record<string, string> = {}) {
  const rules: ResponseProcessingView = {
    rules: [
      {
        kind: "setOutcomeValue",
        identifier: "OUT",
        expression: { kind: "customOperator", class: mathEquivalentClass, expressions: children },
      },
    ],
  };

  return executeResponseProcessing(rules, {
    responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "string" }],
    outcomeDeclarations: [outDeclaration],
    responses,
    customOperators: { [mathEquivalentClass]: mathEquivalentOperator },
  });
}

describe("org.conform-ed.mathEquivalent", () => {
  test("the class name is the documented vocabulary", () => {
    expect(mathEquivalentClass).toBe("org.conform-ed.mathEquivalent");
  });

  test("equivalent by default", () => {
    expect(run([baseValue("string", "x+x"), baseValue("string", "2x")]).outcomes["OUT"]).toBe(true);
    expect(run([baseValue("string", "x+2"), baseValue("string", "2x")]).outcomes["OUT"]).toBe(false);
  });

  test("candidate arrives from a response variable", () => {
    const children = [{ kind: "variable", identifier: "RESPONSE" }, baseValue("string", "\\frac{1}{2}")];

    expect(run(children, { RESPONSE: "0.5" }).outcomes["OUT"]).toBe(true);
  });

  test("third argument selects literal mode", () => {
    const children = [
      baseValue("string", "\\frac{2}{4}"),
      baseValue("string", "\\frac{1}{2}"),
      baseValue("string", "literal"),
    ];

    expect(run(children).outcomes["OUT"]).toBe(false);
  });

  test("fourth argument is the absolute tolerance", () => {
    const children = [
      baseValue("string", "12.339"),
      baseValue("string", "12.34"),
      baseValue("string", "equivalent"),
      baseValue("float", "0.01"),
    ];

    expect(run(children).outcomes["OUT"]).toBe(true);
  });

  test("a NULL candidate yields NULL, not false", () => {
    const children = [{ kind: "variable", identifier: "RESPONSE" }, baseValue("string", "x+1")];

    expect(run(children).outcomes["OUT"]).toBeNull();
  });

  test("unjudgeable input yields NULL, never a guess", () => {
    expect(run([baseValue("string", "\\frac{"), baseValue("string", "x")]).outcomes["OUT"]).toBeNull();
  });
});
