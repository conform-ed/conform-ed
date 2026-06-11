/**
 * The corpus delivery meter (qti-react ADR-0002): runs the full pipeline — XML parse →
 * normalize (qti-xml) → AssessmentItemView (qti-react adapter) → canDeliver against the
 * reference runtime — over every QTI 3 assessment item in the official examples corpus,
 * and reports corpus coverage: the share of official items this stack can deliver,
 * with a histogram of what blocks the rest (normalization gaps vs capability issues).
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createPciModuleRegistry,
  createPciSkin,
  createQtiRuntime,
  assessmentItemViewFromNormalized,
  assessmentTestViewFromNormalized,
  createTestController,
  portableCustomInteraction,
  qtiCoreInteractions,
  referenceSkin,
} from "../packages/qti-react/src";
import { validateQtiXmlFile } from "../packages/qti-xml/src";

type DeliveryStatus = "deliverable" | "undeliverable" | "schema-invalid" | "normalization-gap" | "unsupported-root";
type DocumentType = "item" | "test";

interface DeliveryEntry {
  readonly relativePath: string;
  readonly documentType: DocumentType;
  readonly status: DeliveryStatus;
  readonly blockers: readonly string[];
}

type StatusTotals = Record<DeliveryStatus, number> & { items: number };

interface DeliveryReport {
  readonly rootPath: string;
  readonly generatedAt: string;
  readonly totals: StatusTotals;
  readonly coverage: number;
  readonly testTotals: StatusTotals;
  readonly testCoverage: number;
  readonly blockerHistogram: ReadonlyArray<{ blocker: string; count: number }>;
  readonly entries: readonly DeliveryEntry[];
}

// The meter measures the stack with PCI enabled (it ships in qti-react; opt-in for
// consumers because PCI executes item-supplied JavaScript — see src/pci).
const runtime = createQtiRuntime({
  interactions: [...qtiCoreInteractions, portableCustomInteraction],
  skin: { ...referenceSkin, portableCustomInteraction: createPciSkin({ registry: createPciModuleRegistry() }) },
});

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

  return files.sort();
}

/** Reduce a normalization error message to a stable histogram key. */
function normalizationBlocker(message: string): string {
  const element = /<([a-z0-9-]+)>/iu.exec(message)?.[1];

  return element ? `normalize:<${element}>` : `normalize:${message.slice(0, 80)}`;
}

async function classify(rootPath: string, filePath: string): Promise<DeliveryEntry | null> {
  const relativePath = path.relative(rootPath, filePath).split(path.sep).join("/");
  const result = await validateQtiXmlFile(filePath);

  if (result.rootDetection?.inferredVersion !== "3.0.1") {
    return null;
  }

  const documentType: DocumentType | null =
    result.rootDetection.schemaSelectionKey === "qtiAssessmentItemDocument"
      ? "item"
      : result.rootDetection.schemaSelectionKey === "qtiAssessmentTestDocument"
        ? "test"
        : null;

  if (documentType === null) {
    return null; // the meter measures QTI 3 assessment items and tests
  }

  if (result.status === "unsupported") {
    return { relativePath, documentType, status: "unsupported-root", blockers: [] };
  }

  if (result.status === "parse-error") {
    const blockers = result.issues.map((issue) => normalizationBlocker(issue.message));

    return { relativePath, documentType, status: "normalization-gap", blockers };
  }

  if (result.status === "invalid") {
    return { relativePath, documentType, status: "schema-invalid", blockers: ["contracts-schema"] };
  }

  if (documentType === "test") {
    const view = assessmentTestViewFromNormalized(result.normalizedDocument);

    if (!view) {
      return { relativePath, documentType, status: "normalization-gap", blockers: ["normalize:no-assessment-test"] };
    }

    try {
      const controller = createTestController(view, { seed: 1 });
      const planItems = controller.plan.parts.reduce((count, part) => count + part.items.length, 0);

      if (controller.issues.length === 0 && planItems > 0) {
        return { relativePath, documentType, status: "deliverable", blockers: [] };
      }

      return {
        relativePath,
        documentType,
        status: "undeliverable",
        blockers:
          planItems === 0
            ? ["test-controller:empty-plan"]
            : controller.issues.map((issue) => `${issue.type}:${issue.name}`),
      };
    } catch (error) {
      return {
        relativePath,
        documentType,
        status: "undeliverable",
        blockers: [`test-controller:${error instanceof Error ? error.message.slice(0, 60) : String(error)}`],
      };
    }
  }

  const view = assessmentItemViewFromNormalized(result.normalizedDocument);

  if (!view) {
    return { relativePath, documentType, status: "normalization-gap", blockers: ["normalize:no-assessment-item"] };
  }

  const report = runtime.canDeliver(view);

  if (report.deliverable) {
    return { relativePath, documentType, status: "deliverable", blockers: [] };
  }

  return {
    relativePath,
    documentType,
    status: "undeliverable",
    blockers: report.issues.map((issue) => `${issue.type}:${issue.name}`),
  };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf("--root");
  const rootPath = path.resolve(flagIndex === -1 ? "tmp/qti-examples" : (args[flagIndex + 1] ?? "tmp/qti-examples"));
  const outputPath = path.resolve("tmp/generated/qti/qti-delivery-report.json");

  if (!existsSync(rootPath)) {
    console.error(`Corpus missing at ${rootPath} — run: bun run qti:corpus:fetch`);
    return 1;
  }

  const files = await walkXmlFiles(rootPath);
  const entries: DeliveryEntry[] = [];

  for (const file of files) {
    const entry = await classify(rootPath, file);

    if (entry) {
      entries.push(entry);
    }
  }

  function tally(documentType: DocumentType): StatusTotals {
    const totals: StatusTotals = {
      items: 0,
      deliverable: 0,
      undeliverable: 0,
      "schema-invalid": 0,
      "normalization-gap": 0,
      "unsupported-root": 0,
    };

    for (const entry of entries) {
      if (entry.documentType === documentType) {
        totals.items += 1;
        totals[entry.status] += 1;
      }
    }

    return totals;
  }

  const totals = tally("item");
  const testTotals = tally("test");
  const histogram = new Map<string, number>();

  for (const entry of entries) {
    for (const blocker of entry.blockers) {
      histogram.set(blocker, (histogram.get(blocker) ?? 0) + 1);
    }
  }

  const report: DeliveryReport = {
    rootPath,
    generatedAt: new Date().toISOString(),
    totals,
    coverage: totals.items === 0 ? 0 : totals.deliverable / totals.items,
    testTotals,
    testCoverage: testTotals.items === 0 ? 0 : testTotals.deliverable / testTotals.items,
    blockerHistogram: [...histogram].map(([blocker, count]) => ({ blocker, count })).sort((a, b) => b.count - a.count),
    entries,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Corpus delivery meter — root: ${rootPath}`);
  console.log(
    `QTI 3 items: ${totals.items} | deliverable: ${totals.deliverable} (${(report.coverage * 100).toFixed(1)}%) | ` +
      `undeliverable: ${totals.undeliverable} | normalization-gap: ${totals["normalization-gap"]} | ` +
      `schema-invalid: ${totals["schema-invalid"]} | unsupported-root: ${totals["unsupported-root"]}`,
  );
  console.log(
    `QTI 3 tests: ${testTotals.items} | deliverable: ${testTotals.deliverable} (${(report.testCoverage * 100).toFixed(1)}%) | ` +
      `undeliverable: ${testTotals.undeliverable} | normalization-gap: ${testTotals["normalization-gap"]} | ` +
      `schema-invalid: ${testTotals["schema-invalid"]}`,
  );
  console.log("\nTop blockers:");

  for (const { blocker, count } of report.blockerHistogram.slice(0, 15)) {
    console.log(`  ${String(count).padStart(4)}  ${blocker}`);
  }

  console.log(`\nWrote: ${outputPath}`);

  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
