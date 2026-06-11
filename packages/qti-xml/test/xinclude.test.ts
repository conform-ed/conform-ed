/**
 * XInclude resolution (the corpus's shared-fragment pattern): `xi:include` elements
 * resolve relative to the including file before normalization — recursively, with
 * `xi:fallback` honoured and include cycles failing loudly as parse errors.
 */

import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateQtiXmlFile } from "../src";

const createdDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

async function makeFiles(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "conform-ed-xinclude-"));
  createdDirectories.push(directory);

  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(directory, name), content, "utf8");
  }

  return directory;
}

const itemOpen = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xi="http://www.w3.org/2001/XInclude" identifier="item-1" title="Item" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>N1</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>`;

const fragment = `<?xml version="1.0" encoding="UTF-8"?>
<div xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
  <qti-hottext-interaction response-identifier="RESPONSE" max-choices="1">
    <p>The <qti-hottext identifier="N1">fox</qti-hottext> <qti-hottext identifier="V1">jumped</qti-hottext>.</p>
  </qti-hottext-interaction>
</div>`;

function bodyContent(result: Awaited<ReturnType<typeof validateQtiXmlFile>>): unknown[] {
  const item = (result.normalizedDocument as { assessmentItem: { itemBody: { content: unknown[] } } }).assessmentItem;

  return item.itemBody.content;
}

test("xi:include splices the referenced fragment before normalization", async () => {
  const directory = await makeFiles({
    "fragment.xml": fragment,
    "item.xml": `<?xml version="1.0" encoding="UTF-8"?>
${itemOpen}
  <qti-item-body>
    <p>Select the noun.</p>
    <xi:include href="fragment.xml" parse="xml"/>
  </qti-item-body>
</qti-assessment-item>`,
  });

  const result = await validateQtiXmlFile(path.join(directory, "item.xml"));

  expect(result.issues).toEqual([]);
  expect(result.status).toBe("valid");

  const content = bodyContent(result);
  const div = content[1] as { kind: string; name?: string; children?: Array<{ kind: string }> };

  expect(div).toMatchObject({ kind: "xml", name: "div" });
  expect(div.children?.[0]).toMatchObject({ kind: "hotTextInteraction", responseIdentifier: "RESPONSE" });
});

test("includes resolve recursively relative to each including file", async () => {
  const directory = await makeFiles({
    "inner.xml": `<?xml version="1.0"?><p xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">Shared passage.</p>`,
    "outer.xml": `<?xml version="1.0"?>
<div xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include href="inner.xml"/>
</div>`,
    "item.xml": `<?xml version="1.0" encoding="UTF-8"?>
${itemOpen}
  <qti-item-body>
    <xi:include href="outer.xml"/>
    <p>Pick: <qti-hottext-interaction response-identifier="RESPONSE" max-choices="1"><p><qti-hottext identifier="N1">word</qti-hottext></p></qti-hottext-interaction></p>
  </qti-item-body>
</qti-assessment-item>`,
  });

  const result = await validateQtiXmlFile(path.join(directory, "item.xml"));

  expect(result.status).toBe("valid");

  const div = bodyContent(result)[0] as { children?: Array<{ name?: string; children?: unknown[] }> };
  expect(div.children?.[0]).toMatchObject({ kind: "xml", name: "p" });
});

test("a missing include without fallback is a parse error", async () => {
  const directory = await makeFiles({
    "item.xml": `<?xml version="1.0" encoding="UTF-8"?>
${itemOpen}
  <qti-item-body>
    <xi:include href="missing.xml"/>
  </qti-item-body>
</qti-assessment-item>`,
  });

  const result = await validateQtiXmlFile(path.join(directory, "item.xml"));

  expect(result.status).toBe("parse-error");
  expect(result.issues[0]?.message).toContain("missing.xml");
});

test("xi:fallback content is used when the include target is unreadable", async () => {
  const directory = await makeFiles({
    "item.xml": `<?xml version="1.0" encoding="UTF-8"?>
${itemOpen}
  <qti-item-body>
    <xi:include href="missing.xml">
      <xi:fallback><p>Fallback passage.</p></xi:fallback>
    </xi:include>
    <p>Pick: <qti-hottext-interaction response-identifier="RESPONSE" max-choices="1"><p><qti-hottext identifier="N1">word</qti-hottext></p></qti-hottext-interaction></p>
  </qti-item-body>
</qti-assessment-item>`,
  });

  const result = await validateQtiXmlFile(path.join(directory, "item.xml"));

  expect(result.status).toBe("valid");
  expect(bodyContent(result)[0]).toMatchObject({ kind: "xml", name: "p", children: ["Fallback passage."] });
});

test("include cycles fail loudly", async () => {
  const directory = await makeFiles({
    "a.xml": `<?xml version="1.0"?><div xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="b.xml"/></div>`,
    "b.xml": `<?xml version="1.0"?><div xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="a.xml"/></div>`,
    "item.xml": `<?xml version="1.0" encoding="UTF-8"?>
${itemOpen}
  <qti-item-body>
    <xi:include href="a.xml"/>
  </qti-item-body>
</qti-assessment-item>`,
  });

  const result = await validateQtiXmlFile(path.join(directory, "item.xml"));

  expect(result.status).toBe("parse-error");
  expect(result.issues[0]?.message.toLowerCase()).toContain("cycl");
});
