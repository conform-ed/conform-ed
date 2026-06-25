import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ltiV1_3 } from "../specs/lti/v1_3";
import { buildCoverageMap } from "../src/generate";
import type { CoverageMap } from "../src/types";

const map = buildCoverageMap(ltiV1_3, { now: "2026-01-01" });
const byKey = new Map(map.items.map((i) => [i.key, i]));

describe("LTI 1.3 + Advantage Coverage Map — hybrid (AGS schema spine + curated DL denominator + guide catalogue)", () => {
  test("walks the five lifted AGS media-type schemas into entity doc roots", () => {
    expect(map.meta.spec).toBe("lti");
    expect(map.meta.version).toBe("1.3");
    for (const entity of ["LineItem", "LineItemContainer", "Score", "Result", "ResultContainer"]) {
      expect(byKey.get(`lti:1.3:doc:${entity}`)?.kind).toBe("document");
    }
  });

  test("every item key is namespaced to the spec:version", () => {
    for (const item of map.items) expect(item.key.startsWith("lti:1.3:")).toBe(true);
  });

  test("pins each AGS binding/REST service (OpenAPI) and the seven curated denominators", () => {
    // 5 AGS component bindings + 1 restService (ags paths), all the same derived OpenAPI file,
    // plus the ADR-0017 curated structural denominators (Deep Linking content items + settings,
    // NRPS container, Core launch, the two proctoring messages) and the role value-set vocabulary.
    expect(map.meta.sources).toHaveLength(13);
    for (const source of map.meta.sources) expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    const byBinding = new Map(map.meta.sources.map((s) => [s.binding, s.language]));
    for (const openapi of ["ags (paths)", "LineItem", "LineItemContainer", "Result", "ResultContainer", "Score"]) {
      expect(byBinding.get(openapi)).toBe("openapi");
    }
    for (const curated of [
      "DeepLinkingContentItem",
      "DeepLinkingSettings",
      "NrpsMembershipContainer",
      "CoreLaunchRequest",
      "StartProctoringMessage",
      "EndAssessmentMessage",
      "RoleVocabulary",
    ]) {
      expect(byBinding.get(curated)).toBe("curated");
    }
  });

  test("the value-sets verify conform-ed accepts every published vocabulary member", () => {
    expect(map.rollup.valueSetMembers).toBe(52);
    expect(map.rollup.valueSetModelled).toBe(52);
    expect(map.rollup.valueSetGaps).toBe(0);
    // The role vocabulary (a refinement), plus the launch document-target and the Deep Linking
    // accept-types / accept-presentation enums — each fully modelled, no value-set gaps.
    expect(map.valueSets.map((v) => v.item)).toEqual([
      "lti:1.3:def:ClLaunchPresentation/documentTarget",
      "lti:1.3:doc:DeepLinkingSettings/acceptPresentationDocumentTargets/[]",
      "lti:1.3:doc:DeepLinkingSettings/acceptTypes/[]",
      "lti:1.3:doc:RoleVocabulary/role",
    ]);
    for (const verdict of map.valueSets) expect(verdict.gaps).toEqual([]);
    // The value-set-only vocabulary is excluded from the structural reconciliation (no false gap).
    expect(byKey.get("lti:1.3:doc:RoleVocabulary/role")?.modelled).toBeUndefined();
  });

  test("conform-ed reconciles every denominator (AGS OpenAPI + curated content items + NRPS) with no silent gaps", () => {
    expect(map.rollup.modelledNo).toBe(0);
    expect(map.rollup.modelledYes).toBe(189);
    expect(map.residues.silentGaps).toEqual([]);
    // Honest extensions: optional fields conform-ed models that the denominator omits (NOT gaps).
    // Six are AGS fields the *illustrative* OpenAPI omits; the seventh is the `alt` text on
    // conform-ed's shared image resource, which the LTI Deep Linking image resource never defines.
    expect(map.residues.extensions).toEqual([
      "lti:1.3:def:DeepLinkingContentItem.__schema1/alt",
      "lti:1.3:doc:LineItem/gradesReleased",
      "lti:1.3:doc:LineItemContainer/[]/gradesReleased",
      "lti:1.3:doc:Result/scoringUserId",
      "lti:1.3:doc:ResultContainer/[]/scoringUserId",
      "lti:1.3:doc:Score/scorePublished",
      "lti:1.3:doc:Score/submission",
    ]);
  });

  test("the curated Deep Linking content-item denominator gives the gap-prone per-type fields a verdict", () => {
    // The exact fields that sat under-modelled before the contract fix + ADR-0017 — now each is a
    // real curated L1 item that conform-ed's ContentItemSchema reconciles as modelled `yes`.
    for (const key of [
      "lti:1.3:def:DlHtml/html",
      "lti:1.3:def:DlImage/width",
      "lti:1.3:def:DlImage/height",
      "lti:1.3:def:DlFile/mediaType",
      "lti:1.3:def:DlFile/expiresAt",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
    expect(byKey.get("lti:1.3:doc:DeepLinkingContentItem")?.kind).toBe("document");
  });

  test("the curated NRPS membership-container denominator reconciles the member shape", () => {
    for (const key of [
      "lti:1.3:def:NrpsMember/userId",
      "lti:1.3:def:NrpsMember/roles",
      "lti:1.3:def:NrpsMember/status",
      "lti:1.3:doc:NrpsMembershipContainer/members",
    ]) {
      expect(byKey.get(key)?.modelled).toBe("yes");
    }
    expect(byKey.get("lti:1.3:doc:NrpsMembershipContainer")?.kind).toBe("document");
  });

  test("#/components/schemas refs resolve — no dangling edges", () => {
    const keys = new Set(map.items.map((i) => i.key));
    for (const edge of map.edges) expect(keys.has(edge.to)).toBe(true);
  });

  test("the catalogue spans the six tool Advantage profiles plus the platform-role profiles", () => {
    // 27 tool requirements (LTI-*) + 29 platform requirements (PLAT-*, emergent ADR-0040).
    expect(map.rollup.conformanceRequirements).toBe(56);
    const profiles = new Set(map.conformance.map((r) => r.profile));
    expect(profiles).toEqual(
      new Set([
        "core",
        "security",
        "nrps",
        "ags",
        "deep-linking",
        "proctoring",
        "platform-core",
        "platform-security",
        "platform-nrps",
        "platform-ags",
        "platform-deep-linking",
        "platform-proctoring",
        "platform-dynamic-registration",
      ]),
    );
  });

  test("AGS plus the curated Deep Linking / NRPS / roles requirements carry anchors; the rest carry none", () => {
    const keys = new Set(map.items.map((i) => i.key));
    const anchored = new Set<string>();
    for (const req of map.conformance) {
      for (const key of req.constrains) expect(keys.has(key)).toBe(true);
      if (req.constrains.length > 0) anchored.add(req.reqId);
    }
    // AGS (every requirement except the launch-claim LTI-AGS-1) plus the requirements now backed
    // by an ADR-0017 denominator: Core launch claims (LTI-CORE-3), the roles value-set
    // (LTI-CORE-4), Deep Linking settings + content items (LTI-DL-1/3), the NRPS container
    // (LTI-NRPS-2/3) and the two proctoring messages (LTI-PROC-1/2). What stays guide-only is the
    // behavioural/transport surface with no payload schema: the OIDC/JWT flow (LTI-CORE-1/2/5),
    // the whole Security profile, the AGS endpoint claim (LTI-AGS-1) and NRPS-1/4.
    // The platform role (PLAT-*) reuses the same producing-side anchors, so the same
    // requirement shapes are anchored: core launch claims + roles, NRPS container + member,
    // every AGS line-item/score/result requirement bar the endpoint claim, DL settings +
    // content items, and the two proctoring messages.
    expect(anchored).toEqual(
      new Set([
        "LTI-AGS-2",
        "LTI-AGS-3",
        "LTI-AGS-4",
        "LTI-AGS-5",
        "LTI-AGS-6",
        "LTI-AGS-7",
        "LTI-AGS-8",
        "LTI-CORE-3",
        "LTI-CORE-4",
        "LTI-DL-1",
        "LTI-DL-3",
        "LTI-NRPS-2",
        "LTI-NRPS-3",
        "LTI-PROC-1",
        "LTI-PROC-2",
        "PLAT-AGS-2",
        "PLAT-AGS-3",
        "PLAT-AGS-4",
        "PLAT-AGS-5",
        "PLAT-AGS-6",
        "PLAT-AGS-7",
        "PLAT-AGS-8",
        "PLAT-CORE-3",
        "PLAT-CORE-4",
        "PLAT-DL-1",
        "PLAT-DL-3",
        "PLAT-NRPS-2",
        "PLAT-NRPS-3",
        "PLAT-PROC-1",
        "PLAT-PROC-2",
      ]),
    );
  });

  test("cited is 0 throughout — the AGS OpenAPI carries no ALL-CAPS RFC-2119 prose", () => {
    // The schema-backed-vs-catalogue distinction here is L2 reconciliation (modelledYes),
    // not `cited` (as for the XSD-family CC/QTI maps).
    expect(map.rollup.normativeStatementsCited).toBe(0);
    expect(map.rollup.normativeStatements).toBe(0);
  });

  test("the transport axis inventories the AGS paths (no security scheme is declared)", () => {
    const operations = map.items.filter((i) => i.kind === "operation");
    const parameters = map.items.filter((i) => i.kind === "parameter");
    const security = map.items.filter((i) => i.kind === "security");
    // 7 AGS operations, the six query filters, and NO security scheme (AGS keeps OAuth out of band).
    expect(operations).toHaveLength(7);
    expect(new Set(parameters.map((i) => i.key))).toEqual(
      new Set(["limit", "page", "resource_link_id", "resource_id", "tag", "user_id"].map((p) => `lti:1.3:param:${p}`)),
    );
    expect(security).toHaveLength(0);
    // Transport items are a distinct axis: never reconciled, so never a gap or extension.
    for (const item of [...operations, ...parameters]) expect(item.modelled).toBeUndefined();
  });

  test("the committed map is in sync with the generator", () => {
    const committed = readFileSync(join(import.meta.dir, "..", "maps", "lti-v1.3.json"), "utf8");
    const parsed = JSON.parse(committed) as CoverageMap;
    const rebuilt = buildCoverageMap(ltiV1_3, { now: parsed.meta.generatedAt });
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(committed);
  });
});
