/**
 * L2 reconciliation (conform-ed ADR-0013) — joins the literal information-model
 * inventory against conform-ed's Zod model and computes the residues.
 *
 * The join is a **lockstep structural alignment**, not an independent expansion of
 * each side: starting from each shared document root, the literal and Zod trees are
 * walked *together*, matched by local property name, resolving `$ref` usage edges
 * on both sides as we descend. This is agnostic to conform-ed's deliberate renaming
 * of `$defs` (Q6) and to whether Zod inlines or `$ref`s its model, because only
 * *property names* are compared and refs are resolved on the fly. Alignment is
 * memoised on `(literalNode, zodNode)` pairs, so shared/recursive structures
 * terminate without the path-cross-product explosion a naive expansion produces.
 */

import type { SpecRefOverride, StructuralAlias } from "./source";
import type { CoverageItem, ModelledStatus, ReconciliationResidues, SpecRefNormalisation, UsageEdge } from "./types";

interface Inventory {
  readonly items: readonly CoverageItem[];
  readonly edges: readonly UsageEdge[];
}

interface SideIndex {
  /** parent item key -> its structural child item keys. */
  readonly childrenByParent: ReadonlyMap<string, readonly string[]>;
  /** item key -> the definition keys it references via `$ref`. */
  readonly refsByFrom: ReadonlyMap<string, readonly string[]>;
}

function lastSegment(key: string): string {
  const slash = key.lastIndexOf("/");
  return slash === -1 ? key : key.slice(slash + 1);
}

function indexSide(inv: Inventory): SideIndex {
  const childrenByParent = new Map<string, string[]>();
  for (const item of inv.items) {
    const slash = item.key.lastIndexOf("/");
    if (slash === -1) continue;
    const parent = item.key.slice(0, slash);
    const bucket = childrenByParent.get(parent);
    if (bucket === undefined) childrenByParent.set(parent, [item.key]);
    else bucket.push(item.key);
  }
  const refsByFrom = new Map<string, string[]>();
  for (const edge of inv.edges) {
    const bucket = refsByFrom.get(edge.from);
    if (bucket === undefined) refsByFrom.set(edge.from, [edge.to]);
    else bucket.push(edge.to);
  }
  return { childrenByParent, refsByFrom };
}

/**
 * The effective object shape of a node: local property name -> child item key.
 * `$ref`s are resolved **transitively** (cycle-guarded), accumulating the direct
 * structural children of every node reachable by following ref edges — so a pure
 * indirection definition (e.g. `ProfileRef` = `oneOf[string, $ref Profile]`)
 * resolves through to the property-bearing definition it ultimately points at.
 * Descent *into* those children is the alignment recursion's job, not this one's.
 */
function shapeOf(side: SideIndex, nodeKey: string, normalize: (name: string) => string): ReadonlyMap<string, string> {
  const shape = new Map<string, string>();
  const add = (childKey: string): void => {
    const segment = lastSegment(childKey);
    // `[]` is a structural array marker, never a property name — never normalise it.
    const name = segment === "[]" ? segment : normalize(segment);
    if (!shape.has(name)) shape.set(name, childKey);
  };
  const seen = new Set<string>();
  const stack: string[] = [nodeKey];
  while (stack.length > 0) {
    const key = stack.pop();
    if (key === undefined || seen.has(key)) continue;
    seen.add(key);
    for (const child of side.childrenByParent.get(key) ?? []) add(child);
    for (const ref of side.refsByFrom.get(key) ?? []) stack.push(ref);
  }
  return shape;
}

/** The raw residue lists before documented `specRef` renames are absorbed. */
export interface RawResidues {
  readonly silentGaps: readonly string[];
  readonly extensions: readonly string[];
}

export interface ReconcileResult {
  /** Item key -> L2 verdict, for every literal item reached by the alignment. */
  readonly modelled: ReadonlyMap<string, ModelledStatus>;
  readonly residues: RawResidues;
}

export function reconcile(
  literal: Inventory,
  zod: Inventory,
  documentRootKeys: readonly string[],
  normalize: (name: string) => string = (name) => name,
  aliases: readonly StructuralAlias[] = [],
  literalWrappers: readonly string[] = [],
): ReconcileResult {
  const lit = indexSide(literal);
  const zd = indexSide(zod);

  // Per literal item: in how many aligned contexts was it present in the Zod model?
  const tally = new Map<string, { matched: number; total: number }>();
  const bump = (key: string, matched: boolean): void => {
    const rec = tally.get(key) ?? { matched: 0, total: 0 };
    rec.total += 1;
    if (matched) rec.matched += 1;
    tally.set(key, rec);
  };

  const zodSeen = new Set<string>(); // Zod property keys encountered during alignment
  const zodMatched = new Set<string>(); // ...of those, the ones matched to a literal name
  const visited = new Set<string>();

  // Arrays are transparent containers for coverage: the element's *properties* are
  // the spec items, not the `[]` wrapper. One side may wrap a value in an array
  // (`type: [...]`, `credential: anyOf[array, ...]`) where the other refs it
  // directly, so unwrap any pure-array layer on each side before matching names.
  const litWrappers = new Set(literalWrappers.map(normalize));
  const noWrappers: ReadonlySet<string> = new Set();
  const unwrapArray = (side: SideIndex, key: string, wrappers: ReadonlySet<string>): string => {
    let cur = key;
    for (let i = 0; i < 8; i += 1) {
      const shape = shapeOf(side, cur, normalize);
      let elem = shape.size === 1 ? shape.get("[]") : undefined;
      if (elem === undefined && shape.size === 1 && wrappers.size > 0) {
        // A transparent literal wrapper element conform-ed elides (e.g. the cmi5
        // <objectives><objective>… repetition): descend through it like an array layer.
        const only = [...shape][0];
        if (only !== undefined && wrappers.has(only[0])) elem = only[1];
      }
      if (elem === undefined) break;
      cur = elem;
    }
    return cur;
  };

  // Structural aliases (ADR-0017), pre-normalised to the join's name form. Each bridges a Zod
  // property to differently-named literal element(s) where conform-ed normalised the shape, and
  // descends — so their subtrees reconcile as if the names had matched.
  const aliasMap = aliases.map((alias) => ({
    zodProperty: normalize(alias.zodProperty),
    literalElements: alias.literalElements.map((element) => normalize(element)),
  }));

  const align = (litKeyRaw: string, zodKeyRaw: string): void => {
    const litKey = unwrapArray(lit, litKeyRaw, litWrappers);
    const zodKey = unwrapArray(zd, zodKeyRaw, noWrappers);
    const pairId = `${litKey} ${zodKey}`;
    if (visited.has(pairId)) return;
    visited.add(pairId);

    const litShape = shapeOf(lit, litKey, normalize);
    const zodShape = shapeOf(zd, zodKey, normalize);

    // Resolve structural aliases first, consuming the names they bridge so the name-based loops
    // below do not then mis-score them as a gap (the literal element) or extension (the Zod prop).
    const consumedLit = new Set<string>();
    const consumedZod = new Set<string>();
    for (const alias of aliasMap) {
      const zodChild = zodShape.get(alias.zodProperty);
      if (zodChild === undefined) continue;
      let matchedAny = false;
      for (const litName of alias.literalElements) {
        const litChild = litShape.get(litName);
        if (litChild === undefined) continue;
        matchedAny = true;
        consumedLit.add(litName);
        bump(litChild, true);
        align(litChild, zodChild);
      }
      if (matchedAny) {
        consumedZod.add(alias.zodProperty);
        zodSeen.add(zodChild);
        zodMatched.add(zodChild);
      }
    }

    for (const [name, litChild] of litShape) {
      if (consumedLit.has(name)) continue;
      const zodChild = zodShape.get(name);
      bump(litChild, zodChild !== undefined);
      if (zodChild !== undefined) align(litChild, zodChild);
    }
    for (const [name, zodChild] of zodShape) {
      if (consumedZod.has(name)) continue;
      zodSeen.add(zodChild);
      if (litShape.has(name)) zodMatched.add(zodChild);
    }
  };

  for (const docKey of documentRootKeys) align(docKey, docKey);

  const modelled = new Map<string, ModelledStatus>();
  for (const [key, { matched, total }] of tally) {
    modelled.set(key, matched === 0 ? "no" : matched === total ? "yes" : "partial");
  }

  // Silent gaps: literal items the Zod model never represents in any aligned context.
  const silentGaps = [...modelled.entries()]
    .filter(([, status]) => status === "no")
    .map(([key]) => key)
    .sort();
  // Extensions: Zod properties that never matched a literal property name.
  const extensions = [...zodSeen].filter((key) => !zodMatched.has(key)).sort();

  return { modelled, residues: { silentGaps, extensions } };
}

/**
 * Absorb documented XSD→Zod renames out of the raw residues (conform-ed ADR-0013).
 *
 * The structural join in {@link reconcile} matches purely by property name, so a literal
 * construct conform-ed models under a different name — or a construct the XSD leaves
 * *unnamed* that conform-ed names (`xs:any` → `extensions`, simpleContent text → `value`,
 * `xml:base` ⇄ `xmlBase`) — surfaces as false signal in `silentGaps` / `extensions`. Each
 * {@link SpecRefOverride} declares one such rename by the residue key's **final path
 * segment**; this pass moves the matched keys into `residues.normalisations`, and (for a
 * rename of a *named* literal construct) flips the paired literal gap's verdict to `yes`.
 * Returns a fresh modelled map and the full {@link ReconciliationResidues}. Determinism:
 * absorbed key lists are sorted; overrides that match nothing are dropped (so a stale
 * override is visible as a missing entry, caught by the per-map sync test).
 */
export function applySpecRefOverrides(
  overrides: readonly SpecRefOverride[],
  modelled: ReadonlyMap<string, ModelledStatus>,
  residues: RawResidues,
): { readonly modelled: ReadonlyMap<string, ModelledStatus>; readonly residues: ReconciliationResidues } {
  const finalModelled = new Map(modelled);
  let silentGaps = [...residues.silentGaps];
  let extensions = [...residues.extensions];
  const normalisations: SpecRefNormalisation[] = [];

  for (const override of overrides) {
    const modelledSegments = new Set(
      [override.modelledSegment, ...(override.modelledSegments ?? [])].filter((s): s is string => s !== undefined),
    );
    const literalSegments = new Set(
      [override.literalSegment, ...(override.literalSegments ?? [])].filter((s): s is string => s !== undefined),
    );
    const modelledKeys = extensions.filter((k) => modelledSegments.has(lastSegment(k)));
    const literalKeys = literalSegments.size === 0 ? [] : silentGaps.filter((k) => literalSegments.has(lastSegment(k)));
    if (modelledKeys.length === 0 && literalKeys.length === 0) continue;

    const absorbedExt = new Set(modelledKeys);
    const absorbedGap = new Set(literalKeys);
    extensions = extensions.filter((k) => !absorbedExt.has(k));
    silentGaps = silentGaps.filter((k) => !absorbedGap.has(k));
    for (const key of literalKeys) finalModelled.set(key, "yes");
    normalisations.push({
      note: override.note,
      modelledKeys: [...modelledKeys].sort(),
      literalKeys: [...literalKeys].sort(),
    });
  }

  return { modelled: finalModelled, residues: { silentGaps, extensions, normalisations } };
}

/** Apply L2 verdicts onto the inventory, returning new items (immutably). */
export function applyModelled(
  items: readonly CoverageItem[],
  modelled: ReadonlyMap<string, ModelledStatus>,
): readonly CoverageItem[] {
  return items.map((item) => {
    const verdict = modelled.get(item.key);
    return verdict === undefined ? item : { ...item, modelled: verdict };
  });
}
