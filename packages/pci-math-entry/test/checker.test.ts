/**
 * The pure math checker: LaTeX in, verdict out. Framework-free and I/O-free by design —
 * the same function runs inside the PCI (advisory verdict) and on the platform side
 * (authoritative re-score). Two modes per the design decisions: "equivalent" (symbolic
 * equality, any correct form accepted) and "literal" (structural as-written match),
 * plus an absolute numeric tolerance for float answers.
 */

import { describe, expect, test } from "bun:test";

import { checkMathExpression } from "../src/checker";

describe("equivalent mode (default): any mathematically equal form passes", () => {
  test("identical expressions", () => {
    expect(checkMathExpression("x+1", "x+1").verdict).toBe(true);
  });

  test("algebraic rearrangement", () => {
    expect(checkMathExpression("x+x", "2x").verdict).toBe(true);
    expect(checkMathExpression("1+x", "x+1").verdict).toBe(true);
  });

  test("rational and decimal forms agree", () => {
    expect(checkMathExpression("0.5", "\\frac{1}{2}").verdict).toBe(true);
    expect(checkMathExpression("\\frac{2}{4}", "\\frac{1}{2}").verdict).toBe(true);
  });

  test("unequal expressions fail", () => {
    expect(checkMathExpression("x+2", "2x").verdict).toBe(false);
    expect(checkMathExpression("0.51", "\\frac{1}{2}").verdict).toBe(false);
  });

  test("trigonometric identity", () => {
    expect(checkMathExpression("2\\sin(x)\\cos(x)", "\\sin(2x)").verdict).toBe(true);
  });
});

describe("literal mode: the written form matters", () => {
  test("identical notation passes", () => {
    expect(checkMathExpression("\\frac{1}{2}", "\\frac{1}{2}", { mode: "literal" }).verdict).toBe(true);
  });

  test("an unreduced fraction fails against the reduced correct form", () => {
    expect(checkMathExpression("\\frac{2}{4}", "\\frac{1}{2}", { mode: "literal" }).verdict).toBe(false);
  });

  test("a decimal fails against a fraction", () => {
    expect(checkMathExpression("0.5", "\\frac{1}{2}", { mode: "literal" }).verdict).toBe(false);
  });

  test("compact \\frac12 notation reads identically to \\frac{1}{2}", () => {
    expect(checkMathExpression("\\frac12", "\\frac{1}{2}", { mode: "literal" }).verdict).toBe(true);
  });

  test("commutative reordering is accepted (EqualComAss-style literal semantics)", () => {
    // compute-engine normalizes commutative operand order below the canonical layer,
    // and that matches the design intent: literal rejects different *forms* (unreduced
    // fractions, decimals-for-fractions), not reordered terms.
    expect(checkMathExpression("1+x", "x+1", { mode: "literal" }).verdict).toBe(true);
  });
});

describe("numeric tolerance (equivalent mode, float answers)", () => {
  test("within tolerance passes", () => {
    expect(checkMathExpression("12.339", "12.34", { tolerance: 0.01 }).verdict).toBe(true);
  });

  test("outside tolerance fails", () => {
    expect(checkMathExpression("12.3", "12.34", { tolerance: 0.01 }).verdict).toBe(false);
  });

  test("without tolerance, close-but-unequal numbers fail", () => {
    expect(checkMathExpression("12.339", "12.34").verdict).toBe(false);
  });
});

describe("unjudgeable input", () => {
  test("unparseable candidate yields a null verdict with a reason", () => {
    const result = checkMathExpression("\\frac{", "\\frac{1}{2}");

    expect(result.verdict).toBeNull();
    expect(result.reason).toBe("candidate-parse-error");
  });

  test("unparseable correct expression yields a null verdict with a reason", () => {
    const result = checkMathExpression("0.5", "\\frac{");

    expect(result.verdict).toBeNull();
    expect(result.reason).toBe("correct-parse-error");
  });

  test("empty candidate yields a null verdict", () => {
    expect(checkMathExpression("", "x+1").verdict).toBeNull();
  });
});
