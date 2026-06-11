import { describe, expect, test } from "bun:test";

import { parseCoords, parsePoint, pointInShape } from "../src/graphic";
import { mapResponsePoint, matchCorrect, scoreResponse } from "../src/response-processing";
import { executeResponseProcessing } from "../src/rp";
import type { ResponseDeclarationView } from "../src/types";

describe("graphic primitives", () => {
  test("parseCoords splits comma-separated integers", () => {
    expect(parseCoords("10, 20,30")).toEqual([10, 20, 30]);
  });

  test("parsePoint reads space-separated point values", () => {
    expect(parsePoint("15 25")).toEqual({ x: 15, y: 25 });
    expect(parsePoint("nope")).toBeNull();
  });

  test("circle hit testing", () => {
    expect(pointInShape("circle", [50, 50, 10], { x: 55, y: 55 })).toBe(true);
    expect(pointInShape("circle", [50, 50, 10], { x: 61, y: 50 })).toBe(false);
  });

  test("rect hit testing (left, top, right, bottom)", () => {
    expect(pointInShape("rect", [10, 10, 30, 20], { x: 20, y: 15 })).toBe(true);
    expect(pointInShape("rect", [10, 10, 30, 20], { x: 31, y: 15 })).toBe(false);
  });

  test("poly hit testing (ray casting)", () => {
    const triangle = [0, 0, 10, 0, 5, 10];

    expect(pointInShape("poly", triangle, { x: 5, y: 3 })).toBe(true);
    expect(pointInShape("poly", triangle, { x: 9, y: 9 })).toBe(false);
  });

  test("ellipse and default shapes", () => {
    expect(pointInShape("ellipse", [50, 50, 20, 10], { x: 65, y: 50 })).toBe(true);
    expect(pointInShape("ellipse", [50, 50, 20, 10], { x: 50, y: 65 })).toBe(false);
    expect(pointInShape("default", [], { x: 999, y: 999 })).toBe(true);
  });
});

const pointDeclaration: ResponseDeclarationView = {
  identifier: "RESPONSE",
  cardinality: "single",
  baseType: "point",
  areaMapping: {
    defaultValue: 0,
    areaMapEntries: [
      { shape: "circle", coords: [100, 100, 20], mappedValue: 2 },
      { shape: "rect", coords: [0, 0, 50, 50], mappedValue: 1 },
    ],
  },
};

describe("mapResponsePoint (areaMapping)", () => {
  test("sums area values for hits and uses default for misses", () => {
    expect(mapResponsePoint(pointDeclaration, "105 95")).toBe(2);
    expect(mapResponsePoint(pointDeclaration, "25 25")).toBe(1);
    expect(mapResponsePoint(pointDeclaration, "300 300")).toBe(0);
    expect(mapResponsePoint(pointDeclaration, null)).toBe(0);
  });

  test("each area counts at most once across multiple points", () => {
    const multi: ResponseDeclarationView = { ...pointDeclaration, cardinality: "multiple" };

    expect(mapResponsePoint(multi, ["105 95", "100 100", "25 25"])).toBe(3);
  });

  test("scoreResponse prefers areaMapping when declared", () => {
    const result = scoreResponse(pointDeclaration, "105 95");

    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(3); // positive sum of area values
  });

  test("point baseType compares numerically in match_correct", () => {
    const exact: ResponseDeclarationView = {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "point",
      correctResponse: { values: [{ value: "10 20" }] },
    };

    expect(matchCorrect(exact, "10 20")).toBe(true);
    expect(matchCorrect(exact, "10  20")).toBe(true);
    expect(matchCorrect(exact, "10 21")).toBe(false);
  });
});

describe("map_response_point in the RP interpreter", () => {
  test("the standard template resolves and scores point responses", () => {
    const result = executeResponseProcessing(
      { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response_point" },
      {
        responseDeclarations: [pointDeclaration],
        outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
        responses: { RESPONSE: "105 95" },
      },
    );

    expect(result.issues).toEqual([]);
    expect(result.outcomes["SCORE"]).toBe(2);
  });

  test("null point response scores 0 via the template", () => {
    const result = executeResponseProcessing(
      { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response_point" },
      {
        responseDeclarations: [pointDeclaration],
        outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
        responses: {},
      },
    );

    expect(result.outcomes["SCORE"]).toBe(0);
  });
});
