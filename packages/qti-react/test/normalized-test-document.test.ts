import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { serializeQtiAssessmentTest, validateQtiXmlContent } from "@conform-ed/qti-xml";

import { assessmentTestDocumentFromView, assessmentTestViewFromNormalized } from "../src/headless";

/**
 * `assessmentTestDocumentFromView` is the inverse of `assessmentTestViewFromNormalized`.
 * The invariant it must hold: a view, projected back to a document and serialized, re-ingests
 * to the SAME view — view → document → XML → normalize → view is idempotent. That proves the
 * inverse faithfully reproduces everything the view carries (the field renames children↔
 * expressions, actions↔rules, assessmentSections↔children, category↔categories, the
 * preCondition wrapper, dropped `kind`), and that the emitted XML is valid QTI.
 *
 * (Rubric blocks live outside the test view — `assessmentTestViewFromNormalized` does not read
 * them — so a source test's rubric blocks are absent on both sides; idempotence is unaffected.)
 */

async function assertViewRoundTrips(xml: string): Promise<void> {
  const first = await validateQtiXmlContent(xml);
  expect(first.status).toBe("valid");

  const view = assessmentTestViewFromNormalized(first.normalizedDocument);
  expect(view).not.toBeNull();

  const reserialized = serializeQtiAssessmentTest(assessmentTestDocumentFromView(view!));
  const second = await validateQtiXmlContent(reserialized);
  expect(second.status).toBe("valid");

  const view2 = assessmentTestViewFromNormalized(second.normalizedDocument);
  expect(view2).toEqual(view);
}

// A real, canonical assessmentTest (nested sections, item-ref weights, an outcome-declaration,
// and outcome processing with sum/variable). Source: 1EdTech qti-examples tests/rtest02.xml.
const RTEST02_XML = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="RTEST-02" title="Arbitrary Collections of Item Outcomes">
    <qti-outcome-declaration base-type="float" cardinality="single" identifier="SCORE"/>
    <qti-test-part navigation-mode="nonlinear" submission-mode="simultaneous" identifier="RTEST-02-A">
        <qti-assessment-section identifier="sectionA" title="Section A" visible="true">
            <qti-assessment-item-ref identifier="item034" href="item034.xml">
                <qti-weight identifier="WEIGHT" value="2"/>
            </qti-assessment-item-ref>
            <qti-assessment-item-ref identifier="item160" href="item160.xml">
                <qti-weight identifier="WEIGHT" value="0"/>
            </qti-assessment-item-ref>
        </qti-assessment-section>
        <qti-assessment-section identifier="sectionB" title="Section B" visible="true">
            <qti-assessment-item-ref identifier="item434" href="item434.xml"/>
            <qti-assessment-section identifier="sectionB1" title="Section B1" visible="false">
                <qti-assessment-item-ref identifier="item347" href="item347.xml">
                    <qti-weight identifier="WEIGHT" value="0.5"/>
                </qti-assessment-item-ref>
            </qti-assessment-section>
        </qti-assessment-section>
    </qti-test-part>
    <qti-outcome-processing>
        <qti-set-outcome-value identifier="SCORE">
            <qti-sum>
                <qti-variable identifier="item034.SCORE" weight-identifier="WEIGHT"/>
                <qti-variable identifier="item160.SCORE" weight-identifier="WEIGHT"/>
            </qti-sum>
        </qti-set-outcome-value>
    </qti-outcome-processing>
</qti-assessment-test>`;

test("view→document→view is idempotent for a nested, weighted, outcome-processed test", async () => {
  await assertViewRoundTrips(RTEST02_XML);
});

// Full official corpus (opt-in): every assessmentTest the engine normalizes must survive the
// view→document→view round trip. Runs when the corpus is checked out (the conform-ed pattern).
const corpusTestsDir = path.join(
  process.env["QTI_CORPUS_DIR"] ?? path.join(import.meta.dir, "..", "..", "..", "tmp", "qti-examples"),
  "qtiv3-examples",
  "tests",
);
const corpusPresent = existsSync(corpusTestsDir);
const corpusTest = corpusPresent ? test : test.skip;

corpusTest("view→document→view is idempotent across the official tests/ corpus", async () => {
  const files = readdirSync(corpusTestsDir).filter((name) => name.endsWith(".xml"));
  let checked = 0;
  for (const file of files) {
    const xml = readFileSync(path.join(corpusTestsDir, file), "utf8");
    const first = await validateQtiXmlContent(xml);
    // Some corpus "tests/" files are fragments/sets that don't normalize to a whole test; skip
    // anything that isn't a valid assessmentTest, exercise the rest.
    if (first.status !== "valid") {
      continue;
    }
    const view = assessmentTestViewFromNormalized(first.normalizedDocument);
    if (!view) {
      continue;
    }
    const reserialized = serializeQtiAssessmentTest(assessmentTestDocumentFromView(view));
    const second = await validateQtiXmlContent(reserialized);
    expect(second.status, file).toBe("valid");
    expect(assessmentTestViewFromNormalized(second.normalizedDocument), file).toEqual(view);
    checked += 1;
  }
  expect(checked).toBeGreaterThan(0);
});
