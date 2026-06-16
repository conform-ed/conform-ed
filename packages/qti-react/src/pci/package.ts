/**
 * Package module loading for PCI (ADR-0012, BACKLOG #4): turn a self-contained QTI/CC
 * package's PCI modules into a hash-pinned catalog so they deliver without a separate
 * catalog entry. It reuses `createPciCatalog` — a package simply *becomes* a set of
 * integrity-pinned entries whose bytes the package supplies:
 *
 * 1. Parse the package's `module_resolution.js` (the RequireJS-style `paths` map) as
 *    **data, never executed** — executing it would reintroduce exactly the
 *    content-JS-eval risk the catalog exists to remove.
 * 2. For each package-local module path, read its bytes from the (already-unzipped)
 *    package file map, compute its `sha256`, and register a catalog entry. Module paths
 *    that point at an absolute URL (a CDN: `https://…`) are **not** package-local and
 *    are skipped — a package can host a *widget*, never grant blanket internet trust;
 *    those stay default-denied unless a separate vetted catalog lists them.
 *
 * The caller unzips the package (e.g. with `fflate`, as qti-xml's package validator
 * does) and hands the file map in; keeping this module zip-free leaves it dependency-
 * light and trivially testable against an exploded package directory.
 */

import { createPciCatalog, type PciCatalog } from "./catalog";

/** Normalize a package href to the forward-slash, no-leading-"./" form the file map uses. */
function normalizePackagePath(href: string): string {
  return href.replace(/\\/gu, "/").replace(/^\.\//u, "");
}

function isAbsoluteUrl(path: string): boolean {
  return /^[a-z][a-z\d+.-]*:\/\//iu.test(path);
}

function tryJson(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);

    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The first brace-balanced object literal at or after `from`, ignoring braces in strings. */
function extractBalancedObject(source: string, from: number): string | null {
  const start = source.indexOf("{", from);

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString: '"' | "'" | null = null;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (char === "\\") {
        index += 1; // skip the escaped character
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

/**
 * Parse a PCI `module_resolution.js` into its `{ moduleId → path }` map. Handles the
 * 1EdTech examples' pure-JSON form and the RequireJS wrappers (`var require = {…}`,
 * `require.config({…})`) by extracting the config object and JSON-parsing it — so it
 * reads the file as data without executing it. Object literals with unquoted keys
 * (non-JSON) are not parsed; their modules simply do not resolve (and fail loudly at
 * mount) rather than being silently mis-read.
 */
export function parsePciModuleResolution(source: string): Record<string, string> {
  const trimmed = source.trim();
  const config =
    tryJson(trimmed) ??
    (() => {
      const objectText = extractBalancedObject(trimmed, 0);

      return objectText ? tryJson(objectText) : null;
    })();

  const paths = config?.["paths"];

  if (paths === null || typeof paths !== "object" || Array.isArray(paths)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [id, value] of Object.entries(paths as Record<string, unknown>)) {
    if (typeof value === "string") {
      result[id] = value;
    }
  }

  return result;
}

export interface PackagePciCatalogOptions {
  /**
   * The package-relative path of `module_resolution.js`. Defaults to auto-detection:
   * the file map entry whose path ends in `module_resolution.js` (the conventional
   * `modules/module_resolution.js`, or the package root).
   */
  readonly moduleResolutionPath?: string;
}

/**
 * Build a hash-pinned `PciCatalog` from an (already-unzipped) QTI/CC package file map —
 * `packageRelativePath → bytes`. The catalog resolves the package's PCI module ids to
 * their in-package bytes, integrity-pinned to the `sha256` computed here; its
 * `fetchBytes` serves those bytes from memory (no network). Inject it into
 * `createPciModuleRegistry({ paths, fetchText })` with **no `baseUrl`** — the package
 * paths are already fully resolved.
 *
 * Module paths are resolved relative to the package root (where `module_resolution.js`
 * declares them). A declared module whose bytes are absent from the map, or that points
 * at an absolute URL, is omitted — the package vouches only for the bytes it ships.
 */
export async function createPackagePciCatalog(
  files: Readonly<Record<string, Uint8Array>>,
  options: PackagePciCatalogOptions = {},
): Promise<PciCatalog> {
  const normalized = new Map<string, Uint8Array>();

  for (const [path, bytes] of Object.entries(files)) {
    normalized.set(normalizePackagePath(path), bytes);
  }

  const resolutionPath =
    options.moduleResolutionPath !== undefined
      ? normalizePackagePath(options.moduleResolutionPath)
      : [...normalized.keys()].find(
          (path) => path === "module_resolution.js" || path.endsWith("/module_resolution.js"),
        );

  const resolutionBytes = resolutionPath !== undefined ? normalized.get(resolutionPath) : undefined;
  const pathMap = resolutionBytes ? parsePciModuleResolution(new TextDecoder().decode(resolutionBytes)) : {};

  const entries: Record<string, { url: string; integrity: string }> = {};

  for (const [id, declaredPath] of Object.entries(pathMap)) {
    // A package hosts widgets, not internet trust: absolute-URL modules are not
    // package-local and stay default-denied (ADR-0012).
    if (isAbsoluteUrl(declaredPath)) {
      continue;
    }

    // RequireJS paths are extension-less by convention; resolve against the package root.
    const candidate = normalizePackagePath(/\.[a-z\d]+$/iu.test(declaredPath) ? declaredPath : `${declaredPath}.js`);
    const bytes = normalized.get(candidate);

    if (!bytes) {
      continue; // a module the package declares but does not ship — nothing to pin
    }

    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
    const integrity = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");

    entries[id] = { url: candidate, integrity };
  }

  return createPciCatalog({
    entries,
    // Serve the package's own bytes; the catalog still verifies their pinned integrity
    // before the registry evaluates them.
    fetchBytes: async (url) => {
      const bytes = normalized.get(url);

      if (!bytes) {
        throw new Error(`PCI package module "${url}" is not present in the package file map.`);
      }

      return bytes;
    },
  });
}
