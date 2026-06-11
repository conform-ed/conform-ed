/**
 * Histogram-driven evaluator growth (ADR-0004): the operators the official corpus
 * uses among those the interpreter lacked — equal/equalRounded, rounding, math and
 * stats operators, container and string operators, inside. Spec-strict: unsupported
 * variants (non-numeric tolerance, template-variable counts) abort to defaults and
 * surface as issues, never guess.
 */

import { describe, expect, test } from "bun:test";

import { executeResponseProcessing } from "../src/rp";
import type { ResponseProcessingView, RpExpressionView } from "../src/rp";

const outcomeDeclarations = [{ identifier: "OUT", cardinality: "single" as const, baseType: "float" }];

interface RunOptions {
  readonly responses?: Record<string, string | null>;
  readonly responseBaseType?: string;
  readonly outcomeCardinality?: "single" | "multiple" | "ordered";
}

function run(expression: RpExpressionView, options: RunOptions = {}) {
  const view: ResponseProcessingView = {
    rules: [{ kind: "setOutcomeValue", identifier: "OUT", expression }],
  };

  return executeResponseProcessing(view, {
    responseDeclarations: [
      { identifier: "RESPONSE", cardinality: "single", baseType: options.responseBaseType ?? "float" },
    ],
    outcomeDeclarations: options.outcomeCardinality
      ? [{ identifier: "OUT", cardinality: options.outcomeCardinality, baseType: "float" }]
      : outcomeDeclarations,
    responses: options.responses ?? {},
  });
}

function baseValue(value: string, baseType = "float"): RpExpressionView {
  return { kind: "baseValue", baseType, value };
}

describe("equal", () => {
  test("exact mode (the default) compares numerically", () => {
    expect(run({ kind: "equal", expressions: [baseValue("3"), baseValue("3.0")] }).outcomes["OUT"]).toBe(true);
    expect(run({ kind: "equal", expressions: [baseValue("3"), baseValue("3.01")] }).outcomes["OUT"]).toBe(false);
  });

  test("absolute tolerance accepts values inside the window", () => {
    const expression: RpExpressionView = {
      kind: "equal",
      toleranceMode: "absolute",
      tolerance: [0.01],
      expressions: [baseValue("3.1416"), baseValue("3.1416")],
    };

    expect(run(expression).outcomes["OUT"]).toBe(true);
    expect(run({ ...expression, expressions: [baseValue("3.1416"), baseValue("3.15")] }).outcomes["OUT"]).toBe(true);
    expect(run({ ...expression, expressions: [baseValue("3.1416"), baseValue("3.16")] }).outcomes["OUT"]).toBe(false);
  });

  test("relative tolerance is a percentage window", () => {
    const expression: RpExpressionView = {
      kind: "equal",
      toleranceMode: "relative",
      tolerance: [15],
      expressions: [baseValue("100"), baseValue("110")],
    };

    expect(run(expression).outcomes["OUT"]).toBe(true);
    expect(run({ ...expression, tolerance: [5] }).outcomes["OUT"]).toBe(false);
  });

  test("exclusive bounds honor includeLowerBound/includeUpperBound", () => {
    const expression: RpExpressionView = {
      kind: "equal",
      toleranceMode: "absolute",
      tolerance: [1],
      includeUpperBound: false,
      expressions: [baseValue("10"), baseValue("11")],
    };

    expect(run(expression).outcomes["OUT"]).toBe(false);
  });

  test("template-variable tolerances are unsupported, aborting to defaults", () => {
    const result = run({
      kind: "equal",
      toleranceMode: "absolute",
      tolerance: ["T0"],
      expressions: [baseValue("1"), baseValue("1")],
    });

    expect(result.issues.length).toBeGreaterThan(0);
    // Abort-to-defaults: numeric outcomes fall back to 0 (QTI default), never partial.
    expect(result.outcomes["OUT"]).toBe(0);
  });

  test("null operands yield null", () => {
    const result = run({
      kind: "equal",
      expressions: [{ kind: "variable", identifier: "RESPONSE" }, baseValue("1")],
    });

    expect(result.outcomes["OUT"]).toBeNull();
    expect(result.issues).toEqual([]);
  });
});

describe("round and truncate", () => {
  test("round rounds half up, truncate drops the fraction", () => {
    expect(run({ kind: "round", expressions: [baseValue("3.5")] }).outcomes["OUT"]).toBe(4);
    expect(run({ kind: "round", expressions: [baseValue("-3.5")] }).outcomes["OUT"]).toBe(-3);
    expect(run({ kind: "truncate", expressions: [baseValue("3.9")] }).outcomes["OUT"]).toBe(3);
    expect(run({ kind: "truncate", expressions: [baseValue("-3.9")] }).outcomes["OUT"]).toBe(-3);
  });
});

describe("index", () => {
  const container: RpExpressionView = {
    kind: "ordered",
    expressions: [baseValue("A", "identifier"), baseValue("B", "identifier"), baseValue("C", "identifier")],
  };

  test("selects the 1-based n-th member of an ordered container", () => {
    expect(run({ kind: "index", n: 2, expressions: [container] }).outcomes["OUT"]).toBe("B");
  });

  test("out-of-range n yields null", () => {
    expect(run({ kind: "index", n: 9, expressions: [container] }).outcomes["OUT"]).toBeNull();
  });
});

describe("math constants and operators", () => {
  test("mathConstant supplies pi and e", () => {
    expect(run({ kind: "mathConstant", name: "pi" }).outcomes["OUT"]).toBeCloseTo(Math.PI);
    expect(run({ kind: "mathConstant", name: "e" }).outcomes["OUT"]).toBeCloseTo(Math.E);
  });

  test("mathOperator computes named functions", () => {
    expect(run({ kind: "mathOperator", name: "floor", expressions: [baseValue("3.7")] }).outcomes["OUT"]).toBe(3);
    expect(run({ kind: "mathOperator", name: "abs", expressions: [baseValue("-2")] }).outcomes["OUT"]).toBe(2);
    expect(run({ kind: "mathOperator", name: "signum", expressions: [baseValue("-7")] }).outcomes["OUT"]).toBe(-1);
    expect(
      run({ kind: "mathOperator", name: "atan2", expressions: [baseValue("1"), baseValue("1")] }).outcomes["OUT"],
    ).toBeCloseTo(Math.PI / 4);
  });

  test("domain errors yield null, not NaN", () => {
    const result = run({ kind: "mathOperator", name: "ln", expressions: [baseValue("-1")] });

    expect(result.outcomes["OUT"]).toBeNull();
    expect(result.issues).toEqual([]);
  });

  test("integer division and modulus truncate; division by zero is null", () => {
    expect(run({ kind: "integerDivide", expressions: [baseValue("7"), baseValue("2")] }).outcomes["OUT"]).toBe(3);
    expect(run({ kind: "integerModulus", expressions: [baseValue("7"), baseValue("2")] }).outcomes["OUT"]).toBe(1);
    expect(run({ kind: "integerDivide", expressions: [baseValue("7"), baseValue("0")] }).outcomes["OUT"]).toBeNull();
  });

  test("integerToFloat passes the numeric value through", () => {
    expect(run({ kind: "integerToFloat", expressions: [baseValue("3", "integer")] }).outcomes["OUT"]).toBe(3);
  });

  test("min and max flatten containers and children", () => {
    const members: RpExpressionView = { kind: "multiple", expressions: [baseValue("4"), baseValue("9")] };

    expect(run({ kind: "min", expressions: [members, baseValue("6")] }).outcomes["OUT"]).toBe(4);
    expect(run({ kind: "max", expressions: [members, baseValue("6")] }).outcomes["OUT"]).toBe(9);
  });

  test("gcd and lcm over integer members", () => {
    const integers = (values: string[]): RpExpressionView => ({
      kind: "multiple",
      expressions: values.map((value) => baseValue(value, "integer")),
    });

    expect(
      run({ kind: "gcd", expressions: [integers(["12", "18"]), baseValue("24", "integer")] }).outcomes["OUT"],
    ).toBe(6);
    expect(run({ kind: "lcm", expressions: [integers(["4", "6"])] }).outcomes["OUT"]).toBe(12);
    expect(run({ kind: "lcm", expressions: [integers(["4", "0"])] }).outcomes["OUT"]).toBe(0);
  });
});

describe("rounding to figures", () => {
  test("roundTo decimalPlaces and significantFigures", () => {
    expect(
      run({ kind: "roundTo", roundingMode: "decimalPlaces", figures: 2, expressions: [baseValue("3.14159")] }).outcomes[
        "OUT"
      ],
    ).toBeCloseTo(3.14);
    expect(
      run({ kind: "roundTo", roundingMode: "significantFigures", figures: 2, expressions: [baseValue("1234")] })
        .outcomes["OUT"],
    ).toBe(1200);
  });

  test("equalRounded compares after rounding both sides", () => {
    const expression: RpExpressionView = {
      kind: "equalRounded",
      roundingMode: "significantFigures",
      figures: 2,
      expressions: [baseValue("3.175"), baseValue("3.192")],
    };

    // Two significant figures: both are 3.2. Three: 3.18 vs 3.19.
    expect(run(expression).outcomes["OUT"]).toBe(true);
    expect(run({ ...expression, figures: 3 }).outcomes["OUT"]).toBe(false);
  });
});

describe("statsOperator", () => {
  const container: RpExpressionView = {
    kind: "multiple",
    expressions: [baseValue("1"), baseValue("2"), baseValue("3")],
  };

  test("mean, population and sample statistics", () => {
    expect(run({ kind: "statsOperator", name: "mean", expressions: [container] }).outcomes["OUT"]).toBe(2);
    expect(run({ kind: "statsOperator", name: "popVariance", expressions: [container] }).outcomes["OUT"]).toBeCloseTo(
      2 / 3,
    );
    expect(run({ kind: "statsOperator", name: "sampleVariance", expressions: [container] }).outcomes["OUT"]).toBe(1);
    expect(run({ kind: "statsOperator", name: "sampleSD", expressions: [container] }).outcomes["OUT"]).toBe(1);
  });

  test("sample statistics need at least two members", () => {
    const single: RpExpressionView = { kind: "multiple", expressions: [baseValue("5")] };

    expect(run({ kind: "statsOperator", name: "sampleSD", expressions: [single] }).outcomes["OUT"]).toBeNull();
  });
});

describe("container operators", () => {
  test("delete removes every occurrence of the value", () => {
    const container: RpExpressionView = {
      kind: "multiple",
      expressions: [baseValue("1"), baseValue("2"), baseValue("1"), baseValue("3")],
    };
    const result = run(
      { kind: "delete", expressions: [baseValue("1"), container] },
      { outcomeCardinality: "multiple" },
    );

    expect(result.outcomes["OUT"]).toEqual([2, 3]);
  });

  test("deleting the last member yields null (an empty container is NULL)", () => {
    const container: RpExpressionView = { kind: "multiple", expressions: [baseValue("1")] };

    expect(
      run({ kind: "delete", expressions: [baseValue("1"), container] }, { outcomeCardinality: "multiple" }).outcomes[
        "OUT"
      ],
    ).toBeNull();
  });

  test("repeat collects numberRepeats passes over its children", () => {
    const result = run(
      { kind: "repeat", numberRepeats: 3, expressions: [baseValue("A", "identifier")] },
      { outcomeCardinality: "ordered" },
    );

    expect(result.outcomes["OUT"]).toEqual(["A", "A", "A"]);
  });
});

describe("string operators", () => {
  test("stringMatch honors caseSensitive", () => {
    const expression: RpExpressionView = {
      kind: "stringMatch",
      caseSensitive: false,
      expressions: [baseValue("York", "string"), baseValue("york", "string")],
    };

    expect(run(expression).outcomes["OUT"]).toBe(true);
    expect(run({ ...expression, caseSensitive: true }).outcomes["OUT"]).toBe(false);
  });

  test("substring checks containment", () => {
    expect(
      run({
        kind: "substring",
        caseSensitive: false,
        expressions: [baseValue("ELL", "string"), baseValue("Hello", "string")],
      }).outcomes["OUT"],
    ).toBe(true);
    expect(
      run({
        kind: "substring",
        caseSensitive: true,
        expressions: [baseValue("xyz", "string"), baseValue("Hello", "string")],
      }).outcomes["OUT"],
    ).toBe(false);
  });
});

describe("inside", () => {
  function insideOf(point: string | null) {
    return run(
      {
        kind: "inside",
        shape: "rect",
        coords: "0,0,10,10",
        expressions: [{ kind: "variable", identifier: "RESPONSE" }],
      },
      { responses: { RESPONSE: point }, responseBaseType: "point" },
    ).outcomes["OUT"];
  }

  test("true for a point inside the area, false outside, null for no answer", () => {
    expect(insideOf("5 5")).toBe(true);
    expect(insideOf("15 5")).toBe(false);
    expect(insideOf(null)).toBeNull();
  });
});
