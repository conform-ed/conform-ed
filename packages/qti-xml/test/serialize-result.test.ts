/**
 * QTI Results Reporting XML serialization — the EXPORT side of RR certification:
 * "The system MUST create an instance with all of the REQUIRED properties and
 * values; … The system MUST NOT create an instance that contains any proprietary
 * properties; The XML instance MUST be valid with respect to the official XSD."
 * The gate is the round trip: serialize → parse → normalize → deep-equal input.
 */

import { describe, expect, test } from "bun:test";

import type { QtiAssessmentResultDocument } from "@conform-ed/contracts/qti/v3_0_1";

import { serializeQtiAssessmentResult } from "../src";
import { validateQtiXmlContent } from "../src/node";

const document: QtiAssessmentResultDocument = {
  assessmentResult: {
    context: {
      sourcedId: "learner-1",
      sessionIdentifiers: [{ sourceId: "https://example.org/delivery", identifier: "S-1" }],
    },
    testResult: {
      identifier: "T-RR",
      datestamp: "2026-06-13T10:00:00.000Z",
      responseVariables: [
        {
          identifier: "duration",
          cardinality: "single",
          baseType: "duration",
          candidateResponse: { values: [{ value: "14" }] },
        },
      ],
      outcomeVariables: [{ identifier: "TOTAL", cardinality: "single", baseType: "float", values: [{ value: "2" }] }],
    },
    itemResults: [
      {
        identifier: "I1",
        sequenceIndex: 1,
        datestamp: "2026-06-13T09:58:00.000Z",
        sessionStatus: "final",
        responseVariables: [
          {
            identifier: "numAttempts",
            cardinality: "single",
            baseType: "integer",
            candidateResponse: { values: [{ value: "1" }] },
          },
          {
            identifier: "RESPONSE",
            cardinality: "ordered",
            baseType: "identifier",
            choiceSequence: ["D", "B", "C", "A"],
            candidateResponse: { values: [{ value: "A" }, { value: "B" }] },
            correctResponse: { values: [{ value: "B" }], interpretation: "the right pick" },
          },
          {
            identifier: "COMPOSITE",
            cardinality: "record",
            candidateResponse: {
              values: [
                { value: "3", fieldIdentifier: "count", baseType: "integer" },
                { value: "yes", fieldIdentifier: "flag", baseType: "string" },
              ],
            },
          },
        ],
        outcomeVariables: [
          {
            identifier: "SCORE",
            cardinality: "single",
            baseType: "float",
            values: [{ value: "1" }],
            normalMaximum: 2,
            normalMinimum: 0,
            masteryValue: 1,
            view: ["candidate"],
            interpretation: "points",
            externalScored: "human",
            variableIdentifierRef: "RAW",
          },
        ],
        candidateComment: 'Tricky <but> "fair" & fun.',
      },
      {
        identifier: "I2",
        sequenceIndex: 2,
        datestamp: "2026-06-13T09:59:00.000Z",
        sessionStatus: "initial",
        responseVariables: [
          {
            identifier: "numAttempts",
            cardinality: "single",
            baseType: "integer",
            candidateResponse: { values: [{ value: "0" }] },
          },
        ],
      },
    ],
  },
};

describe("serializeQtiAssessmentResult", () => {
  test("the serialized instance round-trips through our parser to the identical document", async () => {
    const xml = serializeQtiAssessmentResult(document);

    expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.imsglobal.org/xsd/imsqti_result_v3p0"');

    const verdict = await validateQtiXmlContent(xml);

    expect(verdict.status).toBe("valid");
    expect(verdict.normalizedDocument).toEqual(document);
  });

  test("special characters are escaped in attributes and text", () => {
    const xml = serializeQtiAssessmentResult({
      assessmentResult: {
        context: { sourcedId: "id-1" },
        itemResults: [
          {
            identifier: "I1",
            datestamp: "2026-06-13T00:00:00.000Z",
            sessionStatus: "final",
            responseVariables: [
              {
                identifier: "RESPONSE",
                cardinality: "single",
                baseType: "string",
                candidateResponse: { values: [{ value: 'a < b & "c" > d' }] },
                correctResponse: { values: [{ value: "e" }], interpretation: 'say "e" & <smile>' },
              },
            ],
            candidateComment: "Tricky <but> fair & fun.",
          },
        ],
      },
    });

    expect(xml).toContain('a &lt; b &amp; "c" &gt; d'); // text content
    expect(xml).toContain("Tricky &lt;but&gt; fair &amp; fun.");
    expect(xml).toContain('interpretation="say &quot;e&quot; &amp; &lt;smile&gt;"'); // attribute
    expect(xml).not.toMatch(/<but>/u);
  });

  test("a sessionIdentifier serializes its sourceID attribute spelling", () => {
    const xml = serializeQtiAssessmentResult({
      assessmentResult: {
        context: { sessionIdentifiers: [{ sourceId: "https://example.org", identifier: "S-9" }] },
      },
    });

    expect(xml).toContain('sourceID="https://example.org"');
  });
});

describe("validateQtiXmlContent", () => {
  test("rejects a malformed instance with a parse error", async () => {
    const verdict = await validateQtiXmlContent("<assessmentResult");

    expect(verdict.status).toBe("unsupported"); // no detectable root
  });
});
