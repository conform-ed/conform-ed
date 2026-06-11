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
import { assessmentItemViewFromNormalized } from "../src/normalized-item";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime } from "../src/runtime";

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
  "corpus delivery coverage stays at or above the recorded floor",
  async () => {
    const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });
    const files = await walkXmlFiles(corpusRoot);
    let items = 0;
    let deliverable = 0;

    for (const file of files) {
      const result = await validateQtiXmlFile(file);

      if (
        result.rootDetection?.inferredVersion !== "3.0.1" ||
        result.rootDetection.schemaSelectionKey !== "qtiAssessmentItemDocument"
      ) {
        continue;
      }

      items += 1;

      if (result.status !== "valid") {
        continue;
      }

      const view = assessmentItemViewFromNormalized(result.normalizedDocument);

      if (view && runtime.canDeliver(view).deliverable) {
        deliverable += 1;
      }
    }

    expect(items).toBeGreaterThanOrEqual(300);

    // The recorded floor: 283/312 (90.7%) after the math-operator rung (87 at the
    // meter's introduction, 257 after the normalizer rung). Raise this floor as the
    // normalizer and runtime grow — it must never go down. The 29 remaining are
    // PCI/drawing (deferred), CC2 profile templates, xi:include, random-in-RP
    // (determinism policy), and 4 corpus authoring deviations.
    expect(deliverable).toBeGreaterThanOrEqual(283);
  },
  60000,
);
