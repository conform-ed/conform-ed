/**
 * Caliper 1.2 walker (L1) — a JSON-Schema-family walker for the bootcamp-distribution
 * shape (conform-ed ADR-0013). ⚠️ Provenance: the literal denominator is the 1EdTech
 * **CaliperBootcamp** GitHub repo (developer-education material), not a canonical
 * `purl.imsglobal.org` schema release — there is no such release for Caliper. See
 * `vendor/caliper/v1_2/PROVENANCE.md`. Accepted as the denominator on that basis.
 *
 * The bootcamp ships one draft-04 file per type (`id` = filename) that cross-reference
 * each other with a non-standard convention the plain JSON-Schema walker can't follow:
 *
 *  - `"$ref": "Person"`                       → the whole `Person.json` schema;
 *  - `"$ref": "CaliperTypeDefinitions#/extensions"` → a JSON-pointer into another file's
 *                                               top-level key (shared property defs).
 *
 * This walker bundles every file in the entry file's directory into a single `$defs`
 * map and rewrites the refs to ordinary intra-document `#/$defs/<name>` form (`"X"` →
 * `#/$defs/X`; `"X#/k"` → `#/$defs/X.k`, hoisting the fragment target as its own def).
 * The rewrite is mechanical address translation — no schema content is added or dropped,
 * so the vendored files remain the denominator — after which {@link walkSchemaTree} and
 * the reconciler apply exactly as for the native JSON-Schema maps (OB / CLR / CASE).
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { CoverageItem, UsageEdge } from "../types";
import { type JsonSchema, walkSchemaTree, type WalkContext } from "./json-schema";

export interface CaliperWalkResult {
  readonly items: readonly CoverageItem[];
  readonly edges: readonly UsageEdge[];
  readonly docRootKey: string;
  readonly sourceId?: string;
}

function isObject(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The assembled bundle: one flat `$defs` map keyed by entity id (+ hoisted `File.key`). */
interface Bundle {
  readonly defs: ReadonlyMap<string, JsonSchema>;
}

// Bundling reads 110 files; memoise per directory so a multi-binding map assembles once.
const bundleCache = new Map<string, Bundle>();

function assembleBundle(dir: string): Bundle {
  const cached = bundleCache.get(dir);
  if (cached !== undefined) return cached;

  const rawById = new Map<string, JsonSchema>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const parsed: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
    if (!isObject(parsed)) continue;
    const id = typeof parsed["id"] === "string" ? parsed["id"] : file.replace(/\.json$/, "");
    rawById.set(id, parsed);
  }

  const hoists = new Set<string>(); // `File.key` fragment targets discovered during rewrite

  // Rewrite every `$ref` in a freshly-cloned subtree to intra-document `#/$defs/<name>`.
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite);
    if (!isObject(node)) return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") {
        const hash = value.indexOf("#");
        if (hash === -1) {
          out["$ref"] = `#/$defs/${value}`;
        } else {
          const file = value.slice(0, hash);
          const pointer = value.slice(hash + 1).replace(/^\//, ""); // `#/extensions` → `extensions`
          const name = `${file}.${pointer}`;
          hoists.add(name);
          out["$ref"] = `#/$defs/${name}`;
        }
      } else {
        out[key] = rewrite(value);
      }
    }
    return out;
  };

  const defs = new Map<string, JsonSchema>();
  for (const [id, schema] of rawById) defs.set(id, rewrite(schema) as JsonSchema);

  // Hoist fragment targets (e.g. `CaliperTypeDefinitions.extensions`). Their content may
  // itself contain refs (already rewritten on read), so drain to a fixpoint.
  const resolved = new Set<string>();
  let pending = [...hoists];
  while (pending.length > 0) {
    const next: string[] = [];
    for (const name of pending) {
      if (resolved.has(name)) continue;
      resolved.add(name);
      const dot = name.indexOf(".");
      const file = name.slice(0, dot);
      const key = name.slice(dot + 1);
      const target = rawById.get(file)?.[key];
      if (isObject(target)) defs.set(name, rewrite(target) as JsonSchema);
    }
    // `rewrite` above may have added new hoists; pick up any not yet resolved.
    for (const h of hoists) if (!resolved.has(h)) next.push(h);
    pending = next;
  }

  const bundle: Bundle = { defs };
  bundleCache.set(dir, bundle);
  return bundle;
}

export function walkCaliper(entrySchemaPath: string, binding: string, ctx: WalkContext): CaliperWalkResult {
  const { defs } = assembleBundle(dirname(entrySchemaPath));

  const items: CoverageItem[] = [];
  const edges: UsageEdge[] = [];

  // Every bundled definition is keyed once; the reconciler resolves `#/$defs/X` edges.
  for (const [name, schema] of defs) {
    const defKey = `${ctx.spec}:${ctx.version}:def:${name}`;
    const walked = walkSchemaTree(defKey, "definition", schema, ctx);
    items.push(...walked.items);
    edges.push(...walked.edges);
  }

  // The binding's entity is also exposed as a document root edging to its definition.
  const docRootKey = `${ctx.spec}:${ctx.version}:doc:${binding}`;
  items.push({ key: docRootKey, kind: "document", path: "" });
  edges.push({ from: docRootKey, to: `${ctx.spec}:${ctx.version}:def:${binding}` });

  return { items, edges, docRootKey, sourceId: "1EdTech CaliperBootcamp (caliper/v1p2, schemas/v1_2)" };
}
