/**
 * JSON-Schema walker (L1) — the first schema-language walker described in
 * conform-ed ADR-0013. Walks one schema root subtree (a document root or a
 * `$defs` definition) and emits a flat inventory of {@link CoverageItem}s plus
 * the {@link UsageEdge}s for `$ref`s it encounters. `$ref`s are recorded as edges
 * and *not* expanded inline — shared definitions are walked once by the caller
 * (ADR-0013, Q5: definitions keyed once, repeated appearances are edges).
 *
 * Targets JSON Schema draft 2019-09 / 2020-12 (the 1EdTech / W3C bindings:
 * Open Badges, CLR, CASE, Caliper, VC). Treats the schema as opaque JSON.
 */

import type { CoverageItem, ItemKind, UsageEdge } from "../types";

export type JsonSchema = Record<string, unknown>;

export interface WalkContext {
  readonly spec: string;
  readonly version: string;
  /**
   * Optional namespace for `def:` keys, e.g. a binding name. Used when shared
   * definition *names* are not globally unique across documents (Zod's generated
   * `__schemaN` names collide across documents); the literal side leaves this
   * unset so its globally-stable `$def` names key shared definitions once (Q5).
   */
  readonly defNamespace?: string;
}

export interface WalkResult {
  readonly items: readonly CoverageItem[];
  readonly edges: readonly UsageEdge[];
}

const NORMATIVE_RE = /\b(?:MUST NOT|MUST|SHALL NOT|SHALL|REQUIRED)\b/;
const MAX_INLINE_DEPTH = 16;
const MAX_DESCRIPTION = 280;

function isObject(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function getString(node: JsonSchema, key: string): string | undefined {
  const v = node[key];
  return typeof v === "string" ? v : undefined;
}

/** Resolve a local `#/$defs/<Name>` (or legacy `#/definitions/<Name>`) ref. */
export function refDefName(ref: string): string | undefined {
  const match = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(ref);
  if (match === null) return undefined;
  const tail = match[1];
  // Only single-segment definition refs are tracked (deep JSON-Pointer refs are rare here).
  return tail !== undefined && !tail.includes("/") ? decodeURIComponent(tail) : undefined;
}

function readType(node: JsonSchema): string | readonly string[] | undefined {
  const t = node["type"];
  if (typeof t === "string") return t;
  if (Array.isArray(t) && t.every((x): x is string => typeof x === "string")) return t;
  return undefined;
}

function readEnum(node: JsonSchema): readonly (string | number | boolean | null)[] | undefined {
  const e = node["enum"];
  if (Array.isArray(e)) {
    const scalars = e.filter(isScalar);
    if (scalars.length > 0) return scalars;
  }
  if ("const" in node && isScalar(node["const"])) return [node["const"]];
  return undefined;
}

function readStringSet(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((x): x is string => typeof x === "string"));
}

function collapse(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_DESCRIPTION ? `${flat.slice(0, MAX_DESCRIPTION - 1)}…` : flat;
}

function readDescription(node: JsonSchema): string | undefined {
  const desc = getString(node, "description");
  return desc !== undefined && desc.length > 0 ? collapse(desc) : undefined;
}

function isNormative(node: JsonSchema): boolean {
  for (const key of ["description", "$comment", "title"] as const) {
    const text = getString(node, key);
    if (text !== undefined && NORMATIVE_RE.test(text)) return true;
  }
  return false;
}

/**
 * Walk one root subtree. `rootKey` is the canonical key of the root
 * (`spec:version:doc:<binding>` or `spec:version:def:<Name>`); `kind` describes it.
 */
export function walkSchemaTree(rootKey: string, kind: ItemKind, root: JsonSchema, ctx: WalkContext): WalkResult {
  const items: CoverageItem[] = [];
  const edges: UsageEdge[] = [];
  const seen = new Set<string>();

  const keyAt = (path: string): string => (path === "" ? rootKey : `${rootKey}/${path}`);

  function emit(path: string, node: JsonSchema, itemKind: ItemKind, required: boolean): void {
    const key = keyAt(path);
    if (seen.has(key)) return;
    seen.add(key);
    const jsonType = readType(node);
    const enumValues = readEnum(node);
    const description = readDescription(node);
    items.push({
      key,
      kind: itemKind,
      path,
      ...(jsonType !== undefined ? { jsonType } : {}),
      ...(required ? { required: true } : {}),
      ...(enumValues !== undefined ? { enumValues } : {}),
      ...(isNormative(node) ? { normative: true } : {}),
      ...(description !== undefined ? { description } : {}),
    });
  }

  function recurse(path: string, node: JsonSchema, depth: number): void {
    if (depth > MAX_INLINE_DEPTH) return;

    const ref = getString(node, "$ref");
    if (ref !== undefined) {
      const defName = refDefName(ref);
      if (defName !== undefined) {
        const ns = ctx.defNamespace !== undefined ? `${ctx.defNamespace}.` : "";
        edges.push({ from: keyAt(path), to: `${ctx.spec}:${ctx.version}:def:${ns}${defName}` });
      }
      return; // shared definitions are walked once by the caller, not inline
    }

    for (const combinator of ["oneOf", "anyOf", "allOf"] as const) {
      const branches = node[combinator];
      if (Array.isArray(branches)) {
        for (const branch of branches) if (isObject(branch)) recurse(path, branch, depth + 1);
      }
    }

    const props = node["properties"];
    if (isObject(props)) {
      const required = readStringSet(node["required"]);
      for (const [name, schema] of Object.entries(props)) {
        if (!isObject(schema)) continue;
        const childPath = path === "" ? name : `${path}/${name}`;
        emit(childPath, schema, "property", required.has(name));
        recurse(childPath, schema, depth + 1);
      }
    }

    const elemPath = path === "" ? "[]" : `${path}/[]`;
    for (const arrayKey of ["items", "additionalItems", "prefixItems", "contains"] as const) {
      const sub = node[arrayKey];
      if (isObject(sub)) {
        emit(elemPath, sub, "property", false);
        recurse(elemPath, sub, depth + 1);
      } else if (Array.isArray(sub)) {
        for (const entry of sub) {
          if (isObject(entry)) {
            emit(elemPath, entry, "property", false);
            recurse(elemPath, entry, depth + 1);
          }
        }
      }
    }

    const additional = node["additionalProperties"];
    if (isObject(additional)) recurse(path, additional, depth + 1);
  }

  emit("", root, kind, false);
  recurse("", root, 0);
  return { items, edges };
}
