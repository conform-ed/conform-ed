import { describe, expect, test } from "bun:test";

import { applySpecRefOverrides } from "../src/reconcile";
import type { SpecRefOverride } from "../src/source";
import type { ModelledStatus } from "../src/types";

// Synthetic raw reconciliation output exercising the two override shapes:
//  - a *named* rename (xml:base → xmlBase) with a literal `/base` gap and a Zod `/xmlBase`
//    extension, which must pair (gap flipped to modelled, extension absorbed);
//  - *unnamed*-construct renames (xs:any → extensions, simpleContent → value) with only a
//    Zod-side extension and no literal side.
const modelled: ReadonlyMap<string, ModelledStatus> = new Map([
  ["s:1:def:T/base", "no"],
  ["s:1:def:T/title", "yes"],
  ["s:1:def:T/realGap", "no"],
]);
const residues = {
  silentGaps: ["s:1:def:T/base", "s:1:def:T/realGap"],
  extensions: ["s:1:doc:d/xmlBase", "s:1:doc:d/extensions", "s:1:def:T/value", "s:1:doc:d/genuineExtension"],
};

const XS_ANY: SpecRefOverride = { note: "xs:any → extensions", modelledSegment: "extensions" };
const SIMPLE: SpecRefOverride = { note: "simpleContent → value", modelledSegment: "value" };
const XML_BASE: SpecRefOverride = { note: "xml:base → xmlBase", modelledSegment: "xmlBase", literalSegment: "base" };

describe("applySpecRefOverrides — documented-rename absorption", () => {
  test("a named rename pairs a literal gap with its Zod extension and flips the gap to modelled", () => {
    const out = applySpecRefOverrides([XML_BASE], modelled, residues);
    expect(out.modelled.get("s:1:def:T/base")).toBe("yes");
    expect(out.residues.silentGaps).not.toContain("s:1:def:T/base");
    expect(out.residues.extensions).not.toContain("s:1:doc:d/xmlBase");
    const norm = out.residues.normalisations.find((n) => n.note === "xml:base → xmlBase");
    expect(norm?.literalKeys).toEqual(["s:1:def:T/base"]);
    expect(norm?.modelledKeys).toEqual(["s:1:doc:d/xmlBase"]);
  });

  test("an unnamed-construct rename absorbs only the Zod extension, with no literal side", () => {
    const out = applySpecRefOverrides([XS_ANY, SIMPLE], modelled, residues);
    expect(out.residues.extensions).not.toContain("s:1:doc:d/extensions");
    expect(out.residues.extensions).not.toContain("s:1:def:T/value");
    // unrelated extension + literal gaps untouched.
    expect(out.residues.extensions).toContain("s:1:doc:d/genuineExtension");
    expect(out.residues.silentGaps).toContain("s:1:def:T/realGap");
    expect(out.modelled.get("s:1:def:T/realGap")).toBe("no");
    for (const n of out.residues.normalisations) expect(n.literalKeys).toEqual([]);
  });

  test("matching is by final path segment only and leaves genuine signal in place", () => {
    const out = applySpecRefOverrides([XS_ANY, SIMPLE, XML_BASE], modelled, residues);
    expect(out.residues.silentGaps).toEqual(["s:1:def:T/realGap"]);
    expect(out.residues.extensions).toEqual(["s:1:doc:d/genuineExtension"]);
    expect(out.residues.normalisations).toHaveLength(3);
  });

  test("an override that matches nothing is dropped (no empty normalisation entry)", () => {
    const stale: SpecRefOverride = { note: "stale", modelledSegment: "neverMatches" };
    const out = applySpecRefOverrides([stale], modelled, residues);
    expect(out.residues.normalisations).toHaveLength(0);
    expect(out.residues.extensions).toEqual(residues.extensions); // unchanged
  });

  test("no overrides is a faithful pass-through with an empty normalisations list", () => {
    const out = applySpecRefOverrides([], modelled, residues);
    expect(out.residues.normalisations).toEqual([]);
    expect(out.residues.silentGaps).toEqual(residues.silentGaps);
    expect(out.residues.extensions).toEqual(residues.extensions);
  });

  test("does not mutate its inputs", () => {
    const gaps = [...residues.silentGaps];
    const exts = [...residues.extensions];
    applySpecRefOverrides([XS_ANY, XML_BASE], modelled, residues);
    expect(residues.silentGaps).toEqual(gaps);
    expect(residues.extensions).toEqual(exts);
    expect(modelled.get("s:1:def:T/base")).toBe("no");
  });
});
