// ELM v3.3 SHACL shapes, vendored and exposed so a downstream consumer (e.g. a wallet/verifier)
// can call `verifyEdc` / `validateAgainstProfile` WITHOUT vendoring the shapes itself — the engine
// stays vendor-free (the caller supplies shapes), and this module is the batteries-included default
// for the canonical EU profiles. Shapes are read lazily + memoized from the package's `vendor/` dir
// (local files, no network), so importing the package for OB/CLR verification never reads them.
// See vendor/elm/shapes/PROVENANCE.md.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve relative to this module so it works from both `src/` (the `development` export
// condition) and the built `dist/` — `vendor/` ships at the package root in both layouts.
const shapesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../vendor/elm/shapes");
const cache = new Map<string, string>();

function read(name: string): string {
  let ttl = cache.get(name);
  if (ttl === undefined) {
    ttl = readFileSync(resolve(shapesDir, `${name}.ttl`), "utf8");
    cache.set(name, ttl);
  }
  return ttl;
}

/**
 * The EDC verification shape graph: `edc-generic-full` plus its `owl:imports` base
 * `edc-generic-no-cv` — i.e. the full closure. `validateAgainstProfile` strips `owl:imports`, so the
 * caller must supply the closure; pass this to `verifyEdc({ shapes })`.
 */
export function edcGenericFullShapes(): readonly string[] {
  return [read("edc-generic-full"), read("edc-generic-no-cv")];
}

/** The LOQ plain-dataset shape graph (validate-only). */
export function loqShapes(): readonly string[] {
  return [read("loq-constraints")];
}

/** The AMS plain-dataset shape graph (validate-only). */
export function amsShapes(): readonly string[] {
  return [read("ams-constraints")];
}

/** The PID plain-dataset shape graph (validate-only). */
export function pidShapes(): readonly string[] {
  return [read("pid-constraints")];
}

export type ElmPlainProfile = "loq" | "ams" | "pid";

/** The shape graph for a plain (unsealed) ELM profile — LOQ / AMS / PID. */
export function elmPlainProfileShapes(profile: ElmPlainProfile): readonly string[] {
  if (profile === "loq") return loqShapes();
  if (profile === "ams") return amsShapes();
  return pidShapes();
}
