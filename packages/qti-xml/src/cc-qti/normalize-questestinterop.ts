/**
 * Normalize a Common Cartridge QTI ASI 1.2.1 (`questestinterop`) document — the QTI dialect
 * CC 1.3/1.4 carries — from raw XML into the `kind`-tagged structure described by
 * `@conform-ed/contracts/common-cartridge/v1_4`. This mirrors the QTI 3 `normalize.ts`
 * pattern (XML node tree → typed contract shape) and is the input stage of the CC→QTI-3
 * bridge (`convert-to-v3.ts`). The output is validated against the official CC profile, so
 * non-conformant questestinterop is rejected here rather than silently mis-converted.
 */

import {
  QtiQuestestinteropProfileDocumentSchema,
  QtiQuestestinteropRawDocumentSchema,
  type QtiQuestestinteropRaw,
} from "@conform-ed/contracts/common-cartridge/v1_4";

import { parseXmlDocument, type QtiXmlElementNode, type QtiXmlNode } from "../parse-xml";

/** CC 1.x carries QTI ASI 1.2.1 under this namespace. */
export const ccQtiNamespace = "http://www.imsglobal.org/xsd/ims_qtiasiv1p2";

type Json = Record<string, unknown>;

function elements(node: QtiXmlElementNode, localName?: string): QtiXmlElementNode[] {
  return node.children.filter(
    (child): child is QtiXmlElementNode =>
      child.type === "element" && (localName === undefined || child.localName === localName),
  );
}

function firstElement(node: QtiXmlElementNode, localName: string): QtiXmlElementNode | undefined {
  return elements(node, localName)[0];
}

function attr(node: QtiXmlElementNode, name: string): string | undefined {
  const value = node.attributes[name];
  return value === undefined ? undefined : value;
}

/** Concatenate the direct + descendant text of a node (mattext/varequal/setvar carry text). */
function textOf(node: QtiXmlElementNode): string {
  const parts: string[] = [];
  const walk = (children: QtiXmlNode[]): void => {
    for (const child of children) {
      if (child.type === "text") {
        parts.push(child.value);
      } else {
        walk(child.children);
      }
    }
  };
  walk(node.children);
  return parts.join("").trim();
}

function put(target: Json, key: string, value: string | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

// --- material / content ----------------------------------------------------

function mapMatText(node: QtiXmlElementNode): Json {
  const out: Json = { kind: "mattext", value: textOf(node) };
  put(out, "texttype", attr(node, "texttype"));
  put(out, "charset", attr(node, "charset"));
  put(out, "label", attr(node, "label"));
  put(out, "uri", attr(node, "uri"));
  put(out, "width", attr(node, "width"));
  put(out, "height", attr(node, "height"));
  put(out, "x0", attr(node, "x0"));
  put(out, "y0", attr(node, "y0"));
  put(out, "xmlLang", attr(node, "xml:lang"));
  put(out, "xmlSpace", attr(node, "xml:space"));
  return out;
}

function mapMaterialChild(node: QtiXmlElementNode): Json | undefined {
  switch (node.localName) {
    case "mattext":
      return mapMatText(node);
    case "matref":
      return { kind: "matref", linkrefid: attr(node, "linkrefid") ?? "" };
    case "matbreak":
      return { kind: "matbreak" };
    default:
      return undefined;
  }
}

function mapAltMaterial(node: QtiXmlElementNode): Json {
  const out: Json = {
    kind: "altmaterial",
    children: elements(node)
      .map(mapMaterialChild)
      .filter((child): child is Json => child !== undefined),
  };
  put(out, "xmlLang", attr(node, "xml:lang"));
  return out;
}

function mapMaterial(node: QtiXmlElementNode): Json {
  const out: Json = {
    kind: "material",
    children: elements(node)
      .filter((child) => child.localName !== "altmaterial")
      .map(mapMaterialChild)
      .filter((child): child is Json => child !== undefined),
  };
  put(out, "label", attr(node, "label"));
  put(out, "xmlLang", attr(node, "xml:lang"));
  const altmaterial = elements(node, "altmaterial");
  if (altmaterial.length > 0) {
    out["altmaterial"] = altmaterial.map(mapAltMaterial);
  }
  return out;
}

function mapMaterialRef(node: QtiXmlElementNode): Json {
  return { kind: "material_ref", linkrefid: attr(node, "linkrefid") ?? "" };
}

function mapFlowMat(node: QtiXmlElementNode): Json {
  const out: Json = {
    kind: "flow_mat",
    children: elements(node)
      .map((child) => {
        if (child.localName === "flow_mat") return mapFlowMat(child);
        if (child.localName === "material") return mapMaterial(child);
        if (child.localName === "material_ref") return mapMaterialRef(child);
        return undefined;
      })
      .filter((child): child is Json => child !== undefined),
  };
  put(out, "class", attr(node, "class"));
  return out;
}

// --- presentation / responses ----------------------------------------------

function mapResponseLabel(node: QtiXmlElementNode): Json {
  const out: Json = { kind: "response_label", ident: attr(node, "ident") ?? "" };
  put(out, "labelrefid", attr(node, "labelrefid"));
  put(out, "rshuffle", attr(node, "rshuffle"));
  put(out, "match_group", attr(node, "match_group"));
  put(out, "match_max", attr(node, "match_max"));
  const children = elements(node)
    .map((child) => {
      if (child.localName === "material") return mapMaterial(child);
      if (child.localName === "material_ref") return mapMaterialRef(child);
      if (child.localName === "flow_mat") return mapFlowMat(child);
      return undefined;
    })
    .filter((child): child is Json => child !== undefined);
  if (children.length > 0) {
    out["children"] = children;
  }
  return out;
}

function mapFlowLabel(node: QtiXmlElementNode): Json {
  const out: Json = {
    kind: "flow_label",
    children: elements(node)
      .map((child) => {
        if (child.localName === "flow_label") return mapFlowLabel(child);
        if (child.localName === "response_label") return mapResponseLabel(child);
        return undefined;
      })
      .filter((child): child is Json => child !== undefined),
  };
  put(out, "class", attr(node, "class"));
  return out;
}

function mapRenderChildren(node: QtiXmlElementNode): Json[] {
  return elements(node)
    .map((child) => {
      if (child.localName === "material") return mapMaterial(child);
      if (child.localName === "material_ref") return mapMaterialRef(child);
      if (child.localName === "response_label") return mapResponseLabel(child);
      if (child.localName === "flow_label") return mapFlowLabel(child);
      return undefined;
    })
    .filter((child): child is Json => child !== undefined);
}

function mapRender(node: QtiXmlElementNode): Json {
  if (node.localName === "render_fib") {
    const out: Json = { kind: "render_fib" };
    put(out, "encoding", attr(node, "encoding"));
    put(out, "charset", attr(node, "charset"));
    put(out, "rows", attr(node, "rows"));
    put(out, "columns", attr(node, "columns"));
    put(out, "maxchars", attr(node, "maxchars"));
    put(out, "minnumber", attr(node, "minnumber"));
    put(out, "maxnumber", attr(node, "maxnumber"));
    put(out, "prompt", attr(node, "prompt"));
    put(out, "fibtype", attr(node, "fibtype"));
    const children = mapRenderChildren(node);
    if (children.length > 0) out["children"] = children;
    return out;
  }
  // render_choice (default)
  const out: Json = { kind: "render_choice" };
  put(out, "shuffle", attr(node, "shuffle"));
  put(out, "minnumber", attr(node, "minnumber"));
  put(out, "maxnumber", attr(node, "maxnumber"));
  const children = mapRenderChildren(node);
  if (children.length > 0) out["children"] = children;
  return out;
}

function mapLeadingTrailing(node: QtiXmlElementNode): Json | undefined {
  if (node.localName === "material") return mapMaterial(node);
  if (node.localName === "material_ref") return mapMaterialRef(node);
  return undefined;
}

function mapResponse(node: QtiXmlElementNode): Json {
  const kind = node.localName === "response_str" ? "response_str" : "response_lid";
  const out: Json = { kind, ident: attr(node, "ident") ?? "" };
  put(out, "rcardinality", attr(node, "rcardinality"));
  put(out, "rtiming", attr(node, "rtiming"));

  const renderNode = elements(node).find((child) => child.localName.startsWith("render_"));
  // `render` is required by the contract; if absent we still emit an empty render_choice so
  // the structural shape is preserved and validation surfaces the omission.
  out["render"] = renderNode ? mapRender(renderNode) : { kind: "render_choice" };

  const childEls = elements(node);
  const leadingIndex = childEls.findIndex((c) => c.localName === "material" || c.localName === "material_ref");
  const renderIndex = childEls.findIndex((c) => c.localName.startsWith("render_"));
  if (leadingIndex !== -1 && (renderIndex === -1 || leadingIndex < renderIndex)) {
    const leading = mapLeadingTrailing(childEls[leadingIndex]!);
    if (leading) out["leading"] = leading;
  }
  const trailingEls = childEls.filter(
    (c, i) => (c.localName === "material" || c.localName === "material_ref") && i > renderIndex && renderIndex !== -1,
  );
  if (trailingEls.length > 0) {
    const trailing = mapLeadingTrailing(trailingEls[0]!);
    if (trailing) out["trailing"] = trailing;
  }
  return out;
}

function mapFlow(node: QtiXmlElementNode): Json {
  const out: Json = {
    kind: "flow",
    children: elements(node)
      .map((child) => {
        if (child.localName === "flow") return mapFlow(child);
        if (child.localName === "material") return mapMaterial(child);
        if (child.localName === "material_ref") return mapMaterialRef(child);
        if (child.localName === "response_lid" || child.localName === "response_str") return mapResponse(child);
        return undefined;
      })
      .filter((child): child is Json => child !== undefined),
  };
  put(out, "class", attr(node, "class"));
  return out;
}

function mapPresentation(node: QtiXmlElementNode): Json {
  const flowNode = firstElement(node, "flow");
  const common: Json = {};
  put(common, "label", attr(node, "label"));
  put(common, "xmlLang", attr(node, "xml:lang"));
  put(common, "x0", attr(node, "x0"));
  put(common, "y0", attr(node, "y0"));
  put(common, "width", attr(node, "width"));
  put(common, "height", attr(node, "height"));

  if (flowNode) {
    return { flow: mapFlow(flowNode), ...common };
  }
  return {
    children: elements(node)
      .map((child) => {
        if (child.localName === "material") return mapMaterial(child);
        if (child.localName === "response_lid" || child.localName === "response_str") return mapResponse(child);
        return undefined;
      })
      .filter((child): child is Json => child !== undefined),
    ...common,
  };
}

// --- response processing ---------------------------------------------------

function mapConditionNode(node: QtiXmlElementNode): Json | undefined {
  switch (node.localName) {
    case "varequal":
      return {
        kind: "varequal",
        value: textOf(node),
        respident: attr(node, "respident") ?? "",
        ...(attr(node, "case") !== undefined ? { case: attr(node, "case") } : {}),
      };
    case "varsubstring":
      return {
        kind: "varsubstring",
        value: textOf(node),
        respident: attr(node, "respident") ?? "",
        ...(attr(node, "case") !== undefined ? { case: attr(node, "case") } : {}),
      };
    case "and":
      return { kind: "and", tests: mapConditionTests(node) };
    case "or":
      return { kind: "or", tests: mapConditionTests(node) };
    case "not":
      return { kind: "not", tests: mapConditionTests(node) };
    case "other":
      return { kind: "other" };
    default:
      return undefined;
  }
}

function mapConditionTests(node: QtiXmlElementNode): Json[] {
  return elements(node)
    .map(mapConditionNode)
    .filter((child): child is Json => child !== undefined);
}

function mapRespCondition(node: QtiXmlElementNode): Json {
  const conditionvar = firstElement(node, "conditionvar");
  const out: Json = {
    conditionvar: { tests: conditionvar ? mapConditionTests(conditionvar) : [] },
  };
  put(out, "title", attr(node, "title"));
  put(out, "continue", attr(node, "continue"));

  const setvars = elements(node, "setvar").map((sv) => {
    const entry: Json = { value: textOf(sv) };
    put(entry, "varname", attr(sv, "varname"));
    put(entry, "action", attr(sv, "action"));
    return entry;
  });
  if (setvars.length > 0) out["setvar"] = setvars;

  const feedbacks = elements(node, "displayfeedback").map((df) => {
    const entry: Json = {
      feedbacktype: attr(df, "feedbacktype") ?? "Response",
      linkrefid: attr(df, "linkrefid") ?? "",
    };
    const value = textOf(df);
    if (value.length > 0) entry["value"] = value;
    return entry;
  });
  if (feedbacks.length > 0) out["displayfeedback"] = feedbacks;

  return out;
}

function mapResprocessing(node: QtiXmlElementNode): Json {
  const outcomesNode = firstElement(node, "outcomes");
  const decvarNode = outcomesNode ? firstElement(outcomesNode, "decvar") : undefined;
  const decvar: Json = {
    value: attr(decvarNode ?? node, "defaultval") ?? "",
    varname: attr(decvarNode ?? node, "varname") ?? "SCORE",
  };
  put(decvar, "vartype", attr(decvarNode ?? node, "vartype"));
  put(decvar, "minvalue", attr(decvarNode ?? node, "minvalue"));
  put(decvar, "maxvalue", attr(decvarNode ?? node, "maxvalue"));

  return {
    outcomes: { decvar },
    respcondition: elements(node, "respcondition").map(mapRespCondition),
  };
}

// --- item feedback ---------------------------------------------------------

function mapFeedbackMaterialList(node: QtiXmlElementNode): Json {
  const flowMats = elements(node, "flow_mat");
  if (flowMats.length > 0) {
    return { flow_mat: flowMats.map(mapFlowMat) };
  }
  return { material: elements(node, "material").map(mapMaterial) };
}

function mapSolution(node: QtiXmlElementNode): Json {
  const out: Json = {
    kind: "solution",
    solutionmaterial: elements(node, "solutionmaterial").map(mapFeedbackMaterialList),
  };
  put(out, "feedbackstyle", attr(node, "feedbackstyle"));
  return out;
}

function mapHint(node: QtiXmlElementNode): Json {
  const out: Json = { kind: "hint", hintmaterial: elements(node, "hintmaterial").map(mapFeedbackMaterialList) };
  put(out, "feedbackstyle", attr(node, "feedbackstyle"));
  return out;
}

function mapItemFeedback(node: QtiXmlElementNode): Json {
  const out: Json = {
    ident: attr(node, "ident") ?? "",
    children: elements(node)
      .map((child) => {
        if (child.localName === "flow_mat") return mapFlowMat(child);
        if (child.localName === "material") return mapMaterial(child);
        if (child.localName === "solution") return mapSolution(child);
        if (child.localName === "hint") return mapHint(child);
        return undefined;
      })
      .filter((child): child is Json => child !== undefined),
  };
  put(out, "title", attr(node, "title"));
  return out;
}

// --- item / metadata / section / assessment / objectbank -------------------

function mapQtimetadata(node: QtiXmlElementNode): Json {
  return {
    qtimetadatafield: elements(node, "qtimetadatafield").map((field) => {
      const labelNode = firstElement(field, "fieldlabel");
      const entryNode = firstElement(field, "fieldentry");
      const out: Json = {
        fieldlabel: labelNode ? textOf(labelNode) : "",
        fieldentry: entryNode ? textOf(entryNode) : "",
      };
      put(out, "xmlLang", attr(field, "xml:lang"));
      return out;
    }),
  };
}

function mapItem(node: QtiXmlElementNode): Json {
  const out: Json = { ident: attr(node, "ident") ?? "" };
  put(out, "title", attr(node, "title"));
  put(out, "xmlLang", attr(node, "xml:lang"));

  const itemmetadata = firstElement(node, "itemmetadata");
  if (itemmetadata) {
    out["itemmetadata"] = {
      qtimetadata: elements(itemmetadata, "qtimetadata").map(mapQtimetadata),
    };
  }

  const presentation = firstElement(node, "presentation");
  if (presentation) {
    out["presentation"] = mapPresentation(presentation);
  }

  const resprocessing = elements(node, "resprocessing");
  if (resprocessing.length > 0) {
    out["resprocessing"] = resprocessing.map(mapResprocessing);
  }

  const itemfeedback = elements(node, "itemfeedback");
  if (itemfeedback.length > 0) {
    out["itemfeedback"] = itemfeedback.map(mapItemFeedback);
  }

  return out;
}

function mapSection(node: QtiXmlElementNode): Json {
  const out: Json = {
    ident: attr(node, "ident") ?? "",
    item: elements(node, "item").map(mapItem),
  };
  put(out, "title", attr(node, "title"));
  put(out, "xmlLang", attr(node, "xml:lang"));
  return out;
}

function mapAssessment(node: QtiXmlElementNode): Json {
  const out: Json = {
    ident: attr(node, "ident") ?? "",
    title: attr(node, "title") ?? "",
  };
  put(out, "xmlLang", attr(node, "xml:lang"));
  const qtimetadata = firstElement(node, "qtimetadata");
  if (qtimetadata) out["qtimetadata"] = mapQtimetadata(qtimetadata);
  const section = firstElement(node, "section");
  out["section"] = section ? mapSection(section) : { ident: "root_section", item: [] };
  return out;
}

function mapObjectbank(node: QtiXmlElementNode): Json {
  const out: Json = {
    ident: attr(node, "ident") ?? "",
    item: elements(node, "item").map(mapItem),
  };
  const qtimetadata = firstElement(node, "qtimetadata");
  if (qtimetadata) out["qtimetadata"] = mapQtimetadata(qtimetadata);
  return out;
}

export type NormalizeQuestestinteropResult =
  | { status: "valid"; document: { questestinterop: QtiQuestestinteropRaw } }
  | { status: "invalid"; issues: string[] };

/**
 * Parse + normalize a `questestinterop` XML string into the CC 1.4 contract shape and validate
 * it. When `profile` is true (default), the stricter CC profile rules are applied (item-type
 * coherence, feedback linkage); when false, only the structural raw schema is checked.
 */
export function normalizeQuestestinterop(xml: string, options?: { profile?: boolean }): NormalizeQuestestinteropResult {
  const profile = options?.profile ?? true;

  let root: QtiXmlElementNode;
  try {
    root = parseXmlDocument(xml);
  } catch (error) {
    return { status: "invalid", issues: [error instanceof Error ? error.message : "Invalid XML."] };
  }

  if (root.localName !== "questestinterop") {
    return { status: "invalid", issues: [`Expected <questestinterop> root, found <${root.localName}>.`] };
  }

  const assessment = firstElement(root, "assessment");
  const objectbank = firstElement(root, "objectbank");

  let candidate: Json;
  if (assessment) {
    candidate = { questestinterop: { assessment: mapAssessment(assessment) } };
  } else if (objectbank) {
    candidate = { questestinterop: { objectbank: mapObjectbank(objectbank) } };
  } else {
    return { status: "invalid", issues: ["<questestinterop> must contain an <assessment> or <objectbank>."] };
  }

  const schema = profile ? QtiQuestestinteropProfileDocumentSchema : QtiQuestestinteropRawDocumentSchema;
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    return {
      status: "invalid",
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }

  return {
    status: "valid",
    document: parsed.data as { questestinterop: QtiQuestestinteropRaw },
  };
}
