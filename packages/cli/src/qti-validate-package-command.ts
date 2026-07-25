import { validateQtiPackagePath } from "@conform-ed/qti-xml/node";

export async function qtiValidatePackageCommand(packagePath: string) {
  return validateQtiPackagePath(packagePath);
}

export function formatQtiPackageValidationResult(
  result: Awaited<ReturnType<typeof qtiValidatePackageCommand>>,
): string {
  const header = [`Package: ${result.packagePath}`, `Status: ${result.status}`];

  if (result.manifestPath) {
    header.push(`Manifest: ${result.manifestPath}`);
  }

  if (!result.issues.length) {
    return header.join("\n");
  }

  return [...header, ...result.issues.map((issue) => `- ${issue.path}: ${issue.message}`)].join("\n");
}
