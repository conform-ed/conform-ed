/**
 * ELM Coverage Map generator (conform-ed ADR-0013 / ADR-0019).
 *
 * ELM's SHACL denominator is class-flat and multi-rooted (one shape graph per profile,
 * unioned across variants), which does not fit the generic json-schema reconciler's
 * document/path descent. So L2 here is a **class + property name join**: for every literal
 * class/property the SHACL walker emits, look up the conform-ed Zod that models that class
 * (the registry) and check whether it carries the property. The residues fall out the same
 * way as the generic reconciler — silent gaps (literal props with no Zod counterpart) and
 * extensions (Zod props with no literal counterpart, within a modelled class).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { ZodType } from "zod";

import type {
  CoverageItem,
  CoverageMap,
  CoverageRollup,
  NormativeLevel,
  NormativeStatement,
  ReconciliationResidues,
  SourceArtifact,
} from "./types";
import { type ShaclVariantInput, walkShacl } from "./walkers/shacl";

/** className → the conform-ed Zod schema that models it (a registry per ADR-0019 §1). */
export type ElmClassRegistry = Readonly<Record<string, ZodType>>;

export interface ElmProfileSource {
  /** Logical profile id (edc/loq/ams/pid) — used for the SHACL walk + the source binding. */
  readonly profile: string;
  /** spec/version used in keys, e.g. elm / 3.3. */
  readonly spec: string;
  readonly version: string;
  /** The profile's variant shape graphs (each contributes variant-tagged constraints). */
  readonly variants: readonly ShaclVariantInput[];
  /** ELM class → modelling Zod. Shared across profiles; classes absent here reconcile as gaps. */
  readonly registry: ElmClassRegistry;
}

export interface ElmBuildOptions {
  readonly now?: string;
}

const KEY_RE = /:def:([^/]+)(?:\/(.+))?$/;

/** Top-level property names a Zod object schema models (`[]` for non-object schemas). */
function zodProps(schema: ZodType): readonly string[] {
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  return shape ? Object.keys(shape) : [];
}

export function buildElmCoverageMap(source: ElmProfileSource, options: ElmBuildOptions = {}): CoverageMap {
  const ctx = { spec: source.spec, version: source.version };
  const walk = walkShacl(source.profile, source.variants, ctx);

  const zodByClass = new Map<string, ReadonlySet<string>>();
  for (const [cls, schema] of Object.entries(source.registry)) zodByClass.set(cls, new Set(zodProps(schema)));

  // The literal class → its property set (for the extensions residue).
  const literalByClass = new Map<string, Set<string>>();
  for (const item of walk.items) {
    const m = KEY_RE.exec(item.key);
    if (m === null) continue;
    const [, cls, prop] = m;
    if (cls === undefined) continue;
    if (!literalByClass.has(cls)) literalByClass.set(cls, new Set());
    if (prop !== undefined) literalByClass.get(cls)?.add(prop);
  }

  const items: CoverageItem[] = walk.items
    .map((item): CoverageItem => {
      const m = KEY_RE.exec(item.key);
      const cls = m?.[1];
      const prop = m?.[2];
      const modelled =
        cls === undefined
          ? "no"
          : prop === undefined
            ? zodByClass.has(cls)
              ? "yes"
              : "no"
            : (zodByClass.get(cls)?.has(prop) ?? false)
              ? "yes"
              : "no";
      return { ...item, modelled };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const keyOf = (cls: string, prop: string): string => `${ctx.spec}:${ctx.version}:def:${cls}/${prop}`;

  // Silent gaps: literal *properties* with no Zod counterpart.
  const silentGaps = items
    .filter((i) => i.kind === "property" && i.modelled === "no")
    .map((i) => i.key)
    .sort();

  // Extensions: Zod props with no literal counterpart — only within a class the profile models
  // (so unrelated registry classes don't surface as extensions in every profile's map).
  const extensions: string[] = [];
  for (const [cls, literalProps] of literalByClass) {
    const zp = zodByClass.get(cls);
    if (zp === undefined) continue;
    for (const p of zp) if (!literalProps.has(p)) extensions.push(keyOf(cls, p));
  }
  extensions.sort();

  const residues: ReconciliationResidues = { silentGaps, extensions, normalisations: [] };

  const normativeStatements: NormativeStatement[] = items
    .filter(
      (i): i is CoverageItem & { description: string } => i.normative === true && typeof i.description === "string",
    )
    .map(
      (i): NormativeStatement => ({
        item: i.key,
        level: (/\b(MUST NOT|SHALL NOT)\b/.test(i.description) ? "MUST NOT" : "MUST") as NormativeLevel,
        statement: i.description,
        cited: false,
      }),
    )
    .sort((a, b) => a.item.localeCompare(b.item));

  const sources: SourceArtifact[] = source.variants
    .map(
      (v): SourceArtifact => ({
        binding: `${source.profile}:${v.variant}`,
        language: "shacl",
        id: walk.sourceId,
        sha256: createHash("sha256").update(readFileSync(v.path)).digest("hex"),
      }),
    )
    .sort((a, b) => a.binding.localeCompare(b.binding));

  const rollup: CoverageRollup = {
    items: items.length,
    modelledYes: items.filter((i) => i.modelled === "yes").length,
    modelledPartial: items.filter((i) => i.modelled === "partial").length,
    modelledNo: items.filter((i) => i.modelled === "no").length,
    normativeItems: items.filter((i) => i.normative === true).length,
    conformanceRequirements: 0,
    normativeStatements: normativeStatements.length,
    normativeStatementsCited: 0,
    normalisations: 0,
    valueSetMembers: 0,
    valueSetModelled: 0,
    valueSetGaps: 0,
  };

  return {
    meta: {
      spec: source.spec,
      version: source.version,
      generatedAt: options.now ?? new Date().toISOString().slice(0, 10),
      sources,
    },
    items,
    edges: [...walk.edges].sort((a, b) =>
      a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from),
    ),
    conformance: [],
    normativeStatements,
    residues,
    valueSets: [],
    rollup,
  };
}
