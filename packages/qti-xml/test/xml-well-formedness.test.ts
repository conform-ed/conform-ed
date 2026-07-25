/**
 * Well-formedness gate coverage for the XML syntax validator that fronts every parse.
 *
 * These pins exist because the validator behind `parseXmlDocument` has been swapped once
 * already (fast-xml-parser's `XMLValidator` → `fast-xml-validator`'s `SyntaxValidator` →
 * back again) and the two libraries do NOT share a contract: fast-xml-validator *throws*
 * a `ValidationError`, fast-xml-parser *returns* `true | { err }`. Nothing downstream may
 * depend on which one is wired in, so the observable behaviour is pinned here: malformed
 * XML must surface as a `parse-error` validation result (never an escaping throw), and
 * the inventory must classify it as `malformed`.
 *
 * Messages are deliberately NOT pinned — only that a non-empty one reaches the caller.
 */

import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildQtiExampleInventory, validateQtiXmlContent } from "../src/node";

const asiNamespaceUri = "http://www.imsglobal.org/xsd/imsqtiasi_v3p0";

/** A detectable, schema-selectable QTI 3 root, so validation reaches the syntax gate. */
function qtiItemXml(body: string, identifier = "malformed"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="${asiNamespaceUri}" identifier="${identifier}" title="Malformed" adaptive="false" time-dependent="false">${body}</qti-assessment-item>
`;
}

const mismatchedCloseTagXml = qtiItemXml("<a></b>");

const unquotedAttributeXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="${asiNamespaceUri}" identifier=unquoted title="Unquoted" adaptive="false" time-dependent="false"/>
`;

/**
 * Two sibling roots. `detectQtiRoot` only ever looks at the first element, so without a
 * real syntax gate this reads as a plain QTI item and the second root is silently
 * dropped by the tolerant parser. Rejecting it is the deliberate policy (XML has exactly
 * one document element) — fast-xml-validator 1.4.0 returns `true` here, which is why this
 * pin exists.
 */
const multipleRootsXml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="${asiNamespaceUri}" identifier="one" title="One"></qti-assessment-item>
<qti-assessment-item xmlns="${asiNamespaceUri}" identifier="two" title="Two"></qti-assessment-item>
`;

const createdDirectories: string[] = [];

async function createTempFixtureDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "conform-ed-qti-wellformed-"));
  createdDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

test("validateQtiXmlContent reports a parse error for a mismatched closing tag", async () => {
  const result = await validateQtiXmlContent(mismatchedCloseTagXml);

  expect(result.status).toBe("parse-error");
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.message).toBeString();
  expect(result.issues[0]?.message.length).toBeGreaterThan(0);
});

test("validateQtiXmlContent reports a parse error for an unquoted attribute value", async () => {
  const result = await validateQtiXmlContent(unquotedAttributeXml);

  expect(result.status).toBe("parse-error");
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.message).toBeString();
  expect(result.issues[0]?.message.length).toBeGreaterThan(0);
});

test("validateQtiXmlContent rejects a document with more than one root element", async () => {
  const result = await validateQtiXmlContent(multipleRootsXml);

  expect(result.status).toBe("parse-error");
  expect(result.issues[0]?.message.length).toBeGreaterThan(0);
});

test("buildQtiExampleInventory marks a malformed XML example as malformed", async () => {
  const directory = await createTempFixtureDir();
  await mkdir(path.join(directory, "qtiv3-examples", "items"), { recursive: true });
  await writeFile(path.join(directory, "qtiv3-examples", "items", "malformed.xml"), mismatchedCloseTagXml, "utf8");

  const report = await buildQtiExampleInventory(directory);
  const entry = report.entries.find((candidate) => candidate.relativePath === "qtiv3-examples/items/malformed.xml");

  expect(entry?.xmlStatus).toBe("malformed");
  expect(entry?.supportStatus).toBe("unsupported-root");
  expect(entry?.note).toBe("XML is not well formed.");
});
