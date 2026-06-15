/**
 * CC decompose (ADR-0022, conform-ed slice 2). Builds a Common Cartridge in-memory with fflate,
 * then asserts the decomposer recovers the version, organization tree, and resource
 * classification — and that a decomposed QTI resource feeds straight into the slice-1 bridge.
 */

import { expect, test } from "bun:test";

import { strToU8, zipSync } from "fflate";

import { convertCcQtiV1ToV3 } from "@conform-ed/qti-xml";

import { classifyCcResourceType, decomposeCommonCartridge } from "../src";

const questestinterop = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="quiz1" title="Module 1 Quiz">
    <section ident="root_section">
      <item ident="q1" title="Capital">
        <itemmetadata><qtimetadata>
          <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        </qtimetadata></itemmetadata>
        <presentation>
          <material><mattext texttype="text/plain">Capital of France?</mattext></material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              <response_label ident="a"><material><mattext texttype="text/plain">Paris</mattext></material></response_label>
              <response_label ident="b"><material><mattext texttype="text/plain">Rome</mattext></material></response_label>
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes><decvar varname="SCORE" vartype="Decimal" maxvalue="100"/></outcomes>
          <respcondition><conditionvar><varequal respident="response1">a</varequal></conditionvar><setvar varname="SCORE" action="Set">100</setvar></respcondition>
        </resprocessing>
      </item>
    </section>
  </assessment>
</questestinterop>`;

const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="cartridge1"
  xmlns="http://www.imsglobal.org/xsd/imsccv1p4/imscp_v1p2"
  xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p4/LOM/manifest">
  <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.4.0</schemaversion>
    <lomimscc:lom><lomimscc:general><lomimscc:title><lomimscc:string>Sample Course</lomimscc:string></lomimscc:title></lomimscc:general></lomimscc:lom>
  </metadata>
  <organizations>
    <organization identifier="org1" structure="rooted-hierarchy">
      <item identifier="root">
        <item identifier="m1"><title>Module 1</title>
          <item identifier="i_quiz" identifierref="r_quiz"><title>Module 1 Quiz</title></item>
          <item identifier="i_page" identifierref="r_page"><title>Reading</title></item>
          <item identifier="i_link" identifierref="r_link"><title>Useful Link</title></item>
        </item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="r_quiz" type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment" href="quiz/assessment_qti.xml">
      <file href="quiz/assessment_qti.xml"/>
      <dependency identifierref="r_quiz_dep"/>
    </resource>
    <resource identifier="r_page" type="webcontent" href="page.html"><file href="page.html"/><file href="img/diagram.png"/></resource>
    <resource identifier="r_link" type="imswl_xmlv1p3" href="link.xml"><file href="link.xml"/></resource>
    <resource identifier="r_disc" type="imsdt_xmlv1p3" href="disc.xml"><file href="disc.xml"/></resource>
    <resource identifier="r_lti" type="imsbasiclti_xmlv1p0" href="lti.xml"><file href="lti.xml"/></resource>
  </resources>
</manifest>`;

function buildCartridge(): Uint8Array {
  return zipSync({
    "imsmanifest.xml": strToU8(manifest),
    "quiz/assessment_qti.xml": strToU8(questestinterop),
    "page.html": strToU8("<html><body><h1>Reading</h1></body></html>"),
    "img/diagram.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    "link.xml": strToU8('<webLink><url href="https://example.org"/></webLink>'),
    "disc.xml": strToU8("<topic><text>Discuss</text></topic>"),
    "lti.xml": strToU8(
      "<cartridge_basiclti_link><launch_url>https://tool.example</launch_url></cartridge_basiclti_link>",
    ),
  });
}

test("classifies CC resource types per the routing table", () => {
  expect(classifyCcResourceType("imsqti_xmlv1p2/imscc_xmlv1p1/assessment")).toBe("qti-assessment");
  expect(classifyCcResourceType("imsqti_xmlv1p2/imscc_xmlv1p1/question-bank")).toBe("qti-question-bank");
  expect(classifyCcResourceType("webcontent")).toBe("web-content");
  expect(classifyCcResourceType("imswl_xmlv1p3")).toBe("web-link");
  expect(classifyCcResourceType("imsdt_xmlv1p3")).toBe("discussion-topic");
  expect(classifyCcResourceType("imsbasiclti_xmlv1p0")).toBe("lti-link");
  expect(classifyCcResourceType("associatedcontent/imscc_xmlv1p1/learning-application-resource")).toBe(
    "learning-application-resource",
  );
  expect(classifyCcResourceType("something/unrecognised")).toBe("unknown");
});

test("decomposes a CC 1.4 cartridge into version, title, org tree, and classified resources", () => {
  const decomposed = decomposeCommonCartridge(buildCartridge());

  expect(decomposed.version).toBe("1.4");
  expect(decomposed.title).toBe("Sample Course");

  // Org tree preserved: root → Module 1 → [quiz, page, link].
  expect(decomposed.organizations).toHaveLength(1);
  const module = decomposed.organizations[0]!.children[0]!;
  expect(module.title).toBe("Module 1");
  expect(module.children.map((child) => child.identifierref)).toEqual(["r_quiz", "r_page", "r_link"]);

  const byId = new Map(decomposed.resources.map((resource) => [resource.identifier, resource]));
  expect(byId.get("r_quiz")?.kind).toBe("qti-assessment");
  expect(byId.get("r_quiz")?.dependencies).toEqual(["r_quiz_dep"]);
  expect(byId.get("r_page")?.kind).toBe("web-content");
  expect(byId.get("r_page")?.files).toEqual(["page.html", "img/diagram.png"]);
  expect(byId.get("r_link")?.kind).toBe("web-link");
  expect(byId.get("r_disc")?.kind).toBe("discussion-topic");
  expect(byId.get("r_lti")?.kind).toBe("lti-link");

  // Raw files are recoverable for downstream routing.
  expect(decomposed.readText("page.html")).toContain("<h1>Reading</h1>");
});

test("a decomposed QTI resource feeds straight into the QTI bridge", async () => {
  const decomposed = decomposeCommonCartridge(buildCartridge());
  const quiz = decomposed.resources.find((resource) => resource.kind === "qti-assessment")!;
  const xml = decomposed.readText(quiz.href!)!;

  const converted = convertCcQtiV1ToV3(xml);
  expect(converted.status).toBe("converted");
  if (converted.status !== "converted") return;
  expect(converted.source).toBe("assessment");
  expect(converted.items).toHaveLength(1);
  expect(converted.test).toBeDefined();
});

test("throws on an archive with no manifest", () => {
  const noManifest = zipSync({ "page.html": strToU8("<html></html>") });
  expect(() => decomposeCommonCartridge(noManifest)).toThrow(/no imsmanifest/i);
});
