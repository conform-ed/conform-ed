import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// fast-xml-parser's own validator, used in preference to the `fast-xml-validator`
// package it is deprecated in favour of: that package's dependency tree
// (detailed-xml-validator@2.2 → @nodable/flexible-xml-parser) relies on Node's `Buffer`
// global and breaks browser bundles. Full rationale + reopen trigger: ./parse-xml.ts.
import { XMLValidator } from "fast-xml-parser";

import { detectQtiRoot } from "./root-detection";
import { isNormalizationImplemented, selectQtiSchema } from "./schema-selection";
import type {
  QtiExampleInventoryEntry,
  QtiExampleInventoryReport,
  QtiFileKind,
  QtiSupportStatus,
  QtiXmlStatus,
} from "./types";

const knownBrokenExampleSuffixes = ["qtiv3-examples/CAT/test.xml", "qtiv3-examples/results/full-example.xml"] as const;

function createEmptyCountRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

async function walkFiles(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath)));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function normalizeRelativePath(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).split(path.sep).join("/");
}

function fileKindForPath(filePath: string): QtiFileKind {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".xml":
      return "xml";
    case ".zip":
      return "zip";
    case ".html":
    case ".htm":
      return "html";
    default:
      return "other";
  }
}

function isKnownBrokenExample(relativePath: string): boolean {
  return knownBrokenExampleSuffixes.some((suffix) => relativePath === suffix || relativePath.endsWith(`/${suffix}`));
}

function xmlStatusForContent(fileKind: QtiFileKind, content: string): QtiXmlStatus {
  if (fileKind !== "xml") {
    return "not-xml";
  }

  // Return-based contract: `true`, or an error object. Nothing is thrown, so a malformed
  // example is classified rather than aborting the whole inventory walk.
  // oxlint-disable-next-line typescript/no-deprecated -- deliberate; see the import above.
  return XMLValidator.validate(content) === true ? "well-formed" : "malformed";
}

function supportStatusForEntry(entry: {
  fileKind: QtiFileKind;
  xmlStatus: QtiXmlStatus;
  relativePath: string;
  hasSchema: boolean;
  hasNormalizer: boolean;
}): { status: QtiSupportStatus; note?: string } {
  if (entry.fileKind === "zip") {
    return { status: "zip-package" };
  }

  if (entry.fileKind !== "xml") {
    return { status: "not-xml" };
  }

  if (isKnownBrokenExample(entry.relativePath)) {
    return {
      status: "known-broken-example",
      note:
        entry.xmlStatus === "malformed"
          ? "Known malformed official example."
          : "Known official example path that does not currently contain a usable QTI XML document.",
    };
  }

  if (entry.xmlStatus === "malformed") {
    return { status: "unsupported-root", note: "XML is not well formed." };
  }

  if (!entry.hasSchema) {
    return { status: "unsupported-root", note: "No contracts schema is registered for this root." };
  }

  if (!entry.hasNormalizer) {
    return {
      status: "unsupported-normalization",
      note: "A contracts schema exists, but XML normalization is not implemented yet.",
    };
  }

  return { status: "supported" };
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function buildQtiExampleInventory(rootPath: string): Promise<QtiExampleInventoryReport> {
  const absoluteRootPath = path.resolve(rootPath);
  const filePaths = (await walkFiles(absoluteRootPath)).sort();
  const entries: QtiExampleInventoryEntry[] = [];

  for (const absolutePath of filePaths) {
    const relativePath = normalizeRelativePath(absoluteRootPath, absolutePath);
    const fileKind = fileKindForPath(absolutePath);
    const sourceGroup = relativePath.split("/", 1)[0] ?? ".";
    const content = fileKind === "zip" ? "" : await readFile(absolutePath, "utf8");
    const contentHash = hashContent(content);
    const xmlStatus = xmlStatusForContent(fileKind, content);
    const rootDetection = fileKind === "xml" ? detectQtiRoot(content) : undefined;
    const schemaSelection = rootDetection ? selectQtiSchema(rootDetection) : undefined;
    const support = supportStatusForEntry({
      fileKind,
      xmlStatus,
      relativePath,
      hasSchema: Boolean(schemaSelection),
      hasNormalizer:
        schemaSelection !== undefined && isNormalizationImplemented(schemaSelection.version, schemaSelection.key),
    });

    entries.push({
      absolutePath,
      relativePath,
      sourceGroup,
      fileKind,
      xmlStatus,
      supportStatus: support.status,
      contentHash,
      ...(rootDetection?.rootName ? { rootName: rootDetection.rootName } : {}),
      ...(rootDetection?.localName ? { localName: rootDetection.localName } : {}),
      ...(rootDetection?.namespaceUri ? { namespaceUri: rootDetection.namespaceUri } : {}),
      ...(rootDetection?.inferredVersion ? { inferredVersion: rootDetection.inferredVersion } : {}),
      ...(rootDetection?.schemaSelectionKey ? { schemaSelectionKey: rootDetection.schemaSelectionKey } : {}),
      ...(support.note ? { note: support.note } : {}),
    });
  }

  const byFileKind = createEmptyCountRecord(["html", "other", "xml", "zip"] as const);
  const bySupportStatus = createEmptyCountRecord([
    "known-broken-example",
    "not-xml",
    "supported",
    "unsupported-normalization",
    "unsupported-root",
    "zip-package",
  ] as const);
  const byVersion: Record<string, number> = {};

  for (const entry of entries) {
    byFileKind[entry.fileKind] += 1;
    bySupportStatus[entry.supportStatus] += 1;

    if (entry.inferredVersion) {
      byVersion[entry.inferredVersion] = (byVersion[entry.inferredVersion] ?? 0) + 1;
    }
  }

  return {
    rootPath: absoluteRootPath,
    generatedAt: new Date().toISOString(),
    entries,
    summary: {
      totalFiles: entries.length,
      byFileKind,
      bySupportStatus,
      byVersion,
    },
  };
}
