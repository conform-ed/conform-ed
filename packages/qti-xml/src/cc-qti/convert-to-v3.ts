/**
 * Bridge Common Cartridge QTI ASI 1.2.1 (`questestinterop`) into QTI 3.0.1 ASI XML, so a CC
 * cartridge's assessments/question-banks can be ingested + delivered + scored by the same
 * QTI 3 engine as everything else (ADR-0022). The conversion targets the *normalized* QTI 3
 * document the serializers consume, so the emitted XML is guaranteed to re-validate via
 * `validateQtiXmlContent`.
 *
 * A `questestinterop` is either an `<objectbank>` (→ N standalone items) or an `<assessment>`
 * (→ N items + one `assessmentTest` that references them).
 */

import { parseXmlDocument, type QtiXmlElementNode } from "../parse-xml";
import { asiNamespace } from "../serialize-asi";
import { serializeQtiDocument } from "../serialize-document";
import { normalizeQuestestinterop } from "./normalize-questestinterop";

const MATCH_CORRECT = "https://www.imsglobal.org/question/qti_v3p0/rptemplates/match_correct";
const MAP_RESPONSE = "https://www.imsglobal.org/question/qti_v3p0/rptemplates/map_response";

type Node = Record<string, unknown>;
type Fragment = string | Node;

export type CcQtiInteractionKind = "choice" | "textEntry" | "extendedText";

export type CcQtiConvertedItem = {
  identifier: string;
  title: string;
  ccProfile: string | undefined;
  interactionKind: CcQtiInteractionKind;
  xml: string;
};

export type CcQtiConvertedTest = {
  identifier: string;
  title: string;
  itemIdentifiers: string[];
  xml: string;
};

export type CcQtiConversionResult =
  | {
      status: "converted";
      source: "assessment" | "objectbank";
      items: CcQtiConvertedItem[];
      test?: CcQtiConvertedTest;
    }
  | { status: "invalid"; issues: string[] };

// --- small node accessors (mirrors serialize-asi.ts style) -----------------

function asNode(value: unknown): Node {
  return (value ?? {}) as Node;
}
function arr(value: unknown): Node[] {
  return Array.isArray(value) ? (value as Node[]) : [];
}
function strOf(node: Node, key: string): string | undefined {
  const value = node[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * QTI 3 identifiers must match this NCName-ish pattern and be unique. Real cartridges (Canvas,
 * TopKit) use numeric choice/response idents (`42987`) and even reuse one item ident across a
 * whole quiz, so CC idents must be sanitized — consistently, since `correctResponse` values for
 * choice items *are* identifiers and must keep referencing the right choice.
 */
const QTI_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9._-]*$/u;

function sanitizeIdentifier(raw: string): string {
  if (raw.length > 0 && QTI_IDENTIFIER.test(raw)) return raw;
  const replaced = raw.replace(/[^A-Za-z0-9._-]/gu, "_");
  const prefixed = /^[A-Za-z_]/u.test(replaced) ? replaced : `id_${replaced}`;
  return prefixed.length > 0 ? prefixed : "_";
}

/** Sanitize + de-duplicate a list of CC identifiers, preserving order. */
function assignUniqueIdentifiers(rawIds: string[]): string[] {
  const used = new Set<string>();
  return rawIds.map((rawId) => {
    const base = sanitizeIdentifier(rawId);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  });
}

// --- content: CC material → QTI 3 content fragments ------------------------

function htmlToFragments(html: string): Fragment[] {
  try {
    const root = parseXmlDocument(`<div xmlns="${asiNamespace}">${html}</div>`);
    return mapXmlChildren(root);
  } catch {
    // Non-wellformed fragment: keep the text content rather than failing the conversion.
    return [html];
  }
}

function mapXmlElement(element: QtiXmlElementNode): Node {
  const children = mapXmlChildren(element);
  const out: Node = { kind: "xml", namespace: asiNamespace, name: element.localName };
  if (Object.keys(element.attributes).length > 0) {
    out["attributes"] = element.attributes;
  }
  if (children.length > 0) {
    out["children"] = children;
  }
  return out;
}

function mapXmlChildren(element: QtiXmlElementNode): Fragment[] {
  const fragments: Fragment[] = [];
  for (const child of element.children) {
    if (child.type === "text") {
      if (child.value.trim().length > 0) fragments.push(child.value);
    } else {
      fragments.push(mapXmlElement(child));
    }
  }
  return fragments;
}

function mattextFragments(mattext: Node): Fragment[] {
  const value = strOf(mattext, "value") ?? "";
  const texttype = strOf(mattext, "texttype");
  if (texttype && texttype.toLowerCase().includes("html")) {
    return htmlToFragments(value);
  }
  return value.length > 0 ? [value] : [];
}

function materialFragments(material: Node): Fragment[] {
  return arr(material["children"]).flatMap((child) => {
    const kind = strOf(child, "kind");
    if (kind === "mattext") return mattextFragments(child);
    if (kind === "matbreak") return [{ kind: "xml", namespace: asiNamespace, name: "br" } as Node];
    return [];
  });
}

/** Stem materials → itemBody block content; inline-only material is wrapped in a <p>. */
function stemContent(materials: Node[]): Fragment[] {
  const content: Fragment[] = [];
  for (const material of materials) {
    const fragments = materialFragments(material);
    if (fragments.length === 0) continue;
    if (fragments.every((fragment) => typeof fragment === "string")) {
      content.push({ kind: "xml", namespace: asiNamespace, name: "p", children: fragments });
    } else {
      content.push(...fragments);
    }
  }
  return content;
}

// --- presentation traversal ------------------------------------------------

type CollectedPresentation = {
  stemMaterials: Node[];
  response: Node | undefined;
};

function collectPresentation(presentation: Node): CollectedPresentation {
  const stemMaterials: Node[] = [];
  let response: Node | undefined;

  const visit = (node: Node): void => {
    const kind = strOf(node, "kind");
    if (kind === "response_lid" || kind === "response_str") {
      if (!response) response = node;
      const leading = node["leading"];
      if (leading && strOf(asNode(leading), "kind") === "material") stemMaterials.push(asNode(leading));
      return;
    }
    if (kind === "material") {
      stemMaterials.push(node);
      return;
    }
    if (kind === "flow") {
      for (const child of arr(node["children"])) visit(child);
    }
  };

  const flow = presentation["flow"];
  if (flow) {
    visit(asNode(flow));
  } else {
    for (const child of arr(presentation["children"])) visit(child);
  }

  return { stemMaterials, response };
}

function renderChoiceLabels(response: Node): Node[] {
  const render = asNode(response["render"]);
  return arr(render["children"]).filter((child) => strOf(child, "kind") === "response_label");
}

function choiceContent(label: Node): Fragment[] {
  const materials = arr(label["children"]).filter((child) => strOf(child, "kind") === "material");
  const fragments = materials.flatMap(materialFragments);
  return fragments.length > 0 ? fragments : [strOf(label, "ident") ?? ""];
}

// --- response processing extraction ----------------------------------------

type VarEqual = { respident: string; value: string; caseSensitive: boolean };

function collectVarequals(item: Node): VarEqual[] {
  const result: VarEqual[] = [];
  const walk = (node: Node): void => {
    const kind = strOf(node, "kind");
    if (kind === "varequal" || kind === "varsubstring") {
      result.push({
        respident: strOf(node, "respident") ?? "",
        value: strOf(node, "value") ?? "",
        caseSensitive: strOf(node, "case") === "Yes",
      });
      return;
    }
    if (kind === "and" || kind === "or" || kind === "not") {
      for (const test of arr(node["tests"])) walk(test);
    }
  };
  for (const resprocessing of arr(item["resprocessing"])) {
    for (const respcondition of arr(resprocessing["respcondition"])) {
      for (const test of arr(asNode(respcondition["conditionvar"])["tests"])) walk(test);
    }
  }
  return result;
}

// --- item conversion -------------------------------------------------------

function findCcProfile(item: Node): string | undefined {
  for (const metadata of arr(asNode(item["itemmetadata"])["qtimetadata"])) {
    for (const field of arr(metadata["qtimetadatafield"])) {
      if (strOf(field, "fieldlabel") === "cc_profile") return strOf(field, "fieldentry");
    }
  }
  return undefined;
}

function scoreOutcomeDeclaration(): Node {
  return {
    identifier: "SCORE",
    cardinality: "single",
    baseType: "float",
    defaultValue: { values: [{ value: "0" }] },
  };
}

type BuiltItem = { document: Node; interactionKind: CcQtiInteractionKind };

function buildChoiceItem(item: Node, response: Node, stem: Node[]): BuiltItem {
  const rawResponseId = strOf(response, "ident") ?? "RESPONSE";
  const responseId = sanitizeIdentifier(rawResponseId);
  const rcardinality = strOf(response, "rcardinality") ?? "Single";
  const cardinality = rcardinality === "Multiple" ? "multiple" : rcardinality === "Ordered" ? "ordered" : "single";
  const labels = renderChoiceLabels(response);
  // Choice idents are identifiers, so the correct-answer values (which reference them) get the
  // same sanitization — keeping the reference intact after numeric idents are rewritten.
  const correct = collectVarequals(item)
    .filter((entry) => entry.respident === rawResponseId)
    .map((entry) => sanitizeIdentifier(entry.value));

  const interaction: Node = {
    kind: "choiceInteraction",
    responseIdentifier: responseId,
    shuffle: strOf(asNode(response["render"]), "shuffle") === "Yes",
    maxChoices: cardinality === "single" ? 1 : 0,
    simpleChoices: labels.map((label) => ({
      kind: "simpleChoice",
      identifier: sanitizeIdentifier(strOf(label, "ident") ?? ""),
      content: choiceContent(label),
    })),
  };

  const responseDeclaration: Node = {
    identifier: responseId,
    cardinality,
    baseType: "identifier",
    correctResponse: { values: correct.map((value) => ({ value })) },
  };

  return {
    interactionKind: "choice",
    document: {
      responseDeclarations: [responseDeclaration],
      outcomeDeclarations: [scoreOutcomeDeclaration()],
      itemBody: { content: [...stemContent(stem), interaction] },
      responseProcessing: { template: MATCH_CORRECT },
    },
  };
}

function buildTextEntryItem(item: Node, response: Node, stem: Node[]): BuiltItem {
  const rawResponseId = strOf(response, "ident") ?? "RESPONSE";
  const responseId = sanitizeIdentifier(rawResponseId);
  // Text-entry correct answers are free strings (baseType string), so they are NOT sanitized.
  const correct = collectVarequals(item).filter((entry) => entry.respident === rawResponseId);

  const responseDeclaration: Node = {
    identifier: responseId,
    cardinality: "single",
    baseType: "string",
    ...(correct[0] ? { correctResponse: { values: [{ value: correct[0].value }] } } : {}),
    mapping: {
      defaultValue: 0,
      mapEntries: correct.map((entry) => ({
        mapKey: entry.value,
        mappedValue: 1,
        caseSensitive: entry.caseSensitive,
      })),
    },
  };

  const interaction: Node = { kind: "textEntryInteraction", responseIdentifier: responseId };

  return {
    interactionKind: "textEntry",
    document: {
      responseDeclarations: [responseDeclaration],
      outcomeDeclarations: [scoreOutcomeDeclaration()],
      itemBody: { content: [...stemContent(stem), interaction] },
      responseProcessing: { template: MAP_RESPONSE },
    },
  };
}

function buildExtendedTextItem(response: Node, stem: Node[]): BuiltItem {
  const responseId = sanitizeIdentifier(strOf(response, "ident") ?? "RESPONSE");
  return {
    interactionKind: "extendedText",
    document: {
      responseDeclarations: [{ identifier: responseId, cardinality: "single", baseType: "string" }],
      outcomeDeclarations: [scoreOutcomeDeclaration()],
      // Essay / constructed-response: human-scored, so no response-processing template.
      itemBody: {
        content: [...stemContent(stem), { kind: "extendedTextInteraction", responseIdentifier: responseId }],
      },
    },
  };
}

function convertItem(item: Node, identifier: string): CcQtiConvertedItem {
  const title = strOf(item, "title") ?? identifier;
  const ccProfile = findCcProfile(item);

  const presentation = asNode(item["presentation"]);
  const { stemMaterials, response } = collectPresentation(presentation);

  let built: BuiltItem;
  if (!response) {
    built = buildExtendedTextItem({ ident: "RESPONSE" }, stemMaterials);
  } else {
    const responseKind = strOf(response, "kind");
    const renderKind = strOf(asNode(response["render"]), "kind");
    const hasCorrect = collectVarequals(item).length > 0;

    if (responseKind === "response_lid" && renderKind === "render_choice") {
      built = buildChoiceItem(item, response, stemMaterials);
    } else if (responseKind === "response_str" && hasCorrect) {
      built = buildTextEntryItem(item, response, stemMaterials);
    } else {
      built = buildExtendedTextItem(response, stemMaterials);
    }
  }

  const assessmentItem: Node = {
    identifier,
    title,
    timeDependent: false,
    ...built.document,
  };

  const xml = serializeQtiDocument("3.0.1", "qtiAssessmentItemDocument", { assessmentItem });
  return { identifier, title, ccProfile, interactionKind: built.interactionKind, xml };
}

function buildTest(assessment: Node, items: CcQtiConvertedItem[]): CcQtiConvertedTest {
  const identifier = strOf(assessment, "ident") ?? "assessment";
  const title = strOf(assessment, "title") ?? identifier;
  const section = asNode(assessment["section"]);
  const sectionId = strOf(section, "ident") ?? "root_section";

  const assessmentTest: Node = {
    identifier,
    title,
    outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
    testParts: [
      {
        identifier: "testpart-1",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        children: [
          {
            identifier: sectionId,
            title: strOf(section, "title") ?? title,
            visible: true,
            children: items.map((item) => ({
              identifier: `ref-${item.identifier}`,
              href: `${item.identifier}.xml`,
            })),
          },
        ],
      },
    ],
  };

  return {
    identifier,
    title,
    itemIdentifiers: items.map((item) => item.identifier),
    xml: serializeQtiDocument("3.0.1", "qtiAssessmentTestDocument", { assessmentTest }),
  };
}

function convertItems(rawItems: Node[]): CcQtiConvertedItem[] {
  // Sanitize + de-duplicate item identifiers up front: real exports (Canvas/TopKit) reuse one
  // item ident across a whole quiz, and QTI 3 requires unique, NCName-ish identifiers.
  const identifiers = assignUniqueIdentifiers(rawItems.map((item) => strOf(item, "ident") ?? "item"));
  return rawItems.map((item, index) => convertItem(item, identifiers[index]!));
}

/**
 * Convert a CC `questestinterop` XML string into QTI 3.0.1 artifacts. Returns the converted
 * item XMLs (+ a test XML when the source is an `<assessment>`), or a structured `invalid`
 * result when the input is not even structurally valid CC QTI.
 *
 * Validation defaults to **structural** (the raw CC schema). The stricter CC *profile* rules
 * (item-type coherence, no duplicate idents, feedback linkage) are opt-in via `{ profile: true }`
 * — they are a conformance gate for clean cartridges, not a bar a best-effort import of a
 * real-world export should trip over (those routinely violate the profile).
 */
export function convertCcQtiV1ToV3(xml: string, options?: { profile?: boolean }): CcQtiConversionResult {
  const normalized = normalizeQuestestinterop(xml, { profile: options?.profile ?? false });
  if (normalized.status === "invalid") {
    return { status: "invalid", issues: normalized.issues };
  }

  const root = normalized.document.questestinterop as unknown as Node;

  if ("assessment" in root) {
    const assessment = asNode(root["assessment"]);
    const section = asNode(assessment["section"]);
    const items = convertItems(arr(section["item"]));
    return { status: "converted", source: "assessment", items, test: buildTest(assessment, items) };
  }

  const objectbank = asNode(root["objectbank"]);
  const items = convertItems(arr(objectbank["item"]));
  return { status: "converted", source: "objectbank", items };
}
