/**
 * Adapter from `@conform-ed/qti-xml`'s normalized assessment-item JSON (the contracts
 * vocabulary) to the runtime's `AssessmentItemView`. Pure data reshaping with no
 * qti-xml dependency. The contracts shapes and the runtime's descriptor shapes
 * deliberately differ in places; this seam is where they reconcile:
 *
 * - bare-string text fragments become `{ kind: "text", value }` nodes
 * - `hotTextInteraction`/`hotText` rename to the runtime's `hottextInteraction`/`hottext`
 * - graphic stages: contract `image` xml nodes become `{ data, width, height, type }`
 *   objects, and `coords` strings become number arrays (also in `areaMapping`)
 * - `gapChoices` split into the runtime's `gapTexts` (gapMatch) / `gapImgs` (graphic)
 * - media/upload/positionObjectStage flatten to the descriptor fields
 * - processing trees: `children` → `expressions`, `actions` → `rules`,
 *   `responseElseIf`/`templateElseIf` pluralize; fragment rules keep their
 *   nested `rules` verbatim
 *
 * Used by the corpus delivery meter (ADR-0002) and by any consumer ingesting
 * normalized XML.
 */

import { parseCoords } from "./graphic";
import type { CatalogView } from "./pnp";
import type {
  OutcomeDeclarationView,
  ResponseProcessingView,
  RpExpressionView,
  RpRuleView,
  TemplateDeclarationView,
  TemplateProcessingView,
  TemplateRuleView,
} from "./rp";
import type {
  AssessmentItemView,
  BodyNode,
  CompanionMaterialsView,
  FeedbackView,
  StimulusContentView,
} from "./runtime";
import type {
  AssessmentItemRefView,
  AssessmentSectionView,
  AssessmentTestView,
  BranchRuleView,
  ItemSessionControlView,
  OutcomeRuleView,
  RubricBlockView,
  TestFeedbackView,
  TestPartView,
  TimeLimitsView,
} from "./test";
import type { ResponseDeclarationView } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

// ---------- content ----------

const kindRenames: Readonly<Record<string, string>> = {
  hotTextInteraction: "hottextInteraction",
  hotText: "hottext",
};

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

/** The element carrying the image source: the node itself, or (for wrappers like `picture`) the first `img`/`object` descendant. */
function findImageSource(node: unknown): Record<string, unknown> {
  if (!isRecord(node)) {
    return {};
  }

  const attributes = isRecord(node["attributes"]) ? node["attributes"] : {};

  if (typeof attributes["data"] === "string" || typeof attributes["src"] === "string") {
    return attributes;
  }

  for (const child of asRecords(node["children"])) {
    const found = findImageSource(child);

    if (typeof found["data"] === "string" || typeof found["src"] === "string") {
      return found;
    }
  }

  return attributes;
}

/** A contract media node (`object`/`img`/`picture` xml node) as the runtime's stage-object shape. */
function toStageObject(node: unknown): Record<string, unknown> {
  const attributes = findImageSource(node);
  const data = attributes["data"] ?? attributes["src"];
  const width = numberValue(attributes["width"]);
  const height = numberValue(attributes["height"]);

  return {
    data: typeof data === "string" ? data : "",
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(typeof attributes["type"] === "string" ? { type: attributes["type"] } : {}),
  };
}

/** Plain text of converted content nodes (for gapText labels in graphic trays). */
function flattenText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(flattenText).join("");
  }

  if (!isRecord(value)) {
    return "";
  }

  if (value["kind"] === "text") {
    return typeof value["value"] === "string" ? value["value"] : "";
  }

  return flattenText(value["children"]) + flattenText(value["content"]) + flattenText(value["value"]);
}

function withNumericCoords(node: Record<string, unknown>): Record<string, unknown> {
  return typeof node["coords"] === "string" ? { ...node, coords: parseCoords(node["coords"]) } : node;
}

/** Kind-specific reshaping from contract nodes to the runtime descriptor shapes. */
function reshapeContentNode(node: Record<string, unknown>): Record<string, unknown> {
  const kind = node["kind"];

  if (typeof kind !== "string") {
    return node;
  }

  const renamed = kindRenames[kind];
  if (renamed !== undefined) {
    return { ...node, kind: renamed };
  }

  switch (kind) {
    case "hotspotChoice":
    case "associableHotspot":
      return withNumericCoords(node);

    case "hotspotInteraction":
    case "graphicOrderInteraction":
    case "graphicAssociateInteraction":
    case "selectPointInteraction": {
      const { image, ...rest } = node;
      return { ...rest, object: toStageObject(image) };
    }

    case "drawingInteraction": {
      // The stage arrives as generic content (<object> or <picture>/<img>); adapt it
      // to the graphic-family object shape the descriptor expects.
      const { content, ...rest } = node;
      const media = asRecords(content).find(
        (fragment) =>
          fragment["kind"] === "xml" &&
          typeof fragment["name"] === "string" &&
          ["object", "picture", "img"].includes(fragment["name"]),
      );

      return { ...rest, object: toStageObject(media) };
    }

    case "graphicGapMatchInteraction": {
      const { image, gapChoices, ...rest } = node;
      // Both gap choice kinds become tray entries: gapImg carries an image object,
      // gapText a plain-text label.
      const gapImgs = asRecords(gapChoices).map(({ media, content, ...choice }) =>
        choice["kind"] === "gapImg"
          ? { ...choice, object: toStageObject(media) }
          : { ...choice, label: flattenText(content) },
      );

      return { ...rest, object: toStageObject(image), gapImgs };
    }

    case "gapMatchInteraction": {
      const gapTexts = asRecords(node["gapChoices"]).filter((choice) => choice["kind"] === "gapText");
      return { ...node, gapTexts };
    }

    case "mediaInteraction": {
      const { media, ...rest } = node;
      return { ...rest, content: media === undefined ? [] : [media] };
    }

    case "uploadInteraction": {
      const acceptedTypes = node["acceptedTypes"];
      return Array.isArray(acceptedTypes) ? { ...node, type: acceptedTypes.join(",") } : node;
    }

    case "positionObjectStage": {
      const interactions = asRecords(node["positionObjectInteractions"]);
      const [first] = interactions;

      if (interactions.length === 1 && first) {
        return {
          kind: "positionObjectStage",
          responseIdentifier: first["responseIdentifier"],
          stageObject: toStageObject(node["image"]),
          object: toStageObject(first["image"]),
          ...(first["maxChoices"] !== undefined ? { maxChoices: first["maxChoices"] } : {}),
          ...(first["minChoices"] !== undefined ? { minChoices: first["minChoices"] } : {}),
        };
      }

      // Multi-interaction stages are beyond the runtime's single-stage descriptor;
      // keep a responseIdentifier so the capability gate reports the node instead of
      // the renderer silently dropping it (ADR-0003).
      const responseIdentifier = first?.["responseIdentifier"];
      return { ...node, ...(typeof responseIdentifier === "string" ? { responseIdentifier } : {}) };
    }

    default:
      return node;
  }
}

function convertContentEntry(entry: unknown): unknown {
  if (typeof entry === "string") {
    return { kind: "text", value: entry };
  }

  return convertContentValue(entry);
}

function convertContentValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(convertContentValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  const converted = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if ((key === "children" || key === "content") && Array.isArray(entry)) {
        return [key, entry.map(convertContentEntry)];
      }

      return [key, convertContentValue(entry)];
    }),
  );

  return reshapeContentNode(converted);
}

// ---------- processing trees ----------

function convertExpression(expression: unknown): RpExpressionView {
  const record = isRecord(expression) ? expression : {};
  const { children, ...rest } = record;

  return {
    ...rest,
    ...(Array.isArray(children) ? { expressions: children.map(convertExpression) } : {}),
  } as unknown as RpExpressionView;
}

function convertBranch(branch: unknown, convertRule: (rule: unknown) => Record<string, unknown>) {
  const record = isRecord(branch) ? branch : {};

  return {
    expression: convertExpression(record["expression"]),
    rules: (Array.isArray(record["actions"]) ? record["actions"] : []).map(convertRule),
  };
}

function convertRpRule(rule: unknown): Record<string, unknown> {
  const record = isRecord(rule) ? rule : {};
  const kind = typeof record["kind"] === "string" ? record["kind"] : "";

  if (kind === "responseCondition") {
    const elseIfs = Array.isArray(record["responseElseIf"])
      ? record["responseElseIf"].map((branch) => convertBranch(branch, convertRpRule))
      : [];

    return {
      kind,
      responseIf: convertBranch(record["responseIf"], convertRpRule),
      ...(elseIfs.length ? { responseElseIfs: elseIfs } : {}),
      ...(isRecord(record["responseElse"])
        ? {
            responseElse: {
              rules: (Array.isArray(record["responseElse"]["actions"]) ? record["responseElse"]["actions"] : []).map(
                convertRpRule,
              ),
            },
          }
        : {}),
    };
  }

  // Fragments nest their rules under `rules` (not the branches' `actions`).
  if (kind === "responseProcessingFragment") {
    return { kind, rules: (Array.isArray(record["rules"]) ? record["rules"] : []).map(convertRpRule) };
  }

  return {
    kind,
    ...(typeof record["identifier"] === "string" ? { identifier: record["identifier"] } : {}),
    ...(record["expression"] !== undefined ? { expression: convertExpression(record["expression"]) } : {}),
  };
}

function convertTemplateRule(rule: unknown): Record<string, unknown> {
  const record = isRecord(rule) ? rule : {};
  const kind = typeof record["kind"] === "string" ? record["kind"] : "";

  if (kind === "templateCondition") {
    const elseIfs = Array.isArray(record["templateElseIf"])
      ? record["templateElseIf"].map((branch) => convertBranch(branch, convertTemplateRule))
      : [];

    return {
      kind,
      templateIf: convertBranch(record["templateIf"], convertTemplateRule),
      ...(elseIfs.length ? { templateElseIfs: elseIfs } : {}),
      ...(isRecord(record["templateElse"])
        ? {
            templateElse: {
              rules: (Array.isArray(record["templateElse"]["actions"]) ? record["templateElse"]["actions"] : []).map(
                convertTemplateRule,
              ),
            },
          }
        : {}),
    };
  }

  return {
    kind,
    ...(typeof record["identifier"] === "string" ? { identifier: record["identifier"] } : {}),
    ...(record["expression"] !== undefined ? { expression: convertExpression(record["expression"]) } : {}),
  };
}

function convertResponseProcessing(value: Record<string, unknown>): ResponseProcessingView {
  return {
    ...(typeof value["template"] === "string" ? { template: value["template"] } : {}),
    ...(Array.isArray(value["rules"])
      ? { rules: value["rules"].map(convertRpRule) as unknown as readonly RpRuleView[] }
      : {}),
  };
}

// ---------- declarations ----------

function convertResponseDeclaration(declaration: Record<string, unknown>): ResponseDeclarationView {
  const areaMapping = declaration["areaMapping"];

  if (!isRecord(areaMapping)) {
    return declaration as unknown as ResponseDeclarationView;
  }

  const areaMapEntries = asRecords(areaMapping["areaMapEntries"]).map((entry) => withNumericCoords(entry));

  return { ...declaration, areaMapping: { ...areaMapping, areaMapEntries } } as unknown as ResponseDeclarationView;
}

/**
 * Reshape a normalized QTI document (the `normalizedDocument` from qti-xml validation)
 * into an `AssessmentItemView`, or null when it is not an assessment item.
 */
// ---------- catalogs (CatalogInfo, §5.29) ----------

/**
 * Collect every catalog reachable from a converted node tree — catalog ids are
 * document-unique (xs:ID), so item-level and nested (rubric/feedback block) catalogs
 * pool into one list for idref resolution.
 */
function appendCatalogViews(target: CatalogView[], value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      appendCatalogViews(target, entry);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const catalogInfo = value["catalogInfo"];
  if (isRecord(catalogInfo) && Array.isArray(catalogInfo["catalogs"])) {
    target.push(...(catalogInfo["catalogs"] as CatalogView[]));
  }

  appendCatalogViews(target, value["content"]);
  appendCatalogViews(target, value["children"]);
}

/** Item/stimulus-level catalogInfo, converted so card content is renderer-ready. */
function documentCatalogViews(root: Record<string, unknown>, convertedContent: unknown): CatalogView[] {
  const catalogs: CatalogView[] = [];

  appendCatalogViews(
    catalogs,
    isRecord(root["catalogInfo"]) ? { catalogInfo: convertContentValue(root["catalogInfo"]) } : undefined,
  );
  appendCatalogViews(catalogs, convertedContent);

  return catalogs;
}

export function assessmentItemViewFromNormalized(document: unknown): AssessmentItemView | null {
  if (!isRecord(document) || !isRecord(document["assessmentItem"])) {
    return null;
  }

  const item = document["assessmentItem"];
  const itemBody = isRecord(item["itemBody"]) ? item["itemBody"] : {};
  const content = Array.isArray(itemBody["content"]) ? itemBody["content"].map(convertContentEntry) : [];
  const templateRules = isRecord(item["templateProcessing"]) ? item["templateProcessing"]["rules"] : undefined;
  const convertedModalFeedbacks = Array.isArray(item["modalFeedbacks"])
    ? item["modalFeedbacks"].map(convertContentValue)
    : undefined;
  const catalogs = documentCatalogViews(item, [content, convertedModalFeedbacks]);

  return {
    responseDeclarations: asRecords(item["responseDeclarations"]).map(convertResponseDeclaration),
    outcomeDeclarations: (item["outcomeDeclarations"] as OutcomeDeclarationView[] | undefined) ?? [],
    ...(isRecord(item["responseProcessing"])
      ? { responseProcessing: convertResponseProcessing(item["responseProcessing"]) }
      : {}),
    ...(Array.isArray(item["templateDeclarations"])
      ? { templateDeclarations: item["templateDeclarations"] as TemplateDeclarationView[] }
      : {}),
    ...(Array.isArray(templateRules)
      ? {
          templateProcessing: {
            rules: templateRules.map(convertTemplateRule) as unknown as readonly TemplateRuleView[],
          } satisfies TemplateProcessingView,
        }
      : {}),
    ...(typeof item["adaptive"] === "boolean" ? { adaptive: item["adaptive"] } : {}),
    ...(convertedModalFeedbacks
      ? { modalFeedbacks: convertedModalFeedbacks as unknown as readonly FeedbackView[] }
      : {}),
    ...(catalogs.length ? { catalogs } : {}),
    ...(isRecord(item["companionMaterialsInfo"])
      ? { companionMaterials: item["companionMaterialsInfo"] as CompanionMaterialsView }
      : {}),
    ...(Array.isArray(item["assessmentStimulusRefs"])
      ? {
          assessmentStimulusRefs: asRecords(item["assessmentStimulusRefs"]).map((ref) => ({
            identifier: typeof ref["identifier"] === "string" ? ref["identifier"] : "",
            href: typeof ref["href"] === "string" ? ref["href"] : "",
            ...(typeof ref["title"] === "string" ? { title: ref["title"] } : {}),
          })),
        }
      : {}),
    itemBody: { content: content as BodyNode[] },
  };
}

/**
 * The renderable body of a normalized AssessmentStimulus document, for
 * `QtiRuntimeConfig.resolveStimulus`. Returns null for non-stimulus documents.
 */
export function stimulusContentFromNormalized(document: unknown): StimulusContentView | null {
  if (!isRecord(document) || !isRecord(document["assessmentStimulus"])) {
    return null;
  }

  const stimulus = document["assessmentStimulus"];
  const body = isRecord(stimulus["stimulusBody"]) ? stimulus["stimulusBody"] : {};
  const content = Array.isArray(body["content"]) ? body["content"].map(convertContentEntry) : [];
  const catalogs = documentCatalogViews(stimulus, content);

  return { content: content as BodyNode[], ...(catalogs.length ? { catalogs } : {}) };
}

// ---------- assessment tests (ADR-0005) ----------

/** Normalized `{kind: "preCondition", expression}` wrappers as bare expressions. */
function convertPreConditions(value: unknown): RpExpressionView[] {
  return asRecords(value).map((wrapper) => convertExpression(wrapper["expression"]));
}

function convertBranchRules(value: unknown): BranchRuleView[] {
  return asRecords(value).map((rule) => ({
    target: typeof rule["target"] === "string" ? rule["target"] : "",
    expression: convertExpression(rule["expression"]),
  }));
}

function convertOutcomeRule(rule: unknown): Record<string, unknown> {
  const record = isRecord(rule) ? rule : {};
  const kind = typeof record["kind"] === "string" ? record["kind"] : "";

  if (kind === "outcomeCondition") {
    const elseIfs = Array.isArray(record["outcomeElseIf"])
      ? record["outcomeElseIf"].map((branch) => convertBranch(branch, convertOutcomeRule))
      : [];

    return {
      kind,
      outcomeIf: convertBranch(record["outcomeIf"], convertOutcomeRule),
      ...(elseIfs.length ? { outcomeElseIfs: elseIfs } : {}),
      ...(isRecord(record["outcomeElse"])
        ? {
            outcomeElse: {
              rules: (Array.isArray(record["outcomeElse"]["actions"]) ? record["outcomeElse"]["actions"] : []).map(
                convertOutcomeRule,
              ),
            },
          }
        : {}),
    };
  }

  // Fragments nest their rules under `rules` (not the branches' `actions`).
  if (kind === "outcomeProcessingFragment") {
    return { kind, rules: (Array.isArray(record["rules"]) ? record["rules"] : []).map(convertOutcomeRule) };
  }

  return {
    kind,
    ...(typeof record["identifier"] === "string" ? { identifier: record["identifier"] } : {}),
    ...(record["expression"] !== undefined ? { expression: convertExpression(record["expression"]) } : {}),
  };
}

/** `itemSessionControl`/`timeLimits` keep their normalized field names verbatim. */
function sessionControlAndTimeLimits(record: Record<string, unknown>): {
  itemSessionControl?: ItemSessionControlView;
  timeLimits?: TimeLimitsView;
} {
  return {
    ...(isRecord(record["itemSessionControl"])
      ? { itemSessionControl: record["itemSessionControl"] as ItemSessionControlView }
      : {}),
    ...(isRecord(record["timeLimits"]) ? { timeLimits: record["timeLimits"] as TimeLimitsView } : {}),
  };
}

function convertItemRef(ref: Record<string, unknown>): AssessmentItemRefView {
  return {
    kind: "assessmentItemRef",
    identifier: typeof ref["identifier"] === "string" ? ref["identifier"] : "",
    ...(typeof ref["href"] === "string" ? { href: ref["href"] } : {}),
    ...(Array.isArray(ref["category"]) ? { categories: ref["category"] as string[] } : {}),
    ...(typeof ref["fixed"] === "boolean" ? { fixed: ref["fixed"] } : {}),
    ...(typeof ref["required"] === "boolean" ? { required: ref["required"] } : {}),
    ...(ref["preConditions"] !== undefined ? { preConditions: convertPreConditions(ref["preConditions"]) } : {}),
    ...(ref["branchRules"] !== undefined ? { branchRules: convertBranchRules(ref["branchRules"]) } : {}),
    ...(Array.isArray(ref["weights"])
      ? { weights: ref["weights"] as NonNullable<AssessmentItemRefView["weights"]> }
      : {}),
    ...(Array.isArray(ref["templateDefaults"])
      ? {
          templateDefaults: asRecords(ref["templateDefaults"]).map((entry) => ({
            templateIdentifier: typeof entry["templateIdentifier"] === "string" ? entry["templateIdentifier"] : "",
            expression: convertExpression(entry["expression"]),
          })),
        }
      : {}),
    ...sessionControlAndTimeLimits(ref),
  };
}

function convertSection(section: Record<string, unknown>): AssessmentSectionView {
  // No `kind` discriminator in the normalized shape: sections carry `visible`/`title`,
  // item refs an `href`. (Unresolved section-refs share the item-ref shape; the corpus
  // has none and external sections need a package loader anyway.)
  const children = asRecords(section["children"]).map((child) =>
    child["visible"] !== undefined || child["children"] !== undefined ? convertSection(child) : convertItemRef(child),
  );

  return {
    kind: "assessmentSection",
    identifier: typeof section["identifier"] === "string" ? section["identifier"] : "",
    ...(typeof section["title"] === "string" ? { title: section["title"] } : {}),
    ...(typeof section["visible"] === "boolean" ? { visible: section["visible"] } : {}),
    ...(typeof section["fixed"] === "boolean" ? { fixed: section["fixed"] } : {}),
    ...(typeof section["required"] === "boolean" ? { required: section["required"] } : {}),
    ...(typeof section["keepTogether"] === "boolean" ? { keepTogether: section["keepTogether"] } : {}),
    ...(isRecord(section["selection"])
      ? { selection: section["selection"] as unknown as NonNullable<AssessmentSectionView["selection"]> }
      : {}),
    ...(isRecord(section["ordering"])
      ? { ordering: section["ordering"] as unknown as NonNullable<AssessmentSectionView["ordering"]> }
      : {}),
    ...(section["preConditions"] !== undefined
      ? { preConditions: convertPreConditions(section["preConditions"]) }
      : {}),
    ...(section["branchRules"] !== undefined ? { branchRules: convertBranchRules(section["branchRules"]) } : {}),
    ...sessionControlAndTimeLimits(section),
    ...rubricBlocksView(section),
    children,
  };
}

function convertTestFeedback(feedback: Record<string, unknown>): TestFeedbackView {
  const converted = convertContentValue(feedback) as Record<string, unknown>;

  return {
    outcomeIdentifier: typeof converted["outcomeIdentifier"] === "string" ? converted["outcomeIdentifier"] : "",
    identifier: typeof converted["identifier"] === "string" ? converted["identifier"] : "",
    ...(converted["access"] === "atEnd" || converted["access"] === "during" ? { access: converted["access"] } : {}),
    ...(converted["showHide"] === "show" || converted["showHide"] === "hide"
      ? { showHide: converted["showHide"] }
      : {}),
    ...(Array.isArray(converted["content"]) ? { content: converted["content"] as BodyNode[] } : {}),
  };
}

// A rubric block round-trips structurally: only its `content` body needs the document↔view
// content reshape; every other field (`view`, `use`, `printedVariable`, `catalogInfo`, …) passes
// through `convertContentValue`/`contentValueToDocument` (which are inverses) unchanged.
function convertRubricBlock(block: Record<string, unknown>): RubricBlockView {
  return convertContentValue(block) as unknown as RubricBlockView;
}

function rubricBlocksView(record: Record<string, unknown>): { rubricBlocks?: readonly RubricBlockView[] } {
  return Array.isArray(record["rubricBlocks"])
    ? { rubricBlocks: asRecords(record["rubricBlocks"]).map(convertRubricBlock) }
    : {};
}

/**
 * Reshape a normalized QTI document into the Test Controller's `AssessmentTestView`,
 * or null when it is not an assessment test.
 */
export function assessmentTestViewFromNormalized(document: unknown): AssessmentTestView | null {
  if (!isRecord(document) || !isRecord(document["assessmentTest"])) {
    return null;
  }

  const testDocument = document["assessmentTest"];
  const outcomeRules = isRecord(testDocument["outcomeProcessing"])
    ? testDocument["outcomeProcessing"]["rules"]
    : undefined;

  const testParts: TestPartView[] = asRecords(testDocument["testParts"]).map((part) => ({
    identifier: typeof part["identifier"] === "string" ? part["identifier"] : "",
    navigationMode: part["navigationMode"] === "nonlinear" ? "nonlinear" : "linear",
    submissionMode: part["submissionMode"] === "simultaneous" ? "simultaneous" : "individual",
    ...(part["preConditions"] !== undefined ? { preConditions: convertPreConditions(part["preConditions"]) } : {}),
    ...(part["branchRules"] !== undefined ? { branchRules: convertBranchRules(part["branchRules"]) } : {}),
    ...sessionControlAndTimeLimits(part),
    ...rubricBlocksView(part),
    assessmentSections: asRecords(part["children"]).map(convertSection),
  }));

  return {
    identifier: typeof testDocument["identifier"] === "string" ? testDocument["identifier"] : "",
    ...(typeof testDocument["title"] === "string" ? { title: testDocument["title"] } : {}),
    outcomeDeclarations: (testDocument["outcomeDeclarations"] as OutcomeDeclarationView[] | undefined) ?? [],
    ...(isRecord(testDocument["timeLimits"]) ? { timeLimits: testDocument["timeLimits"] as TimeLimitsView } : {}),
    ...rubricBlocksView(testDocument),
    testParts,
    ...(Array.isArray(outcomeRules)
      ? { outcomeProcessing: { rules: outcomeRules.map(convertOutcomeRule) as unknown as readonly OutcomeRuleView[] } }
      : {}),
    ...(Array.isArray(testDocument["testFeedbacks"])
      ? { testFeedbacks: asRecords(testDocument["testFeedbacks"]).map(convertTestFeedback) }
      : {}),
  };
}

// ===========================================================================
// assessmentTest VIEW → normalized DOCUMENT — the inverse of the projection above.
//
// `assessmentTestViewFromNormalized` is one-way; an authoring system that holds a view (or a
// view-shaped authoring structure) cannot serialize it without re-deriving the document field
// names. This is that inverse, exactly mirroring the `convert*` reshapes (children↔expressions,
// actions↔rules, assessmentSections↔children, category↔categories, the preCondition `{expression}`
// wrapper, dropped `kind` discriminators), so `serializeQtiAssessmentTest` can consume the result.
// Proven by view→document→view idempotence over the corpus (normalized-test-document.test.ts).
//
// Scope: the structural assessmentTest surface an authoring system produces (parts, sections,
// itemRefs, conditions over the RP expression union, test outcomes/processing, test feedback).
// Item-level response/template processing and interaction content are item-document concerns,
// not assessmentTest ones, so the content inverse here handles non-interactive feedback content.
// ===========================================================================

const reverseContentKindRenames: Readonly<Record<string, string>> = {
  hottextInteraction: "hotTextInteraction",
  hottext: "hotText",
};

function expressionToDocument(expression: unknown): Record<string, unknown> {
  const record = isRecord(expression) ? expression : {};
  const { expressions, ...rest } = record;

  return {
    ...rest,
    ...(Array.isArray(expressions) ? { children: expressions.map(expressionToDocument) } : {}),
  };
}

// View preConditions are bare expressions; the document wraps each in `{ expression }`.
function preConditionsToDocument(value: readonly unknown[]): Record<string, unknown>[] {
  return value.map((expression) => ({ expression: expressionToDocument(expression) }));
}

function branchRulesToDocument(value: readonly unknown[]): Record<string, unknown>[] {
  return asRecords(value).map((rule) => ({
    ...(typeof rule["target"] === "string" ? { target: rule["target"] } : {}),
    expression: expressionToDocument(rule["expression"]),
  }));
}

// View condition branch `{ expression, rules }` → document `{ expression, actions }`.
function outcomeBranchToDocument(branch: unknown): Record<string, unknown> {
  const record = isRecord(branch) ? branch : {};
  return {
    expression: expressionToDocument(record["expression"]),
    actions: asRecords(record["rules"]).map(outcomeRuleToDocument),
  };
}

function outcomeRuleToDocument(rule: unknown): Record<string, unknown> {
  const record = isRecord(rule) ? rule : {};
  const kind = typeof record["kind"] === "string" ? record["kind"] : "";

  if (kind === "outcomeCondition") {
    const elseIfs = asRecords(record["outcomeElseIfs"]).map(outcomeBranchToDocument);

    return {
      kind,
      outcomeIf: outcomeBranchToDocument(record["outcomeIf"]),
      ...(elseIfs.length ? { outcomeElseIf: elseIfs } : {}),
      ...(isRecord(record["outcomeElse"])
        ? { outcomeElse: { actions: asRecords(record["outcomeElse"]["rules"]).map(outcomeRuleToDocument) } }
        : {}),
    };
  }

  if (kind === "outcomeProcessingFragment") {
    return { kind, rules: asRecords(record["rules"]).map(outcomeRuleToDocument) };
  }

  return {
    kind,
    ...(typeof record["identifier"] === "string" ? { identifier: record["identifier"] } : {}),
    ...(record["expression"] !== undefined ? { expression: expressionToDocument(record["expression"]) } : {}),
  };
}

function contentNodeToDocument(node: Record<string, unknown>): Record<string, unknown> {
  const kind = node["kind"];
  if (typeof kind === "string" && reverseContentKindRenames[kind] !== undefined) {
    return { ...node, kind: reverseContentKindRenames[kind] };
  }
  return node;
}

// Inverse of `convertContentEntry`: a `{ kind: "text", value }` node in a children/content
// array was a bare string in the document.
function contentEntryToDocument(entry: unknown): unknown {
  if (isRecord(entry) && entry["kind"] === "text" && typeof entry["value"] === "string") {
    return entry["value"];
  }
  return contentValueToDocument(entry);
}

function contentValueToDocument(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(contentValueToDocument);
  }
  if (!isRecord(value)) {
    return value;
  }

  const node = contentNodeToDocument(value);
  return Object.fromEntries(
    Object.entries(node).map(([key, entry]) =>
      (key === "children" || key === "content") && Array.isArray(entry)
        ? [key, entry.map(contentEntryToDocument)]
        : [key, contentValueToDocument(entry)],
    ),
  );
}

// Inverse of `convertRubricBlock`: reshape the content body back to the document form and ensure
// the `testRubricBlock` discriminator the serializer reads (an authoring view may omit it).
function rubricBlockToDocument(block: unknown): Record<string, unknown> {
  const record = contentValueToDocument(block);
  return { ...(isRecord(record) ? record : {}), kind: "testRubricBlock" };
}

function rubricBlocksToDocument(record: Record<string, unknown>): { rubricBlocks?: Record<string, unknown>[] } {
  return Array.isArray(record["rubricBlocks"])
    ? { rubricBlocks: record["rubricBlocks"].map(rubricBlockToDocument) }
    : {};
}

function structureConditionsToDocument(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(Array.isArray(record["preConditions"])
      ? { preConditions: preConditionsToDocument(record["preConditions"]) }
      : {}),
    ...(Array.isArray(record["branchRules"]) ? { branchRules: branchRulesToDocument(record["branchRules"]) } : {}),
    ...(isRecord(record["itemSessionControl"]) ? { itemSessionControl: record["itemSessionControl"] } : {}),
    ...(isRecord(record["timeLimits"]) ? { timeLimits: record["timeLimits"] } : {}),
  };
}

function itemRefToDocument(ref: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(typeof ref["identifier"] === "string" ? { identifier: ref["identifier"] } : {}),
    ...(typeof ref["href"] === "string" ? { href: ref["href"] } : {}),
    // The view pluralises `category` → `categories`.
    ...(Array.isArray(ref["categories"]) ? { category: ref["categories"] } : {}),
    ...(typeof ref["fixed"] === "boolean" ? { fixed: ref["fixed"] } : {}),
    ...(typeof ref["required"] === "boolean" ? { required: ref["required"] } : {}),
    ...structureConditionsToDocument(ref),
    ...(Array.isArray(ref["weights"]) ? { weights: ref["weights"] } : {}),
    ...(Array.isArray(ref["templateDefaults"])
      ? {
          templateDefaults: asRecords(ref["templateDefaults"]).map((entry) => ({
            ...(typeof entry["templateIdentifier"] === "string"
              ? { templateIdentifier: entry["templateIdentifier"] }
              : {}),
            expression: expressionToDocument(entry["expression"]),
          })),
        }
      : {}),
  };
}

function sectionChildToDocument(child: Record<string, unknown>): Record<string, unknown> {
  return child["kind"] === "assessmentSection" ? sectionToDocument(child) : itemRefToDocument(child);
}

function sectionToDocument(section: Record<string, unknown>): Record<string, unknown> {
  const identifier = typeof section["identifier"] === "string" ? section["identifier"] : "";

  return {
    identifier,
    // `title` and `visible` are required in the document (optional in the view); fall back to
    // the QTI defaults (identifier as a non-empty title; visible sections).
    title: typeof section["title"] === "string" ? section["title"] : identifier,
    visible: typeof section["visible"] === "boolean" ? section["visible"] : true,
    ...(typeof section["fixed"] === "boolean" ? { fixed: section["fixed"] } : {}),
    ...(typeof section["required"] === "boolean" ? { required: section["required"] } : {}),
    ...(typeof section["keepTogether"] === "boolean" ? { keepTogether: section["keepTogether"] } : {}),
    ...(isRecord(section["selection"]) ? { selection: section["selection"] } : {}),
    ...(isRecord(section["ordering"]) ? { ordering: section["ordering"] } : {}),
    ...structureConditionsToDocument(section),
    ...rubricBlocksToDocument(section),
    children: asRecords(section["children"]).map(sectionChildToDocument),
  };
}

function testPartToDocument(part: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(typeof part["identifier"] === "string" ? { identifier: part["identifier"] } : {}),
    ...(typeof part["navigationMode"] === "string" ? { navigationMode: part["navigationMode"] } : {}),
    ...(typeof part["submissionMode"] === "string" ? { submissionMode: part["submissionMode"] } : {}),
    ...structureConditionsToDocument(part),
    ...rubricBlocksToDocument(part),
    // The view names a part's sections `assessmentSections`; the document nests them under `children`.
    children: asRecords(part["assessmentSections"]).map(sectionToDocument),
  };
}

function testFeedbackToDocument(feedback: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(typeof feedback["access"] === "string" ? { access: feedback["access"] } : {}),
    ...(typeof feedback["outcomeIdentifier"] === "string" ? { outcomeIdentifier: feedback["outcomeIdentifier"] } : {}),
    ...(typeof feedback["identifier"] === "string" ? { identifier: feedback["identifier"] } : {}),
    ...(typeof feedback["showHide"] === "string" ? { showHide: feedback["showHide"] } : {}),
    ...(Array.isArray(feedback["content"]) ? { content: feedback["content"].map(contentEntryToDocument) } : {}),
  };
}

/**
 * Project an `AssessmentTestView` back to the normalized `qti-assessment-test` document
 * `serializeQtiAssessmentTest` consumes — the inverse of `assessmentTestViewFromNormalized`.
 * Authoring systems that hold a view (or a view-shaped authoring structure) use this to export
 * QTI XML without re-implementing the serializer.
 */
export function assessmentTestDocumentFromView(view: AssessmentTestView): unknown {
  const test = view as unknown as Record<string, unknown>;
  const outcomeDeclarations = Array.isArray(test["outcomeDeclarations"]) ? test["outcomeDeclarations"] : [];
  const outcomeProcessing = isRecord(test["outcomeProcessing"]) ? test["outcomeProcessing"] : undefined;

  return {
    assessmentTest: {
      ...(typeof test["identifier"] === "string" ? { identifier: test["identifier"] } : {}),
      ...(typeof test["title"] === "string" ? { title: test["title"] } : {}),
      ...(outcomeDeclarations.length ? { outcomeDeclarations } : {}),
      ...(isRecord(test["timeLimits"]) ? { timeLimits: test["timeLimits"] } : {}),
      ...rubricBlocksToDocument(test),
      testParts: asRecords(test["testParts"]).map(testPartToDocument),
      ...(outcomeProcessing
        ? { outcomeProcessing: { rules: asRecords(outcomeProcessing["rules"]).map(outcomeRuleToDocument) } }
        : {}),
      ...(Array.isArray(test["testFeedbacks"])
        ? { testFeedbacks: asRecords(test["testFeedbacks"]).map(testFeedbackToDocument) }
        : {}),
    },
  };
}
