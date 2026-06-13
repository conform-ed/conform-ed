/**
 * Usage Data & Item Statistics serialization — the EXPORT direction of the Usage
 * Data specification. The gate is the round trip: serialize → parse → normalize →
 * strict contracts schema → deep-equal, including the official corpus instance.
 */

import { expect, test } from "bun:test";
import path from "node:path";

import type { QtiUsageDataDocument } from "@conform-ed/contracts/qti/v3_0_1";

import { serializeQtiUsageData, validateQtiXmlContent, validateQtiXmlFile } from "../src";

const corpusRoot = path.resolve(import.meta.dir, "../../../tmp/qti-examples");

const document: QtiUsageDataDocument = {
  usageData: {
    statistics: [
      {
        kind: "ordinaryStatistic",
        name: "P-value",
        context: "https://stats.example.org/run-1",
        caseCount: 689325,
        stdError: 0.0022,
        lastUpdated: "2026-06-13",
        targetObjects: [{ identifier: "Item_VB123456" }],
        value: { value: "0.647" },
      },
      {
        kind: "categorizedStatistic",
        name: "D-Parm",
        context: "https://stats.example.org/run-1",
        targetObjects: [{ identifier: "Item_VB123456", partIdentifier: "A", objectType: "choice" }],
        mapping: {
          lowerBound: 1,
          upperBound: 4,
          defaultValue: 0,
          mapEntries: [
            { mapKey: "d1", mappedValue: 412.5267 },
            { mapKey: "d2", mappedValue: 426.5699 },
          ],
        },
      },
    ],
  },
};

test("a usage data document round-trips through the serializer and parser", async () => {
  const xml = serializeQtiUsageData(document);

  expect(xml).toContain('xmlns="http://www.imsglobal.org/xsd/imsqti_usagedata_v3p0"');

  const verdict = await validateQtiXmlContent(xml);

  expect(verdict.status).toBe("valid");
  expect(verdict.normalizedDocument).toEqual(document);
});

test("the corpus usage data instance survives import → export → import unchanged", async () => {
  const imported = await validateQtiXmlFile(path.join(corpusRoot, "qtiv3-examples/usageData/example.xml"));

  expect(imported.status).toBe("valid");

  const xml = serializeQtiUsageData(imported.normalizedDocument as QtiUsageDataDocument);
  const reimported = await validateQtiXmlContent(xml);

  expect(reimported.status).toBe("valid");
  expect(reimported.normalizedDocument).toEqual(imported.normalizedDocument);
});
