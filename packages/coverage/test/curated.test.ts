import { describe, expect, test } from "bun:test";

import { walkCurated } from "../src/walkers/curated";

const ctx = { spec: "demo", version: "1.0" } as const;
const provenance = "Hand-authored denominator (conform-ed ADR-0017). Source: https://example.org/spec";

describe("curated denominator walker (ADR-0017)", () => {
  test("walks a provenanced curated schema into doc + def items and ref edges", () => {
    const bytes = JSON.stringify({
      $id: "conform-ed:curated:demo",
      $comment: provenance,
      oneOf: [{ $ref: "#/$defs/Thing" }],
      $defs: {
        Thing: {
          type: "object",
          properties: { name: { type: "string", $comment: "specRef: §1 (name)" } },
        },
      },
    });

    const walked = walkCurated(bytes, "Demo", ctx);
    const keys = new Set(walked.items.map((i) => i.key));

    expect(keys.has("demo:1.0:doc:Demo")).toBe(true);
    expect(keys.has("demo:1.0:def:Thing/name")).toBe(true);
    expect(walked.edges.some((e) => e.from === "demo:1.0:doc:Demo" && e.to === "demo:1.0:def:Thing")).toBe(true);
    expect(walked.sourceId).toBe("conform-ed:curated:demo");
  });

  test("rejects a file with no ADR-0017 + spec-URL provenance comment", () => {
    const bytes = JSON.stringify({ type: "object", properties: {} });
    expect(() => walkCurated(bytes, "Demo", ctx)).toThrow(/ADR-0017/u);
  });

  test("rejects a property with no specRef citation (the mandatory-citation guardrail)", () => {
    const bytes = JSON.stringify({
      $comment: provenance,
      type: "object",
      properties: { name: { type: "string" } },
    });
    expect(() => walkCurated(bytes, "Demo", ctx)).toThrow(/specRef/u);
  });

  test("enforces the citation through union branches and $defs, not just top-level properties", () => {
    const bytes = JSON.stringify({
      $comment: provenance,
      $defs: {
        Nested: {
          type: "object",
          // Missing the specRef $comment on a nested-def property must still fail.
          properties: { deep: { type: "string" } },
        },
      },
      oneOf: [{ $ref: "#/$defs/Nested" }],
    });
    expect(() => walkCurated(bytes, "Demo", ctx)).toThrow(/specRef/u);
  });
});
