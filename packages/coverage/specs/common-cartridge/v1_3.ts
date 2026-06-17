/**
 * Common Cartridge 1.3 — Web Link resource — the XSD-family pilot {@link SpecSource}
 * (conform-ed ADR-0013; emergent ADR-0028 rollout). It exercises the direct XSD
 * walker (`src/walkers/xsd.ts`) end-to-end against the literal published `.xsd`
 * denominator, reconciled with conform-ed's Zod model.
 *
 * The vendored schema under `vendor/common-cartridge/v1_3/` is the literal
 * denominator, copied verbatim from the IMS CC 1.3 binding bundle
 * (`ccv1p3_imswl_v1p3.xsd`, targetNamespace
 * `http://www.imsglobal.org/xsd/imsccv1p3/imswl_v1p3`).
 *
 * Note on the expected residue: the XSD's open extension point is the nameless
 * `xs:any` inside `grpStrict.any`; conform-ed models it as a named `extensions`
 * field. The two cannot align by name, so `extensions` surfaces as a single
 * `extension` residue — the literal-denominator mechanism correctly reporting a
 * documented normalisation (to be bridged by a `specRef` override increment),
 * not a defect.
 */

import { join } from "node:path";

import { WebLinkSchema } from "@conform-ed/contracts/common-cartridge/v1_3";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "common-cartridge", "v1_3", file);

/**
 * Conformance seed — a grounded slice of the CC 1.3 Web Link resource's normative
 * rules, each cross-linked to the literal L1 item it constrains. Requirement ids
 * are synthesised (`CC-WL-n`); the published CC 1.3 conformance guide has no clean
 * per-statement id scheme. Full extraction is the next hand-curation increment.
 */
const conformance: readonly ConformanceRequirement[] = [
  {
    key: "cc:1.3:conf:web-link/CC-WL-1",
    profile: "web-link",
    reqId: "CC-WL-1",
    level: "MUST",
    statement: "A Web Link resource MUST contain a webLink element carrying exactly one title and exactly one url.",
    constrains: ["cc:1.3:def:WebLink.Type/title", "cc:1.3:def:WebLink.Type/url"],
    source:
      "IMS CC 1.3 — Web Link resource (imswl_v1p3) — https://www.imsglobal.org/cc/CCv1p3/imscc_profilev1p3-Final.html#WebLinks",
  },
  {
    key: "cc:1.3:conf:web-link/CC-WL-2",
    profile: "web-link",
    reqId: "CC-WL-2",
    level: "MUST",
    statement: "The url element MUST carry an href attribute identifying the link target.",
    constrains: ["cc:1.3:def:URL.Type/href"],
    source:
      "IMS CC 1.3 — Web Link resource (imswl_v1p3) URL.Type — https://www.imsglobal.org/cc/CCv1p3/imscc_profilev1p3-Final.html#WebLinks",
  },
];

export const commonCartridgeV1_3: SpecSource = {
  spec: "cc",
  version: "1.3",
  bindings: [
    {
      binding: "webLink",
      schemaPath: vendor("ccv1p3_imswl_v1p3.xsd"),
      language: "xsd",
      zod: WebLinkSchema,
    },
  ],
  conformance,
};
