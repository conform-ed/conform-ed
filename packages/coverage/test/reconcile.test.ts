import { describe, expect, test } from "bun:test";

import { reconcile } from "../src/reconcile";
import type { CoverageItem, ModelledStatus, UsageEdge } from "../src/types";

// A miniature spec exercising a reference-or-inline duality (Caliper's, ADR-0018) in isolation:
//
//   doc:d  has two association slots — refE and refF.
//   E      is a rich entity (id/type/body) modelled fully at its own document root doc:E, AND
//          reached BY REFERENCE from doc:d/refE (the Zod side there carries only id/type).
//   F      is a rich entity (id/type/foo) reached ONLY by reference from doc:d/refF — it has no
//          document root of its own, so `foo` is never modelled inline anywhere.
//
// The literal side always expands the full entity (via the ref edge); only the Zod side is thin in
// a by-reference context. The def keys differ per side (the Zod model namespaces its defs), exactly
// as the real generator renders them — the join matches purely by property name.
const literalItems: readonly CoverageItem[] = [
  { key: "s:1:doc:d", kind: "document", path: "" },
  { key: "s:1:doc:d/refE", kind: "property", path: "refE" },
  { key: "s:1:doc:d/refF", kind: "property", path: "refF" },
  { key: "s:1:doc:E", kind: "document", path: "" },
  { key: "s:1:def:E", kind: "definition", path: "" },
  { key: "s:1:def:E/id", kind: "property", path: "id" },
  { key: "s:1:def:E/type", kind: "property", path: "type" },
  { key: "s:1:def:E/body", kind: "property", path: "body" },
  { key: "s:1:def:F", kind: "definition", path: "" },
  { key: "s:1:def:F/id", kind: "property", path: "id" },
  { key: "s:1:def:F/type", kind: "property", path: "type" },
  { key: "s:1:def:F/foo", kind: "property", path: "foo" },
];
const literalEdges: readonly UsageEdge[] = [
  { from: "s:1:doc:d/refE", to: "s:1:def:E" },
  { from: "s:1:doc:d/refF", to: "s:1:def:F" },
  { from: "s:1:doc:E", to: "s:1:def:E" },
];

const zodItems: readonly CoverageItem[] = [
  { key: "s:1:doc:d", kind: "document", path: "" },
  { key: "s:1:doc:d/refE", kind: "property", path: "refE" },
  { key: "s:1:doc:d/refF", kind: "property", path: "refF" },
  { key: "s:1:doc:E", kind: "document", path: "" },
  // The thin by-reference def both slots resolve to: identity properties only.
  { key: "s:1:def:Z.ref", kind: "definition", path: "" },
  { key: "s:1:def:Z.ref/id", kind: "property", path: "id" },
  { key: "s:1:def:Z.ref/type", kind: "property", path: "type" },
  // The full inline model of E, reached at its own document root.
  { key: "s:1:def:Z.E", kind: "definition", path: "" },
  { key: "s:1:def:Z.E/id", kind: "property", path: "id" },
  { key: "s:1:def:Z.E/type", kind: "property", path: "type" },
  { key: "s:1:def:Z.E/body", kind: "property", path: "body" },
];
const zodEdges: readonly UsageEdge[] = [
  { from: "s:1:doc:d/refE", to: "s:1:def:Z.ref" },
  { from: "s:1:doc:d/refF", to: "s:1:def:Z.ref" },
  { from: "s:1:doc:E", to: "s:1:def:Z.E" },
];

const roots = ["s:1:doc:d", "s:1:doc:E"];
const run = (referenceIdentityProps?: readonly string[]): ReadonlyMap<string, ModelledStatus> =>
  reconcile(
    { items: literalItems, edges: literalEdges },
    { items: zodItems, edges: zodEdges },
    roots,
    undefined,
    undefined,
    undefined,
    referenceIdentityProps,
  ).modelled;

describe("reconcile — reference/inline duality (referenceIdentityProps)", () => {
  test("disabled (default): a by-reference deep field reads `partial`, an only-referenced field `no`", () => {
    const m = run();
    // E.body matched at doc:E (inline) but missed at doc:d/refE (the thin reference) → partial.
    expect(m.get("s:1:def:E/body")).toBe("partial");
    // F.foo missed at its sole context (doc:d/refF, a reference) and never modelled inline → no.
    expect(m.get("s:1:def:F/foo")).toBe("no");
    expect(m.get("s:1:def:E/id")).toBe("yes");
  });

  test("enabled: the reference context becomes N/A, so the inline-proven field reads `yes`", () => {
    const m = run(["id", "type"]);
    // The miss at doc:d/refE is now N/A; E.body is still proven `yes` at its document root.
    expect(m.get("s:1:def:E/body")).toBe("yes");
    expect(m.get("s:1:def:E/id")).toBe("yes");
  });

  test("enabled: a field reached ONLY by reference is restored to a genuine gap, never erased", () => {
    const m = run(["id", "type"]);
    // F has no inline document root, so F.foo is N/A in every context — the safeguard keeps it `no`
    // rather than letting it vanish from the map (which would hide a real silent gap).
    expect(m.get("s:1:def:F/foo")).toBe("no");
    expect(m.get("s:1:def:F/id")).toBe("yes");
  });
});
