/**
 * Official QTI 3 XSD validation for the hardening lane (xsd-conformance.local.test.ts).
 *
 * libxml2 (via xmllint-wasm) validates against the real 1EdTech ASI schema. The schema
 * set is vendored under tmp/qti (gitignored, like the example corpus) and fetched by
 * scripts/fetch-qti-schemas.ts, so this is a local/nightly lane that skips when the
 * schemas are absent — it is not a per-commit gate.
 *
 * Two accommodations, both forced by libxml2 and both documented in ADR-0011:
 *  - schemaLocation values (absolute purl URLs in the official XSDs) are rewritten to
 *    bare basenames so imports resolve from the preloaded set offline;
 *  - SSML (the synthesis namespace) is resolved by a lax anyType stub rather than the
 *    official ssmlv1p1-core.xsd, which declares its elements via xs:redefine — a feature
 *    libxml2 does not fully support. QTI structure is still validated strictly; only the
 *    embedded TTS-annotation namespace is lax.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { validateXML } from "xmllint-wasm";

export const qtiSchemaRoot = path.resolve(import.meta.dir, "../../../../tmp/qti");
const asiSchemaPath = path.join(qtiSchemaRoot, "3.0.1/imsqti_asiv3p0p1_v1p0.xsd");
const asiSchemaDepsDir = path.join(qtiSchemaRoot, "3.0.1/xsd-deps");

export function hasQtiSchemas(): boolean {
  return existsSync(asiSchemaPath) && existsSync(asiSchemaDepsDir);
}

/** Rewrite any URL-form schemaLocation to its bare basename (relative ones are kept). */
function rewriteSchemaLocations(xsd: string): string {
  return xsd.replace(/schemaLocation="[^"]*\/([^"/]+\.xsd)"/gu, 'schemaLocation="$1"');
}

/** Read an XSD, decoding the UTF-16 vendored files (e.g. XInclude.xsd) as needed. */
async function loadXsd(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  const text = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.toString("utf16le") : bytes.toString("utf8");
  return rewriteSchemaLocations(text.replace(/^﻿/u, ""));
}

export interface XsdDocument {
  readonly fileName: string;
  readonly contents: string;
}

export interface XsdValidationOutcome {
  readonly valid: boolean;
  readonly errors: string[];
}

type PreparedSchema = {
  readonly schema: XsdDocument[];
  readonly preload: XsdDocument[];
};

let asiSchemaPromise: Promise<PreparedSchema> | undefined;

async function loadAsiSchema(): Promise<PreparedSchema> {
  asiSchemaPromise ??= (async () => {
    const schemaContents = await loadXsd(asiSchemaPath);
    const depFiles = (await readdir(asiSchemaDepsDir)).filter((file) => file.endsWith(".xsd"));
    const preload = await Promise.all(
      depFiles.map(async (file) => ({ fileName: file, contents: await loadXsd(path.join(asiSchemaDepsDir, file)) })),
    );
    return {
      schema: [{ fileName: "imsqti_asiv3p0p1_v1p0.xsd", contents: schemaContents }],
      preload,
    };
  })();
  return asiSchemaPromise;
}

function flattenErrors(errors: unknown): string[] {
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.map((error) => {
    if (typeof error === "string") {
      return error;
    }
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : JSON.stringify(error);
  });
}

/**
 * Validate one or more ASI instances (items, tests, sections, stimuli, standalone
 * response-processing / outcome-declaration / outcome-processing — every root the ASI
 * schema declares) against the official ASI XSD. Documents are validated in a single
 * call so the 18 MB schema compiles once.
 */
export async function validateAsiDocuments(documents: readonly XsdDocument[]): Promise<XsdValidationOutcome> {
  const { schema, preload } = await loadAsiSchema();
  const result = await validateXML({ xml: documents.map((document) => ({ ...document })), schema, preload });
  return { valid: result.valid, errors: flattenErrors((result as { errors?: unknown }).errors) };
}
