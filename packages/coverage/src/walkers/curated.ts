/**
 * Curated denominator walker (L1) — conform-ed ADR-0017.
 *
 * For families the spec publishes only as prose + inline JSON examples (no XSD / JSON
 * Schema / OpenAPI to walk: LTI Core / Deep Linking / NRPS, cmi5, the credential REST
 * surfaces), the denominator is a **hand-authored** JSON Schema vendored in the repo. It is
 * walked by the very same {@link walkSchemaTree} as a machine-vendored schema — so it
 * reconciles against the Zod model identically — but it is the lowest provenance tier and
 * must earn that trust: this walker refuses to walk a curated file unless
 *
 *  1. the document carries file-level provenance (a `$comment` naming ADR-0017 and a spec
 *     URL), and
 *  2. **every** property node cites its spec section (a `$comment` beginning `specRef:`).
 *
 * A curated file that drifts from this discipline fails the build, not silently the audit.
 */

import type { UsageEdge } from "../types";
import { type JsonSchema, walkSchemaTree, type WalkContext, type WalkResult } from "./json-schema";

function isObject(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getComment(node: JsonSchema): string | undefined {
  const comment = node["$comment"];
  return typeof comment === "string" ? comment : undefined;
}

/** Provenance gate (ADR-0017): the document must name the ADR and a spec URL. */
function assertFileProvenance(root: JsonSchema, binding: string): void {
  const comment = getComment(root);
  if (comment === undefined || !comment.includes("ADR-0017") || !/https?:\/\//.test(comment)) {
    throw new Error(
      `Curated denominator "${binding}" must carry a top-level $comment naming ADR-0017 and the source spec URL.`,
    );
  }
}

/**
 * Every property node must cite its spec section. Recurses the whole schema (properties,
 * combinator branches, array items, `$defs`, additionalProperties) so a citation cannot be
 * skipped by nesting it under a sub-object or a union branch.
 */
function assertPropertyCitations(node: JsonSchema, binding: string, label: string): void {
  const props = node["properties"];
  if (isObject(props)) {
    for (const [name, sub] of Object.entries(props)) {
      if (!isObject(sub)) continue;
      const comment = getComment(sub);
      if (comment === undefined || !comment.startsWith("specRef:")) {
        throw new Error(
          `Curated denominator "${binding}" property ${label}/${name} is missing a "specRef:" $comment citation.`,
        );
      }
      assertPropertyCitations(sub, binding, `${label}/${name}`);
    }
  }

  for (const combinator of ["oneOf", "anyOf", "allOf"] as const) {
    const branches = node[combinator];
    if (Array.isArray(branches)) {
      branches.forEach((branch, index) => {
        if (isObject(branch)) assertPropertyCitations(branch, binding, `${label}/${combinator}[${index}]`);
      });
    }
  }

  for (const arrayKey of ["items", "contains", "additionalProperties"] as const) {
    const sub = node[arrayKey];
    if (isObject(sub)) assertPropertyCitations(sub, binding, `${label}/${arrayKey}`);
  }

  const defs = node["$defs"];
  if (isObject(defs)) {
    for (const [name, def] of Object.entries(defs)) {
      if (isObject(def)) assertPropertyCitations(def, binding, `$defs/${name}`);
    }
  }
}

function readDefs(schema: JsonSchema): ReadonlyMap<string, JsonSchema> {
  const out = new Map<string, JsonSchema>();
  const defs = schema["$defs"];
  if (isObject(defs)) {
    for (const [name, def] of Object.entries(defs)) {
      if (isObject(def)) out.set(name, def);
    }
  }
  return out;
}

export interface CuratedWalkResult extends WalkResult {
  readonly sourceId?: string;
}

/**
 * Walk a curated denominator into the shared inventory. `$defs` are keyed globally
 * (`def:<Name>`, the literal-side convention) so the reconciler's name-based join is
 * agnostic to whether the Zod side inlines or `$ref`s the same sub-objects.
 */
export function walkCurated(bytes: string, binding: string, ctx: WalkContext): CuratedWalkResult {
  const parsed: unknown = JSON.parse(bytes);
  if (!isObject(parsed)) {
    throw new Error(`Curated denominator "${binding}" is not a JSON object.`);
  }

  assertFileProvenance(parsed, binding);
  assertPropertyCitations(parsed, binding, "");

  const root = walkSchemaTree(`${ctx.spec}:${ctx.version}:doc:${binding}`, "document", parsed, ctx);
  const items = [...root.items];
  const edges: UsageEdge[] = [...root.edges];

  for (const [name, def] of readDefs(parsed)) {
    const walked = walkSchemaTree(`${ctx.spec}:${ctx.version}:def:${name}`, "definition", def, ctx);
    items.push(...walked.items);
    edges.push(...walked.edges);
  }

  const id = typeof parsed["$id"] === "string" ? parsed["$id"] : undefined;
  return { items, edges, ...(id !== undefined ? { sourceId: id } : {}) };
}
