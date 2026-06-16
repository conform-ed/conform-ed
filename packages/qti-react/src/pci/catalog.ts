/**
 * A hash-pinned PCI module catalog: a *policy wrapper* over the registry's existing
 * `paths` + `fetchText` seam (it adds no loader). It turns "deliver whatever the
 * content's `module_resolution` points at" — content-author / arbitrary-internet
 * JavaScript evaluated in a learner's browser, which ADR-0006/0007 refused as a
 * default — into an explicit, verifiable publishing decision:
 *
 * - **Allowlist (default-deny).** Only module ids the catalog vetted resolve, and only
 *   to their vetted URLs. The registry asking for any other URL is refused loudly
 *   (ADR-0003), never blind-eval'd.
 * - **Integrity.** Fetched source is checked against a pinned `sha256` *before* it is
 *   handed to the registry to `evaluate`. A swapped/tampered module fails closed.
 *
 * Inject the result into `createPciModuleRegistry({ paths: catalog.paths, fetchText:
 * catalog.fetchText })`; the registry and `mountPci` are otherwise unchanged. Trust
 * becomes a publishing decision (ADR-0006) instead of "whatever the content points at".
 */

export interface PciCatalogEntry {
  /** The vetted URL this module id resolves to (and the sole allowlist member for it). */
  readonly url: string;
  /**
   * The pinned `sha256` of the module source: either a bare hex digest or an SRI
   * `sha256-<base64>` string. Normalized to lowercase hex before comparison, so an
   * emergent asset row's server-authoritative `sha256` is a catalog entry verbatim
   * (ADR-0012 — one hash, computed once at finalize).
   */
  readonly integrity: string;
}

export interface PciCatalogOptions {
  /** module id → vetted entry. The set of entry URLs *is* the fetch allowlist. */
  readonly entries: Readonly<Record<string, PciCatalogEntry>>;
  /**
   * Byte fetcher for vetted URLs; defaults to global `fetch` → `arrayBuffer`. The
   * consumer injects its own (e.g. emergent's signed-URL fetch). Only ever called for
   * an allowlisted URL — the allowlist check runs first.
   */
  readonly fetchBytes?: (url: string) => Promise<Uint8Array>;
}

export interface PciCatalog {
  /** module id → vetted URL, for `createPciModuleRegistry({ paths })`. */
  readonly paths: Readonly<Record<string, string>>;
  /**
   * The allowlist- and integrity-enforcing source fetcher for
   * `createPciModuleRegistry({ fetchText })`. Rejects any URL not in the catalog and
   * any source whose `sha256` does not match the pinned integrity.
   */
  readonly fetchText: (url: string) => Promise<string>;
  /**
   * Whether a content-declared module id is a vetted, deliverable catalog entry — the
   * deliverability predicate a consumer's ingest gate consults (ADR-0012: flip a PCI
   * item from quarantined to deliverable exactly when its module resolves here).
   */
  readonly has: (moduleId: string) => boolean;
}

const textDecoder = new TextDecoder();

function toHex(bytes: Uint8Array): string {
  let hex = "";

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return hex;
}

/** Normalize a pinned integrity (`sha256-<base64>` SRI form or bare hex) to lowercase hex. */
function normalizeIntegrity(integrity: string): string {
  const trimmed = integrity.trim();
  const sri = /^sha256-(.+)$/iu.exec(trimmed);

  if (sri) {
    const base64 = sri[1]!;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return toHex(bytes);
  }

  return trimmed.toLowerCase();
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);

  return toHex(new Uint8Array(digest));
}

function defaultFetchBytes(url: string): Promise<Uint8Array> {
  return fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  });
}

export function createPciCatalog(options: PciCatalogOptions): PciCatalog {
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const paths: Record<string, string> = {};
  // Keyed by the exact URL the registry will request (it asks for `entry.url` verbatim;
  // see the registry's `toUrl`, which leaves complete URLs untouched).
  const byUrl = new Map<string, PciCatalogEntry>();

  for (const [id, entry] of Object.entries(options.entries)) {
    paths[id] = entry.url;
    byUrl.set(entry.url, entry);
  }

  return {
    paths,
    has: (moduleId) => Object.hasOwn(options.entries, moduleId),
    async fetchText(url) {
      const entry = byUrl.get(url);

      // Default-deny: the registry asked for a URL no catalog entry vetted.
      if (!entry) {
        throw new Error(`PCI module source "${url}" is not in the hash-pinned catalog (refused).`);
      }

      const bytes = await fetchBytes(url);
      const actual = await sha256Hex(bytes);
      const expected = normalizeIntegrity(entry.integrity);

      if (actual !== expected) {
        throw new Error(
          `PCI module source "${url}" failed its integrity check (expected sha256 ${expected}, got ${actual}).`,
        );
      }

      return textDecoder.decode(bytes);
    },
  };
}
