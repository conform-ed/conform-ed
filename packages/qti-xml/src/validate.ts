import { readFile } from "node:fs/promises";
import path from "node:path";

import { detectQtiRoot } from "./root-detection";
import { normalizeQtiDocument } from "./normalize";
import { parseXmlDocument } from "./parse-xml";
import { isNormalizationImplemented, selectQtiSchema } from "./schema-selection";
import type { QtiValidationIssue, QtiValidationResult } from "./types";
import { resolveXIncludes } from "./xinclude";

type SafeParseResult = {
  success: boolean;
  error?: { issues?: Array<{ path?: PropertyKey[]; message?: string }> };
};

function formatIssuePath(pathEntries: PropertyKey[] | undefined): string {
  if (!pathEntries?.length) {
    return "$";
  }

  return `$${pathEntries.map((entry) => (typeof entry === "number" ? `[${entry}]` : `.${String(entry)}`)).join("")}`;
}

function flattenIssues(
  error: { issues?: Array<{ path?: PropertyKey[]; message?: string }> } | undefined,
): QtiValidationIssue[] {
  return (error?.issues ?? []).map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message ?? "Validation error.",
  }));
}

export async function validateQtiXmlFile(filePath: string): Promise<QtiValidationResult> {
  const absolutePath = path.resolve(filePath);
  const xml = await readFile(absolutePath, "utf8");
  const rootDetection = detectQtiRoot(xml);

  if (!rootDetection) {
    return {
      filePath: absolutePath,
      status: "unsupported",
      issues: [{ path: "$", message: "Could not detect an XML root element." }],
    };
  }

  const schemaSelection = selectQtiSchema(rootDetection);
  if (!schemaSelection) {
    return {
      filePath: absolutePath,
      rootDetection,
      status: "unsupported",
      issues: [{ path: "$", message: "No contracts schema is registered for this QTI root." }],
    };
  }

  if (!isNormalizationImplemented(schemaSelection.version, schemaSelection.key)) {
    return {
      filePath: absolutePath,
      rootDetection,
      schemaSelectionKey: schemaSelection.key,
      status: "unsupported",
      issues: [{ path: "$", message: "XML normalization is not implemented for this QTI root yet." }],
    };
  }

  let normalizedDocument: unknown;
  try {
    const documentRoot = parseXmlDocument(xml);

    // Shared fragments (xi:include) splice in before normalization — this is the only
    // layer that knows the file path the hrefs are relative to.
    await resolveXIncludes(documentRoot, absolutePath);
    normalizedDocument = normalizeQtiDocument(schemaSelection.version, schemaSelection.key, documentRoot);
  } catch (error) {
    return {
      filePath: absolutePath,
      rootDetection,
      schemaSelectionKey: schemaSelection.key,
      status: "parse-error",
      issues: [{ path: "$", message: error instanceof Error ? error.message : String(error) }],
    };
  }

  const parsed = schemaSelection.schema.safeParse(normalizedDocument) as SafeParseResult;
  if (!parsed.success) {
    return {
      filePath: absolutePath,
      rootDetection,
      schemaSelectionKey: schemaSelection.key,
      normalizedDocument,
      status: "invalid",
      issues: flattenIssues(parsed.error),
    };
  }

  return {
    filePath: absolutePath,
    rootDetection,
    schemaSelectionKey: schemaSelection.key,
    normalizedDocument,
    status: "valid",
    issues: [],
  };
}
