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
 * information model, so {@link walkOpenApi} leaves them out of L1. The transport
 * surface is instead inventoried by {@link walkOpenApiPaths}, on the separate
 * `operation` / `parameter` / `security` axis (conform-ed ADR-0013) — opted in per
 * map via `SpecSource.restServices`.
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

/** Collapse documentation prose to a trimmed single line, as the schema walkers do. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function infoSourceId(doc: JsonSchema): string | undefined {
  const info = isObject(doc["info"]) ? doc["info"] : undefined;
  if (info === undefined) return undefined;
  const title = typeof info["title"] === "string" ? info["title"] : undefined;
  const version = typeof info["version"] === "string" ? info["version"] : undefined;
  if (title === undefined) return undefined;
  return version !== undefined ? `${title} v${version}` : title;
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

  const sourceId = infoSourceId(doc);

  return {
    items,
    edges,
    docRootKey,
    ...(sourceId !== undefined ? { sourceId } : {}),
  };
}

export interface OpenApiPathsResult {
  readonly items: readonly CoverageItem[];
  readonly edges: readonly UsageEdge[];
  /** The document's `info.title` + version — its provenance label. */
  readonly sourceId?: string;
}

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options", "trace"] as const;

/**
 * Walk an OpenAPI document's **transport surface** (conform-ed ADR-0013): the `paths`
 * operations, their reusable query parameters, and the `securitySchemes`. This is the
 * REST-binding axis — distinct from the information model {@link walkOpenApi} inventories
 * — so the items it emits are L1-only and never reconciled against Zod:
 *
 *  - `spec:version:path:<service>/<METHOD> <template>` (`operation`) per request operation;
 *  - `spec:version:param:<name>` (`parameter`) per distinct `in: query` parameter, shared
 *    across operations/services (the OneRoster query mechanisms: limit/offset/filter/…);
 *  - `spec:version:sec:<scheme>` (`security`) per declared security scheme.
 *
 * Operations edge to the query parameters and security schemes they use; the reconciler
 * never visits these nodes (its alignment starts from schema document roots), so the
 * edges are graph metadata only and the operations never pollute the residues.
 */
export function walkOpenApiPaths(docText: string, service: string, ctx: WalkContext): OpenApiPathsResult {
  const parsed: unknown = JSON.parse(docText);
  const doc = isObject(parsed) ? parsed : {};
  const paths = isObject(doc["paths"]) ? doc["paths"] : {};
  const components = isObject(doc["components"]) ? doc["components"] : {};
  const securitySchemes = isObject(components["securitySchemes"]) ? components["securitySchemes"] : {};
  const prefix = `${ctx.spec}:${ctx.version}`;
  const docSecurity = Array.isArray(doc["security"]) ? doc["security"] : [];

  const items: CoverageItem[] = [];
  const edges: UsageEdge[] = [];

  for (const [template, rawPathItem] of Object.entries(paths)) {
    if (!isObject(rawPathItem)) continue;
    const pathLevelParams = Array.isArray(rawPathItem["parameters"]) ? rawPathItem["parameters"] : [];
    for (const method of HTTP_METHODS) {
      const op = rawPathItem[method];
      if (!isObject(op)) continue;
      const label = `${method.toUpperCase()} ${template}`;
      const opKey = `${prefix}:path:${service}/${label}`;
      const summary =
        typeof op["summary"] === "string"
          ? op["summary"]
          : typeof op["description"] === "string"
            ? op["description"]
            : undefined;
      items.push({
        key: opKey,
        kind: "operation",
        path: label,
        ...(summary !== undefined ? { description: oneLine(summary) } : {}),
      });

      const opParams = Array.isArray(op["parameters"]) ? op["parameters"] : [];
      for (const raw of [...pathLevelParams, ...opParams]) {
        if (!isObject(raw) || raw["in"] !== "query" || typeof raw["name"] !== "string") continue;
        const paramKey = `${prefix}:param:${raw["name"]}`;
        items.push({
          key: paramKey,
          kind: "parameter",
          path: raw["name"],
          ...(typeof raw["description"] === "string" ? { description: oneLine(raw["description"]) } : {}),
        });
        edges.push({ from: opKey, to: paramKey });
      }

      const security = Array.isArray(op["security"]) ? op["security"] : docSecurity;
      for (const requirement of security) {
        if (!isObject(requirement)) continue;
        for (const schemeName of Object.keys(requirement)) {
          edges.push({ from: opKey, to: `${prefix}:sec:${schemeName}` });
        }
      }
    }
  }

  for (const [name, scheme] of Object.entries(securitySchemes)) {
    if (!isObject(scheme)) continue;
    const description =
      typeof scheme["description"] === "string"
        ? scheme["description"]
        : typeof scheme["type"] === "string"
          ? scheme["type"]
          : undefined;
    items.push({
      key: `${prefix}:sec:${name}`,
      kind: "security",
      path: name,
      ...(description !== undefined ? { description: oneLine(description) } : {}),
    });
  }

  const sourceId = infoSourceId(doc);
  return { items, edges, ...(sourceId !== undefined ? { sourceId } : {}) };
}
