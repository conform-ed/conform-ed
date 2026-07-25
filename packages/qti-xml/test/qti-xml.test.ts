import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { detectQtiRoot } from "../src";
import { buildQtiExampleInventory, validateQtiXmlFile } from "../src/node";

const createdDirectories: string[] = [];

const qti22ChoiceItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice" title="Choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>Choose one option.</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Pick the correct answer.</prompt>
      <simpleChoice identifier="ChoiceA">A</simpleChoice>
      <simpleChoice identifier="ChoiceB">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>
`;

const qti22ManifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="manifest-1">
  <metadata>
    <schema>QTIv2.2 Package</schema>
    <schemaversion>1.0.0</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv2p2" href="choice.xml">
      <file href="choice.xml"/>
    </resource>
  </resources>
</manifest>
`;

const qti301ChoiceItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="Choice" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>ChoiceA</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>Choose one option.</p>
    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
      <qti-prompt>Pick the correct answer.</qti-prompt>
      <qti-simple-choice identifier="ChoiceA">A</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://www.imsglobal.org/question/qti_v3p0/rptemplates/match_correct.xml"/>
</qti-assessment-item>
`;

const qti301TestXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="TEST-1" title="Choice Test">
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>
  <qti-time-limits max-time="3600" min-time="60"/>
  <qti-test-part identifier="PART-1" navigation-mode="linear" submission-mode="individual">
    <qti-item-session-control allow-review="false" max-attempts="1" show-feedback="true" show-solution="false"/>
    <qti-assessment-section identifier="SECTION-1" title="Main" visible="true">
      <qti-pre-condition>
        <qti-match>
          <qti-variable identifier="switch.RESPONSE"/>
          <qti-base-value base-type="identifier">A</qti-base-value>
        </qti-match>
      </qti-pre-condition>
      <qti-assessment-item-ref identifier="ITEM-1" href="choice.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>
`;

const qti301ResultXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentResult xmlns="http://www.imsglobal.org/xsd/imsqti_result_v3p0">
  <context sourcedId="candidate-1">
    <sessionIdentifier sourceID="https://example.test" identifier="SESSION-1"/>
  </context>
  <testResult identifier="TEST-1" datestamp="2026-05-28T00:00:00Z">
    <responseVariable identifier="duration" cardinality="single" baseType="duration">
      <candidateResponse>
        <value>100</value>
      </candidateResponse>
    </responseVariable>
    <outcomeVariable identifier="SCORE" cardinality="single" baseType="float">
      <value>1</value>
    </outcomeVariable>
  </testResult>
  <itemResult identifier="ITEM-1" datestamp="2026-05-28T00:00:00Z" sessionStatus="final">
    <responseVariable identifier="RESPONSE" cardinality="single" baseType="identifier">
      <candidateResponse>
        <value>ChoiceA</value>
      </candidateResponse>
    </responseVariable>
    <outcomeVariable identifier="SCORE" cardinality="single" baseType="float">
      <value>1</value>
    </outcomeVariable>
  </itemResult>
</assessmentResult>
`;

async function createTempFixtureDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "conform-ed-qti-xml-"));
  createdDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

test("detectQtiRoot infers version and schema keys", () => {
  const qti22Item = detectQtiRoot(qti22ChoiceItemXml);
  const qti301Test = detectQtiRoot(qti301TestXml);

  expect(qti22Item?.inferredVersion).toBe("2.2");
  expect(qti22Item?.schemaSelectionKey).toBe("qtiAssessmentItemDocument");
  expect(qti301Test?.inferredVersion).toBe("3.0.1");
  expect(qti301Test?.schemaSelectionKey).toBe("qtiAssessmentTestDocument");
});

test("validateQtiXmlFile validates the initial supported QTI example roots", async () => {
  const directory = await createTempFixtureDir();
  const files = [
    ["choice-v2.xml", qti22ChoiceItemXml],
    ["manifest-v2.xml", qti22ManifestXml],
    ["choice-v3.xml", qti301ChoiceItemXml],
    ["test-v3.xml", qti301TestXml],
    ["result-v3.xml", qti301ResultXml],
  ] as const;

  await Promise.all(files.map(([name, content]) => writeFile(path.join(directory, name), content, "utf8")));

  const results = await Promise.all(files.map(([name]) => validateQtiXmlFile(path.join(directory, name))));

  for (const result of results) {
    expect(result.status).toBe("valid");
    expect(result.issues).toHaveLength(0);
  }
});

test("validateQtiXmlFile normalizes standalone section roots (every registered root normalizes)", async () => {
  const directory = await createTempFixtureDir();
  const sectionPath = path.join(directory, "section-v3.xml");
  await writeFile(
    sectionPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-section xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="SECTION-1" title="Main" visible="true"/>
`,
    "utf8",
  );

  const result = await validateQtiXmlFile(sectionPath);

  expect(result.status).toBe("valid");
  expect(result.schemaSelectionKey).toBe("qtiAssessmentSectionDocument");
  expect(result.normalizedDocument).toEqual({
    assessmentSection: { identifier: "SECTION-1", title: "Main", visible: true },
  });
});

test("buildQtiExampleInventory classifies supported, broken, and packaged examples", async () => {
  const directory = await createTempFixtureDir();
  await mkdir(path.join(directory, "qtiv2p2-examples", "items"), { recursive: true });
  await mkdir(path.join(directory, "qtiv3-examples", "results"), { recursive: true });
  await mkdir(path.join(directory, "qtiv3-examples", "CAT"), { recursive: true });
  await mkdir(path.join(directory, "qtiv3-examples", "packaging"), { recursive: true });

  await Promise.all([
    writeFile(path.join(directory, "qtiv2p2-examples", "items", "choice.xml"), qti22ChoiceItemXml, "utf8"),
    writeFile(path.join(directory, "qtiv3-examples", "results", "report.xml"), qti301ResultXml, "utf8"),
    writeFile(
      path.join(directory, "qtiv3-examples", "CAT", "test.xml"),
      "<!DOCTYPE html><html><body>broken</body></html>",
      "utf8",
    ),
    writeFile(path.join(directory, "qtiv3-examples", "packaging", "sample.zip"), "zip-placeholder", "utf8"),
  ]);

  const report = await buildQtiExampleInventory(directory);
  const choiceEntry = report.entries.find((entry) => entry.relativePath === "qtiv2p2-examples/items/choice.xml");
  const resultEntry = report.entries.find((entry) => entry.relativePath === "qtiv3-examples/results/report.xml");
  const brokenEntry = report.entries.find((entry) => entry.relativePath === "qtiv3-examples/CAT/test.xml");
  const zipEntry = report.entries.find((entry) => entry.relativePath === "qtiv3-examples/packaging/sample.zip");

  expect(choiceEntry?.supportStatus).toBe("supported");
  expect(choiceEntry?.schemaSelectionKey).toBe("qtiAssessmentItemDocument");
  expect(resultEntry?.supportStatus).toBe("supported");
  expect(resultEntry?.schemaSelectionKey).toBe("qtiAssessmentResultDocument");
  expect(brokenEntry?.supportStatus).toBe("known-broken-example");
  expect(zipEntry?.supportStatus).toBe("zip-package");
  expect(report.summary.bySupportStatus.supported).toBe(2);
});
