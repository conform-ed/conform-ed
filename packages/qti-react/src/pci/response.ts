/**
 * PCI JSON ↔ ResponseValue conversion (IMS PCI v1 "JSON representation of variable
 * values"). PCI instances exchange `{ base: { integer: 3 } }` / `{ list: ... }` /
 * `{ record: [{ name, base }] }` shapes; the attempt store speaks string / string[] /
 * record-object / null. Record fields keep their runtime type so `fieldValue` in
 * response processing sees properly typed members.
 */

import { isResponseRecord } from "../types";
import type { ResponseDeclarationView, ResponseFieldValue, ResponseValue } from "../types";

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

/** One `{ name, base }` record entry → a typed field, or null for malformed entries. */
function recordField(entry: unknown): [string, ResponseFieldValue] | null {
  if (typeof entry !== "object" || entry === null) {
    return null;
  }

  const { name, base } = entry as { name?: unknown; base?: unknown };

  if (typeof name !== "string") {
    return null;
  }

  const raw = payloadEntry(base);

  if (raw === undefined || raw === null) {
    return [name, null];
  }

  return [name, typeof raw === "boolean" || typeof raw === "number" ? raw : scalarToString(raw)];
}

export function pciResponseToValue(json: unknown): ResponseValue {
  if (typeof json !== "object" || json === null) {
    return null;
  }

  const shaped = json as { base?: unknown; list?: unknown; record?: unknown };

  if (shaped.base !== undefined) {
    const entry = payloadEntry(shaped.base);

    return entry === undefined || entry === null ? null : scalarToString(entry);
  }

  if (shaped.list !== undefined) {
    const entry = payloadEntry(shaped.list);

    return Array.isArray(entry) ? entry.map(scalarToString) : null;
  }

  if (Array.isArray(shaped.record)) {
    return Object.fromEntries(
      shaped.record.flatMap((entry) => {
        const field = recordField(entry);

        return field === null ? [] : [field];
      }),
    );
  }

  return null; // unknown shapes
}

/** PCI JSON base key for a record field, derived from its runtime type. */
function fieldPciType(value: string | number | boolean): string {
  return typeof value === "boolean" ? "boolean" : typeof value === "number" ? "float" : "string";
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

  if (isResponseRecord(value)) {
    return {
      record: Object.entries(value).map(([name, member]) =>
        member === null ? { name, base: null } : { name, base: { [fieldPciType(member)]: member } },
      ),
    };
  }

  if (declaration.cardinality === "single") {
    const single = Array.isArray(value) ? value[0] : value;

    return single === undefined ? { base: null } : { base: { [baseType]: bindScalar(single, baseType) } };
  }

  const entries = Array.isArray(value) ? value : [value];

  return { list: { [baseType]: entries.map((entry) => bindScalar(entry, baseType)) } };
}
