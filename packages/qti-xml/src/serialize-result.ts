/**
 * QTI Results Reporting XML serialization — conform-ed's first XML writer. Takes the
 * normalized/contracts document shape and emits an instance against the official
 * binding (namespace imsqti_result_v3p0), in the XSD's element order. The export
 * conformance gate: "The system MUST create an instance with all of the REQUIRED
 * properties and values; … The XML instance MUST be valid with respect to the
 * official XSD" — guarded in tests by round-tripping the output through our own
 * parser, normalizer, and strict contracts schema.
 */

import type {
  QtiAssessmentResultDocument,
  QtiResultContextVariable,
  QtiResultItemResult,
  QtiResultOutcomeVariable,
  QtiResultResponseVariable,
  QtiResultSupport,
  QtiResultTemplateVariable,
  QtiResultTestResult,
  QtiResultValue,
} from "@conform-ed/contracts/qti/v3_0_1";

import { XmlWriter, type AttributeValue } from "./xml-writer";

const resultNamespace = "http://www.imsglobal.org/xsd/imsqti_result_v3p0";
const resultSchemaLocation = `${resultNamespace} https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_resultv3p0_v1p0.xsd`;

function writeValues(writer: XmlWriter, values: readonly QtiResultValue[] | undefined): void {
  for (const entry of values ?? []) {
    writer.element(
      "value",
      [
        ["fieldIdentifier", entry.fieldIdentifier],
        ["baseType", entry.baseType],
      ],
      entry.value,
    );
  }
}

function writeResponseVariable(writer: XmlWriter, variable: QtiResultResponseVariable): void {
  writer.element(
    "responseVariable",
    [
      ["identifier", variable.identifier],
      ["cardinality", variable.cardinality],
      ["baseType", variable.baseType],
      ["choiceSequence", variable.choiceSequence?.join(" ")],
      ["scoreStatus", variable.scoreStatus],
      ["answeredStatus", variable.answeredStatus],
    ],
    () => {
      if (variable.correctResponse) {
        writer.element("correctResponse", [["interpretation", variable.correctResponse.interpretation]], () => {
          writeValues(writer, variable.correctResponse?.values);
        });
      }

      writer.element("candidateResponse", [], () => {
        writeValues(writer, variable.candidateResponse.values);
      });
    },
  );
}

function writeOutcomeVariable(writer: XmlWriter, variable: QtiResultOutcomeVariable): void {
  const attributes: ReadonlyArray<readonly [string, AttributeValue]> = [
    ["identifier", variable.identifier],
    ["cardinality", variable.cardinality],
    ["baseType", variable.baseType],
    ["view", variable.view?.join(" ")],
    ["interpretation", variable.interpretation],
    ["longInterpretation", variable.longInterpretation],
    ["normalMaximum", variable.normalMaximum],
    ["normalMinimum", variable.normalMinimum],
    ["masteryValue", variable.masteryValue],
    ["external-scored", variable.externalScored],
    ["variable-identifier-ref", variable.variableIdentifierRef],
  ];

  if (!variable.values?.length) {
    writer.element("outcomeVariable", attributes);
    return;
  }

  writer.element("outcomeVariable", attributes, () => {
    writeValues(writer, variable.values);
  });
}

function writeContextTemplateVariable(
  writer: XmlWriter,
  name: "templateVariable" | "contextVariable",
  variable: QtiResultTemplateVariable | QtiResultContextVariable,
): void {
  const attributes: ReadonlyArray<readonly [string, AttributeValue]> = [
    ["identifier", variable.identifier],
    ["cardinality", variable.cardinality],
    ["baseType", variable.baseType],
  ];

  if (!variable.values?.length) {
    writer.element(name, attributes);
    return;
  }

  writer.element(name, attributes, () => {
    writeValues(writer, variable.values);
  });
}

function writeSupport(writer: XmlWriter, support: QtiResultSupport): void {
  writer.element("support", [
    ["name", support.name],
    ["assignment", support.assignment],
    ["value", support.value],
    ["language", support.xmlLang],
  ]);
}

function writeVariables(writer: XmlWriter, container: QtiResultTestResult | QtiResultItemResult): void {
  for (const variable of container.responseVariables ?? []) {
    writeResponseVariable(writer, variable);
  }

  for (const variable of container.templateVariables ?? []) {
    writeContextTemplateVariable(writer, "templateVariable", variable);
  }

  for (const variable of container.outcomeVariables ?? []) {
    writeOutcomeVariable(writer, variable);
  }

  for (const variable of container.contextVariables ?? []) {
    writeContextTemplateVariable(writer, "contextVariable", variable);
  }
}

/** Serialize a results document against the official 3.0 binding. */
export function serializeQtiAssessmentResult(document: QtiAssessmentResultDocument): string {
  const { assessmentResult } = document;
  const writer = new XmlWriter();

  writer.line('<?xml version="1.0" encoding="UTF-8"?>');
  writer.element(
    "assessmentResult",
    [
      ["xmlns", resultNamespace],
      ["xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"],
      ["xsi:schemaLocation", resultSchemaLocation],
    ],
    () => {
      const { context } = assessmentResult;

      if (context.sessionIdentifiers?.length) {
        writer.element("context", [["sourcedId", context.sourcedId]], () => {
          for (const session of context.sessionIdentifiers ?? []) {
            // The binding spells the attribute sourceID.
            writer.element("sessionIdentifier", [
              ["sourceID", session.sourceId],
              ["identifier", session.identifier],
            ]);
          }
        });
      } else {
        writer.element("context", [["sourcedId", context.sourcedId]]);
      }

      const { testResult } = assessmentResult;

      if (testResult) {
        writer.element(
          "testResult",
          [
            ["identifier", testResult.identifier],
            ["datestamp", testResult.datestamp],
          ],
          () => {
            writeVariables(writer, testResult);

            for (const support of testResult.supports ?? []) {
              writeSupport(writer, support);
            }
          },
        );
      }

      for (const itemResult of assessmentResult.itemResults ?? []) {
        writer.element(
          "itemResult",
          [
            ["identifier", itemResult.identifier],
            ["sequenceIndex", itemResult.sequenceIndex],
            ["datestamp", itemResult.datestamp],
            ["sessionStatus", itemResult.sessionStatus],
          ],
          () => {
            writeVariables(writer, itemResult);

            // The XSD sequence puts candidateComment after the variables.
            if (itemResult.candidateComment !== undefined) {
              writer.element("candidateComment", [], itemResult.candidateComment);
            }

            for (const support of itemResult.supports ?? []) {
              writeSupport(writer, support);
            }
          },
        );
      }
    },
  );

  return writer.toString();
}
