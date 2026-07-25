import { validateQtiXmlFile } from "@conform-ed/qti-xml/node";

export async function qtiValidateFileCommand(filePath: string) {
  return validateQtiXmlFile(filePath);
}

export function formatQtiValidationResult(result: Awaited<ReturnType<typeof qtiValidateFileCommand>>): string {
  const header = [`File: ${result.filePath}`, `Status: ${result.status}`];

  if (result.rootDetection?.inferredVersion) {
    header.push(`Version: ${result.rootDetection.inferredVersion}`);
  }

  if (result.schemaSelectionKey) {
    header.push(`Schema: ${result.schemaSelectionKey}`);
  }

  if (!result.issues.length) {
    return header.join("\n");
  }

  return [...header, ...result.issues.map((issue) => `- ${issue.path}: ${issue.message}`)].join("\n");
}
