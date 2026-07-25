import { buildQtiExampleInventory } from "@conform-ed/qti-xml/node";

export async function qtiInventoryExamplesCommand(rootPath: string) {
  return buildQtiExampleInventory(rootPath);
}

export function formatQtiInventorySummary(report: Awaited<ReturnType<typeof qtiInventoryExamplesCommand>>): string {
  const { summary } = report;

  return [
    `Inventory: ${report.rootPath}`,
    `Files: ${summary.totalFiles}`,
    `Kinds: xml=${summary.byFileKind.xml}, zip=${summary.byFileKind.zip}, html=${summary.byFileKind.html}, other=${summary.byFileKind.other}`,
    `Support: supported=${summary.bySupportStatus.supported}, unsupported-root=${summary.bySupportStatus["unsupported-root"]}, unsupported-normalization=${summary.bySupportStatus["unsupported-normalization"]}, known-broken=${summary.bySupportStatus["known-broken-example"]}, zip=${summary.bySupportStatus["zip-package"]}, not-xml=${summary.bySupportStatus["not-xml"]}`,
  ].join("\n");
}
