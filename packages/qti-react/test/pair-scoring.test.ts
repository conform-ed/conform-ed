import { describe, expect, test } from "bun:test";

import { mapResponse, matchCorrect } from "../src/response-processing";
import type { ResponseDeclarationView } from "../src/types";

function declaration(partial: Partial<ResponseDeclarationView>): ResponseDeclarationView {
  return { identifier: "RESPONSE", cardinality: "multiple", ...partial };
}

describe("pair baseType (unordered within the pair)", () => {
  const pairDeclaration = declaration({
    baseType: "pair",
    correctResponse: { values: [{ value: "A B" }, { value: "C D" }] },
  });

  test("exact members match", () => {
    expect(matchCorrect(pairDeclaration, ["A B", "C D"])).toBe(true);
  });

  test("reversed members still match — pairs are unordered", () => {
    expect(matchCorrect(pairDeclaration, ["B A", "D C"])).toBe(true);
  });

  test("a different pairing does not match", () => {
    expect(matchCorrect(pairDeclaration, ["A C", "B D"])).toBe(false);
  });

  test("map_response matches reversed pair keys", () => {
    const mapped = declaration({
      baseType: "pair",
      mapping: {
        defaultValue: 0,
        mapEntries: [
          { mapKey: "A B", mappedValue: 2 },
          { mapKey: "C D", mappedValue: 1 },
        ],
      },
    });

    expect(mapResponse(mapped, ["B A"])).toBe(2);
    expect(mapResponse(mapped, ["B A", "D C"])).toBe(3);
    expect(mapResponse(mapped, ["A C"])).toBe(0);
  });
});

describe("directedPair baseType (ordered within the pair)", () => {
  const directedDeclaration = declaration({
    baseType: "directedPair",
    correctResponse: { values: [{ value: "A B" }] },
  });

  test("exact member matches", () => {
    expect(matchCorrect(directedDeclaration, ["A B"])).toBe(true);
  });

  test("reversed member does not match — direction matters", () => {
    expect(matchCorrect(directedDeclaration, ["B A"])).toBe(false);
  });

  test("map_response respects direction", () => {
    const mapped = declaration({
      baseType: "directedPair",
      mapping: {
        defaultValue: -1,
        lowerBound: 0,
        mapEntries: [{ mapKey: "A B", mappedValue: 2 }],
      },
    });

    expect(mapResponse(mapped, ["A B"])).toBe(2);
    expect(mapResponse(mapped, ["B A"])).toBe(0);
  });

  test("identifier values never fold case", () => {
    const identifierDeclaration = declaration({
      cardinality: "single",
      baseType: "identifier",
      correctResponse: { values: [{ value: "TOKYO" }] },
    });

    expect(matchCorrect(identifierDeclaration, "tokyo")).toBe(false);
  });
});
