/**
 * Coverage Map generator (conform-ed ADR-0013). Given a {@link SpecSource}:
 *
 *  1. Walk each vendored literal schema → L1 inventory (documents + shared defs,
 *     definitions keyed once, repeated appearances as usage edges).
 *  2. Render conform-ed's Zod for each binding to JSON Schema and walk it the same
 *     way → the "modelled" inventory.
 *  3. Reconcile the two by path-based join → L2 verdicts + the three residues.
 *  4. Cross-link the hand-curated conformance catalog and compute rollups.
 *
 * The result is deterministic (items/edges sorted by key) so a regenerated map
 * diffs cleanly in review.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { z } from "zod";

import { applyModelled, reconcile } from "./reconcile";
import type { SpecSource } from "./source";
import type { CoverageItem, CoverageMap, CoverageRollup, SourceArtifact, UsageEdge } from "./types";
import { type JsonSchema, walkSchemaTree, type WalkContext } from "./walkers/json-schema";
import { walkXsd } from "./walkers/xsd";

function parseJson(path: string): { schema: JsonSchema; bytes: string } {
  const bytes = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(bytes);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Schema at ${path} is not a JSON object`);
  }
  return { schema: parsed as JsonSchema, bytes };
}

function readDefs(schema: JsonSchema): ReadonlyMap<string, JsonSchema> {
  const out = new Map<string, JsonSchema>();
  for (const key of ["$defs", "definitions"] as const) {
    const defs = schema[key];
    if (typeof defs === "object" && defs !== null && !Array.isArray(defs)) {
      for (const [name, def] of Object.entries(defs)) {
        if (typeof def === "object" && def !== null && !Array.isArray(def) && !out.has(name)) {
          out.set(name, def as JsonSchema);
        }
      }
    }
  }
  return out;
}

interface Inventory {
  items: CoverageItem[];
  edges: UsageEdge[];
}

/**
 * Walk a set of document roots plus their shared definitions.
 *
 * - `scopedDefs: false` (literal side) — `$def` names are globally stable, so a
 *   shared definition is keyed once and merged across documents (Q5).
 * - `scopedDefs: true` (Zod side) — Zod's generated `__schemaN` names are
 *   document-local and collide across documents, so each document's defs are
 *   namespaced by its binding to stay collision-free.
 */
function buildInventory(
  ctx: WalkContext,
  documents: ReadonlyArray<{ binding: string; schema: JsonSchema }>,
  scopedDefs: boolean,
): Inventory {
  const items: CoverageItem[] = [];
  const edges: UsageEdge[] = [];
  const sharedDefs = new Map<string, JsonSchema>();

  for (const { binding, schema } of documents) {
    const docCtx: WalkContext = scopedDefs ? { ...ctx, defNamespace: binding } : ctx;
    const docKey = `${ctx.spec}:${ctx.version}:doc:${binding}`;
    const walked = walkSchemaTree(docKey, "document", schema, docCtx);
    items.push(...walked.items);
    edges.push(...walked.edges);

    if (scopedDefs) {
      for (const [name, def] of readDefs(schema)) {
        const defKey = `${ctx.spec}:${ctx.version}:def:${binding}.${name}`;
        const walkedDef = walkSchemaTree(defKey, "definition", def, docCtx);
        items.push(...walkedDef.items);
        edges.push(...walkedDef.edges);
      }
    } else {
      for (const [name, def] of readDefs(schema)) if (!sharedDefs.has(name)) sharedDefs.set(name, def);
    }
  }

  for (const [name, def] of sharedDefs) {
    const defKey = `${ctx.spec}:${ctx.version}:def:${name}`;
    const walked = walkSchemaTree(defKey, "definition", def, ctx);
    items.push(...walked.items);
    edges.push(...walked.edges);
  }

  return { items, edges };
}

function zodToJsonSchema(schema: z.ZodType): JsonSchema {
  // `reused: "ref"` makes Zod emit `$defs`/`$ref` for shared & recursive schemas
  // instead of inlining them, so the rendered topology matches the literal schema's
  // ref-based shape — a prerequisite for the path-based join to be symmetric.
  return z.toJSONSchema(schema, {
    unrepresentable: "any",
    io: "output",
    reused: "ref",
  }) as JsonSchema;
}

function rollup(items: readonly CoverageItem[], conformance: number): CoverageRollup {
  let yes = 0;
  let partial = 0;
  let no = 0;
  let normative = 0;
  for (const item of items) {
    if (item.modelled === "yes") yes += 1;
    else if (item.modelled === "partial") partial += 1;
    else if (item.modelled === "no") no += 1;
    if (item.normative === true) normative += 1;
  }
  return {
    items: items.length,
    modelledYes: yes,
    modelledPartial: partial,
    modelledNo: no,
    normativeItems: normative,
    conformanceRequirements: conformance,
  };
}

const byKey = (a: { key: string }, b: { key: string }): number => a.key.localeCompare(b.key);
const byEdge = (a: UsageEdge, b: UsageEdge): number =>
  a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from);

export interface BuildOptions {
  /** Override the generation timestamp (for deterministic tests). */
  readonly now?: string;
}

export function buildCoverageMap(source: SpecSource, options: BuildOptions = {}): CoverageMap {
  const ctx: WalkContext = { spec: source.spec, version: source.version };

  const jsonLiteralDocs: Array<{ binding: string; schema: JsonSchema }> = [];
  const xsdItems: CoverageItem[] = [];
  const xsdEdges: UsageEdge[] = [];
  const zodDocs: Array<{ binding: string; schema: JsonSchema }> = [];
  const sources: SourceArtifact[] = [];

  for (const binding of source.bindings) {
    if (binding.language === "xsd") {
      // Literal XSD: walked directly (no JSON-Schema conversion) — see walkers/xsd.ts.
      const bytes = readFileSync(binding.schemaPath, "utf8");
      const walked = walkXsd(bytes, binding.binding, ctx);
      xsdItems.push(...walked.items);
      xsdEdges.push(...walked.edges);
      sources.push({
        binding: binding.binding,
        language: binding.language,
        id: walked.sourceId ?? binding.schemaPath,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    } else {
      const { schema, bytes } = parseJson(binding.schemaPath);
      jsonLiteralDocs.push({ binding: binding.binding, schema });
      const id = typeof schema["$id"] === "string" ? schema["$id"] : binding.schemaPath;
      sources.push({
        binding: binding.binding,
        language: binding.language,
        id,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    if (binding.zod !== undefined) {
      zodDocs.push({ binding: binding.binding, schema: zodToJsonSchema(binding.zod) });
    }
  }

  // JSON document roots share `$defs` by global name (scopedDefs:false); the XSD
  // walker already keys its own defs, so its items/edges are simply concatenated.
  const jsonLiteral = buildInventory(ctx, jsonLiteralDocs, false);
  const literal = {
    items: [...jsonLiteral.items, ...xsdItems],
    edges: [...jsonLiteral.edges, ...xsdEdges],
  };
  const zod = buildInventory(ctx, zodDocs, true);

  const documentRootKeys = source.bindings.map((b) => `${ctx.spec}:${ctx.version}:doc:${b.binding}`);
  const { modelled, residues } = reconcile(literal, zod, documentRootKeys);
  const items = [...applyModelled(literal.items, modelled)].sort(byKey);
  const edges = [...literal.edges].sort(byEdge);
  const conformance = [...source.conformance].sort(byKey);

  return {
    meta: {
      spec: source.spec,
      version: source.version,
      generatedAt: options.now ?? new Date().toISOString().slice(0, 10),
      sources: sources.sort((a, b) => a.binding.localeCompare(b.binding)),
    },
    items,
    edges,
    conformance,
    residues,
    rollup: rollup(items, conformance.length),
  };
}
