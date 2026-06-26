/**
 * SHACL coverage walker (conform-ed ADR-0013 "one walker per schema *language*";
 * ADR-0019). Walks the European Learning Model's SHACL shape graphs — the authoritative
 * conformance denominator an EDC self-declares via `ShaclValidator2017` — into the shared
 * {@link CoverageItem} L1 inventory.
 *
 * A profile's map is the **union of its variant shape graphs** (ADR-0019): each EDC
 * sub-variant (generic-full/no-cv/accredited/converted/issued-by-mandate/diploma-supplement)
 * and each LOQ/AMS `-mdr` variant is walked, and every constraint is tagged with the
 * variant(s) that declare it (`CoverageItem.variants`). We walk every variant file directly
 * rather than resolving `owl:imports` for the inventory — the import closure is recorded as
 * metadata (it matters at verify-time, where the SHACL engine needs the full closure), but
 * the L1 inventory is the union of what the files literally contain.
 *
 * Controlled-vocabulary leaves (a property whose value shape is a `…Restriction` over a
 * `data.europa.eu/snb/<scheme>/` authority) are tagged `cvScheme`/`cvEnforcement`: `opaque`
 * for the large open schemes (ESCO), `membership` for the bounded EU lists (ADR-0019 §5).
 */

import { readFileSync } from "node:fs";

import { Parser, Store, type Quad_Object, type Quad_Subject, type Term } from "n3";

import type { CoverageItem, UsageEdge } from "../types";
import type { WalkContext } from "./json-schema";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment";
const OWL_IMPORTS = "http://www.w3.org/2002/07/owl#imports";
const OWL_ONTOLOGY = "http://www.w3.org/2002/07/owl#Ontology";
const SH = "http://www.w3.org/ns/shacl#";
const sh = (t: string): string => `${SH}${t}`;
const SKOS_INSCHEME = "http://www.w3.org/2004/02/skos/core#inScheme";
const NORMATIVE_RE = /\b(MUST|SHALL|REQUIRED)\b/;

/** xsd datatype IRI → JSON Schema `type`. */
function jsonTypeForDatatype(iri: string): string | undefined {
  const t = iri.replace("http://www.w3.org/2001/XMLSchema#", "");
  if (t === "boolean") return "boolean";
  if (["integer", "decimal", "float", "double", "int", "long", "nonNegativeInteger"].includes(t)) return "number";
  if (
    ["string", "anyURI", "dateTime", "date", "time", "gYear", "duration", "normalizedString", "language"].includes(t)
  ) {
    return "string";
  }
  return undefined;
}

/** Local name of an IRI — the segment after the last `#` or `/`. */
function localName(iri: string): string {
  const hash = iri.lastIndexOf("#");
  const slash = iri.lastIndexOf("/");
  return iri.slice(Math.max(hash, slash) + 1);
}

export interface ShaclVariantInput {
  /** Absolute path to the vendored `.ttl` shape graph. */
  readonly path: string;
  /** Short variant tag recorded on each item, e.g. `generic-no-cv`, `accredited`, `mdr`. */
  readonly variant: string;
}

export interface ShaclWalkResult {
  readonly items: CoverageItem[];
  readonly edges: UsageEdge[];
  /** The profile's primary ontology IRI (first variant's `owl:Ontology` subject). */
  readonly sourceId: string;
  /** Recorded `owl:imports` edges across the variants (closure metadata, not L1). */
  readonly imports: ReadonlyArray<{ readonly from: string; readonly to: string }>;
}

/** Mutable accumulator for an item being unioned across variants. */
interface ItemAccumulator {
  kind: "definition" | "property";
  path: string;
  jsonType?: string;
  required?: boolean;
  description?: string;
  normative?: boolean;
  cvScheme?: string;
  cvEnforcement?: "membership" | "opaque";
  variants: Set<string>;
}

/** First object IRI/literal value for (subject, predicate), or undefined. */
function firstObject(store: Store, subject: Term, predicate: string): Quad_Object | undefined {
  for (const q of store.getQuads(subject as Quad_Subject, predicate, null, null)) return q.object;
  return undefined;
}

/**
 * Resolve the controlled-vocabulary scheme a `…Restriction` value shape constrains its
 * values to. The scheme IRI is the `sh:hasValue` of the restriction's nested
 * `sh:property [ sh:path skos:inScheme ; sh:hasValue <scheme> ]`. ESCO schemes
 * (`…/esco/…`) are `opaque` (scheme-checked only); the bounded EU authorities
 * (`data.europa.eu/snb/<scheme>/`, `publications.europa.eu/resource/authority/<scheme>`)
 * are `membership` (ADR-0019 §5). The full scheme IRI is recorded for traceability.
 */
function resolveCv(
  store: Store,
  restriction: Term,
): { scheme: string; enforcement: "membership" | "opaque" } | undefined {
  for (const pq of store.getQuads(restriction as Quad_Subject, sh("property"), null, null)) {
    const inner = pq.object;
    const pathTerm = firstObject(store, inner, sh("path"));
    if (pathTerm?.value !== SKOS_INSCHEME) continue;
    const hasValue = firstObject(store, inner, sh("hasValue"));
    if (hasValue === undefined || hasValue.termType !== "NamedNode") continue;
    return { scheme: hasValue.value, enforcement: /\/esco\//i.test(hasValue.value) ? "opaque" : "membership" };
  }
  return undefined;
}

export function walkShacl(profile: string, variants: readonly ShaclVariantInput[], ctx: WalkContext): ShaclWalkResult {
  const keyPrefix = `${ctx.spec}:${ctx.version}`;
  const acc = new Map<string, ItemAccumulator>();
  const edgeSet = new Set<string>();
  const edges: UsageEdge[] = [];
  const imports: Array<{ from: string; to: string }> = [];
  let sourceId = "";

  const addEdge = (from: string, to: string): void => {
    const k = `${from} ${to}`;
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push({ from, to });
  };

  const touch = (key: string, kind: "definition" | "property", path: string, variant: string): ItemAccumulator => {
    let a = acc.get(key);
    if (a === undefined) {
      a = { kind, path, variants: new Set() };
      acc.set(key, a);
    }
    a.variants.add(variant);
    return a;
  };

  for (const { path, variant } of variants) {
    const store = new Store(new Parser().parse(readFileSync(path, "utf8")));

    for (const q of store.getQuads(null, OWL_IMPORTS, null, null)) {
      imports.push({ from: q.subject.value, to: q.object.value });
    }
    if (sourceId === "") {
      for (const q of store.getQuads(null, RDF_TYPE, OWL_ONTOLOGY, null)) {
        sourceId = q.subject.value;
        break;
      }
    }

    // Every NodeShape that targets a class is a class shape in the inventory.
    for (const tc of store.getQuads(null, sh("targetClass"), null, null)) {
      const shapeNode = tc.subject;
      const className = localName(tc.object.value);
      const defKey = `${keyPrefix}:def:${className}`;
      const defAcc = touch(defKey, "definition", "", variant);
      const defComment = firstObject(store, shapeNode, RDFS_COMMENT);
      if (defAcc.description === undefined && defComment !== undefined) {
        defAcc.description = defComment.value.replace(/\s+/g, " ").trim();
        if (NORMATIVE_RE.test(defAcc.description)) defAcc.normative = true;
      }

      for (const psq of store.getQuads(shapeNode as Quad_Subject, sh("property"), null, null)) {
        const ps = psq.object;
        const pathTerm = firstObject(store, ps, sh("path"));
        // P1 handles simple IRI paths; complex SHACL path expressions (blank nodes) are skipped.
        if (pathTerm === undefined || pathTerm.termType !== "NamedNode") continue;
        const propLocal = localName(pathTerm.value);
        const propKey = `${defKey}/${propLocal}`;
        const a = touch(propKey, "property", propLocal, variant);

        const minCount = firstObject(store, ps, sh("minCount"));
        if (minCount !== undefined && Number(minCount.value) >= 1) a.required = true;

        const datatype = firstObject(store, ps, sh("datatype"));
        if (a.jsonType === undefined && datatype !== undefined) {
          const jt = jsonTypeForDatatype(datatype.value);
          if (jt !== undefined) a.jsonType = jt;
        }

        const desc = firstObject(store, ps, sh("description")) ?? firstObject(store, ps, sh("name"));
        if (a.description === undefined && desc !== undefined) {
          a.description = desc.value.replace(/\s+/g, " ").trim();
          if (NORMATIVE_RE.test(a.description)) a.normative = true;
        }

        // Value type: sh:class (a target class) or sh:node (a named value/restriction shape).
        const valueClass = firstObject(store, ps, sh("class"));
        const valueNode = firstObject(store, ps, sh("node"));
        const valueType = valueClass ?? valueNode;
        if (valueType !== undefined && valueType.termType === "NamedNode") {
          const vLocal = localName(valueType.value);
          if (/Restriction$/.test(vLocal)) {
            const cv = resolveCv(store, valueType);
            if (cv !== undefined && a.cvScheme === undefined) {
              a.cvScheme = cv.scheme;
              a.cvEnforcement = cv.enforcement;
            }
          } else {
            addEdge(propKey, `${keyPrefix}:def:${vLocal}`);
          }
        }
      }
    }
  }

  const items: CoverageItem[] = [...acc.entries()]
    .map(([key, a]): CoverageItem => {
      const variantList = [...a.variants].sort();
      return {
        key,
        kind: a.kind,
        path: a.path,
        ...(a.jsonType !== undefined ? { jsonType: a.jsonType } : {}),
        ...(a.required === true ? { required: true } : {}),
        ...(a.normative === true ? { normative: true } : {}),
        ...(a.description !== undefined ? { description: a.description } : {}),
        ...(a.cvScheme !== undefined ? { cvScheme: a.cvScheme } : {}),
        ...(a.cvEnforcement !== undefined ? { cvEnforcement: a.cvEnforcement } : {}),
        variants: variantList,
      };
    })
    .sort((x, y) => x.key.localeCompare(y.key));

  edges.sort((a, b) => (a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)));

  return { items, edges, sourceId: sourceId === "" ? profile : sourceId, imports };
}
