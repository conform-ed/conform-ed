/**
 * The corpus delivery meter (qti-react ADR-0002): runs the full pipeline — XML parse →
 * normalize (qti-xml) → AssessmentItemView (qti-react adapter) → canDeliver against the
 * reference runtime — over every QTI 3 assessment item in the official examples corpus,
 * and reports corpus coverage: the share of official items this stack can deliver,
 * with a histogram of what blocks the rest (normalization gaps vs capability issues).
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createQtiRuntime,
  assessmentItemViewFromNormalized,
  qtiCoreInteractions,
  referenceSkin,
} from "../packages/qti-react/src";
import { validateQtiXmlFile } from "../packages/qti-xml/src";

type DeliveryStatus = "deliverable" | "undeliverable" | "schema-invalid" | "normalization-gap" | "unsupported-root";

interface DeliveryEntry {
  readonly relativePath: string;
  readonly status: DeliveryStatus;
  readonly blockers: readonly string[];
}

interface DeliveryReport {
  readonly rootPath: string;
  readonly generatedAt: string;
  readonly totals: Record<DeliveryStatus, number> & { items: number };
  readonly coverage: number;
  readonly blockerHistogram: ReadonlyArray<{ blocker: string; count: number }>;
  readonly entries: readonly DeliveryEntry[];
}

const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });

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

  if (
    result.rootDetection?.inferredVersion !== "3.0.1" ||
    result.rootDetection.schemaSelectionKey !== "qtiAssessmentItemDocument"
  ) {
    return null; // the meter measures QTI 3 assessment items only
  }

  if (result.status === "unsupported") {
    return { relativePath, status: "unsupported-root", blockers: [] };
  }

  if (result.status === "parse-error") {
    const blockers = result.issues.map((issue) => normalizationBlocker(issue.message));

    return { relativePath, status: "normalization-gap", blockers };
  }

  if (result.status === "invalid") {
    return { relativePath, status: "schema-invalid", blockers: ["contracts-schema"] };
  }

  const view = assessmentItemViewFromNormalized(result.normalizedDocument);

  if (!view) {
    return { relativePath, status: "normalization-gap", blockers: ["normalize:no-assessment-item"] };
  }

  const report = runtime.canDeliver(view);

  if (report.deliverable) {
    return { relativePath, status: "deliverable", blockers: [] };
  }

  return {
    relativePath,
    status: "undeliverable",
    blockers: report.issues.map((issue) => `${issue.type}:${issue.name}`),
  };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf("--root");
  const rootPath = path.resolve(flagIndex === -1 ? "tmp/qti-examples" : (args[flagIndex + 1] ?? "tmp/qti-examples"));
  const outputPath = path.resolve("tmp/generated/qti/qti-delivery-report.json");

  const files = await walkXmlFiles(rootPath);
  const entries: DeliveryEntry[] = [];

  for (const file of files) {
    const entry = await classify(rootPath, file);

    if (entry) {
      entries.push(entry);
    }
  }

  const totals: DeliveryReport["totals"] = {
    items: entries.length,
    deliverable: 0,
    undeliverable: 0,
    "schema-invalid": 0,
    "normalization-gap": 0,
    "unsupported-root": 0,
  };
  const histogram = new Map<string, number>();

  for (const entry of entries) {
    totals[entry.status] += 1;

    for (const blocker of entry.blockers) {
      histogram.set(blocker, (histogram.get(blocker) ?? 0) + 1);
    }
  }

  const report: DeliveryReport = {
    rootPath,
    generatedAt: new Date().toISOString(),
    totals,
    coverage: totals.items === 0 ? 0 : totals.deliverable / totals.items,
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
