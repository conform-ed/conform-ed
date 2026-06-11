/**
 * PCI JSON ↔ ResponseValue conversion (IMS PCI v1 "JSON representation of variable
 * values"). PCI instances exchange `{ base: { integer: 3 } }` / `{ list: ... }`
 * shapes; the attempt store speaks string / string[] / null. Records have no
 * ResponseValue shape and convert to null — record-bound PCIs are out of scope.
 */

import type { ResponseDeclarationView, ResponseValue } from "../types";

function scalarToString(value: unknown): string {
  if (Array.isArray(value)) {
    // point / pair / directedPair entries: tuples join with a space, matching the
    // runtime's response conventions ("x y", "from to").
    return value.map(String).join(" ");
  }

  return String(value);
}

/** First (and per spec only) entry of a base/list payload: `{ integer: 3 }` → 3. */
function payloadEntry(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const values = Object.values(payload);

  return values.length > 0 ? values[0] : undefined;
}

export function pciResponseToValue(json: unknown): ResponseValue {
  if (typeof json !== "object" || json === null) {
    return null;
  }

  const shaped = json as { base?: unknown; list?: unknown };

  if (shaped.base !== undefined) {
    const entry = payloadEntry(shaped.base);

    return entry === undefined || entry === null ? null : scalarToString(entry);
  }

  if (shaped.list !== undefined) {
    const entry = payloadEntry(shaped.list);

    return Array.isArray(entry) ? entry.map(scalarToString) : null;
  }

  return null; // records and unknown shapes
}

const numericBaseTypes = new Set(["integer", "float"]);

function bindScalar(value: string, baseType: string): unknown {
  if (numericBaseTypes.has(baseType)) {
    return Number(value);
  }

  if (baseType === "boolean") {
    return value === "true";
  }

  if (baseType === "point") {
    return value.split(/\s+/u).map(Number);
  }

  if (baseType === "pair" || baseType === "directedPair") {
    return value.split(/\s+/u);
  }

  return value;
}

/** The current response in PCI JSON form — fed to `getInstance` as `boundTo`. */
export function valueToPciResponse(value: ResponseValue, declaration: ResponseDeclarationView): unknown {
  const baseType = declaration.baseType ?? "string";

  if (value === null || value === undefined) {
    return { base: null };
  }

  if (declaration.cardinality === "single") {
    const single = Array.isArray(value) ? value[0] : value;

    return single === undefined ? { base: null } : { base: { [baseType]: bindScalar(single, baseType) } };
  }

  const entries = Array.isArray(value) ? value : [value];

  return { list: { [baseType]: entries.map((entry) => bindScalar(entry, baseType)) } };
}
