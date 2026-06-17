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

import type { CoverageItem, ModelledStatus, ReconciliationResidues, UsageEdge } from "./types";

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
function shapeOf(side: SideIndex, nodeKey: string): ReadonlyMap<string, string> {
  const shape = new Map<string, string>();
  const add = (childKey: string): void => {
    const name = lastSegment(childKey);
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

export interface ReconcileResult {
  /** Item key -> L2 verdict, for every literal item reached by the alignment. */
  readonly modelled: ReadonlyMap<string, ModelledStatus>;
  readonly residues: ReconciliationResidues;
}

export function reconcile(literal: Inventory, zod: Inventory, documentRootKeys: readonly string[]): ReconcileResult {
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
  const unwrapArray = (side: SideIndex, key: string): string => {
    let cur = key;
    for (let i = 0; i < 8; i += 1) {
      const shape = shapeOf(side, cur);
      const elem = shape.size === 1 ? shape.get("[]") : undefined;
      if (elem === undefined) break;
      cur = elem;
    }
    return cur;
  };

  const align = (litKeyRaw: string, zodKeyRaw: string): void => {
    const litKey = unwrapArray(lit, litKeyRaw);
    const zodKey = unwrapArray(zd, zodKeyRaw);
    const pairId = `${litKey} ${zodKey}`;
    if (visited.has(pairId)) return;
    visited.add(pairId);

    const litShape = shapeOf(lit, litKey);
    const zodShape = shapeOf(zd, zodKey);

    for (const [name, litChild] of litShape) {
      const zodChild = zodShape.get(name);
      bump(litChild, zodChild !== undefined);
      if (zodChild !== undefined) align(litChild, zodChild);
    }
    for (const [name, zodChild] of zodShape) {
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
