/**
 * Root coverage beyond items/tests/stimuli/results: "The exchange of a single
 * qti-assessment-section instance is permitted", response-processing templates are
 * exchanged standalone ("qti-response-processing - … enables the exchange of
 * best-practice response processing templates"), qti-outcome-declaration is its own
 * root, QTI metadata has its own binding, and Usage Data & Item Statistics is its
 * own specification with corpus instances. Each test validates end-to-end (parse →
 * normalize → strict contracts schema).
 */

import { expect, test } from "bun:test";
import path from "node:path";

import { validateQtiXmlContent, validateQtiXmlFile } from "../src/node";
import { corpusRoot, hasCorpus } from "./support/corpus";

// Corpus-backed tests run when the corpus is available (cloned by the test preload when
// absent — see test/support/corpus.ts) and skip gracefully otherwise.
const corpusTest = hasCorpus() ? test : test.skip;

corpusTest("a corpus response-processing template normalizes standalone", async () => {
  const result = await validateQtiXmlFile(
    path.join(corpusRoot, "qtiv3-examples/packaging/maxfiles/rptemplates/match_correct.xml"),
  );

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  const document = result.normalizedDocument as { responseProcessing: { rules: unknown[] } };

  expect(document.responseProcessing.rules.length).toBeGreaterThan(0);
});

corpusTest("all corpus response-processing templates normalize", async () => {
  const templates = [
    "qtiv3-examples/packaging/maxfiles/rptemplates/match_correct.xml",
    "qtiv3-examples/packaging/maxfiles/rptemplates/map_response.xml",
    "qtiv3-examples/packaging/ccPackage/rptemplates/CC2_map_response.xml",
    "qtiv3-examples/packaging/ccPackage/rptemplates/CC2_match.xml",
    "qtiv3-examples/packaging/ccPackage/rptemplates/CC2_match_basic.xml",
  ];

  for (const template of templates) {
    const result = await validateQtiXmlFile(path.join(corpusRoot, template));

    expect([template, result.status]).toEqual([template, "valid"]);
  }
});

corpusTest("the corpus standalone qti-outcome-declaration normalizes", async () => {
  const result = await validateQtiXmlFile(
    path.join(corpusRoot, "qtiv3-examples/packaging/CASEWithOutcome/testoutcome01.xml"),
  );

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");
  expect(result.normalizedDocument).toEqual({
    outcomeDeclaration: {
      identifier: "SCORE",
      cardinality: "single",
      baseType: "float",
      defaultValue: { values: [{ value: "0.0" }] },
    },
  });
});

test("a standalone qti-assessment-section document normalizes", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-section xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="S1" title="Standalone" visible="true">
  <qti-assessment-item-ref identifier="I1" href="items/i1.xml"/>
</qti-assessment-section>
`;

  const result = await validateQtiXmlContent(xml);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  const document = result.normalizedDocument as { assessmentSection: Record<string, unknown> };

  expect(document.assessmentSection["identifier"]).toBe("S1");
  expect(document.assessmentSection["children"]).toEqual([{ identifier: "I1", href: "items/i1.xml" }]);
});

test("a standalone qti-outcome-processing document normalizes", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-outcome-processing xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
  <qti-set-outcome-value identifier="TOTAL">
    <qti-sum><qti-test-variables variable-identifier="SCORE"/></qti-sum>
  </qti-set-outcome-value>
</qti-outcome-processing>
`;

  const result = await validateQtiXmlContent(xml);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  const document = result.normalizedDocument as { outcomeProcessing: { rules: unknown[] } };

  expect(document.outcomeProcessing.rules).toHaveLength(1);
});

test("a qtiMetadata document normalizes its camelCase binding", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qtiMetadata xmlns="http://www.imsglobal.org/xsd/imsqti_metadata_v3p0">
  <itemTemplate>false</itemTemplate>
  <timeDependent>false</timeDependent>
  <composite>true</composite>
  <interactionType>choiceInteraction</interactionType>
  <interactionType>textEntryInteraction</interactionType>
  <feedbackType>nonadaptive</feedbackType>
  <solutionAvailable>true</solutionAvailable>
  <scoringMode>responseprocessing</scoringMode>
  <toolName>XMLSPY</toolName>
  <toolVersion>5.4</toolVersion>
  <toolVendor>ALTOVA</toolVendor>
</qtiMetadata>
`;

  const result = await validateQtiXmlContent(xml);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");
  expect(result.normalizedDocument).toEqual({
    qtiMetadata: {
      itemTemplate: false,
      timeDependent: false,
      composite: true,
      interactionType: ["choiceInteraction", "textEntryInteraction"],
      feedbackType: "nonadaptive",
      solutionAvailable: true,
      scoringMode: ["responseprocessing"],
      toolName: "XMLSPY",
      toolVersion: "5.4",
      toolVendor: "ALTOVA",
    },
  });
});

corpusTest("all corpus usage data instances normalize (Usage Data & Item Statistics)", async () => {
  const instances = [
    "qtiv3-examples/usageData/example.xml",
    "qtiv3-examples/packaging/usageData/USAGE-MALE-TEST-106391.xml",
    "qtiv3-examples/packaging/usageData/USAGE-FEMALE-TEST-106391.xml",
    "qtiv3-examples/packaging/usageData/USAGE-TOTAL-TEST-106391.xml",
  ];

  for (const instance of instances) {
    const result = await validateQtiXmlFile(path.join(corpusRoot, instance));

    expect([instance, result.issues.slice(0, 1), result.status]).toEqual([instance, [], "valid"]);
  }
});

corpusTest("usage data statistics map their target objects, values, and mappings", async () => {
  const result = await validateQtiXmlFile(path.join(corpusRoot, "qtiv3-examples/usageData/example.xml"));
  const document = result.normalizedDocument as {
    usageData: { statistics: Array<Record<string, unknown>> };
  };

  const first = document.usageData.statistics[0]!;

  expect(first["kind"]).toBe("ordinaryStatistic");
  expect(first["name"]).toBe("AIS");
  expect(first["context"]).toBe("http://ntweb.ets.org/itemStats/Context/XVZ2004_J1B");
  expect(first["caseCount"]).toBe(689325);
  expect(first["stdError"]).toBe(0.0022);
  expect(first["lastUpdated"]).toBe("2004-07-04");
  expect(first["targetObjects"]).toEqual([{ identifier: "Item_VB123456" }]);
  expect(first["value"]).toEqual({ value: "0.87" });
});

corpusTest("every corpus QTI 3 manifest normalizes (packaging)", async () => {
  const { readdir } = await import("node:fs/promises");
  const manifests: string[] = [];

  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name === "imsmanifest.xml") {
        manifests.push(full);
      }
    }
  }

  await walk(path.join(corpusRoot, "qtiv3-examples"));
  expect(manifests.length).toBeGreaterThanOrEqual(24);

  for (const manifest of manifests) {
    const result = await validateQtiXmlFile(manifest);

    expect([manifest.slice(corpusRoot.length), result.issues.slice(0, 1), result.status]).toEqual([
      manifest.slice(corpusRoot.length),
      [],
      "valid",
    ]);
  }
});

corpusTest("manifest resources map type, href, files, dependencies, and inline qtiMetadata", async () => {
  const result = await validateQtiXmlFile(path.join(corpusRoot, "qtiv3-examples/packaging/metaData/imsmanifest.xml"));

  expect(result.status).toBe("valid");

  const document = result.normalizedDocument as {
    manifest: {
      identifier: string;
      metadata: { schema: string; schemaVersion: string };
      resources: Array<Record<string, unknown>>;
    };
  };

  expect(document.manifest.metadata.schema).toBe("QTI Package");
  expect(document.manifest.metadata.schemaVersion).toBe("3.0.0");

  const choice = document.manifest.resources.find((resource) => resource["identifier"] === "choice")!;

  expect(choice["type"]).toBe("imsqti_item_xmlv3p0");
  expect(choice["href"]).toBe("choice.xml");
  expect((choice["metadata"] as { qtiMetadata?: Record<string, unknown> }).qtiMetadata).toEqual({
    timeDependent: false,
    interactionType: ["choiceInteraction"],
    feedbackType: "nonadaptive",
    solutionAvailable: true,
    toolName: "XMLSPY",
    toolVersion: "5.4",
    toolVendor: "ALTOVA",
  });
});

corpusTest("shared-stimulus manifest dependencies survive normalization", async () => {
  const result = await validateQtiXmlFile(
    path.join(corpusRoot, "qtiv3-examples/packaging/sharedStimulus/imsmanifest.xml"),
  );

  const document = result.normalizedDocument as { manifest: { resources: Array<Record<string, unknown>> } };
  const item = document.manifest.resources.find((resource) => resource["identifier"] === "Item1")!;

  expect(item["dependencies"]).toEqual([{ identifierRef: "Stimulus1" }]);
  expect((item["files"] as unknown[]).length).toBe(1);
});

test("CAT adaptive selection on a section normalizes (§2.8.4)", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-section xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="S-CAT" title="Adaptive" visible="true">
  <qti-adaptive-selection>
    <qti-adaptive-engine-ref identifier="engine" href="https://cat.example.org/engine"/>
    <qti-adaptive-settings-ref identifier="settings" href="settings.json"/>
    <qti-usagedata-ref identifier="usage" href="usage.xml"/>
  </qti-adaptive-selection>
  <qti-assessment-item-ref identifier="I1" href="items/i1.xml"/>
</qti-assessment-section>
`;

  const result = await validateQtiXmlContent(xml);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  const document = result.normalizedDocument as { assessmentSection: Record<string, unknown> };

  expect(document.assessmentSection["adaptiveSelection"]).toEqual({
    adaptiveEngineRef: { identifier: "engine", href: "https://cat.example.org/engine" },
    adaptiveSettingsRef: { identifier: "settings", href: "settings.json" },
    usagedataRef: { identifier: "usage", href: "usage.xml" },
  });
});

test("test-level rubric blocks normalize (qti-assessment-test children)", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="T1" title="Test">
  <qti-rubric-block view="candidate" use="instructions">
    <qti-content-body><p>Whole-test instructions.</p></qti-content-body>
  </qti-rubric-block>
  <qti-test-part identifier="P1" navigation-mode="linear" submission-mode="individual">
    <qti-assessment-section identifier="S1" title="One" visible="true">
      <qti-assessment-item-ref identifier="I1" href="i1.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>
`;

  const result = await validateQtiXmlContent(xml);

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  const document = result.normalizedDocument as { assessmentTest: { rubricBlocks?: unknown[] } };

  expect(document.assessmentTest.rubricBlocks).toHaveLength(1);
});
