/**
 * Official-XSD conformance hardening lane. Our per-commit gates validate against the
 * zod contracts and a model round trip; this lane adds the stronger check the export
 * conformance claim actually needs — that instances validate against the official
 * 1EdTech ASI XSD (libxml2 via xmllint-wasm).
 *
 * Runs only when both the example corpus (tmp/qti-examples) and the vendored schema set
 * (tmp/qti, via scripts/fetch-qti-schemas.ts) are present; skips otherwise.
 *
 * The prize is the second test: every instance OUR serializer emits, for inputs that
 * were themselves XSD-valid, must also be XSD-valid. A failure there is a serializer
 * bug, not a corpus quirk.
 */

import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { serializeQtiDocument, validateQtiXmlFile } from "../src";
import { hasQtiSchemas, validateAsiDocuments, type XsdDocument } from "./support/qti-xsd";

const corpusRoot = fileURLToPath(new URL("../../../tmp/qti-examples", import.meta.url));
const ready = hasQtiSchemas() && existsSync(corpusRoot);
const lane = ready ? test : test.skip;

// Roots the ASI XSD declares as global elements (so a document of that root validates
// against the ASI schema). Manifest/metadata/result/usage-data have their own schemas.
const asiKeys = new Set([
  "qtiAssessmentItemDocument",
  "qtiAssessmentTestDocument",
  "qtiAssessmentSectionDocument",
  "qtiAssessmentStimulusDocument",
  "qtiResponseProcessingDocument",
  "qtiOutcomeDeclarationDocument",
  "qtiOutcomeProcessingDocument",
]);

/** xmllint-wasm's virtual FS is flat — collapse path separators into a unique token. */
function flatName(relativePath: string): string {
  return relativePath.replace(/[^a-zA-Z0-9._-]/gu, "__");
}

async function walkXmlFiles(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkXmlFiles(absolutePath)));
    } else if (entry.name.toLowerCase().endsWith(".xml")) {
      files.push(absolutePath);
    }
  }
  return files;
}

interface AsiCorpusEntry {
  readonly fileName: string;
  readonly version: string;
  readonly key: string;
  readonly original: string;
  readonly normalizedDocument: unknown;
}

let cachedEntries: AsiCorpusEntry[] | undefined;

async function asiCorpusEntries(): Promise<AsiCorpusEntry[]> {
  if (cachedEntries) {
    return cachedEntries;
  }
  const files = await walkXmlFiles(corpusRoot);
  const entries: AsiCorpusEntry[] = [];
  for (const file of files) {
    const result = await validateQtiXmlFile(file);
    const key = result.rootDetection?.schemaSelectionKey;
    if (
      result.status === "valid" &&
      result.rootDetection?.inferredVersion === "3.0.1" &&
      key !== undefined &&
      asiKeys.has(key)
    ) {
      const original = await Bun.file(file).text();
      entries.push({
        fileName: path.relative(corpusRoot, file),
        version: "3.0.1",
        key,
        original,
        normalizedDocument: result.normalizedDocument,
      });
    }
  }
  cachedEntries = entries;
  return entries;
}

/** The fileNames a libxml2 error batch implicates (errors are "fileName:line: ..."). */
function failingFileNames(errors: readonly string[], candidates: readonly XsdDocument[]): Set<string> {
  const failing = new Set<string>();
  for (const error of errors) {
    for (const candidate of candidates) {
      if (error.includes(candidate.fileName)) {
        failing.add(candidate.fileName);
      }
    }
  }
  return failing;
}

lane(
  "a representative spread of corpus ASI documents validates against the official ASI XSD",
  async () => {
    const entries = await asiCorpusEntries();
    const documents = entries.map((entry) => ({ fileName: flatName(entry.fileName), contents: entry.original }));
    const { valid, errors } = await validateAsiDocuments(documents);

    const failing = failingFileNames(errors, documents);
    // The official corpus is third-party; some examples carry quirks the strict XSD
    // rejects. We require that the overwhelming majority are XSD-valid (proving the
    // schema setup is sound) and surface the rest for visibility.
    const xsdValid = documents.length - failing.size;
    console.log(`corpus ASI docs XSD-valid: ${xsdValid}/${documents.length}`);
    if (!valid) {
      console.log("non-XSD-valid corpus files:", [...failing].slice(0, 20).join(", "));
    }
    expect(documents.length).toBeGreaterThanOrEqual(300);
    expect(xsdValid).toBeGreaterThanOrEqual(Math.floor(documents.length * 0.9));
  },
  300000,
);

lane(
  "every emitted ASI instance is XSD-valid for inputs that were themselves XSD-valid",
  async () => {
    const entries = await asiCorpusEntries();
    const originals = entries.map((entry) => ({ fileName: flatName(entry.fileName), contents: entry.original }));

    // Baseline: which corpus originals the official XSD accepts. We only hold our
    // serializer to inputs that were conformant to begin with.
    const originalOutcome = await validateAsiDocuments(originals);
    const failingOriginals = failingFileNames(originalOutcome.errors, originals);
    const baseline = entries.filter((entry) => !failingOriginals.has(flatName(entry.fileName)));

    // Serialize each baseline document and validate the OUTPUT against the official XSD.
    const emitted = baseline.map((entry) => ({
      fileName: flatName(entry.fileName),
      contents: serializeQtiDocument("3.0.1", entry.key as never, entry.normalizedDocument),
    }));
    const { valid, errors } = await validateAsiDocuments(emitted);

    const failing = failingFileNames(errors, emitted);
    if (!valid) {
      console.log(`emitted instances NOT XSD-valid (${failing.size}/${emitted.length}):`);
      console.log([...failing].slice(0, 20).join(", "));
      console.log("first errors:", errors.slice(0, 12).join("\n"));
    }
    expect(baseline.length).toBeGreaterThanOrEqual(280);
    expect(valid).toBe(true);
  },
  300000,
);
