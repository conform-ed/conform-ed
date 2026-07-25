import { expect, test } from "bun:test";
import path from "node:path";

import { validateQtiXmlFile } from "../src/node";
import { corpusRoot as officialExamplesRoot, hasCorpus } from "./support/corpus";

const corpusTest = hasCorpus() ? test : test.skip;

corpusTest("curated official examples validate with the current normalization slice", async () => {
  const files = [
    "qtiv2p2-examples/items/choice.xml",
    "qtiv2p2-examples/items/imsmanifest.xml",
    "qtiv3-examples/packaging/simple/choice.xml",
    "qtiv3-examples/tests/complete.xml",
    "qtiv3-examples/results/report.xml",
  ];

  const results = await Promise.all(files.map((file) => validateQtiXmlFile(path.join(officialExamplesRoot, file))));

  for (const result of results) {
    expect(result.status).toBe("valid");
  }
});

corpusTest("known broken official examples remain explicitly non-valid", async () => {
  const files = ["qtiv3-examples/CAT/test.xml", "qtiv3-examples/results/full-example.xml"];

  const results = await Promise.all(files.map((file) => validateQtiXmlFile(path.join(officialExamplesRoot, file))));

  expect(results[0]?.status).toBe("unsupported");
  expect(results[1]?.status).toBe("parse-error");
});

corpusTest("official result documents survive the export round trip byte-for-shape", async () => {
  // RR export conformance: the instance "MUST be valid with respect to the official
  // XSD" — gated here by re-ingesting our own serialization of the official
  // examples and requiring the identical normalized document.
  const { serializeQtiAssessmentResult } = await import("../src");
  const { validateQtiXmlContent } = await import("../src/node");
  const files = ["qtiv3-examples/results/report.xml", "qtiv3-examples/results/conformance-use-case-1.xml"];

  for (const file of files) {
    const original = await validateQtiXmlFile(path.join(officialExamplesRoot, file));

    expect(original.status).toBe("valid");

    const xml = serializeQtiAssessmentResult(original.normalizedDocument as never);
    const roundTripped = await validateQtiXmlContent(xml);

    expect(roundTripped.status).toBe("valid");
    expect(roundTripped.normalizedDocument).toEqual(original.normalizedDocument);
  }
});
