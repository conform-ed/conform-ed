import { buildQtiExampleInventory, validateQtiXmlFile } from "@conform-ed/qti-xml/node";

export interface QtiFolderValidationSummary {
  rootPath: string;
  totalFiles: number;
  validatedFiles: number;
  valid: number;
  invalid: number;
  parseErrors: number;
  unsupported: number;
  skipped: number;
  results: Awaited<ReturnType<typeof validateQtiXmlFile>>[];
}

export async function qtiValidateFolderCommand(rootPath: string): Promise<QtiFolderValidationSummary> {
  const inventory = await buildQtiExampleInventory(rootPath);
  const candidates = inventory.entries.filter(
    (entry) => entry.fileKind === "xml" && entry.supportStatus === "supported",
  );
  const results = await Promise.all(candidates.map((entry) => validateQtiXmlFile(entry.absolutePath)));

  return {
    rootPath: inventory.rootPath,
    totalFiles: inventory.summary.totalFiles,
    validatedFiles: results.length,
    valid: results.filter((result) => result.status === "valid").length,
    invalid: results.filter((result) => result.status === "invalid").length,
    parseErrors: results.filter((result) => result.status === "parse-error").length,
    unsupported: results.filter((result) => result.status === "unsupported").length,
    skipped: inventory.entries.length - results.length,
    results,
  };
}

export function formatQtiFolderValidationSummary(summary: QtiFolderValidationSummary): string {
  return [
    `Folder: ${summary.rootPath}`,
    `Total files: ${summary.totalFiles}`,
    `Validated XML files: ${summary.validatedFiles}`,
    `Results: valid=${summary.valid}, invalid=${summary.invalid}, parse-errors=${summary.parseErrors}, unsupported=${summary.unsupported}, skipped=${summary.skipped}`,
  ].join("\n");
}
