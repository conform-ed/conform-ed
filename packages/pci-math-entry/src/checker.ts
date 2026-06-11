/**
 * The pure math checker: LaTeX in, verdict out (compute-engine under the hood).
 * Framework-free and I/O-free by design — the identical function produces the PCI's
 * advisory client-side verdict and the platform's authoritative re-score, so the two
 * can only disagree across package versions, never across code paths.
 *
 * Modes: "equivalent" accepts any mathematically equal form (symbolic equality with
 * compute-engine's numeric probing); "literal" compares the non-canonical parse trees,
 * so the written form matters (\frac{2}{4} ≠ \frac{1}{2}). An absolute `tolerance`
 * widens numeric comparison in equivalent mode (float answers like the sine-rule item).
 */

import { ComputeEngine } from "@cortex-js/compute-engine";
import type { BoxedExpression } from "@cortex-js/compute-engine";

export type MathCheckMode = "equivalent" | "literal";

export interface MathCheckOptions {
  /** Default "equivalent". */
  readonly mode?: MathCheckMode;
  /** Absolute numeric window; only meaningful in equivalent mode. */
  readonly tolerance?: number;
}

export type MathCheckReason = "candidate-parse-error" | "correct-parse-error" | "undecidable";

export interface MathCheckResult {
  /** true/false when judged; null when the input could not be judged at all. */
  readonly verdict: boolean | null;
  readonly reason?: MathCheckReason;
}

const ce = new ComputeEngine();

/**
 * Literal mode compares the written form, but compute-engine's parser eagerly reduces
 * rational literals in every mode (\frac{2}{4} parses as 1/2 even non-canonically), so
 * digit fractions are rewritten to an opaque marker before parsing. The resulting
 * trees are form fingerprints, not mathematics — they exist only to be compared.
 */
function fingerprintRationalLiterals(latex: string): string {
  return latex
    .replace(/\\frac\s*\{\s*(-?\d+)\s*\}\s*\{\s*(-?\d+)\s*\}/gu, "\\operatorname{ratlit}($1,$2)")
    .replace(/\\frac\s*(\d)\s*(\d)/gu, "\\operatorname{ratlit}($1,$2)")
    .replace(/(?<![\w.])(-?\d+)\s*\/\s*(\d+)(?![\w.])/gu, "\\operatorname{ratlit}($1,$2)");
}

/**
 * Literal verdicts are EqualComAss-style (the STACK convention): the written *form*
 * matters, term order does not — rejecting "1+x" for "x+1" is never the pedagogy.
 * Operands of commutative heads sort before comparison.
 */
const commutativeHeads = new Set(["Add", "Multiply"]);

function normalizeOperandOrder(node: unknown): unknown {
  if (!Array.isArray(node)) {
    return node;
  }

  const [head, ...operands] = node as unknown[];
  const mapped = operands.map(normalizeOperandOrder);

  if (typeof head === "string" && commutativeHeads.has(head)) {
    mapped.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  return [head, ...mapped];
}

/** Structural equality over MathJSON (isSame compares number literals numerically). */
function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((member, i) => sameJson(member, b[i]))
    );
  }

  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);

    return keys.length === Object.keys(right).length && keys.every((key) => sameJson(left[key], right[key]));
  }

  return a === b;
}

function parseLatex(latex: string, form: "canonical" | "structural"): BoxedExpression | null {
  if (latex.trim() === "") {
    return null;
  }

  const expression = ce.parse(latex, { form });

  return expression.isValid ? expression : null;
}

/** Finite real value of an expression, or null when it is not plainly numeric. */
function realValue(expression: BoxedExpression): number | null {
  const numeric = expression.N();
  const real = numeric.re;
  const imaginary = numeric.im;

  return Number.isFinite(real) && imaginary === 0 ? real : null;
}

export function checkMathExpression(candidate: string, correct: string, options?: MathCheckOptions): MathCheckResult {
  const mode = options?.mode ?? "equivalent";
  const form = mode === "equivalent" ? "canonical" : "structural";
  const prepare = mode === "literal" ? fingerprintRationalLiterals : (latex: string) => latex;
  const candidateExpression = parseLatex(prepare(candidate), form);

  if (candidateExpression === null) {
    return { verdict: null, reason: "candidate-parse-error" };
  }

  const correctExpression = parseLatex(prepare(correct), form);

  if (correctExpression === null) {
    return { verdict: null, reason: "correct-parse-error" };
  }

  if (mode === "literal") {
    return {
      verdict: sameJson(normalizeOperandOrder(candidateExpression.json), normalizeOperandOrder(correctExpression.json)),
    };
  }

  if (options?.tolerance !== undefined) {
    const candidateValue = realValue(candidateExpression);
    const correctValue = realValue(correctExpression);

    if (candidateValue !== null && correctValue !== null) {
      return { verdict: Math.abs(candidateValue - correctValue) <= options.tolerance };
    }
  }

  const equal = candidateExpression.isEqual(correctExpression);

  return equal === undefined ? { verdict: null, reason: "undecidable" } : { verdict: equal };
}
