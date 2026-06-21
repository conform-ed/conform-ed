/**
 * CC compose (the producer side — the inverse of decompose). Builds a neutral `ComposableCartridge`,
 * composes it to `.imscc` bytes, and asserts `decomposeCommonCartridge` recovers the same version,
 * title, organization tree, resources (types / hrefs / files / dependencies / CASE-alignment GUIDs)
 * and file bytes — the compose→decompose identity. Also asserts the conformance gate (a
 * profile-forbidden manifest throws) and that the archive is deterministic.
 */

import { expect, test } from "bun:test";

import { strFromU8, strToU8 } from "fflate";

import {
  type ComposableCartridge,
  composeCommonCartridge,
  decomposeCommonCartridge,
  serializeCommonCartridgeManifest,
} from "../src";

const qtiPackageBytes = strToU8('<?xml version="1.0"?><assessmentTest/>');
const webContentBytes = strToU8("<html><body>Reading</body></html>");
const webLinkBytes = strToU8('<webLink><url href="https://example.com"/></webLink>');

function sampleCartridge(): ComposableCartridge {
  return {
    identifier: "course-1",
    title: "My Course",
    organizations: [
      {
        identifier: "unit-1",
        title: "Unit 1",
        children: [
          { identifier: "act-a", identifierref: "res-a", title: "Quiz" },
          { identifier: "act-b", identifierref: "res-b", title: "Reading" },
        ],
      },
      { identifier: "act-c", identifierref: "res-c", title: "External link" },
    ],
    resources: [
      {
        identifier: "res-a",
        type: "imsqti_zipv3p0",
        href: "assessments/res-a/imsmanifest.xml",
        standardsGuids: ["GUID-ALPHA", "GUID-BETA"],
        files: [{ href: "assessments/res-a/imsmanifest.xml", bytes: qtiPackageBytes }],
      },
      {
        identifier: "res-b",
        type: "webcontent",
        href: "web/reading.html",
        files: [{ href: "web/reading.html", bytes: webContentBytes }],
      },
      {
        identifier: "res-c",
        // imswl forbids an href under the CC 1.4 profile — the link target lives in the file.
        type: "imswl_xmlv1p4",
        files: [{ href: "weblinks/res-c.xml", bytes: webLinkBytes }],
      },
    ],
  };
}

test("compose → decompose round-trips the structure, resources and files", () => {
  const decomposed = decomposeCommonCartridge(composeCommonCartridge(sampleCartridge()));

  expect(decomposed.version).toBe("1.4");
  expect(decomposed.title).toBe("My Course");

  // The organization tree decomposes under the implicit rooted-hierarchy root item.
  const root = decomposed.organizations[0]!;
  expect(root.children.map((item) => item.identifier)).toEqual(["unit-1", "act-c"]);
  const unit1 = root.children[0]!;
  expect(unit1.title).toBe("Unit 1");
  expect(unit1.children.map((item) => [item.identifier, item.identifierref, item.title])).toEqual([
    ["act-a", "res-a", "Quiz"],
    ["act-b", "res-b", "Reading"],
  ]);

  const resourcesById = new Map(decomposed.resources.map((resource) => [resource.identifier, resource]));
  const qti = resourcesById.get("res-a")!;
  expect(qti.type).toBe("imsqti_zipv3p0");
  expect(qti.kind).toBe("qti-assessment");
  expect(qti.href).toBe("assessments/res-a/imsmanifest.xml");
  expect(qti.files).toEqual(["assessments/res-a/imsmanifest.xml"]);
  expect(qti.standardsGuids).toEqual(["GUID-ALPHA", "GUID-BETA"]);

  const link = resourcesById.get("res-c")!;
  expect(link.type).toBe("imswl_xmlv1p4");
  expect(link.kind).toBe("web-link");
  expect(link.href).toBeUndefined();

  // The file bytes survive verbatim.
  expect(strFromU8(decomposed.files["web/reading.html"]!)).toBe("<html><body>Reading</body></html>");
  expect(strFromU8(decomposed.files["assessments/res-a/imsmanifest.xml"]!)).toBe(
    '<?xml version="1.0"?><assessmentTest/>',
  );
});

test("composeCommonCartridge is deterministic", () => {
  const first = composeCommonCartridge(sampleCartridge());
  const second = composeCommonCartridge(sampleCartridge());
  expect(first).toEqual(second);
});

test("the manifest declares the CC 1.4 namespace and schema version", () => {
  const manifest = serializeCommonCartridgeManifest(sampleCartridge());
  expect(manifest).toContain("imsccv1p4");
  expect(manifest).toContain("<schemaversion>1.4.0</schemaversion>");
});

test("the conformance gate rejects a profile-forbidden manifest (imswl with an href)", () => {
  const cartridge = sampleCartridge();
  const offending = {
    ...cartridge,
    resources: cartridge.resources.map((resource) =>
      resource.identifier === "res-c" ? { ...resource, href: "weblinks/res-c.xml" } : resource,
    ),
  };
  expect(() => composeCommonCartridge(offending)).toThrow(/conformant CC 1\.4 manifest/);
});
