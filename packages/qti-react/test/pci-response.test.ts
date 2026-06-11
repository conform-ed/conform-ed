/**
 * PCI JSON ↔ ResponseValue conversion (IMS PCI v1 "JSON representation of variable
 * values"). PCI instances speak `{ base: { integer: 3 } }`; the attempt store speaks
 * string / string[] / null. Records have no ResponseValue shape and convert to null.
 */

import { describe, expect, test } from "bun:test";

import { pciResponseToValue, valueToPciResponse } from "../src/pci";
import type { ResponseDeclarationView } from "../src/types";

describe("pciResponseToValue", () => {
  test("base scalars become strings", () => {
    expect(pciResponseToValue({ base: { integer: 3 } })).toBe("3");
    expect(pciResponseToValue({ base: { float: 1.5 } })).toBe("1.5");
    expect(pciResponseToValue({ base: { string: "cabbage" } })).toBe("cabbage");
    expect(pciResponseToValue({ base: { identifier: "choiceA" } })).toBe("choiceA");
    expect(pciResponseToValue({ base: { boolean: true } })).toBe("true");
  });

  test("points and pairs join with a space, matching the runtime convention", () => {
    expect(pciResponseToValue({ base: { point: [3, 7] } })).toBe("3 7");
    expect(pciResponseToValue({ base: { pair: ["a", "b"] } })).toBe("a b");
    expect(pciResponseToValue({ base: { directedPair: ["from", "to"] } })).toBe("from to");
  });

  test("lists become string arrays", () => {
    expect(pciResponseToValue({ list: { integer: [1, 2, 3] } })).toEqual(["1", "2", "3"]);
    expect(
      pciResponseToValue({
        list: {
          point: [
            [1, 2],
            [3, 4],
          ],
        },
      }),
    ).toEqual(["1 2", "3 4"]);
    expect(pciResponseToValue({ list: { identifier: [] } })).toEqual([]);
  });

  test("null bases, records, and junk are null", () => {
    expect(pciResponseToValue({ base: null })).toBeNull();
    expect(pciResponseToValue(null)).toBeNull();
    expect(pciResponseToValue(undefined)).toBeNull();
    expect(pciResponseToValue({ record: [{ name: "x", base: { string: "y" } }] })).toBeNull();
    expect(pciResponseToValue("nonsense")).toBeNull();
  });
});

describe("valueToPciResponse", () => {
  const integerDeclaration: ResponseDeclarationView = {
    identifier: "RESPONSE",
    cardinality: "single",
    baseType: "integer",
  };

  test("single values bind by declared base type", () => {
    expect(valueToPciResponse("3", integerDeclaration)).toEqual({ base: { integer: 3 } });
    expect(valueToPciResponse("yes", { identifier: "R", cardinality: "single", baseType: "identifier" })).toEqual({
      base: { identifier: "yes" },
    });
  });

  test("multiple cardinality binds as a list", () => {
    expect(valueToPciResponse(["1", "2"], { identifier: "R", cardinality: "multiple", baseType: "integer" })).toEqual({
      list: { integer: [1, 2] },
    });
  });

  test("empty responses bind as a null base", () => {
    expect(valueToPciResponse(null, integerDeclaration)).toEqual({ base: null });
  });
});
