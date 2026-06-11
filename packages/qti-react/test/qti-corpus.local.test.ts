/**
 * Corpus delivery lane (ADR-0002): runs only when the official 1EdTech qti-examples
 * corpus is checked out at tmp/qti-examples (repo root). Guards the corpus-coverage
 * floor — the meter may only go up. `bun run qti:delivery:report` prints the full
 * histogram.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { expect, test } from "bun:test";

import { validateQtiXmlFile } from "@conform-ed/qti-xml";

import { qtiCoreInteractions } from "../src/interactions";
import { assessmentItemViewFromNormalized, assessmentTestViewFromNormalized } from "../src/normalized-item";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime } from "../src/runtime";
import { createTestController } from "../src/test";

const corpusRoot = fileURLToPath(new URL("../../../tmp/qti-examples", import.meta.url));
const corpusTest = existsSync(corpusRoot) ? test : test.skip;

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

corpusTest(
  "corpus delivery coverage stays at or above the recorded floors",
  async () => {
    const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });
    const files = await walkXmlFiles(corpusRoot);
    let items = 0;
    let deliverable = 0;
    let tests = 0;
    let deliverableTests = 0;

    for (const file of files) {
      const result = await validateQtiXmlFile(file);

      if (result.rootDetection?.inferredVersion !== "3.0.1") {
        continue;
      }

      if (result.rootDetection.schemaSelectionKey === "qtiAssessmentItemDocument") {
        items += 1;

        if (result.status !== "valid") {
          continue;
        }

        const view = assessmentItemViewFromNormalized(result.normalizedDocument);

        if (view && runtime.canDeliver(view).deliverable) {
          deliverable += 1;
        }
      }

      if (result.rootDetection.schemaSelectionKey === "qtiAssessmentTestDocument") {
        tests += 1;

        if (result.status !== "valid") {
          continue;
        }

        const view = assessmentTestViewFromNormalized(result.normalizedDocument);

        if (!view) {
          continue;
        }

        const controller = createTestController(view, { seed: 1 });
        const planItems = controller.plan.parts.reduce((count, part) => count + part.items.length, 0);

        if (controller.issues.length === 0 && planItems > 0) {
          deliverableTests += 1;
        }
      }
    }

    expect(items).toBeGreaterThanOrEqual(300);
    expect(tests).toBeGreaterThanOrEqual(25);

    // The recorded floors (raise as the stack grows — they must never go down):
    // items 293/312 (93.9%) after the CC2-template rung; the 19 remaining are
    // PCI/drawing (deferred), xi:include, random-in-RP (determinism policy),
    // customOperator, and 4 corpus authoring deviations.
    // tests 29/30 (96.7%); the holdout needs the numberCorrect/number* family,
    // which requires per-item correctness in the session model.
    expect(deliverable).toBeGreaterThanOrEqual(293);
    expect(deliverableTests).toBeGreaterThanOrEqual(29);
  },
  60000,
);
