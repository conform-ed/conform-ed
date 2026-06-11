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
 *   `responseElseIf`/`templateElseIf` pluralize
 *
 * Used by the corpus delivery meter (ADR-0002) and by any consumer ingesting
 * normalized XML.
 */

import { parseCoords } from "./graphic";
import type {
  OutcomeDeclarationView,
  ResponseProcessingView,
  RpExpressionView,
  RpRuleView,
  TemplateDeclarationView,
  TemplateProcessingView,
  TemplateRuleView,
} from "./rp";
import type { AssessmentItemView, BodyNode, FeedbackView } from "./runtime";
import type {
  AssessmentItemRefView,
  AssessmentSectionView,
  AssessmentTestView,
  BranchRuleView,
  OutcomeRuleView,
  TestFeedbackView,
  TestPartView,
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
  } as RpExpressionView;
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
export function assessmentItemViewFromNormalized(document: unknown): AssessmentItemView | null {
  if (!isRecord(document) || !isRecord(document["assessmentItem"])) {
    return null;
  }

  const item = document["assessmentItem"];
  const itemBody = isRecord(item["itemBody"]) ? item["itemBody"] : {};
  const content = Array.isArray(itemBody["content"]) ? itemBody["content"].map(convertContentEntry) : [];
  const templateRules = isRecord(item["templateProcessing"]) ? item["templateProcessing"]["rules"] : undefined;

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
    ...(Array.isArray(item["modalFeedbacks"])
      ? { modalFeedbacks: item["modalFeedbacks"].map(convertContentValue) as unknown as readonly FeedbackView[] }
      : {}),
    itemBody: { content: content as BodyNode[] },
  };
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

  return {
    kind,
    ...(typeof record["identifier"] === "string" ? { identifier: record["identifier"] } : {}),
    ...(record["expression"] !== undefined ? { expression: convertExpression(record["expression"]) } : {}),
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
    ...(isRecord(section["selection"])
      ? { selection: section["selection"] as unknown as AssessmentSectionView["selection"] }
      : {}),
    ...(isRecord(section["ordering"])
      ? { ordering: section["ordering"] as unknown as AssessmentSectionView["ordering"] }
      : {}),
    ...(section["preConditions"] !== undefined
      ? { preConditions: convertPreConditions(section["preConditions"]) }
      : {}),
    ...(section["branchRules"] !== undefined ? { branchRules: convertBranchRules(section["branchRules"]) } : {}),
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
    assessmentSections: asRecords(part["children"]).map(convertSection),
  }));

  return {
    identifier: typeof testDocument["identifier"] === "string" ? testDocument["identifier"] : "",
    ...(typeof testDocument["title"] === "string" ? { title: testDocument["title"] } : {}),
    outcomeDeclarations: (testDocument["outcomeDeclarations"] as OutcomeDeclarationView[] | undefined) ?? [],
    testParts,
    ...(Array.isArray(outcomeRules)
      ? { outcomeProcessing: { rules: outcomeRules.map(convertOutcomeRule) as unknown as readonly OutcomeRuleView[] } }
      : {}),
    ...(Array.isArray(testDocument["testFeedbacks"])
      ? { testFeedbacks: asRecords(testDocument["testFeedbacks"]).map(convertTestFeedback) }
      : {}),
  };
}
