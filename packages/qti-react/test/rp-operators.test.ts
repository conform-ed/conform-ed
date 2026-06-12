/**
 * Histogram-driven evaluator growth (ADR-0004), completed to the full QTI 3 operator
 * vocabulary. Semantics cited from the QTI 3.0.1 ASI information model §2.11
 * (imsqti_asi_v3p0p1_infomodel) — spec-strict NULL handling, never guessed.
 * Numeric attributes accept variable references ("If n is an identifier, it is the
 * value of n at runtime that is used", §2.11.3.6).
 */

import { describe, expect, test } from "bun:test";

import { executeResponseProcessing } from "../src/rp";
import type { ResponseProcessingView, RpExpressionView } from "../src/rp";

const outcomeDeclarations = [{ identifier: "OUT", cardinality: "single" as const, baseType: "float" }];

interface RunOptions {
  readonly responses?: Record<string, string | null>;
  readonly responseBaseType?: string;
  readonly outcomeCardinality?: "single" | "multiple" | "ordered";
  /** Template variables visible to variable-reference attributes. */
  readonly templates?: Record<string, number | string | null>;
}

function run(expression: RpExpressionView, options: RunOptions = {}) {
  const view: ResponseProcessingView = {
    rules: [{ kind: "setOutcomeValue", identifier: "OUT", expression }],
  };

  const templateEntries = Object.entries(options.templates ?? {});

  return executeResponseProcessing(view, {
    responseDeclarations: [
      { identifier: "RESPONSE", cardinality: "single", baseType: options.responseBaseType ?? "float" },
    ],
    outcomeDeclarations: options.outcomeCardinality
      ? [{ identifier: "OUT", cardinality: options.outcomeCardinality, baseType: "float" }]
      : outcomeDeclarations,
    responses: options.responses ?? {},
    ...(templateEntries.length
      ? {
          templateDeclarations: templateEntries.map(([identifier, value]) => ({
            identifier,
            cardinality: "single" as const,
            baseType: typeof value === "string" ? "string" : "float",
          })),
          templateValues: Object.fromEntries(templateEntries),
        }
      : {}),
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

  test("variable-reference tolerances resolve at runtime (§2.11.3.6 rule)", () => {
    const expression: RpExpressionView = {
      kind: "equal",
      toleranceMode: "absolute",
      tolerance: ["TOL"],
      expressions: [baseValue("3"), baseValue("3.4")],
    };

    expect(run(expression, { templates: { TOL: 0.5 } }).outcomes["OUT"]).toBe(true);
    expect(run(expression, { templates: { TOL: 0.1 } }).outcomes["OUT"]).toBe(false);
  });

  test("an unresolvable tolerance reference yields null, not an abort", () => {
    const result = run({
      kind: "equal",
      toleranceMode: "absolute",
      tolerance: ["T0"],
      expressions: [baseValue("1"), baseValue("1")],
    });

    expect(result.issues).toEqual([]);
    expect(result.outcomes["OUT"]).toBeNull();
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

describe("three-valued and/or (§2.11.3.10, §2.11.3.15)", () => {
  const TRUE = baseValue("true", "boolean");
  const FALSE = baseValue("false", "boolean");
  const NULLISH: RpExpressionView = { kind: "variable", identifier: "RESPONSE" };

  test("and: false wins over NULL; otherwise NULL when any operand is NULL", () => {
    expect(run({ kind: "and", expressions: [TRUE, TRUE] }).outcomes["OUT"]).toBe(true);
    expect(run({ kind: "and", expressions: [TRUE, FALSE, NULLISH] }).outcomes["OUT"]).toBe(false);
    // "If one or more sub-expressions are NULL and all others are true then the
    // operator also results in NULL."
    expect(run({ kind: "and", expressions: [TRUE, NULLISH] }).outcomes["OUT"]).toBeNull();
  });

  test("or: true wins over NULL; otherwise NULL when any operand is NULL", () => {
    expect(run({ kind: "or", expressions: [FALSE, TRUE, NULLISH] }).outcomes["OUT"]).toBe(true);
    expect(run({ kind: "or", expressions: [FALSE, FALSE] }).outcomes["OUT"]).toBe(false);
    // "If one or more sub-expressions are NULL and all the others are false then the
    // operator also results in NULL."
    expect(run({ kind: "or", expressions: [FALSE, NULLISH] }).outcomes["OUT"]).toBeNull();
  });
});

describe("variable-reference numeric attributes (§2.11.3.6 runtime-value rule)", () => {
  const ordered: RpExpressionView = {
    kind: "ordered",
    expressions: [baseValue("10"), baseValue("20"), baseValue("30")],
  };

  test("repeat resolves a template-variable count", () => {
    const result = run(
      { kind: "repeat", numberRepeats: "REPS", expressions: [baseValue("1"), baseValue("2")] },
      { templates: { REPS: 2 }, outcomeCardinality: "ordered" },
    );

    expect(result.outcomes["OUT"]).toEqual([1, 2, 1, 2]);
    expect(result.issues).toEqual([]);
  });

  test("repeat: a referenced count below 1 makes the whole expression NULL (§2.11.3.42)", () => {
    expect(
      run(
        { kind: "repeat", numberRepeats: "REPS", expressions: [baseValue("1")] },
        { templates: { REPS: 0 }, outcomeCardinality: "ordered" },
      ).outcomes["OUT"],
    ).toBeNull();
  });

  test("index resolves n from a template variable, braced form included", () => {
    expect(run({ kind: "index", n: "POS", expressions: [ordered] }, { templates: { POS: 2 } }).outcomes["OUT"]).toBe(
      20,
    );
    // EncVariableString form (§7.13): "a string enclosed in curly brackets".
    expect(run({ kind: "index", n: "{POS}", expressions: [ordered] }, { templates: { POS: 3 } }).outcomes["OUT"]).toBe(
      30,
    );
  });

  test("roundTo and equalRounded resolve figures from a template variable", () => {
    expect(
      run(
        { kind: "roundTo", roundingMode: "decimalPlaces", figures: "FIGS", expressions: [baseValue("3.14159")] },
        { templates: { FIGS: 2 } },
      ).outcomes["OUT"],
    ).toBe(3.14);
    expect(
      run(
        { kind: "equalRounded", figures: "FIGS", expressions: [baseValue("3.14159"), baseValue("3.1402")] },
        { templates: { FIGS: 3 } },
      ).outcomes["OUT"],
    ).toBe(true);
  });

  test("an unresolvable reference makes the operator NULL, never an abort", () => {
    const result = run({ kind: "index", n: "MISSING", expressions: [ordered] });

    expect(result.outcomes["OUT"]).toBeNull();
    expect(result.issues).toEqual([]);
  });
});

describe("null (§2.11.3, the NULL literal)", () => {
  test("evaluates to NULL and isNull sees it", () => {
    expect(run({ kind: "null" }).outcomes["OUT"]).toBeNull();
    expect(run({ kind: "isNull", expressions: [{ kind: "null" }] }).outcomes["OUT"]).toBe(true);
  });
});

describe("power (§2.11.3.30)", () => {
  test("raises the first operand to the second", () => {
    expect(run({ kind: "power", expressions: [baseValue("2"), baseValue("10")] }).outcomes["OUT"]).toBe(1024);
  });

  test("results outside the float value set (incl. infinities) are NULL", () => {
    expect(run({ kind: "power", expressions: [baseValue("-2"), baseValue("0.5")] }).outcomes["OUT"]).toBeNull();
    expect(run({ kind: "power", expressions: [baseValue("10"), baseValue("400")] }).outcomes["OUT"]).toBeNull();
  });

  test("NULL operands propagate", () => {
    expect(
      run({ kind: "power", expressions: [baseValue("2"), { kind: "variable", identifier: "RESPONSE" }] }).outcomes[
        "OUT"
      ],
    ).toBeNull();
  });
});

describe("containerSize (§2.11.3.32)", () => {
  test("counts the container's values", () => {
    expect(
      run({
        kind: "containerSize",
        expressions: [{ kind: "multiple", expressions: [baseValue("1"), baseValue("2"), baseValue("3")] }],
      }).outcomes["OUT"],
    ).toBe(3);
  });

  test("a NULL sub-expression gives 0 — the spec's exception to NULL propagation", () => {
    expect(run({ kind: "containerSize", expressions: [{ kind: "null" }] }).outcomes["OUT"]).toBe(0);
  });
});

describe("contains (§2.11.3.17)", () => {
  function identifiers(values: readonly string[], kind: "multiple" | "ordered"): RpExpressionView {
    return { kind, expressions: values.map((value) => baseValue(value, "identifier")) };
  }

  test("unordered: multiset semantics — [A,B,C] lacks [B,B] but [A,B,B,C] has it", () => {
    expect(
      run({
        kind: "contains",
        expressions: [identifiers(["A", "B", "C"], "multiple"), identifiers(["C", "A"], "multiple")],
      }).outcomes["OUT"],
    ).toBe(true);
    expect(
      run({
        kind: "contains",
        expressions: [identifiers(["A", "B", "C"], "multiple"), identifiers(["B", "B"], "multiple")],
      }).outcomes["OUT"],
    ).toBe(false);
    expect(
      run({
        kind: "contains",
        expressions: [identifiers(["A", "B", "B", "C"], "multiple"), identifiers(["B", "B"], "multiple")],
      }).outcomes["OUT"],
    ).toBe(true);
  });

  test("ordered: 'a strict sub-sequence within the first' — contiguous, in order", () => {
    const first = identifiers(["A", "B", "C", "D"], "ordered");

    expect(run({ kind: "contains", expressions: [first, identifiers(["B", "C"], "ordered")] }).outcomes["OUT"]).toBe(
      true,
    );
    expect(run({ kind: "contains", expressions: [first, identifiers(["C", "A"], "ordered")] }).outcomes["OUT"]).toBe(
      false,
    );
    // "within the first": the sub-sequence is a contiguous run, so a gapped
    // selection does not count.
    expect(run({ kind: "contains", expressions: [first, identifiers(["B", "D"], "ordered")] }).outcomes["OUT"]).toBe(
      false,
    );
  });

  test("NULL operands propagate", () => {
    expect(
      run({ kind: "contains", expressions: [identifiers(["A"], "multiple"), { kind: "null" }] }).outcomes["OUT"],
    ).toBeNull();
  });
});

describe("anyN (§2.11.3, with the spec's worked examples)", () => {
  const TRUE = baseValue("true", "boolean");
  const FALSE = baseValue("false", "boolean");
  const NULLISH: RpExpressionView = { kind: "variable", identifier: "RESPONSE" };

  function anyN(min: number | string, max: number | string, expressions: RpExpressionView[]): RpExpressionView {
    return { kind: "anyN", min, max, expressions };
  }

  test("counts true sub-expressions against [min, max]", () => {
    expect(run(anyN(2, 3, [TRUE, TRUE, FALSE])).outcomes["OUT"]).toBe(true);
    expect(run(anyN(2, 2, [TRUE, TRUE, TRUE])).outcomes["OUT"]).toBe(false);
    expect(run(anyN(2, 3, [TRUE, FALSE, FALSE])).outcomes["OUT"]).toBe(false);
  });

  test("the spec's NULL examples: min 3, max 4", () => {
    // {true,true,false,NULL} → NULL; {true,false,false,NULL} → false;
    // {true,true,true,NULL} → true.
    expect(run(anyN(3, 4, [TRUE, TRUE, FALSE, NULLISH])).outcomes["OUT"]).toBeNull();
    expect(run(anyN(3, 4, [TRUE, FALSE, FALSE, NULLISH])).outcomes["OUT"]).toBe(false);
    expect(run(anyN(3, 4, [TRUE, TRUE, TRUE, NULLISH])).outcomes["OUT"]).toBe(true);
  });

  test("min and max accept variable references", () => {
    expect(run(anyN("MINV", "MAXV", [TRUE, TRUE, FALSE]), { templates: { MINV: 1, MAXV: 2 } }).outcomes["OUT"]).toBe(
      true,
    );
  });
});

describe("patternMatch (§2.11.3.41, XSD regex dialect per Appendix F of XML Schema)", () => {
  function match(pattern: string, response: string | null) {
    return run(
      { kind: "patternMatch", pattern, expressions: [{ kind: "variable", identifier: "RESPONSE" }] },
      { responses: { RESPONSE: response }, responseBaseType: "string" },
    );
  }

  test("patterns implicitly match the whole string", () => {
    expect(match("[A-Z]{3}\\d{2}", "ABC12").outcomes["OUT"]).toBe(true);
    expect(match("[A-Z]{3}\\d{2}", "ABC123").outcomes["OUT"]).toBe(false);
    expect(match("abc", "xabcx").outcomes["OUT"]).toBe(false);
  });

  test("XSD-only constructs work (character class subtraction)", () => {
    expect(match("[a-z-[aeiou]]+", "bcd").outcomes["OUT"]).toBe(true);
    expect(match("[a-z-[aeiou]]+", "bcda").outcomes["OUT"]).toBe(false);
  });

  test("a NULL sub-expression results in NULL", () => {
    expect(match("abc", null).outcomes["OUT"]).toBeNull();
  });

  test("an EncVariableString pattern resolves from a variable (§7.13)", () => {
    const result = run(
      { kind: "patternMatch", pattern: "{PAT}", expressions: [{ kind: "variable", identifier: "RESPONSE" }] },
      { responses: { RESPONSE: "ABBA" }, responseBaseType: "string", templates: { PAT: "(AB)+BA" } },
    );

    expect(result.outcomes["OUT"]).toBe(true);
  });

  test("an invalid pattern is refused loudly, never guessed", () => {
    const result = match("[unclosed", "x");

    expect(result.outcomes["OUT"]).toBe(0); // abort to declared defaults
    expect(result.issues.some((issue) => issue.name === "patternMatch")).toBe(true);
  });
});

describe("default (§2.11.1.3)", () => {
  // "This expression looks up the declaration of an item variable and returns the
  // associated qti-default-value or NULL if no default value was declared."
  function runDefault(identifier: string) {
    return executeResponseProcessing(
      { rules: [{ kind: "setOutcomeValue", identifier: "OUT", expression: { kind: "default", identifier } }] },
      {
        responseDeclarations: [
          {
            identifier: "RESPONSE",
            cardinality: "single",
            baseType: "integer",
            defaultValue: { values: [{ value: "5" }] },
          },
          { identifier: "BLANK", cardinality: "single", baseType: "string" },
        ],
        outcomeDeclarations: [
          { identifier: "OUT", cardinality: "single", baseType: "float" },
          {
            identifier: "LABEL",
            cardinality: "single",
            baseType: "string",
            defaultValue: { values: [{ value: "abc" }] },
          },
        ],
        templateDeclarations: [
          { identifier: "T", cardinality: "single", baseType: "float", defaultValue: { values: [{ value: "7" }] } },
        ],
        responses: {},
      },
    ).outcomes["OUT"];
  }

  test("returns the declared default of response, outcome, and template variables", () => {
    expect(runDefault("RESPONSE")).toBe(5);
    expect(runDefault("LABEL")).toBe("abc");
    expect(runDefault("T")).toBe(7);
  });

  test("NULL when no default was declared or the variable is unknown", () => {
    expect(runDefault("BLANK")).toBeNull();
    expect(runDefault("NOPE")).toBeNull();
  });
});

describe("duration built-in and durationGte/durationLt (§2.11.3.20/.21)", () => {
  function runWithDuration(kind: "durationGte" | "durationLt", seconds: number | undefined, threshold: string) {
    return executeResponseProcessing(
      {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "OUT",
            expression: {
              kind,
              expressions: [
                { kind: "variable", identifier: "duration" },
                { kind: "baseValue", baseType: "duration", value: threshold },
              ],
            },
          },
        ],
      },
      {
        responseDeclarations: [],
        outcomeDeclarations: outcomeDeclarations,
        responses: {},
        ...(seconds === undefined ? {} : { duration: seconds }),
      },
    ).outcomes["OUT"];
  }

  test("compares the built-in duration response variable in seconds", () => {
    expect(runWithDuration("durationGte", 90, "60")).toBe(true);
    expect(runWithDuration("durationGte", 60, "60")).toBe(true); // "longer (or equal …)"
    expect(runWithDuration("durationGte", 30, "60")).toBe(false);
    expect(runWithDuration("durationLt", 30, "60")).toBe(true);
    expect(runWithDuration("durationLt", 90, "60")).toBe(false);
  });

  test("NULL when no duration is tracked in the context", () => {
    expect(runWithDuration("durationGte", undefined, "60")).toBeNull();
  });
});

describe("numAttempts built-in", () => {
  test("resolves from the context (increments at the start of each attempt per spec)", () => {
    const result = executeResponseProcessing(
      {
        rules: [
          {
            kind: "setOutcomeValue",
            identifier: "OUT",
            expression: { kind: "variable", identifier: "numAttempts" },
          },
        ],
      },
      { responseDeclarations: [], outcomeDeclarations: outcomeDeclarations, responses: {}, numAttempts: 2 },
    );

    expect(result.outcomes["OUT"]).toBe(2);
  });
});
