// Vendored JSON-LD `@context` documents. Data Integrity canonicalization must expand the
// credential against the exact contexts it references; a verifier MUST NOT fetch them over
// the network at verify time (that is a remote-context injection surface and a liveness
// dependency). So the well-known VC 2.0 / OB 3.0 / CLR 2.0 contexts are vendored and served
// from memory. See vendor/contexts/PROVENANCE.md for source URLs + retrieval.

import clrV2Context from "../vendor/contexts/clr-v2p0.context.json" with { type: "json" };
import obV3Context from "../vendor/contexts/open-badges-v3p0.context.json" with { type: "json" };
import vcV2Context from "../vendor/contexts/vc-data-model-v2.context.json" with { type: "json" };

/** Canonical context URL → vendored document. Keyed by the IRI credentials reference. */
export const BUNDLED_CONTEXTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ["https://www.w3.org/ns/credentials/v2", vcV2Context],
  ["https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json", obV3Context],
  ["https://purl.imsglobal.org/spec/clr/v2p0/context.json", clrV2Context],
]);
