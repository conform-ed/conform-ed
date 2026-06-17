/**
 * OpenAPI walker (L1) — the third schema-language walker described in conform-ed
 * ADR-0013, for the OpenAPI 3 REST bindings (1EdTech OneRoster 1.2). The literal
 * denominator is the published OpenAPI document; its information model lives in
 * `components.schemas`, each entry of which is an ordinary JSON Schema referencing
 * its siblings via `#/components/schemas/<Name>`.
 *
 * So this walker reuses {@link walkSchemaTree} unchanged (its {@link refDefName} now
 * resolves `#/components/schemas/` refs): every component schema becomes a
 * `spec:version:def:<Name>` definition, and each *binding* additionally gets a
 * `spec:version:doc:<binding>` document root with an edge to its definition — the
 * same doc-root→def shape the XSD walker uses, so the reconciler is unchanged.
 *
 * `paths` (the REST operations) are the conformance/REST-binding axis, not the
 * information model, so they are out of scope for L1 here.
 */

import type { CoverageItem, UsageEdge } from "../types";
import { type JsonSchema, walkSchemaTree, type WalkContext } from "./json-schema";

export interface OpenApiWalkResult {
  readonly items: readonly CoverageItem[];
  readonly edges: readonly UsageEdge[];
  readonly docRootKey: string;
  /** The document's `info.title` + version — its provenance label. */
  readonly sourceId?: string;
}

function isObject(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function walkOpenApi(docText: string, binding: string, ctx: WalkContext): OpenApiWalkResult {
  const parsed: unknown = JSON.parse(docText);
  const doc = isObject(parsed) ? parsed : {};
  const components = isObject(doc["components"]) ? doc["components"] : {};
  const schemas = isObject(components["schemas"]) ? components["schemas"] : {};

  const items: CoverageItem[] = [];
  const edges: UsageEdge[] = [];

  // Every component schema → a shared definition (keyed once; the reconciler resolves
  // `#/components/schemas/X` ref edges transitively).
  for (const [name, schema] of Object.entries(schemas)) {
    if (!isObject(schema)) continue;
    const defKey = `${ctx.spec}:${ctx.version}:def:${name}`;
    const walked = walkSchemaTree(defKey, "definition", schema, ctx);
    items.push(...walked.items);
    edges.push(...walked.edges);
  }

  // The binding's component is also exposed as a document root that edges to its def.
  const docRootKey = `${ctx.spec}:${ctx.version}:doc:${binding}`;
  items.push({ key: docRootKey, kind: "document", path: "" });
  edges.push({ from: docRootKey, to: `${ctx.spec}:${ctx.version}:def:${binding}` });

  const info = isObject(doc["info"]) ? doc["info"] : undefined;
  const title = info !== undefined && typeof info["title"] === "string" ? info["title"] : undefined;
  const version = info !== undefined && typeof info["version"] === "string" ? info["version"] : undefined;
  const sourceId = title !== undefined ? (version !== undefined ? `${title} v${version}` : title) : undefined;

  return {
    items,
    edges,
    docRootKey,
    ...(sourceId !== undefined ? { sourceId } : {}),
  };
}
