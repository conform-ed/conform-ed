/**
 * Corpus delivery lane (ADR-0002): runs only when the official 1EdTech qti-examples
 * corpus is checked out at tmp/qti-examples (repo root). Guards the corpus-coverage
 * floor — the meter may only go up. `bun run qti:delivery:report` prints the full
 * histogram.
 */

import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateQtiXmlFile } from "@conform-ed/qti-xml/node";

import { qtiCoreInteractions } from "../src/interactions";
import {
  assessmentItemViewFromNormalized,
  assessmentTestViewFromNormalized,
  stimulusContentFromNormalized,
} from "../src/normalized-item";
import { createPciModuleRegistry, createPciSkin, portableCustomInteraction } from "../src/pci";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type StimulusContentView } from "../src/runtime";
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
    const files = await walkXmlFiles(corpusRoot);
    const results = new Map<string, Awaited<ReturnType<typeof validateQtiXmlFile>>>();

    for (const file of files) {
      results.set(file, await validateQtiXmlFile(file));
    }

    // Shared stimuli resolve from the package itself: hrefs are relative to the
    // referencing item's file (same model as the delivery meter).
    const stimulusByPath = new Map<string, StimulusContentView>();

    for (const [file, result] of results) {
      const stimulus = result.status === "valid" ? stimulusContentFromNormalized(result.normalizedDocument) : null;

      if (stimulus) {
        stimulusByPath.set(path.resolve(file), stimulus);
      }
    }

    let currentItemDir = corpusRoot;
    // PCI enabled, matching the delivery meter (scripts/generate-qti-delivery-report.ts).
    const runtime = createQtiRuntime({
      interactions: [...qtiCoreInteractions, portableCustomInteraction],
      skin: { ...referenceSkin, portableCustomInteraction: createPciSkin({ registry: createPciModuleRegistry() }) },
      resolveStimulus: (ref) => stimulusByPath.get(path.resolve(currentItemDir, ref.href)) ?? null,
    });
    let items = 0;
    let deliverable = 0;
    let tests = 0;
    let deliverableTests = 0;
    const refusals: Array<{ readonly file: string; readonly blockers: readonly string[] }> = [];

    for (const [file, result] of results) {
      if (result.rootDetection?.inferredVersion !== "3.0.1") {
        continue;
      }

      currentItemDir = path.dirname(file);

      if (result.rootDetection.schemaSelectionKey === "qtiAssessmentItemDocument") {
        items += 1;

        if (result.status !== "valid") {
          refusals.push({ file: path.basename(file), blockers: [`status:${result.status}`] });
          continue;
        }

        const view = assessmentItemViewFromNormalized(result.normalizedDocument);

        if (!view) {
          refusals.push({ file: path.basename(file), blockers: ["normalization-gap"] });
          continue;
        }

        const verdict = runtime.canDeliver(view);

        if (verdict.deliverable) {
          deliverable += 1;
        } else {
          refusals.push({
            file: path.basename(file),
            blockers: verdict.issues.map((issue) => `${issue.type}:${issue.name}`),
          });
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
    // items 311/312 delivered + the asserted refusal below = 312/312 handled
    // correctly. tests 30/30 (100%).
    expect(deliverable).toBeGreaterThanOrEqual(311);
    expect(deliverableTests).toBeGreaterThanOrEqual(30);

    // Refusal-as-success: the only item not delivered is the one that must not be.
    // SineRule-001 binds its template maths to the GPL Maxima *product* via the
    // third-party MathAssess profile (customOperator class
    // org.qtitools.mathassess.CasProcess, ma:syntax="text/x-maxima"). QTI 3 leaves
    // customOperator implementation-defined, so the conformant response to an
    // unregistered class is exactly this loud refusal — guessing or faking a CAS to
    // print 312/312 would be the non-conformant move. The seam for real
    // implementations is QtiRuntimeConfig.customOperators.
    expect(refusals).toEqual([{ file: "SineRule-001.xml", blockers: ["unsupported-rp:customOperator"] }]);
  },
  60000,
);
