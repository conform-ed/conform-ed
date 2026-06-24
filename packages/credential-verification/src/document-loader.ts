// JSON-LD document loaders for canonicalization. The default `staticDocumentLoader` serves
// only the vendored, well-known contexts and refuses anything else — a verifier must not
// dereference arbitrary remote `@context` IRIs. A host that needs to add trusted contexts
// (e.g. an institution's own) supplies them via `createStaticDocumentLoader(extra)` or wraps
// its own DocumentLoader.

import type { JsonLd, RemoteDocument } from "jsonld/jsonld-spec";

import { BUNDLED_CONTEXTS } from "./contexts";
import type { DocumentLoader, LoadedDocument } from "./resolvers";

/**
 * Build a document loader backed by the bundled contexts plus any caller-supplied extras.
 * Loading an unknown IRI throws — the canonicalization fails closed rather than reaching out
 * to the network.
 */
export function createStaticDocumentLoader(extraContexts?: ReadonlyMap<string, unknown>): DocumentLoader {
  return {
    async load(url: string): Promise<LoadedDocument> {
      const document = extraContexts?.get(url) ?? BUNDLED_CONTEXTS.get(url);
      if (document === undefined) {
        throw new Error(`Refusing to load non-vendored JSON-LD context '${url}' (no network dereferencing).`);
      }
      return { documentUrl: url, document };
    },
  };
}

/** The default loader: vendored VC 2.0 / OB 3.0 / CLR 2.0 contexts only. */
export const staticDocumentLoader: DocumentLoader = createStaticDocumentLoader();

/** Adapt our `DocumentLoader` to the loader shape `jsonld.canonize` expects (a RemoteDocument). */
export function toJsonLdDocumentLoader(loader: DocumentLoader): (url: string) => Promise<RemoteDocument> {
  return async (url: string) => {
    const loaded = await loader.load(url);
    return { documentUrl: loaded.documentUrl, document: loaded.document as JsonLd };
  };
}
