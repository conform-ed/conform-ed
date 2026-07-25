/**
 * PIF (Package Interchange Format) ingestion: a QTI 3 content package is distributed
 * as a ZIP with imsmanifest.xml at its root.
 *
 * - validateQtiPackageArchive validates in-memory bytes (XML-only inflation) — the
 *   convenience path for modest packages; fixtures are built in-memory with fflate.
 * - validateQtiPackagePath streams a ZIP file from disk, materializing only the XML
 *   into a temp directory (bounded memory, xi:include resolved). Those tests write a
 *   real ZIP to the OS temp dir and clean it up — legitimate runtime/test I/O.
 */

import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { zipSync, strToU8 } from "fflate";

import { validateQtiPackageArchive, validateQtiPackagePath } from "../src/node";

/** Build a ZIP, write it to a throwaway temp file, run `fn`, then remove the dir. */
async function withZipFile(entries: Record<string, Uint8Array>, fn: (zipPath: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "qti-pif-test-"));
  try {
    const zipPath = path.join(dir, "package.zip");
    await writeFile(zipPath, zipSync(entries));
    await fn(zipPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const asiHeader =
  'xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

const choiceItem = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item ${asiHeader} identifier="item1" title="Item 1" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

function manifest(resourceXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="MANIFEST-1">
  <metadata>
    <schema>QTI Package</schema>
    <schemaversion>3.0.0</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    ${resourceXml}
  </resources>
</manifest>`;
}

const itemResource = `<resource identifier="item1" type="imsqti_item_xmlv3p0" href="items/item1.xml">
      <file href="items/item1.xml"/>
    </resource>`;

test("a well-formed PIF archive validates", async () => {
  const zip = zipSync({
    "imsmanifest.xml": strToU8(manifest(itemResource)),
    "items/item1.xml": strToU8(choiceItem),
  });

  const result = await validateQtiPackageArchive(zip);

  expect(result.status).toBe("valid");
  expect(result.issues).toEqual([]);
  expect(result.referencedDocumentResults).toHaveLength(1);
  expect(result.referencedDocumentResults[0]?.status).toBe("valid");
});

test("an archive without imsmanifest.xml at the root is unsupported", async () => {
  const zip = zipSync({ "items/item1.xml": strToU8(choiceItem) });

  const result = await validateQtiPackageArchive(zip);

  expect(result.status).toBe("unsupported");
  expect(result.issues[0]?.message).toContain("imsmanifest.xml");
});

test("a manifest referencing a missing file is invalid", async () => {
  const zip = zipSync({ "imsmanifest.xml": strToU8(manifest(itemResource)) });

  const result = await validateQtiPackageArchive(zip);

  expect(result.status).toBe("invalid");
  expect(result.issues.some((issue) => issue.message.includes("items/item1.xml"))).toBe(true);
});

test("a referenced document that is itself invalid surfaces in the package result", async () => {
  const brokenItem = choiceItem.replace('identifier="item1"', "");
  const zip = zipSync({
    "imsmanifest.xml": strToU8(manifest(itemResource)),
    "items/item1.xml": strToU8(brokenItem),
  });

  const result = await validateQtiPackageArchive(zip);

  expect(result.status).toBe("invalid");
  expect(result.referencedDocumentResults[0]?.status).not.toBe("valid");
});

test("bytes that are not a ZIP archive are unsupported", async () => {
  const result = await validateQtiPackageArchive(strToU8("<not-a-zip/>"));

  expect(result.status).toBe("unsupported");
  expect(result.issues[0]?.message.toLowerCase()).toContain("zip");
});

test("a PIF ZIP file validates when streamed from disk, and media is ignored", async () => {
  await withZipFile(
    {
      "imsmanifest.xml": strToU8(manifest(itemResource)),
      "items/item1.xml": strToU8(choiceItem),
      // A large non-XML 'media' entry that must never be inflated for validation.
      "media/picture.bin": new Uint8Array(2_000_000),
    },
    async (zipPath) => {
      const result = await validateQtiPackagePath(zipPath);

      expect(result.status).toBe("valid");
      expect(result.referencedDocumentResults).toHaveLength(1);
      // Reported paths are re-anchored to the package, not the temp dir.
      expect(result.packagePath).toBe(path.resolve(zipPath));
      expect(result.manifestPath).toContain("package.zip");
    },
  );
});

test("streaming the ZIP file resolves xi:include across entries", async () => {
  // The exploded-directory route the streaming path reuses resolves shared fragments;
  // the in-memory bytes route cannot. This is the correctness win of disk extraction.
  const itemWithInclude = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item ${asiHeader} xmlns:xi="http://www.w3.org/2001/XInclude" identifier="inc" title="Inc" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <xi:include href="../shared/body.xml"/>
  </qti-item-body>
</qti-assessment-item>`;
  const sharedFragment = `<?xml version="1.0" encoding="UTF-8"?>
<div xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"><p>Shared prompt.</p></div>`;
  // The shared fragment is a dependency consumed via xi:include, not a standalone QTI
  // document, so it is not a manifest-listed resource file (a <div>-rooted fragment is
  // correctly "unsupported" on its own). It still ships in the ZIP for resolution.
  const resource = `<resource identifier="inc" type="imsqti_item_xmlv3p0" href="items/inc.xml">
      <file href="items/inc.xml"/>
    </resource>`;

  await withZipFile(
    {
      "imsmanifest.xml": strToU8(manifest(resource)),
      "items/inc.xml": strToU8(itemWithInclude),
      "shared/body.xml": strToU8(sharedFragment),
    },
    async (zipPath) => {
      const result = await validateQtiPackagePath(zipPath);

      expect(result.status).toBe("valid");
      const item = result.referencedDocumentResults.find((document) => document.filePath.endsWith("inc.xml"));
      expect(item?.status).toBe("valid");
    },
  );
});

test("a file that is not a ZIP archive is unsupported on the path route", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "qti-pif-test-"));
  try {
    const notZip = path.join(dir, "package.zip");
    await writeFile(notZip, "<not-a-zip/>");

    const result = await validateQtiPackagePath(notZip);

    expect(result.status).toBe("unsupported");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
