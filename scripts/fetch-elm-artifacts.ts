/**
 * Vendors the official European Learning Model (ELM) v3.3 machine artifacts into
 * packages/coverage/vendor/elm/ — version-pinned and **committed** (per ADR-0013; the
 * artifacts are small, unlike the QTI XSD set which lives under tmp/). Idempotent: skips
 * files already present unless run with --force.
 *
 * Sources (the data.europa.eu/snb/* deref chain redirects to op.europa.eu, whose cert
 * fails hostname validation, so we pin to byte-stable mirrors instead):
 *   - SHACL shapes, edc-ap JSON-LD context, ELM ontology — the archived GitHub mirror
 *     `european-commission-empl/European-Learning-Model`, pinned to a commit SHA. The
 *     mirror's TTL carries the canonical `data.europa.eu/snb/...` IRIs (AP version 1.1.0,
 *     distribution snapshot snb-model/20230928-0).
 *   - EU credential examples (the corpus) — the live source-of-truth repo
 *     `code.europa.eu/.../ELM-support` via its GitLab raw API, pinned to a commit SHA.
 *
 * NOT fetched here: the bounded SKOS controlled-vocabulary value-sets (eqf, isced-f,
 * claim-type, credential, evidence-type, learning-setting, skill-type, …) live under the
 * EU Publications Office authority tables and are vendored by the CV-enforcement step
 * (see docs/architecture/elm-edc.md §4.1/§9); they are not needed by the SHACL walker or
 * the Zod contracts, which key off the scheme IRIs the shapes already carry.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const vendorDir = resolve(repoRoot, "packages/coverage/vendor/elm");

// `@conform-ed/credential-verification` re-ships the consumer subset of the SHACL shapes (the ones
// `verifyEdc` / `validateAgainstProfile` need at runtime) so downstream consumers don't vendor them
// themselves — see that package's `src/elm-shapes.ts`. Keep it in sync with the coverage copy here.
const credVerifShapesDir = resolve(repoRoot, "packages/credential-verification/vendor/elm/shapes");
const consumerShapeSubset = [
  "edc-generic-full.ttl",
  "edc-generic-no-cv.ttl",
  "loq-constraints.ttl",
  "ams-constraints.ttl",
  "pid-constraints.ttl",
];

const force = process.argv.includes("--force");

// Archived GitHub mirror, pinned. (Repo is read-only/archived → SHA is effectively immutable.)
const MIRROR_SHA = "9d7c5d22002237c3afeb1750b7038e6fe2cdd371";
const mirrorRaw = `https://raw.githubusercontent.com/european-commission-empl/European-Learning-Model/${MIRROR_SHA}`;

// code.europa.eu ELM-support, pinned.
const CODE_EUROPA_SHA = "b9dcfa8efea435181222f7a65585c8cf8d40f427";
const codeEuropaProject = "qualifications-courses-and-credentials%2FELM-support";
const exampleDir = "credential examples/JSON-LD Examples (ELM v3)";

/** SHACL shape graphs (TTL): all 6 EDC sub-variants + LOQ/AMS (±mdr) + PID. */
const shapes: Array<{ from: string; to: string }> = [
  ["rdf/ap/edc/EDC-generic-full.ttl", "shapes/edc-generic-full.ttl"],
  ["rdf/ap/edc/EDC-generic-no-cv.ttl", "shapes/edc-generic-no-cv.ttl"],
  ["rdf/ap/edc/EDC-accredited.ttl", "shapes/edc-accredited.ttl"],
  ["rdf/ap/edc/EDC-converted.ttl", "shapes/edc-converted.ttl"],
  ["rdf/ap/edc/EDC-diplomaSupplement.ttl", "shapes/edc-diploma-supplement.ttl"],
  ["rdf/ap/edc/EDC-issuedByMandate.ttl", "shapes/edc-issued-by-mandate.ttl"],
  ["rdf/ap/loq/LOQ-constraints.ttl", "shapes/loq-constraints.ttl"],
  ["rdf/ap/loq/LOQ-constraints-mdr.ttl", "shapes/loq-constraints-mdr.ttl"],
  ["rdf/ap/ams/AMS-constraints.ttl", "shapes/ams-constraints.ttl"],
  ["rdf/ap/ams/AMS-constraints-mdr.ttl", "shapes/ams-constraints-mdr.ttl"],
  ["rdf/ap/pid/PID-constraints.ttl", "shapes/pid-constraints.ttl"],
].map(([from, to]) => ({ from: `${mirrorRaw}/${from}`, to }));

/** edc-ap JSON-LD context + the ELM ontology (semantics cross-reference). */
const rdfArtifacts: Array<{ from: string; to: string }> = [
  ["rdf/ap/edc/edc-ap-context.jsonld", "context/edc-ap-context.jsonld"],
  ["rdf/ontology/ELM.ttl", "ontology/ELM.ttl"],
  ["rdf/ontology/ELM-external.ttl", "ontology/ELM-external.ttl"],
].map(([from, to]) => ({ from: `${mirrorRaw}/${from}`, to }));

/** The 10 EU EDC examples (5 signed .jsonld + 5 unsigned .json) → the corpus. */
const exampleFiles = [
  "AA-Annex1-MC-signed.jsonld",
  "AA-Annex1-MC-unsigned.json",
  "Sample-CertOfPart-signed.jsonld",
  "Sample-CertOfPart-unsigned.json",
  "Sample-JointDegree-signed.jsonld",
  "Sample-JointDegree-unsigned.json",
  "Sample-MastersDegree-signed.jsonld",
  "Sample-MastersDegree-unsigned.json",
  "Sample-TranscriptOfRecords-signed.jsonld",
  "Sample-TranscriptOfRecords-unsigned.json",
];
const examples: Array<{ from: string; to: string }> = exampleFiles.map((name) => {
  const path = encodeURIComponent(`${exampleDir}/${name}`);
  return {
    from: `https://code.europa.eu/api/v4/projects/${codeEuropaProject}/repository/files/${path}/raw?ref=${CODE_EUROPA_SHA}`,
    to: `examples/edc/${name}`,
  };
});

async function fetchTo(url: string, relTarget: string): Promise<number> {
  const target = resolve(vendorDir, relTarget);
  if (existsSync(target) && !force) {
    return 0;
  }
  await mkdir(resolve(target, ".."), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}): ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(target, bytes);
  console.log(`fetched ${relTarget} (${bytes.length} bytes)`);
  return bytes.length;
}

async function main(): Promise<void> {
  const all = [...shapes, ...rdfArtifacts, ...examples];
  let total = 0;
  for (const { from, to } of all) {
    total += await fetchTo(from, to);
  }

  const provenance = `# ELM v3.3 vendored artifacts — provenance

These files are version-pinned, committed upstream artifacts of the **European Learning
Model v3.3** (application-profile version \`1.1.0\`, distribution snapshot
\`snb-model/20230928-0\`). Regenerate with \`bun run scripts/fetch-elm-artifacts.ts\`
(\`--force\` to overwrite). See ADR-0019 and docs/architecture/elm-edc.md.

## Sources

- **shapes/**, **context/**, **ontology/** — archived GitHub mirror
  \`european-commission-empl/European-Learning-Model\`, pinned to commit
  \`${MIRROR_SHA}\`. The mirror's TTL carries the canonical \`data.europa.eu/snb/...\`
  IRIs. (The data.europa.eu deref chain redirects to op.europa.eu, whose TLS cert fails
  hostname validation, so the mirror is the byte-stable source.)
- **examples/edc/** — \`code.europa.eu/qualifications-courses-and-credentials/ELM-support\`
  (the live source-of-truth repo) via its GitLab raw API, pinned to commit
  \`${CODE_EUROPA_SHA}\`.

## Contents

- \`shapes/\` — SHACL shape graphs (the conformance denominator): all 6 EDC sub-variants,
  LOQ (±mdr), AMS (±mdr), PID.
- \`context/edc-ap-context.jsonld\` — the EDC JSON-LD context (term/IRI resolution).
- \`ontology/ELM.ttl\`, \`ontology/ELM-external.ttl\` — the ELM OWL ontology (semantics).
- \`examples/edc/\` — the 10 EU EDC examples (5 signed \`.jsonld\` + 5 unsigned \`.json\`).

## Not vendored here

- Bounded SKOS controlled-vocabulary value-sets (eqf, isced-f, claim-type, credential,
  evidence-type, learning-setting, skill-type, skill-reuse-level, verification-status,
  entitlement-status, accreditation) — vendored by the CV-enforcement step.
- The legacy LOQ/AMS XSDs — SHACL is our denominator (ADR-0019).
`;
  await writeFile(resolve(vendorDir, "PROVENANCE.md"), provenance);
  console.log(`\nvendored ${all.length} artifacts (${total} new bytes) -> packages/coverage/vendor/elm/`);

  // Mirror the consumer shape subset into credential-verification so its `elm-shapes` export and the
  // coverage copy never drift (both regenerate from the same pinned fetch).
  await mkdir(credVerifShapesDir, { recursive: true });
  for (const name of consumerShapeSubset) {
    await copyFile(resolve(vendorDir, "shapes", name), resolve(credVerifShapesDir, name));
  }
  console.log(`synced ${consumerShapeSubset.length} shapes -> packages/credential-verification/vendor/elm/shapes/`);
}

await main();
