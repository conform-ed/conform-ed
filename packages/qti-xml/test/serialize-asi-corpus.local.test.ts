/**
 * ASI export round trip across the whole corpus (the authoring-system export
 * direction). For every official 1EdTech example that normalizes to `valid`, the
 * serializer's output must re-ingest through our own parser, normalizer, and strict
 * contracts schema to the IDENTICAL normalized document. This is the same export
 * conformance gate the results serializer holds ("MUST be valid with respect to the
 * official XSD" — proven here by model-level idempotence), generalized to the entire
 * ASI + manifest surface and anchored to the vendored corpus as ground truth.
 *
 * Runs only when the corpus is checked out at tmp/qti-examples (repo root).
 */

import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { serializeQtiDocument } from "../src";
import { validateQtiXmlContent, validateQtiXmlFile } from "../src/node";
import { corpusRoot, hasCorpus } from "./support/corpus";

const corpusTest = hasCorpus() ? test : test.skip;

// The roots whose export direction this serializer owns. Result/usage-data/PNP each
// have their own dedicated round-trip tests; the manifest and ASI roots are new here.
const serializableKeys = new Set([
  "qtiAssessmentItemDocument",
  "qtiAssessmentTestDocument",
  "qtiAssessmentStimulusDocument",
  "qtiAssessmentSectionDocument",
  "qtiResponseProcessingDocument",
  "qtiOutcomeDeclarationDocument",
  "qtiOutcomeProcessingDocument",
  "qtiMetadataDocument",
  "qtiManifestDocument",
]);

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
  "every normalizable ASI/manifest corpus document survives the export round trip",
  async () => {
    const files = await walkXmlFiles(corpusRoot);
    let roundTripped = 0;
    const failures: Array<{ readonly file: string; readonly reason: string }> = [];

    for (const file of files) {
      const original = await validateQtiXmlFile(file);

      if (
        original.status !== "valid" ||
        // v2.2 is an import-only legacy lane; the ASI export direction targets QTI 3.
        // (The 2.2 usage-data binding has its own dedicated round-trip test.)
        original.rootDetection?.inferredVersion !== "3.0.1" ||
        original.rootDetection.schemaSelectionKey === undefined ||
        !serializableKeys.has(original.rootDetection.schemaSelectionKey)
      ) {
        continue;
      }

      const version = original.rootDetection.inferredVersion ?? "3.0.1";
      const key = original.rootDetection.schemaSelectionKey;

      let xml: string;
      try {
        xml = serializeQtiDocument(version, key, original.normalizedDocument);
      } catch (error) {
        failures.push({ file: path.relative(corpusRoot, file), reason: `serialize threw: ${String(error)}` });
        continue;
      }

      // The serialized instance is anchored at the original file path so any residual
      // relative hrefs resolve identically; the model is already post-xinclude.
      const reingested = await validateQtiXmlContent(xml, { sourcePath: file });

      if (reingested.status !== "valid") {
        failures.push({
          file: path.relative(corpusRoot, file),
          reason: `re-ingest status ${reingested.status}: ${reingested.issues.map((i) => i.message).join("; ")}`,
        });
        continue;
      }

      try {
        expect(reingested.normalizedDocument).toEqual(original.normalizedDocument);
        roundTripped += 1;
      } catch {
        failures.push({
          file: path.relative(corpusRoot, file),
          reason: "normalized documents differ after round trip",
        });
      }
    }

    // Surface the first handful of failures verbatim — the floor assertion alone hides
    // which document broke.
    expect(failures.slice(0, 10)).toEqual([]);

    // The export floor: every serializable v3 corpus document round-trips. 306 items +
    // 30 tests + 2 stimuli + 7 outcome-declarations + 5 response-processing + 24
    // manifests + standalone metadata = 376. Raise as the corpus grows; never lower it.
    expect(roundTripped).toBeGreaterThanOrEqual(376);
  },
  120000,
);
