/**
 * Usage Data & Item Statistics XML serialization (imsqti_usagedata_v3p0) — the
 * EXPORT direction of the Usage Data specification, gated in tests by the round
 * trip through our own parser, normalizer, and strict contracts schema.
 */

import type { QtiUsageDataDocument, QtiUsageStatistic, QtiUsageTargetObject } from "@conform-ed/contracts/qti/v3_0_1";

import { XmlWriter, type AttributeValue } from "./xml-writer";

const usageDataNamespace = "http://www.imsglobal.org/xsd/imsqti_usagedata_v3p0";
const usageDataSchemaLocation = `${usageDataNamespace} https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_usagedatav3p0_v1p0.xsd`;

function writeTargetObjects(writer: XmlWriter, targetObjects: readonly QtiUsageTargetObject[]): void {
  for (const target of targetObjects) {
    writer.element("targetObject", [
      ["identifier", target.identifier],
      ["partIdentifier", target.partIdentifier],
      ["objectType", target.objectType],
    ]);
  }
}

function statisticAttributes(statistic: QtiUsageStatistic): ReadonlyArray<readonly [string, AttributeValue]> {
  return [
    ["name", statistic.name],
    ["glossary", statistic.glossary],
    ["context", statistic.context],
    ["caseCount", statistic.caseCount],
    ["stdError", statistic.stdError],
    ["stdDeviation", statistic.stdDeviation],
    ["lastUpdated", statistic.lastUpdated],
  ];
}

/** Serialize a usage data document against the official 3.0 binding. */
export function serializeQtiUsageData(document: QtiUsageDataDocument): string {
  const { usageData } = document;
  const writer = new XmlWriter();

  writer.line('<?xml version="1.0" encoding="UTF-8"?>');
  writer.element(
    "usageData",
    [
      ["xmlns", usageDataNamespace],
      ["xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"],
      ["xsi:schemaLocation", usageDataSchemaLocation],
      ["glossary", usageData.glossary],
    ],
    () => {
      for (const statistic of usageData.statistics) {
        if (statistic.kind === "ordinaryStatistic") {
          writer.element("ordinaryStatistic", statisticAttributes(statistic), () => {
            writeTargetObjects(writer, statistic.targetObjects);
            writer.element("value", [], statistic.value.value);
          });
          continue;
        }

        writer.element("categorizedStatistic", statisticAttributes(statistic), () => {
          writeTargetObjects(writer, statistic.targetObjects);
          writer.element(
            "mapping",
            [
              ["lowerBound", statistic.mapping.lowerBound],
              ["upperBound", statistic.mapping.upperBound],
              ["defaultValue", statistic.mapping.defaultValue],
            ],
            () => {
              for (const entry of statistic.mapping.mapEntries) {
                writer.element("mapEntry", [
                  ["mapKey", entry.mapKey],
                  ["mappedValue", entry.mappedValue],
                  ["caseSensitive", entry.caseSensitive],
                ]);
              }
            },
          );
        });
      }
    },
  );

  return writer.toString();
}
