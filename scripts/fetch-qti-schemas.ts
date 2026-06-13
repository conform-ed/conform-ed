/**
 * Materializes the official QTI 3 ASI XSD plus the dependency schemas the
 * XSD-conformance lane (packages/qti-xml/test/xsd-conformance.local.test.ts) needs,
 * into tmp/qti/3.0.1 (never committed — tmp/** is gitignored). The lane skips when the
 * schemas are absent; this script is what makes it run, locally or in a scheduled CI
 * lane. Idempotent.
 *
 * Two dependency schemas are deliberately replaced with lax stubs, because libxml2
 * (xmllint-wasm) cannot compile the official ones (documented in ADR-0011):
 *   - SSML 1.1 (synthesis namespace) declares its elements via xs:redefine, which
 *     libxml2 does not fully support;
 *   - MathML 3 uses content models libxml2's compiler rejects, and QTI references only
 *     the <math> root element anyway.
 * QTI structure is still validated strictly against the official ASI XSD; only these
 * embedded annotation namespaces are treated laxly.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const schemaDir = resolve(repoRoot, "tmp/qti/3.0.1");
const depsDir = resolve(schemaDir, "xsd-deps");
const otherDir = resolve(repoRoot, "tmp/qti/2.2/other");

const purl = "https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd";
const w3 = "https://purl.imsglobal.org/spec/w3/2001/schema/xsd";

const asiSchemaName = "imsqti_asiv3p0p1_v1p0.xsd";

async function fetchTo(url: string, target: string): Promise<void> {
  if (existsSync(target)) {
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}): ${url}`);
  }
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(`fetched ${url} -> ${target}`);
}

/** Read an XSD, decoding the UTF-16 vendored files (e.g. XInclude.xsd) to UTF-8. */
async function readXsd(path: string): Promise<string> {
  const bytes = await readFile(path);
  return bytes[0] === 0xff && bytes[1] === 0xfe
    ? new TextDecoder("utf-16le").decode(bytes).replace(/^﻿/u, "")
    : bytes.toString("utf8");
}

const ssmlStub = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Lax stand-in for SSML 1.1; see ADR-0011 and fetch-qti-schemas.ts header. -->
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="http://www.w3.org/2001/10/synthesis"
           elementFormDefault="qualified">
${["audio", "break", "emphasis", "mark", "p", "phoneme", "prosody", "s", "say-as", "speak", "sub", "voice"]
  .map((name) => `  <xs:element name="${name}" type="xs:anyType"/>`)
  .join("\n")}
</xs:schema>
`;

const mathmlStub = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Lax stand-in for MathML 3; see ADR-0011 and fetch-qti-schemas.ts header. -->
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="http://www.w3.org/1998/Math/MathML"
           elementFormDefault="qualified">
  <xs:element name="math" type="xs:anyType"/>
</xs:schema>
`;

async function main(): Promise<number> {
  await mkdir(depsDir, { recursive: true });

  // The official ASI schema (large; fetched once if absent).
  await fetchTo(`${purl}/${asiSchemaName}`, resolve(schemaDir, asiSchemaName));

  // xml.xsd: copy the vendored one if present, else fetch.
  const xmlTarget = resolve(depsDir, "xml.xsd");
  if (!existsSync(xmlTarget)) {
    const vendoredXml = resolve(otherDir, "xml.xsd");
    if (existsSync(vendoredXml)) {
      await writeFile(xmlTarget, await readFile(vendoredXml));
    } else {
      await fetchTo(`${w3}/xml.xsd`, xmlTarget);
    }
  }

  // XInclude.xsd: the vendored copy is UTF-16; re-encode to UTF-8 for libxml2.
  const xincludeTarget = resolve(depsDir, "XInclude.xsd");
  if (!existsSync(xincludeTarget)) {
    const vendoredXInclude = resolve(otherDir, "XInclude.xsd");
    if (existsSync(vendoredXInclude)) {
      await writeFile(xincludeTarget, await readXsd(vendoredXInclude));
    } else {
      await fetchTo(`${w3}/XInclude.xsd`, xincludeTarget);
    }
  }

  // Lax stubs for the namespaces libxml2 cannot compile (see header).
  await writeFile(resolve(depsDir, "ssmlv1p1-core.xsd"), ssmlStub);
  await writeFile(resolve(depsDir, "mathml3.xsd"), mathmlStub);

  console.log(`QTI 3 schema set ready: ${schemaDir}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
