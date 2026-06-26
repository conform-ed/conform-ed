// Real SHACL validation over a credential's JSON-LD → RDF graph (conform-ed ADR-0019 §3).
// An EDC self-declares `ShaclValidator2017`, so structural conformance MUST be judged by the
// actual SHACL shapes, not a JSON Schema or our Zod. This is the **profile-agnostic** core:
// `validateAgainstProfile` takes any vendored shape graph (the EDC verify path is a thin
// orchestrator over it), which is why LOQ/AMS/PID validation is a free later addition.
//
// It stays offline-deterministic: @context resolution uses the host's bundled document loader
// (no network), and the shapes are supplied by the caller (the conform-ed vendored set).

import rdf from "@zazuko/env-node";
import jsonld from "jsonld";
import { Parser } from "n3";
import SHACLValidator from "rdf-validate-shacl";

import { staticDocumentLoader, toJsonLdDocumentLoader } from "./document-loader";
import type { DocumentLoader } from "./resolvers";

/** The EDC envelope references the VC 1.1 context + the EDC application-profile context. */
export const EDC_DEFAULT_CONTEXT: readonly string[] = [
  "https://www.w3.org/2018/credentials/v1",
  "http://data.europa.eu/snb/model/context/edc-ap",
];

export interface ShaclViolation {
  readonly focusNode?: string;
  readonly path?: string;
  readonly message: string;
  readonly severity?: string;
  readonly sourceConstraintComponent?: string;
}

export interface ShaclReport {
  readonly conforms: boolean;
  readonly violations: readonly ShaclViolation[];
}

export interface ProfileValidationOptions {
  /**
   * The profile's SHACL shape graph(s) as Turtle strings — the full `owl:imports` closure
   * (e.g. `edc-generic-full` + `edc-generic-no-cv`). The caller supplies the conform-ed
   * vendored set, keeping this engine free of any vendor-path dependency.
   */
  readonly shapes: readonly string[];
  /** Offline JSON-LD context loader; defaults to the engine's bundled (no-network) loader. */
  readonly documentLoader?: DocumentLoader;
  /**
   * Injected as `@context` when the credential omits it (the EDC pre-issuance delivery form);
   * defaults to {@link EDC_DEFAULT_CONTEXT}. Ignored when the credential already carries one.
   */
  readonly defaultContext?: unknown;
}

function hasContext(doc: unknown): boolean {
  return typeof doc === "object" && doc !== null && "@context" in doc;
}

interface ResultLike {
  readonly focusNode?: { readonly value: string };
  readonly path?: { readonly value: string };
  readonly severity?: { readonly value: string };
  readonly sourceConstraintComponent?: { readonly value: string };
  readonly message?: unknown;
}

/** SHACL result messages are RDF terms (often an array of language-tagged literals). */
function termValue(term: unknown): string {
  if (typeof term === "string") return term;
  if (typeof term === "object" && term !== null && "value" in term) {
    const v = (term as { value: unknown }).value;
    return typeof v === "string" ? v : "";
  }
  return "";
}

function messageOf(message: unknown): string {
  if (Array.isArray(message)) return message.map(termValue).filter(Boolean).join("; ");
  return termValue(message);
}

function toViolation(result: ResultLike): ShaclViolation {
  return {
    ...(result.focusNode?.value !== undefined ? { focusNode: result.focusNode.value } : {}),
    ...(result.path?.value !== undefined ? { path: result.path.value } : {}),
    message: messageOf(result.message),
    ...(result.severity?.value !== undefined ? { severity: result.severity.value } : {}),
    ...(result.sourceConstraintComponent?.value !== undefined
      ? { sourceConstraintComponent: result.sourceConstraintComponent.value }
      : {}),
  };
}

/**
 * Validate a credential/dataset against a profile's SHACL shapes. Profile-agnostic: pass the
 * EDC shapes to verify a credential, or the LOQ/AMS/PID shapes to validate a plain dataset.
 */
export async function validateAgainstProfile(doc: unknown, options: ProfileValidationOptions): Promise<ShaclReport> {
  const loader = toJsonLdDocumentLoader(options.documentLoader ?? staticDocumentLoader);
  const input = hasContext(doc)
    ? doc
    : { "@context": options.defaultContext ?? EDC_DEFAULT_CONTEXT, ...(doc as Record<string, unknown>) };

  const nquads = (await jsonld.toRDF(input as jsonld.JsonLdDocument, {
    format: "application/n-quads",
    documentLoader: loader,
  })) as unknown as string;

  const data = rdf.dataset(new Parser({ format: "N-Quads" }).parse(nquads));
  // Strip `owl:imports`: the caller supplies the full shape closure (variant + its imports),
  // so the validator must not try to dereference imports itself (it has no network).
  const shapeQuads = options.shapes
    .flatMap((ttl) => new Parser().parse(ttl))
    .filter((q) => q.predicate.value !== "http://www.w3.org/2002/07/owl#imports");
  const shapes = rdf.dataset(shapeQuads);
  const report = await new SHACLValidator(shapes, { factory: rdf }).validate(data);

  return {
    conforms: report.conforms,
    violations: (report.results as ResultLike[]).map(toViolation),
  };
}
