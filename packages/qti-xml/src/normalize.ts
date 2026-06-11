import type { QtiXmlElementNode, QtiXmlNode } from "./parse-xml";
import type { QtiSchemaSelectionKey, QtiVersion } from "./types";

const qtiV22DomainContentNames = new Set([
  "associateInteraction",
  "choiceInteraction",
  "customInteraction",
  "endAttemptInteraction",
  "extendedTextInteraction",
  "gap",
  "gapImg",
  "gapMatchInteraction",
  "gapText",
  "graphicAssociateInteraction",
  "graphicGapMatchInteraction",
  "graphicOrderInteraction",
  "hotspotChoice",
  "hotspotInteraction",
  "hotText",
  "hotTextInteraction",
  "inlineChoice",
  "inlineChoiceInteraction",
  "matchInteraction",
  "mediaInteraction",
  "orderInteraction",
  "positionObjectInteraction",
  "prompt",
  "selectPointInteraction",
  "simpleAssociableChoice",
  "simpleChoice",
  "sliderInteraction",
  "textEntryInteraction",
  "uploadInteraction",
]);

// Spelled exactly as the QTI 3 XSD (and the official corpus) spell them — notably
// `qti-hottext`, not `qti-hot-text`.
const qtiV30DomainContentNames = new Set([
  "qti-associable-hotspot",
  "qti-associate-interaction",
  "qti-choice-interaction",
  "qti-custom-interaction",
  "qti-drawing-interaction",
  "qti-end-attempt-interaction",
  "qti-extended-text-interaction",
  "qti-feedback-block",
  "qti-feedback-inline",
  "qti-gap",
  "qti-gap-img",
  "qti-gap-match-interaction",
  "qti-gap-text",
  "qti-graphic-associate-interaction",
  "qti-graphic-gap-match-interaction",
  "qti-graphic-order-interaction",
  "qti-hotspot-choice",
  "qti-hotspot-interaction",
  "qti-hottext",
  "qti-hottext-interaction",
  "qti-include",
  "qti-inline-choice",
  "qti-inline-choice-interaction",
  "qti-match-interaction",
  "qti-media-interaction",
  "qti-order-interaction",
  "qti-portable-custom-interaction",
  "qti-position-object-interaction",
  "qti-position-object-stage",
  "qti-printed-variable",
  "qti-prompt",
  "qti-rubric-block",
  "qti-select-point-interaction",
  "qti-simple-associable-choice",
  "qti-simple-choice",
  "qti-simple-match-set",
  "qti-slider-interaction",
  "qti-template-block",
  "qti-template-inline",
  "qti-text-entry-interaction",
  "qti-upload-interaction",
]);

function normalizeTextValue(value: string): string | undefined {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function attributeBoolean(attributes: Record<string, string>, ...names: string[]): boolean | undefined {
  for (const name of names) {
    const value = attributes[name];
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }
  return undefined;
}

function attributeNumber(attributes: Record<string, string>, ...names: string[]): number | undefined {
  for (const name of names) {
    const value = attributes[name];
    if (value === undefined) {
      continue;
    }
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function requireAttribute(element: QtiXmlElementNode, ...names: string[]): string {
  for (const name of names) {
    const value = element.attributes[name];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  throw new Error(`Missing required attribute on <${element.name}>: ${names.join(", ")}`);
}

function childElements(element: QtiXmlElementNode, localName?: string): QtiXmlElementNode[] {
  return element.children.filter(
    (child): child is QtiXmlElementNode =>
      child.type === "element" && (localName ? child.localName === localName : true),
  );
}

function firstChildElement(element: QtiXmlElementNode, localName: string): QtiXmlElementNode | undefined {
  return childElements(element, localName)[0];
}

function textContent(element: QtiXmlElementNode): string | undefined {
  const parts: string[] = [];

  for (const child of element.children) {
    if (child.type === "text") {
      const normalized = normalizeTextValue(child.value);
      if (normalized) {
        parts.push(normalized);
      }
      continue;
    }

    const nested = textContent(child);
    if (nested) {
      parts.push(nested);
    }
  }

  return parts.length ? parts.join(" ") : undefined;
}

function mapValueList(element: QtiXmlElementNode): Array<{ value: string }> {
  return childElements(element, "value").flatMap((valueElement) => {
    const value = textContent(valueElement);
    return value !== undefined ? [{ value }] : [];
  });
}

function mapV2ResponseDeclaration(element: QtiXmlElementNode) {
  const correctResponseElement = firstChildElement(element, "correctResponse");
  const defaultValueElement = firstChildElement(element, "defaultValue");

  return {
    identifier: requireAttribute(element, "identifier"),
    cardinality: requireAttribute(element, "cardinality"),
    baseType: element.attributes.baseType,
    ...(correctResponseElement
      ? {
          correctResponse: {
            values: mapValueList(correctResponseElement),
          },
        }
      : {}),
    ...(defaultValueElement
      ? {
          defaultValue: {
            values: mapValueList(defaultValueElement),
          },
        }
      : {}),
  };
}

function mapV2OutcomeDeclaration(element: QtiXmlElementNode) {
  const defaultValueElement = firstChildElement(element, "defaultValue");

  return {
    identifier: requireAttribute(element, "identifier"),
    cardinality: requireAttribute(element, "cardinality"),
    baseType: element.attributes.baseType,
    ...(defaultValueElement
      ? {
          defaultValue: {
            values: mapValueList(defaultValueElement),
          },
        }
      : {}),
    ...(element.attributes.interpretation ? { interpretation: element.attributes.interpretation } : {}),
    ...(element.attributes.longInterpretation ? { longInterpretation: element.attributes.longInterpretation } : {}),
    ...(attributeNumber(element.attributes, "normalMaximum") !== undefined
      ? { normalMaximum: attributeNumber(element.attributes, "normalMaximum") }
      : {}),
    ...(attributeNumber(element.attributes, "normalMinimum") !== undefined
      ? { normalMinimum: attributeNumber(element.attributes, "normalMinimum") }
      : {}),
    ...(attributeNumber(element.attributes, "masteryValue") !== undefined
      ? { masteryValue: attributeNumber(element.attributes, "masteryValue") }
      : {}),
  };
}

function mapV2ContentNodes(nodes: QtiXmlNode[]): unknown[] {
  const content: unknown[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      const value = normalizeTextValue(node.value);
      if (value) {
        content.push({ kind: "text", value });
      }
      continue;
    }

    if (qtiV22DomainContentNames.has(node.localName)) {
      switch (node.localName) {
        case "prompt":
          content.push({
            kind: "prompt",
            children: mapV2ContentNodes(node.children),
          });
          break;
        case "simpleChoice":
          content.push({
            kind: "simpleChoice",
            identifier: requireAttribute(node, "identifier"),
            ...(attributeBoolean(node.attributes, "fixed") !== undefined
              ? { fixed: attributeBoolean(node.attributes, "fixed") }
              : {}),
            ...(node.attributes.showHide ? { showHide: node.attributes.showHide } : {}),
            ...(mapV2ContentNodes(node.children).length ? { children: mapV2ContentNodes(node.children) } : {}),
          });
          break;
        case "choiceInteraction":
        case "orderInteraction": {
          const prompt = firstChildElement(node, "prompt");
          const simpleChoices = childElements(node, "simpleChoice").map((choiceElement) => {
            const [mapped] = mapV2ContentNodes([choiceElement]);
            return mapped;
          });

          content.push({
            kind: node.localName,
            responseIdentifier: requireAttribute(node, "responseIdentifier"),
            ...(attributeBoolean(node.attributes, "shuffle") !== undefined
              ? { shuffle: attributeBoolean(node.attributes, "shuffle") }
              : {}),
            ...(attributeNumber(node.attributes, "maxChoices") !== undefined
              ? { maxChoices: attributeNumber(node.attributes, "maxChoices") }
              : {}),
            ...(attributeNumber(node.attributes, "minChoices") !== undefined
              ? { minChoices: attributeNumber(node.attributes, "minChoices") }
              : {}),
            ...(prompt ? { prompt: mapV2ContentNodes([prompt])[0] } : {}),
            simpleChoices,
          });
          break;
        }
        default:
          throw new Error(`Unsupported QTI 2.2 content element <${node.localName}> in normalization.`);
      }

      continue;
    }

    const children = mapV2ContentNodes(node.children);
    content.push({
      kind: node.localName,
      ...(Object.keys(node.attributes).length ? { attributes: node.attributes } : {}),
      ...(children.length ? { children } : {}),
    });
  }

  return content;
}

/** Split a whitespace-separated attribute value into a contracts string list. */
function attributeList(value: string | undefined): string[] | undefined {
  const entries = value?.split(/\s+/u).filter(Boolean);
  return entries?.length ? entries : undefined;
}

function mapV3ValueList(element: QtiXmlElementNode): Array<Record<string, unknown>> {
  return childElements(element, "qti-value").map((valueElement) => ({
    value: textContent(valueElement) ?? "",
    ...(valueElement.attributes["base-type"] ? { baseType: valueElement.attributes["base-type"] } : {}),
    ...(valueElement.attributes["field-identifier"]
      ? { fieldIdentifier: valueElement.attributes["field-identifier"] }
      : {}),
  }));
}

function mapV3MappingBounds(element: QtiXmlElementNode) {
  return {
    ...(attributeNumber(element.attributes, "lower-bound") !== undefined
      ? { lowerBound: attributeNumber(element.attributes, "lower-bound") }
      : {}),
    ...(attributeNumber(element.attributes, "upper-bound") !== undefined
      ? { upperBound: attributeNumber(element.attributes, "upper-bound") }
      : {}),
    ...(attributeNumber(element.attributes, "default-value") !== undefined
      ? { defaultValue: attributeNumber(element.attributes, "default-value") }
      : {}),
  };
}

function mapV3Mapping(element: QtiXmlElementNode) {
  return {
    ...mapV3MappingBounds(element),
    mapEntries: childElements(element, "qti-map-entry").map((entry) => ({
      mapKey: requireAttribute(entry, "map-key"),
      mappedValue: attributeNumber(entry.attributes, "mapped-value") ?? 0,
      ...(attributeBoolean(entry.attributes, "case-sensitive") !== undefined
        ? { caseSensitive: attributeBoolean(entry.attributes, "case-sensitive") }
        : {}),
    })),
  };
}

function mapV3AreaMapping(element: QtiXmlElementNode) {
  return {
    ...mapV3MappingBounds(element),
    areaMapEntries: childElements(element, "qti-area-map-entry").map((entry) => ({
      shape: requireAttribute(entry, "shape"),
      coords: requireAttribute(entry, "coords"),
      mappedValue: attributeNumber(entry.attributes, "mapped-value") ?? 0,
    })),
  };
}

function mapV3MatchTable(element: QtiXmlElementNode) {
  return {
    ...(element.attributes["default-value"] ? { defaultValue: element.attributes["default-value"] } : {}),
    matchTableEntries: childElements(element, "qti-match-table-entry").map((entry) => ({
      sourceValue: attributeNumber(entry.attributes, "source-value") ?? 0,
      targetValue: requireAttribute(entry, "target-value"),
    })),
  };
}

function mapV3InterpolationTable(element: QtiXmlElementNode) {
  return {
    ...(element.attributes["default-value"] ? { defaultValue: element.attributes["default-value"] } : {}),
    interpolationTableEntries: childElements(element, "qti-interpolation-table-entry").map((entry) => ({
      sourceValue: attributeNumber(entry.attributes, "source-value") ?? 0,
      targetValue: requireAttribute(entry, "target-value"),
      ...(attributeBoolean(entry.attributes, "include-boundary") !== undefined
        ? { includeBoundary: attributeBoolean(entry.attributes, "include-boundary") }
        : {}),
    })),
  };
}

function mapV3ResponseDeclaration(element: QtiXmlElementNode) {
  const correctResponseElement = firstChildElement(element, "qti-correct-response");
  const defaultValueElement = firstChildElement(element, "qti-default-value");
  const mappingElement = firstChildElement(element, "qti-mapping");
  const areaMappingElement = firstChildElement(element, "qti-area-mapping");

  return {
    identifier: requireAttribute(element, "identifier"),
    cardinality: requireAttribute(element, "cardinality"),
    baseType: element.attributes["base-type"],
    ...(defaultValueElement
      ? {
          defaultValue: {
            values: mapV3ValueList(defaultValueElement),
          },
        }
      : {}),
    ...(correctResponseElement
      ? {
          correctResponse: {
            values: mapV3ValueList(correctResponseElement),
          },
        }
      : {}),
    ...(mappingElement ? { mapping: mapV3Mapping(mappingElement) } : {}),
    ...(areaMappingElement ? { areaMapping: mapV3AreaMapping(areaMappingElement) } : {}),
  };
}

function mapV3TemplateDeclaration(element: QtiXmlElementNode) {
  const defaultValueElement = firstChildElement(element, "qti-default-value");

  return {
    identifier: requireAttribute(element, "identifier"),
    cardinality: requireAttribute(element, "cardinality"),
    baseType: element.attributes["base-type"],
    ...(defaultValueElement ? { defaultValue: { values: mapV3ValueList(defaultValueElement) } } : {}),
    ...(attributeBoolean(element.attributes, "param-variable") !== undefined
      ? { paramVariable: attributeBoolean(element.attributes, "param-variable") }
      : {}),
    ...(attributeBoolean(element.attributes, "math-variable") !== undefined
      ? { mathVariable: attributeBoolean(element.attributes, "math-variable") }
      : {}),
  };
}

function mapV3ContextDeclaration(element: QtiXmlElementNode) {
  const defaultValueElement = firstChildElement(element, "qti-default-value");

  return {
    identifier: requireAttribute(element, "identifier"),
    cardinality: requireAttribute(element, "cardinality"),
    baseType: element.attributes["base-type"],
    ...(defaultValueElement ? { defaultValue: { values: mapV3ValueList(defaultValueElement) } } : {}),
  };
}

function mapV3StyleSheet(element: QtiXmlElementNode) {
  return {
    href: requireAttribute(element, "href"),
    type: requireAttribute(element, "type"),
    ...(element.attributes.media ? { media: element.attributes.media } : {}),
    ...(element.attributes.title ? { title: element.attributes.title } : {}),
  };
}

function mapV3OutcomeDeclaration(element: QtiXmlElementNode) {
  const defaultValueElement = firstChildElement(element, "qti-default-value");
  const matchTableElement = firstChildElement(element, "qti-match-table");
  const interpolationTableElement = firstChildElement(element, "qti-interpolation-table");

  return {
    identifier: requireAttribute(element, "identifier"),
    cardinality: requireAttribute(element, "cardinality"),
    baseType: element.attributes["base-type"],
    ...(defaultValueElement
      ? {
          defaultValue: {
            values: mapV3ValueList(defaultValueElement),
          },
        }
      : {}),
    ...(matchTableElement ? { matchTable: mapV3MatchTable(matchTableElement) } : {}),
    ...(interpolationTableElement ? { interpolationTable: mapV3InterpolationTable(interpolationTableElement) } : {}),
    ...(attributeList(element.attributes.view) ? { view: attributeList(element.attributes.view) } : {}),
    ...(element.attributes["external-scored"] ? { externalScored: element.attributes["external-scored"] } : {}),
    ...(element.attributes.interpretation ? { interpretation: element.attributes.interpretation } : {}),
    ...(element.attributes["long-interpretation"]
      ? { longInterpretation: element.attributes["long-interpretation"] }
      : {}),
    ...(attributeNumber(element.attributes, "normal-maximum") !== undefined
      ? { normalMaximum: attributeNumber(element.attributes, "normal-maximum") }
      : {}),
    ...(attributeNumber(element.attributes, "normal-minimum") !== undefined
      ? { normalMinimum: attributeNumber(element.attributes, "normal-minimum") }
      : {}),
    ...(attributeNumber(element.attributes, "mastery-value") !== undefined
      ? { masteryValue: attributeNumber(element.attributes, "mastery-value") }
      : {}),
  };
}

function mapV3XmlNode(element: QtiXmlElementNode): unknown {
  const children = mapV3ContentFragments(element.children);
  const textValue = textContent(element);

  return {
    kind: "xml",
    ...(element.namespaceUri ? { namespace: element.namespaceUri } : {}),
    name: element.localName,
    ...(Object.keys(element.attributes).length ? { attributes: element.attributes } : {}),
    ...(children.length ? { children } : {}),
    ...(children.length === 0 && textValue ? { value: textValue } : {}),
  };
}

function requireNumberAttribute(element: QtiXmlElementNode, name: string): number {
  const value = attributeNumber(element.attributes, name);
  if (value === undefined) {
    throw new Error(`Missing required numeric attribute on <${element.localName}>: ${name}`);
  }
  return value;
}

function optionalString(attributes: Record<string, string>, name: string, key: string): Record<string, string> {
  const value = attributes[name];
  return value !== undefined && value !== "" ? { [key]: value } : {};
}

function optionalNumber(attributes: Record<string, string>, name: string, key: string): Record<string, number> {
  const value = attributeNumber(attributes, name);
  return value !== undefined ? { [key]: value } : {};
}

function optionalBoolean(attributes: Record<string, string>, name: string, key: string): Record<string, boolean> {
  const value = attributeBoolean(attributes, name);
  return value !== undefined ? { [key]: value } : {};
}

function contentOf(node: QtiXmlElementNode): { content?: unknown[] } {
  // QTI 3 block containers (feedback/template/rubric blocks, modal feedback) wrap
  // their flow content in a <qti-content-body>; the normalized node carries the
  // content directly.
  const contentBody = firstChildElement(node, "qti-content-body");
  const content = mapV3ContentFragments(contentBody ? contentBody.children : node.children);
  return content.length ? { content } : {};
}

/** Body fragments of `node` excluding the element names mapped into dedicated fields. */
function fragmentsExcluding(node: QtiXmlElementNode, excluded: ReadonlySet<string>): unknown[] {
  return mapV3ContentFragments(
    node.children.filter((child) => child.type !== "element" || !excluded.has(child.localName)),
  );
}

function mapV3Prompt(node: QtiXmlElementNode): unknown {
  return { kind: "prompt", content: mapV3ContentFragments(node.children) };
}

function promptOf(node: QtiXmlElementNode): { prompt?: unknown } {
  const prompt = firstChildElement(node, "qti-prompt");
  return prompt ? { prompt: mapV3Prompt(prompt) } : {};
}

function interactionBase(node: QtiXmlElementNode) {
  return { responseIdentifier: requireAttribute(node, "response-identifier") };
}

/** The stage media of graphic/media interactions: the first non-QTI element child. */
function requireV3StageMedia(node: QtiXmlElementNode): unknown {
  const media = node.children.find(
    (child): child is QtiXmlElementNode => child.type === "element" && !child.localName.startsWith("qti-"),
  );
  if (!media) {
    throw new Error(`<${node.localName}> must contain a stage <object>, <img>, or media element.`);
  }
  return mapV3XmlNode(media);
}

function mapV3HotspotChoice(node: QtiXmlElementNode, kind: "hotspotChoice" | "associableHotspot"): unknown {
  return {
    kind,
    identifier: requireAttribute(node, "identifier"),
    shape: requireAttribute(node, "shape"),
    coords: requireAttribute(node, "coords"),
    ...(kind === "associableHotspot" ? optionalNumber(node.attributes, "match-max", "matchMax") : {}),
    ...optionalString(node.attributes, "hotspot-label", "hotspotLabel"),
    ...(attributeList(node.attributes["match-group"])
      ? { matchGroup: attributeList(node.attributes["match-group"]) }
      : {}),
  };
}

function mapV3GapChoice(node: QtiXmlElementNode): unknown {
  if (node.localName === "qti-gap-text") {
    return {
      kind: "gapText",
      identifier: requireAttribute(node, "identifier"),
      matchMax: requireNumberAttribute(node, "match-max"),
      ...optionalNumber(node.attributes, "match-min", "matchMin"),
      ...contentOf(node),
    };
  }

  return {
    kind: "gapImg",
    identifier: requireAttribute(node, "identifier"),
    matchMax: requireNumberAttribute(node, "match-max"),
    ...optionalNumber(node.attributes, "match-min", "matchMin"),
    ...optionalString(node.attributes, "object-label", "objectLabel"),
    ...optionalString(node.attributes, "top", "top"),
    ...optionalString(node.attributes, "left", "left"),
    media: requireV3StageMedia(node),
  };
}

function mapV3SimpleAssociableChoice(node: QtiXmlElementNode): unknown {
  return {
    kind: "simpleAssociableChoice",
    identifier: requireAttribute(node, "identifier"),
    matchMax: requireNumberAttribute(node, "match-max"),
    ...optionalNumber(node.attributes, "match-min", "matchMin"),
    ...optionalBoolean(node.attributes, "fixed", "fixed"),
    ...(attributeList(node.attributes["match-group"])
      ? { matchGroup: attributeList(node.attributes["match-group"]) }
      : {}),
    ...contentOf(node),
  };
}

function mapV3PositionObjectInteraction(node: QtiXmlElementNode, stageImage: unknown): unknown {
  const centerPoint = attributeList(node.attributes["center-point"])?.map(Number);

  return {
    kind: "positionObjectInteraction",
    ...interactionBase(node),
    image: stageImage,
    ...(centerPoint ? { centerPoint } : {}),
    ...optionalNumber(node.attributes, "min-choices", "minChoices"),
    ...optionalNumber(node.attributes, "max-choices", "maxChoices"),
  };
}

const promptOnly = new Set(["qti-prompt"]);
const gapMatchOwnedNames = new Set(["qti-prompt", "qti-gap-text", "qti-gap-img"]);

/** Map one QTI 3 domain content element to its contracts node. */
function mapV3DomainNode(node: QtiXmlElementNode): unknown {
  switch (node.localName) {
    case "qti-prompt":
      return mapV3Prompt(node);

    case "qti-simple-choice":
      return {
        kind: "simpleChoice",
        identifier: requireAttribute(node, "identifier"),
        ...optionalBoolean(node.attributes, "fixed", "fixed"),
        ...optionalString(node.attributes, "template-identifier", "templateIdentifier"),
        ...optionalString(node.attributes, "show-hide", "showHide"),
        ...contentOf(node),
      };

    case "qti-choice-interaction":
    case "qti-order-interaction":
      return {
        kind: node.localName === "qti-choice-interaction" ? "choiceInteraction" : "orderInteraction",
        ...interactionBase(node),
        ...optionalBoolean(node.attributes, "shuffle", "shuffle"),
        ...optionalNumber(node.attributes, "max-choices", "maxChoices"),
        ...optionalNumber(node.attributes, "min-choices", "minChoices"),
        ...optionalString(node.attributes, "orientation", "orientation"),
        ...promptOf(node),
        simpleChoices: childElements(node, "qti-simple-choice").map((choice) => mapV3DomainNode(choice)),
      };

    case "qti-inline-choice":
      return {
        kind: "inlineChoice",
        identifier: requireAttribute(node, "identifier"),
        ...optionalBoolean(node.attributes, "fixed", "fixed"),
        ...optionalString(node.attributes, "template-identifier", "templateIdentifier"),
        ...optionalString(node.attributes, "show-hide", "showHide"),
        ...contentOf(node),
      };

    case "qti-inline-choice-interaction":
      return {
        kind: "inlineChoiceInteraction",
        ...interactionBase(node),
        ...optionalBoolean(node.attributes, "shuffle", "shuffle"),
        ...optionalBoolean(node.attributes, "required", "required"),
        ...optionalNumber(node.attributes, "min-choices", "minChoices"),
        ...optionalString(node.attributes, "data-prompt", "dataPrompt"),
        inlineChoices: childElements(node, "qti-inline-choice").map((choice) => mapV3DomainNode(choice)),
      };

    case "qti-text-entry-interaction":
      return {
        kind: "textEntryInteraction",
        ...interactionBase(node),
        ...optionalNumber(node.attributes, "base", "base"),
        ...optionalString(node.attributes, "string-identifier", "stringIdentifier"),
        ...optionalNumber(node.attributes, "expected-length", "expectedLength"),
        ...optionalString(node.attributes, "pattern-mask", "patternMask"),
        ...optionalString(node.attributes, "placeholder-text", "placeholderText"),
        ...optionalString(node.attributes, "format", "format"),
      };

    case "qti-extended-text-interaction":
      return {
        kind: "extendedTextInteraction",
        ...interactionBase(node),
        ...optionalNumber(node.attributes, "base", "base"),
        ...optionalString(node.attributes, "string-identifier", "stringIdentifier"),
        ...optionalNumber(node.attributes, "expected-length", "expectedLength"),
        ...optionalString(node.attributes, "pattern-mask", "patternMask"),
        ...optionalString(node.attributes, "placeholder-text", "placeholderText"),
        ...optionalNumber(node.attributes, "max-strings", "maxStrings"),
        ...optionalNumber(node.attributes, "min-strings", "minStrings"),
        ...optionalNumber(node.attributes, "expected-lines", "expectedLines"),
        ...optionalString(node.attributes, "format", "format"),
        ...promptOf(node),
      };

    case "qti-hottext":
      return {
        kind: "hotText",
        identifier: requireAttribute(node, "identifier"),
        ...optionalString(node.attributes, "template-identifier", "templateIdentifier"),
        ...optionalString(node.attributes, "show-hide", "showHide"),
        ...contentOf(node),
      };

    case "qti-hottext-interaction":
      return {
        kind: "hotTextInteraction",
        ...interactionBase(node),
        ...optionalNumber(node.attributes, "max-choices", "maxChoices"),
        ...optionalNumber(node.attributes, "min-choices", "minChoices"),
        ...promptOf(node),
        content: fragmentsExcluding(node, promptOnly),
      };

    case "qti-match-interaction":
      return {
        kind: "matchInteraction",
        ...interactionBase(node),
        ...optionalBoolean(node.attributes, "shuffle", "shuffle"),
        ...optionalNumber(node.attributes, "max-associations", "maxAssociations"),
        ...optionalNumber(node.attributes, "min-associations", "minAssociations"),
        ...optionalString(node.attributes, "data-first-column-header", "dataFirstColumnHeader"),
        ...promptOf(node),
        simpleMatchSets: childElements(node, "qti-simple-match-set").map((set) => ({
          kind: "simpleMatchSet",
          simpleAssociableChoices: childElements(set, "qti-simple-associable-choice").map((choice) =>
            mapV3SimpleAssociableChoice(choice),
          ),
        })),
      };

    case "qti-simple-associable-choice":
      return mapV3SimpleAssociableChoice(node);

    case "qti-associate-interaction":
      return {
        kind: "associateInteraction",
        ...interactionBase(node),
        ...optionalBoolean(node.attributes, "shuffle", "shuffle"),
        ...optionalNumber(node.attributes, "max-associations", "maxAssociations"),
        ...optionalNumber(node.attributes, "min-associations", "minAssociations"),
        ...promptOf(node),
        simpleAssociableChoices: childElements(node, "qti-simple-associable-choice").map((choice) =>
          mapV3SimpleAssociableChoice(choice),
        ),
      };

    case "qti-gap":
      return {
        kind: "gap",
        identifier: requireAttribute(node, "identifier"),
        ...optionalBoolean(node.attributes, "required", "required"),
        ...optionalString(node.attributes, "template-identifier", "templateIdentifier"),
        ...optionalString(node.attributes, "show-hide", "showHide"),
      };

    case "qti-gap-text":
    case "qti-gap-img":
      return mapV3GapChoice(node);

    case "qti-gap-match-interaction":
      return {
        kind: "gapMatchInteraction",
        ...interactionBase(node),
        ...optionalBoolean(node.attributes, "shuffle", "shuffle"),
        ...optionalNumber(node.attributes, "max-associations", "maxAssociations"),
        ...optionalNumber(node.attributes, "min-associations", "minAssociations"),
        ...promptOf(node),
        gapChoices: childElements(node)
          .filter((child) => child.localName === "qti-gap-text" || child.localName === "qti-gap-img")
          .map((choice) => mapV3GapChoice(choice)),
        content: fragmentsExcluding(node, gapMatchOwnedNames),
      };

    case "qti-hotspot-choice":
      return mapV3HotspotChoice(node, "hotspotChoice");

    case "qti-associable-hotspot":
      return mapV3HotspotChoice(node, "associableHotspot");

    case "qti-hotspot-interaction":
    case "qti-graphic-order-interaction":
      return {
        kind: node.localName === "qti-hotspot-interaction" ? "hotspotInteraction" : "graphicOrderInteraction",
        ...interactionBase(node),
        ...optionalNumber(node.attributes, "max-choices", "maxChoices"),
        ...optionalNumber(node.attributes, "min-choices", "minChoices"),
        ...promptOf(node),
        image: requireV3StageMedia(node),
        hotspotChoices: childElements(node, "qti-hotspot-choice").map((choice) =>
          mapV3HotspotChoice(choice, "hotspotChoice"),
        ),
      };

    case "qti-graphic-associate-interaction":
      return {
        kind: "graphicAssociateInteraction",
        ...interactionBase(node),
        ...optionalNumber(node.attributes, "max-associations", "maxAssociations"),
        ...optionalNumber(node.attributes, "min-associations", "minAssociations"),
        ...promptOf(node),
        image: requireV3StageMedia(node),
        associableHotspots: childElements(node, "qti-associable-hotspot").map((choice) =>
          mapV3HotspotChoice(choice, "associableHotspot"),
        ),
      };

    case "qti-graphic-gap-match-interaction":
      return {
        kind: "graphicGapMatchInteraction",
        ...interactionBase(node),
        ...optionalNumber(node.attributes, "max-associations", "maxAssociations"),
        ...optionalNumber(node.attributes, "min-associations", "minAssociations"),
        ...promptOf(node),
        image: requireV3StageMedia(node),
        gapChoices: childElements(node)
          .filter((child) => child.localName === "qti-gap-text" || child.localName === "qti-gap-img")
          .map((choice) => mapV3GapChoice(choice)),
        associableHotspots: childElements(node, "qti-associable-hotspot").map((choice) =>
          mapV3HotspotChoice(choice, "associableHotspot"),
        ),
      };

    case "qti-select-point-interaction":
      return {
        kind: "selectPointInteraction",
        ...interactionBase(node),
        ...optionalNumber(node.attributes, "max-choices", "maxChoices"),
        ...optionalNumber(node.attributes, "min-choices", "minChoices"),
        ...promptOf(node),
        image: requireV3StageMedia(node),
      };

    case "qti-position-object-stage": {
      const image = requireV3StageMedia(node);

      return {
        kind: "positionObjectStage",
        image,
        positionObjectInteractions: childElements(node, "qti-position-object-interaction").map((interaction) =>
          mapV3PositionObjectInteraction(interaction, image),
        ),
      };
    }

    case "qti-position-object-interaction":
      throw new Error("<qti-position-object-interaction> is only supported inside <qti-position-object-stage>.");

    case "qti-media-interaction":
      return {
        kind: "mediaInteraction",
        ...interactionBase(node),
        autostart: attributeBoolean(node.attributes, "autostart") ?? false,
        ...optionalNumber(node.attributes, "min-plays", "minPlays"),
        ...optionalNumber(node.attributes, "max-plays", "maxPlays"),
        ...optionalBoolean(node.attributes, "loop", "loop"),
        ...optionalString(node.attributes, "coords", "coords"),
        ...promptOf(node),
        media: requireV3StageMedia(node),
      };

    case "qti-upload-interaction":
      return {
        kind: "uploadInteraction",
        ...interactionBase(node),
        ...promptOf(node),
        ...(attributeList(node.attributes.type) ? { acceptedTypes: attributeList(node.attributes.type) } : {}),
      };

    case "qti-slider-interaction":
      return {
        kind: "sliderInteraction",
        ...interactionBase(node),
        lowerBound: requireNumberAttribute(node, "lower-bound"),
        upperBound: requireNumberAttribute(node, "upper-bound"),
        ...optionalNumber(node.attributes, "step", "step"),
        ...optionalBoolean(node.attributes, "step-label", "stepLabel"),
        ...optionalString(node.attributes, "orientation", "orientation"),
        ...optionalBoolean(node.attributes, "reverse", "reverse"),
        ...promptOf(node),
      };

    case "qti-end-attempt-interaction":
      return {
        kind: "endAttemptInteraction",
        ...interactionBase(node),
        title: requireAttribute(node, "title"),
      };

    case "qti-feedback-inline":
    case "qti-feedback-block":
      return {
        kind: node.localName === "qti-feedback-inline" ? "feedbackInline" : "feedbackBlock",
        outcomeIdentifier: requireAttribute(node, "outcome-identifier"),
        identifier: requireAttribute(node, "identifier"),
        ...optionalString(node.attributes, "show-hide", "showHide"),
        ...contentOf(node),
      };

    case "qti-template-inline":
    case "qti-template-block":
      return {
        kind: node.localName === "qti-template-inline" ? "templateInline" : "templateBlock",
        templateIdentifier: requireAttribute(node, "template-identifier"),
        identifier: requireAttribute(node, "identifier"),
        ...optionalString(node.attributes, "show-hide", "showHide"),
        ...contentOf(node),
      };

    case "qti-printed-variable":
      return {
        kind: "printedVariable",
        identifier: requireAttribute(node, "identifier"),
        ...optionalString(node.attributes, "format", "format"),
        ...optionalNumber(node.attributes, "base", "base"),
        ...optionalNumber(node.attributes, "index", "index"),
        ...optionalBoolean(node.attributes, "power-form", "powerForm"),
        ...optionalString(node.attributes, "field", "field"),
        ...optionalString(node.attributes, "delimiter", "delimiter"),
        ...optionalString(node.attributes, "mapping-indicator", "mappingIndicator"),
      };

    case "qti-rubric-block":
      return {
        kind: "rubricBlock",
        view: attributeList(requireAttribute(node, "view")) ?? [],
        ...optionalString(node.attributes, "use", "use"),
        ...contentOf(node),
      };

    case "qti-include":
      return {
        kind: "include",
        ...optionalString(node.attributes, "href", "href"),
        ...optionalString(node.attributes, "parse", "parse"),
        ...optionalString(node.attributes, "xpointer", "xpointer"),
      };

    case "qti-portable-custom-interaction": {
      const markup = firstChildElement(node, "qti-interaction-markup");
      const modules = firstChildElement(node, "qti-interaction-modules");
      // PCI configuration properties: every data-* attribute except the reserved QTI
      // ones (catalog/TTS/SSML), keyed by the name minus its "data-" prefix.
      const reservedDataAttributes = new Set(["data-catalog-idref", "data-ssml"]);
      const properties = Object.fromEntries(
        Object.entries(node.attributes)
          .filter(
            ([name]) => name.startsWith("data-") && !reservedDataAttributes.has(name) && !name.startsWith("data-qti-"),
          )
          .map(([name, value]) => [name.slice("data-".length), value]),
      );
      const classTokens = (node.attributes["class"] ?? "").split(/\s+/u).filter((token) => token.length > 0);

      return {
        kind: "portableCustomInteraction",
        ...interactionBase(node),
        customInteractionTypeIdentifier: requireAttribute(node, "custom-interaction-type-identifier"),
        ...optionalString(node.attributes, "module", "module"),
        ...(classTokens.length > 0 ? { class: classTokens } : {}),
        ...optionalString(node.attributes, "data-catalog-idref", "dataCatalogIdref"),
        ...(Object.keys(properties).length > 0 ? { properties } : {}),
        interactionMarkup: {
          kind: "interactionMarkup",
          ...(markup ? contentOf(markup) : {}),
        },
        ...(modules
          ? {
              interactionModules: {
                kind: "interactionModules",
                ...optionalString(modules.attributes, "primary-configuration", "primaryConfiguration"),
                ...optionalString(modules.attributes, "secondary-configuration", "secondaryConfiguration"),
                modules: childElements(modules, "qti-interaction-module").map((moduleElement) => ({
                  kind: "interactionModule",
                  id: requireAttribute(moduleElement, "id"),
                  ...optionalString(moduleElement.attributes, "primary-path", "primaryPath"),
                  ...optionalString(moduleElement.attributes, "fallback-path", "fallbackPath"),
                })),
              },
            }
          : {}),
      };
    }

    case "qti-custom-interaction":
      return {
        kind: "customInteraction",
        ...interactionBase(node),
        ...contentOf(node),
      };

    case "qti-drawing-interaction":
      return {
        kind: "drawingInteraction",
        ...interactionBase(node),
        ...promptOf(node),
        content: fragmentsExcluding(node, promptOnly),
      };

    default:
      throw new Error(`Unsupported QTI 3.0.1 content element <${node.localName}> in normalization.`);
  }
}

function mapV3ContentFragments(nodes: QtiXmlNode[]): unknown[] {
  const content: unknown[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      const value = normalizeTextValue(node.value);
      if (value) {
        content.push(value);
      }
      continue;
    }

    if (qtiV30DomainContentNames.has(node.localName)) {
      content.push(mapV3DomainNode(node));
      continue;
    }

    content.push(mapV3XmlNode(node));
  }

  return content;
}

/** Expression elements whose contracts node is `{ kind, children }` with no attributes. */
const v3ChildOnlyExpressionNames = new Map<string, string>([
  ["qti-and", "and"],
  ["qti-contains", "contains"],
  ["qti-container-size", "containerSize"],
  ["qti-delete", "delete"],
  ["qti-divide", "divide"],
  ["qti-duration-gte", "durationGte"],
  ["qti-duration-lt", "durationLt"],
  ["qti-gcd", "gcd"],
  ["qti-gt", "gt"],
  ["qti-gte", "gte"],
  ["qti-integer-divide", "integerDivide"],
  ["qti-integer-modulus", "integerModulus"],
  ["qti-integer-to-float", "integerToFloat"],
  ["qti-is-null", "isNull"],
  ["qti-lcm", "lcm"],
  ["qti-lt", "lt"],
  ["qti-lte", "lte"],
  ["qti-match", "match"],
  ["qti-max", "max"],
  ["qti-member", "member"],
  ["qti-min", "min"],
  ["qti-multiple", "multiple"],
  ["qti-not", "not"],
  ["qti-or", "or"],
  ["qti-ordered", "ordered"],
  ["qti-power", "power"],
  ["qti-product", "product"],
  ["qti-random", "random"],
  ["qti-round", "round"],
  ["qti-subtract", "subtract"],
  ["qti-sum", "sum"],
  ["qti-truncate", "truncate"],
]);

/** An attribute that is either a numeric literal or a template-variable reference. */
function numberOrVariableAttribute(
  attributes: Record<string, string>,
  name: string,
  key: string,
): Record<string, number | string> {
  const value = attributes[name];
  if (value === undefined || value === "") {
    return {};
  }
  const parsed = Number(value);
  return { [key]: Number.isNaN(parsed) ? value : parsed };
}

function expressionChildren(element: QtiXmlElementNode): unknown[] {
  return childElements(element).map((child) => mapV3Expression(child));
}

function outcomeSubsetSelection(attributes: Record<string, string>) {
  return {
    ...optionalString(attributes, "section-identifier", "sectionIdentifier"),
    ...(attributeList(attributes["include-category"])
      ? { includeCategory: attributeList(attributes["include-category"]) }
      : {}),
    ...(attributeList(attributes["exclude-category"])
      ? { excludeCategory: attributeList(attributes["exclude-category"]) }
      : {}),
  };
}

function mapV3Expression(element: QtiXmlElementNode): unknown {
  const childOnlyKind = v3ChildOnlyExpressionNames.get(element.localName);
  if (childOnlyKind !== undefined) {
    return { kind: childOnlyKind, children: expressionChildren(element) };
  }

  switch (element.localName) {
    case "qti-null":
      return { kind: "null" };
    case "qti-base-value":
      return {
        kind: "baseValue",
        baseType: requireAttribute(element, "base-type"),
        value: textContent(element) ?? "",
      };
    case "qti-variable":
      return {
        kind: "variable",
        identifier: requireAttribute(element, "identifier"),
        ...optionalString(element.attributes, "weight-identifier", "weightIdentifier"),
      };
    case "qti-correct":
      return { kind: "correct", identifier: requireAttribute(element, "identifier") };
    case "qti-default":
      return { kind: "default", identifier: requireAttribute(element, "identifier") };
    case "qti-map-response":
      return { kind: "mapResponse", identifier: requireAttribute(element, "identifier") };
    case "qti-map-response-point":
      return { kind: "mapResponsePoint", identifier: requireAttribute(element, "identifier") };
    case "qti-random-integer":
      return {
        kind: "randomInteger",
        ...numberOrVariableAttribute(element.attributes, "min", "min"),
        ...numberOrVariableAttribute(element.attributes, "max", "max"),
        ...numberOrVariableAttribute(element.attributes, "step", "step"),
      };
    case "qti-random-float":
      return {
        kind: "randomFloat",
        ...numberOrVariableAttribute(element.attributes, "min", "min"),
        ...numberOrVariableAttribute(element.attributes, "max", "max"),
      };
    case "qti-math-constant":
      return { kind: "mathConstant", name: requireAttribute(element, "name") };
    case "qti-math-operator":
      return { kind: "mathOperator", name: requireAttribute(element, "name"), children: expressionChildren(element) };
    case "qti-stats-operator":
      return { kind: "statsOperator", name: requireAttribute(element, "name"), children: expressionChildren(element) };
    case "qti-any-n":
      return {
        kind: "anyN",
        ...numberOrVariableAttribute(element.attributes, "min", "min"),
        ...numberOrVariableAttribute(element.attributes, "max", "max"),
        children: expressionChildren(element),
      };
    case "qti-equal": {
      const tolerance = attributeList(element.attributes.tolerance)?.map((entry) => {
        const parsed = Number(entry);
        return Number.isNaN(parsed) ? entry : parsed;
      });

      return {
        kind: "equal",
        ...optionalString(element.attributes, "tolerance-mode", "toleranceMode"),
        ...(tolerance ? { tolerance } : {}),
        ...optionalBoolean(element.attributes, "include-lower-bound", "includeLowerBound"),
        ...optionalBoolean(element.attributes, "include-upper-bound", "includeUpperBound"),
        children: expressionChildren(element),
      };
    }
    case "qti-equal-rounded":
      return {
        kind: "equalRounded",
        ...optionalString(element.attributes, "rounding-mode", "roundingMode"),
        ...numberOrVariableAttribute(element.attributes, "figures", "figures"),
        children: expressionChildren(element),
      };
    case "qti-round-to":
      return {
        kind: "roundTo",
        roundingMode: requireAttribute(element, "rounding-mode"),
        ...numberOrVariableAttribute(element.attributes, "figures", "figures"),
        children: expressionChildren(element),
      };
    case "qti-field-value":
      return {
        kind: "fieldValue",
        fieldIdentifier: requireAttribute(element, "field-identifier"),
        children: expressionChildren(element),
      };
    case "qti-index":
      return {
        kind: "index",
        ...numberOrVariableAttribute(element.attributes, "n", "n"),
        children: expressionChildren(element),
      };
    case "qti-inside":
      return {
        kind: "inside",
        shape: requireAttribute(element, "shape"),
        coords: requireAttribute(element, "coords"),
        children: expressionChildren(element),
      };
    case "qti-pattern-match":
      return {
        kind: "patternMatch",
        pattern: requireAttribute(element, "pattern"),
        children: expressionChildren(element),
      };
    case "qti-string-match":
      return {
        kind: "stringMatch",
        caseSensitive: attributeBoolean(element.attributes, "case-sensitive") ?? true,
        ...optionalBoolean(element.attributes, "substring", "substring"),
        children: expressionChildren(element),
      };
    case "qti-substring":
      return {
        kind: "substring",
        caseSensitive: attributeBoolean(element.attributes, "case-sensitive") ?? true,
        children: expressionChildren(element),
      };
    case "qti-repeat":
      return {
        kind: "repeat",
        ...numberOrVariableAttribute(element.attributes, "number-repeats", "numberRepeats"),
        children: expressionChildren(element),
      };
    case "qti-custom-operator":
      return {
        kind: "customOperator",
        ...optionalString(element.attributes, "class", "class"),
        ...optionalString(element.attributes, "definition", "definition"),
        children: expressionChildren(element),
      };
    case "qti-number-correct":
      return { kind: "numberCorrect", ...outcomeSubsetSelection(element.attributes) };
    case "qti-number-incorrect":
      return { kind: "numberIncorrect", ...outcomeSubsetSelection(element.attributes) };
    case "qti-number-presented":
      return { kind: "numberPresented", ...outcomeSubsetSelection(element.attributes) };
    case "qti-number-responded":
      return { kind: "numberResponded", ...outcomeSubsetSelection(element.attributes) };
    case "qti-number-selected":
      return { kind: "numberSelected", ...outcomeSubsetSelection(element.attributes) };
    case "qti-outcome-minimum":
      return {
        kind: "outcomeMinimum",
        ...outcomeSubsetSelection(element.attributes),
        outcomeIdentifier: requireAttribute(element, "outcome-identifier"),
        ...optionalString(element.attributes, "weight-identifier", "weightIdentifier"),
      };
    case "qti-outcome-maximum":
      return {
        kind: "outcomeMaximum",
        ...outcomeSubsetSelection(element.attributes),
        outcomeIdentifier: requireAttribute(element, "outcome-identifier"),
        ...optionalString(element.attributes, "weight-identifier", "weightIdentifier"),
      };
    case "qti-test-variables":
      return {
        kind: "testVariables",
        ...outcomeSubsetSelection(element.attributes),
        variableIdentifier: requireAttribute(element, "variable-identifier"),
        ...optionalString(element.attributes, "weight-identifier", "weightIdentifier"),
        ...optionalString(element.attributes, "base-type", "baseType"),
      };
    default:
      throw new Error(`Unsupported QTI 3.0.1 expression element <${element.localName}> in normalization.`);
  }
}

/** The condition branch of a response/template condition: first child is the expression, the rest are rules. */
function conditionBranch(
  element: QtiXmlElementNode,
  kind: string,
  mapRule: (rule: QtiXmlElementNode) => unknown,
): Record<string, unknown> {
  const [expressionElement, ...ruleElements] = childElements(element);
  if (!expressionElement) {
    throw new Error(`<${element.localName}> must contain an expression.`);
  }

  const actions = ruleElements.map((rule) => mapRule(rule));

  return {
    kind,
    expression: mapV3Expression(expressionElement),
    ...(actions.length ? { actions } : {}),
  };
}

function elseBranch(
  element: QtiXmlElementNode,
  kind: string,
  mapRule: (rule: QtiXmlElementNode) => unknown,
): Record<string, unknown> {
  const actions = childElements(element).map((rule) => mapRule(rule));
  return { kind, ...(actions.length ? { actions } : {}) };
}

function mapV3ResponseRule(element: QtiXmlElementNode): unknown {
  switch (element.localName) {
    case "qti-response-condition": {
      const responseIf = firstChildElement(element, "qti-response-if");
      if (!responseIf) {
        throw new Error("<qti-response-condition> must contain <qti-response-if>.");
      }
      const elseIfs = childElements(element, "qti-response-else-if");
      const responseElse = firstChildElement(element, "qti-response-else");

      return {
        kind: "responseCondition",
        responseIf: conditionBranch(responseIf, "responseIf", mapV3ResponseRule),
        ...(elseIfs.length
          ? { responseElseIf: elseIfs.map((branch) => conditionBranch(branch, "responseIf", mapV3ResponseRule)) }
          : {}),
        ...(responseElse ? { responseElse: elseBranch(responseElse, "responseElse", mapV3ResponseRule) } : {}),
      };
    }
    case "qti-set-outcome-value":
    case "qti-lookup-outcome-value": {
      const expressionElement = childElements(element)[0];
      if (!expressionElement) {
        throw new Error(`<${element.localName}> must contain an expression.`);
      }

      return {
        kind: element.localName === "qti-set-outcome-value" ? "setOutcomeValue" : "lookupOutcomeValue",
        identifier: requireAttribute(element, "identifier"),
        expression: mapV3Expression(expressionElement),
      };
    }
    case "qti-exit-response":
      return { kind: "exitResponse" };
    case "qti-response-processing-fragment": {
      const rules = childElements(element).map((rule) => mapV3ResponseRule(rule));
      return { kind: "responseProcessingFragment", ...(rules.length ? { rules } : {}) };
    }
    default:
      throw new Error(`Unsupported QTI 3.0.1 response rule <${element.localName}> in normalization.`);
  }
}

function mapV3TemplateRule(element: QtiXmlElementNode): unknown {
  switch (element.localName) {
    case "qti-template-condition": {
      const templateIf = firstChildElement(element, "qti-template-if");
      if (!templateIf) {
        throw new Error("<qti-template-condition> must contain <qti-template-if>.");
      }
      const elseIfs = childElements(element, "qti-template-else-if");
      const templateElse = firstChildElement(element, "qti-template-else");

      return {
        kind: "templateCondition",
        templateIf: conditionBranch(templateIf, "templateIf", mapV3TemplateRule),
        ...(elseIfs.length
          ? { templateElseIf: elseIfs.map((branch) => conditionBranch(branch, "templateIf", mapV3TemplateRule)) }
          : {}),
        ...(templateElse ? { templateElse: elseBranch(templateElse, "templateElse", mapV3TemplateRule) } : {}),
      };
    }
    case "qti-set-template-value":
    case "qti-set-default-value":
    case "qti-set-correct-response": {
      const expressionElement = childElements(element)[0];
      if (!expressionElement) {
        throw new Error(`<${element.localName}> must contain an expression.`);
      }

      const kinds: Record<string, string> = {
        "qti-set-template-value": "setTemplateValue",
        "qti-set-default-value": "setDefaultValue",
        "qti-set-correct-response": "setCorrectResponse",
      };

      return {
        kind: kinds[element.localName]!,
        identifier: requireAttribute(element, "identifier"),
        expression: mapV3Expression(expressionElement),
      };
    }
    case "qti-template-constraint": {
      const expressionElement = childElements(element)[0];
      if (!expressionElement) {
        throw new Error("<qti-template-constraint> must contain an expression.");
      }
      return { kind: "templateConstraint", expression: mapV3Expression(expressionElement) };
    }
    case "qti-exit-template":
      return { kind: "exitTemplate" };
    default:
      throw new Error(`Unsupported QTI 3.0.1 template rule <${element.localName}> in normalization.`);
  }
}

function mapV3PreCondition(element: QtiXmlElementNode) {
  const expressionElement = childElements(element)[0];
  if (!expressionElement) {
    throw new Error("<qti-pre-condition> must contain an expression.");
  }

  return {
    kind: "preCondition",
    expression: mapV3Expression(expressionElement),
  };
}

function mapV3ItemSessionControl(element: QtiXmlElementNode) {
  return {
    ...(attributeBoolean(element.attributes, "allow-review") !== undefined
      ? { allowReview: attributeBoolean(element.attributes, "allow-review") }
      : {}),
    ...(attributeNumber(element.attributes, "max-attempts") !== undefined
      ? { maxAttempts: attributeNumber(element.attributes, "max-attempts") }
      : {}),
    ...(attributeBoolean(element.attributes, "show-feedback") !== undefined
      ? { showFeedback: attributeBoolean(element.attributes, "show-feedback") }
      : {}),
    ...(attributeBoolean(element.attributes, "show-solution") !== undefined
      ? { showSolution: attributeBoolean(element.attributes, "show-solution") }
      : {}),
    ...(attributeBoolean(element.attributes, "allow-comment") !== undefined
      ? { allowComment: attributeBoolean(element.attributes, "allow-comment") }
      : {}),
    ...(attributeBoolean(element.attributes, "allow-skipping") !== undefined
      ? { allowSkipping: attributeBoolean(element.attributes, "allow-skipping") }
      : {}),
    ...(attributeBoolean(element.attributes, "validate-responses") !== undefined
      ? { validateResponses: attributeBoolean(element.attributes, "validate-responses") }
      : {}),
  };
}

function mapV3TimeLimits(element: QtiXmlElementNode) {
  return {
    ...(attributeNumber(element.attributes, "min-time") !== undefined
      ? { minTime: attributeNumber(element.attributes, "min-time") }
      : {}),
    ...(attributeNumber(element.attributes, "max-time") !== undefined
      ? { maxTime: attributeNumber(element.attributes, "max-time") }
      : {}),
    ...(attributeBoolean(element.attributes, "allow-late-submission") !== undefined
      ? { allowLateSubmission: attributeBoolean(element.attributes, "allow-late-submission") }
      : {}),
  };
}

function mapV3BranchRule(element: QtiXmlElementNode) {
  const expressionElement = childElements(element)[0];
  if (!expressionElement) {
    throw new Error("<qti-branch-rule> must contain an expression.");
  }

  return {
    kind: "branchRule",
    target: requireAttribute(element, "target"),
    expression: mapV3Expression(expressionElement),
  };
}

function mapV3OutcomeRule(element: QtiXmlElementNode): unknown {
  switch (element.localName) {
    case "qti-outcome-condition": {
      const outcomeIf = firstChildElement(element, "qti-outcome-if");
      if (!outcomeIf) {
        throw new Error("<qti-outcome-condition> must contain <qti-outcome-if>.");
      }
      const elseIfs = childElements(element, "qti-outcome-else-if");
      const outcomeElse = firstChildElement(element, "qti-outcome-else");

      return {
        kind: "outcomeCondition",
        outcomeIf: conditionBranch(outcomeIf, "outcomeIf", mapV3OutcomeRule),
        ...(elseIfs.length
          ? { outcomeElseIf: elseIfs.map((branch) => conditionBranch(branch, "outcomeIf", mapV3OutcomeRule)) }
          : {}),
        ...(outcomeElse ? { outcomeElse: elseBranch(outcomeElse, "outcomeElse", mapV3OutcomeRule) } : {}),
      };
    }
    case "qti-set-outcome-value":
    case "qti-lookup-outcome-value": {
      const expressionElement = childElements(element)[0];
      if (!expressionElement) {
        throw new Error(`<${element.localName}> must contain an expression.`);
      }

      return {
        kind: element.localName === "qti-set-outcome-value" ? "setOutcomeValue" : "lookupOutcomeValue",
        identifier: requireAttribute(element, "identifier"),
        expression: mapV3Expression(expressionElement),
      };
    }
    case "qti-exit-test":
      return { kind: "exitTest" };
    case "qti-outcome-processing-fragment": {
      const rules = childElements(element).map((rule) => mapV3OutcomeRule(rule));
      return { kind: "outcomeProcessingFragment", ...(rules.length ? { rules } : {}) };
    }
    default:
      throw new Error(`Unsupported QTI 3.0.1 outcome rule <${element.localName}> in normalization.`);
  }
}

function mapV3TestFeedback(element: QtiXmlElementNode) {
  return {
    kind: "testFeedback",
    access: requireAttribute(element, "access"),
    outcomeIdentifier: requireAttribute(element, "outcome-identifier"),
    showHide: requireAttribute(element, "show-hide"),
    identifier: requireAttribute(element, "identifier"),
    ...optionalString(element.attributes, "title", "title"),
    ...contentOf(element),
  };
}

function mapV3TestRubricBlock(element: QtiXmlElementNode) {
  return {
    kind: "testRubricBlock",
    view: attributeList(requireAttribute(element, "view")) ?? [],
    ...optionalString(element.attributes, "use", "use"),
    ...contentOf(element),
  };
}

function mapV3Selection(element: QtiXmlElementNode) {
  return {
    select: requireNumberAttribute(element, "select"),
    ...optionalBoolean(element.attributes, "with-replacement", "withReplacement"),
  };
}

function mapV3Ordering(element: QtiXmlElementNode) {
  return {
    ...optionalBoolean(element.attributes, "shuffle", "shuffle"),
  };
}

function mapV3AssessmentItemRef(element: QtiXmlElementNode) {
  return {
    identifier: requireAttribute(element, "identifier"),
    href: requireAttribute(element, "href"),
    ...(attributeBoolean(element.attributes, "required") !== undefined
      ? { required: attributeBoolean(element.attributes, "required") }
      : {}),
    ...(attributeBoolean(element.attributes, "fixed") !== undefined
      ? { fixed: attributeBoolean(element.attributes, "fixed") }
      : {}),
    ...(attributeList(element.attributes.category) ? { category: attributeList(element.attributes.category) } : {}),
    ...(childElements(element, "qti-pre-condition").length
      ? { preConditions: childElements(element, "qti-pre-condition").map((child) => mapV3PreCondition(child)) }
      : {}),
    ...(childElements(element, "qti-branch-rule").length
      ? { branchRules: childElements(element, "qti-branch-rule").map((child) => mapV3BranchRule(child)) }
      : {}),
    ...(firstChildElement(element, "qti-item-session-control")
      ? { itemSessionControl: mapV3ItemSessionControl(firstChildElement(element, "qti-item-session-control")!) }
      : {}),
    ...(firstChildElement(element, "qti-time-limits")
      ? { timeLimits: mapV3TimeLimits(firstChildElement(element, "qti-time-limits")!) }
      : {}),
    ...(childElements(element, "qti-weight").length
      ? {
          weights: childElements(element, "qti-weight").map((weight) => ({
            identifier: requireAttribute(weight, "identifier"),
            value: requireNumberAttribute(weight, "value"),
          })),
        }
      : {}),
    ...(childElements(element, "qti-variable-mapping").length
      ? {
          variableMappings: childElements(element, "qti-variable-mapping").map((mapping) => ({
            sourceIdentifier: requireAttribute(mapping, "source-identifier"),
            targetIdentifier: requireAttribute(mapping, "target-identifier"),
          })),
        }
      : {}),
    ...(childElements(element, "qti-template-default").length
      ? {
          templateDefaults: childElements(element, "qti-template-default").map((templateDefault) => {
            const expressionElement = childElements(templateDefault)[0];
            if (!expressionElement) {
              throw new Error("<qti-template-default> must contain an expression.");
            }

            return {
              kind: "templateDefault",
              templateIdentifier: requireAttribute(templateDefault, "template-identifier"),
              expression: mapV3Expression(expressionElement),
            };
          }),
        }
      : {}),
  };
}

function mapV3AssessmentSection(element: QtiXmlElementNode): unknown {
  const children = childElements(element).flatMap((child) => {
    switch (child.localName) {
      case "qti-assessment-item-ref":
        return [mapV3AssessmentItemRef(child)];
      case "qti-assessment-section":
        return [mapV3AssessmentSection(child)];
      case "qti-assessment-section-ref":
        return [
          {
            identifier: requireAttribute(child, "identifier"),
            href: requireAttribute(child, "href"),
          },
        ];
      case "qti-pre-condition":
      case "qti-branch-rule":
      case "qti-item-session-control":
      case "qti-time-limits":
      case "qti-selection":
      case "qti-ordering":
      case "qti-rubric-block":
        return []; // mapped into dedicated fields below
      default:
        throw new Error(`Unsupported QTI 3.0.1 assessment section child <${child.localName}> in normalization.`);
    }
  });

  return {
    identifier: requireAttribute(element, "identifier"),
    title: requireAttribute(element, "title"),
    visible: attributeBoolean(element.attributes, "visible") ?? true,
    ...(attributeBoolean(element.attributes, "required") !== undefined
      ? { required: attributeBoolean(element.attributes, "required") }
      : {}),
    ...(attributeBoolean(element.attributes, "fixed") !== undefined
      ? { fixed: attributeBoolean(element.attributes, "fixed") }
      : {}),
    ...(attributeBoolean(element.attributes, "keep-together") !== undefined
      ? { keepTogether: attributeBoolean(element.attributes, "keep-together") }
      : {}),
    ...(childElements(element, "qti-pre-condition").length
      ? { preConditions: childElements(element, "qti-pre-condition").map((child) => mapV3PreCondition(child)) }
      : {}),
    ...(childElements(element, "qti-branch-rule").length
      ? { branchRules: childElements(element, "qti-branch-rule").map((child) => mapV3BranchRule(child)) }
      : {}),
    ...(firstChildElement(element, "qti-item-session-control")
      ? { itemSessionControl: mapV3ItemSessionControl(firstChildElement(element, "qti-item-session-control")!) }
      : {}),
    ...(firstChildElement(element, "qti-time-limits")
      ? { timeLimits: mapV3TimeLimits(firstChildElement(element, "qti-time-limits")!) }
      : {}),
    ...(firstChildElement(element, "qti-selection")
      ? { selection: mapV3Selection(firstChildElement(element, "qti-selection")!) }
      : {}),
    ...(firstChildElement(element, "qti-ordering")
      ? { ordering: mapV3Ordering(firstChildElement(element, "qti-ordering")!) }
      : {}),
    ...(childElements(element, "qti-rubric-block").length
      ? { rubricBlocks: childElements(element, "qti-rubric-block").map((child) => mapV3TestRubricBlock(child)) }
      : {}),
    ...(children.length ? { children } : {}),
  };
}

function mapV3ResultValues(element: QtiXmlElementNode): Array<{ value: string }> {
  return childElements(element, "value").map((valueElement) => ({
    value: textContent(valueElement) ?? "",
  }));
}

function mapV3ResultResponseVariable(element: QtiXmlElementNode) {
  const candidateResponseElement = firstChildElement(element, "candidateResponse");
  const correctResponseElement = firstChildElement(element, "correctResponse");

  return {
    identifier: requireAttribute(element, "identifier"),
    cardinality: requireAttribute(element, "cardinality"),
    baseType: element.attributes.baseType,
    candidateResponse: {
      values: candidateResponseElement ? mapV3ResultValues(candidateResponseElement) : [],
    },
    ...(correctResponseElement
      ? {
          correctResponse: {
            values: mapV3ResultValues(correctResponseElement),
          },
        }
      : {}),
    ...(element.attributes.choiceSequence
      ? { choiceSequence: element.attributes.choiceSequence.split(/\s+/u).filter(Boolean) }
      : {}),
    ...(element.attributes.scoreStatus ? { scoreStatus: element.attributes.scoreStatus } : {}),
    ...(element.attributes.answeredStatus ? { answeredStatus: element.attributes.answeredStatus } : {}),
  };
}

function mapV3ResultOutcomeVariable(element: QtiXmlElementNode) {
  return {
    identifier: requireAttribute(element, "identifier"),
    cardinality: requireAttribute(element, "cardinality"),
    baseType: element.attributes.baseType,
    values: mapV3ResultValues(element),
    ...(attributeNumber(element.attributes, "masteryValue") !== undefined
      ? { masteryValue: attributeNumber(element.attributes, "masteryValue") }
      : {}),
  };
}

function mapV3ResultContext(element: QtiXmlElementNode) {
  return {
    ...(element.attributes.sourcedId ? { sourcedId: element.attributes.sourcedId } : {}),
    ...(childElements(element, "sessionIdentifier").length
      ? {
          sessionIdentifiers: childElements(element, "sessionIdentifier").map((sessionIdentifier) => ({
            sourceId: requireAttribute(sessionIdentifier, "sourceID", "sourceId"),
            identifier: requireAttribute(sessionIdentifier, "identifier"),
          })),
        }
      : {}),
  };
}

function mapV3TestResult(element: QtiXmlElementNode) {
  return {
    identifier: requireAttribute(element, "identifier"),
    datestamp: requireAttribute(element, "datestamp"),
    ...(childElements(element, "responseVariable").length
      ? {
          responseVariables: childElements(element, "responseVariable").map((variable) =>
            mapV3ResultResponseVariable(variable),
          ),
        }
      : {}),
    ...(childElements(element, "outcomeVariable").length
      ? {
          outcomeVariables: childElements(element, "outcomeVariable").map((variable) =>
            mapV3ResultOutcomeVariable(variable),
          ),
        }
      : {}),
  };
}

function mapV3ItemResult(element: QtiXmlElementNode) {
  return {
    identifier: requireAttribute(element, "identifier"),
    datestamp: requireAttribute(element, "datestamp"),
    sessionStatus: requireAttribute(element, "sessionStatus"),
    ...(attributeNumber(element.attributes, "sequenceIndex") !== undefined
      ? { sequenceIndex: attributeNumber(element.attributes, "sequenceIndex") }
      : {}),
    ...(childElements(element, "responseVariable").length
      ? {
          responseVariables: childElements(element, "responseVariable").map((variable) =>
            mapV3ResultResponseVariable(variable),
          ),
        }
      : {}),
    ...(childElements(element, "outcomeVariable").length
      ? {
          outcomeVariables: childElements(element, "outcomeVariable").map((variable) =>
            mapV3ResultOutcomeVariable(variable),
          ),
        }
      : {}),
  };
}

function normalizeQti22AssessmentItem(root: QtiXmlElementNode) {
  return {
    assessmentItem: {
      identifier: requireAttribute(root, "identifier"),
      ...(root.attributes.title ? { title: root.attributes.title } : {}),
      ...(attributeBoolean(root.attributes, "adaptive") !== undefined
        ? { adaptive: attributeBoolean(root.attributes, "adaptive") }
        : {}),
      ...(attributeBoolean(root.attributes, "timeDependent") !== undefined
        ? { timeDependent: attributeBoolean(root.attributes, "timeDependent") }
        : {}),
      responseDeclarations: childElements(root, "responseDeclaration").map((element) =>
        mapV2ResponseDeclaration(element),
      ),
      outcomeDeclarations: childElements(root, "outcomeDeclaration").map((element) => mapV2OutcomeDeclaration(element)),
      ...(firstChildElement(root, "itemBody")
        ? {
            itemBody: {
              children: mapV2ContentNodes(firstChildElement(root, "itemBody")!.children),
            },
          }
        : {}),
    },
  };
}

function normalizeQti22Manifest(root: QtiXmlElementNode) {
  const metadataElement = firstChildElement(root, "metadata");
  if (!metadataElement) {
    throw new Error("<manifest> must contain <metadata>.");
  }

  return {
    manifest: {
      identifier: requireAttribute(root, "identifier"),
      metadata: {
        schema: textContent(firstChildElement(metadataElement, "schema") ?? metadataElement) ?? "",
        schemaVersion: textContent(firstChildElement(metadataElement, "schemaversion") ?? metadataElement) ?? "",
      },
      organizations: {},
      resources: childElements(firstChildElement(root, "resources") ?? root, "resource").map((resourceElement) => ({
        identifier: requireAttribute(resourceElement, "identifier"),
        type: requireAttribute(resourceElement, "type"),
        ...(resourceElement.attributes.href ? { href: resourceElement.attributes.href } : {}),
        ...(childElements(resourceElement, "file").length
          ? {
              files: childElements(resourceElement, "file").map((fileElement) => ({
                href: requireAttribute(fileElement, "href"),
              })),
            }
          : {}),
        ...(childElements(resourceElement, "dependency").length
          ? {
              dependencies: childElements(resourceElement, "dependency").map((dependencyElement) => ({
                identifierRef: requireAttribute(dependencyElement, "identifierref"),
              })),
            }
          : {}),
      })),
    },
  };
}

function mapV3ResponseProcessing(element: QtiXmlElementNode) {
  const rules = childElements(element).map((rule) => mapV3ResponseRule(rule));

  return {
    ...optionalString(element.attributes, "template", "template"),
    ...optionalString(element.attributes, "template-location", "templateLocation"),
    ...(rules.length ? { rules } : {}),
  };
}

function mapV3ModalFeedback(element: QtiXmlElementNode) {
  return {
    kind: "modalFeedback",
    outcomeIdentifier: requireAttribute(element, "outcome-identifier"),
    identifier: requireAttribute(element, "identifier"),
    showHide: requireAttribute(element, "show-hide"),
    ...optionalString(element.attributes, "title", "title"),
    ...contentOf(element),
  };
}

function normalizeQti301AssessmentItem(root: QtiXmlElementNode) {
  const templateProcessingElement = firstChildElement(root, "qti-template-processing");
  const responseProcessingElement = firstChildElement(root, "qti-response-processing");

  return {
    assessmentItem: {
      identifier: requireAttribute(root, "identifier"),
      title: requireAttribute(root, "title"),
      ...optionalString(root.attributes, "label", "label"),
      ...optionalString(root.attributes, "xml:lang", "xmlLang"),
      ...optionalString(root.attributes, "tool-name", "toolName"),
      ...optionalString(root.attributes, "tool-version", "toolVersion"),
      timeDependent: attributeBoolean(root.attributes, "time-dependent") ?? false,
      ...(attributeBoolean(root.attributes, "adaptive") !== undefined
        ? { adaptive: attributeBoolean(root.attributes, "adaptive") }
        : {}),
      ...(childElements(root, "qti-context-declaration").length
        ? {
            contextDeclarations: childElements(root, "qti-context-declaration").map((element) =>
              mapV3ContextDeclaration(element),
            ),
          }
        : {}),
      responseDeclarations: childElements(root, "qti-response-declaration").map((element) =>
        mapV3ResponseDeclaration(element),
      ),
      outcomeDeclarations: childElements(root, "qti-outcome-declaration").map((element) =>
        mapV3OutcomeDeclaration(element),
      ),
      ...(childElements(root, "qti-template-declaration").length
        ? {
            templateDeclarations: childElements(root, "qti-template-declaration").map((element) =>
              mapV3TemplateDeclaration(element),
            ),
          }
        : {}),
      ...(templateProcessingElement
        ? {
            templateProcessing: {
              rules: childElements(templateProcessingElement).map((rule) => mapV3TemplateRule(rule)),
            },
          }
        : {}),
      ...(childElements(root, "qti-stylesheet").length
        ? { stylesheets: childElements(root, "qti-stylesheet").map((element) => mapV3StyleSheet(element)) }
        : {}),
      ...(firstChildElement(root, "qti-item-body")
        ? {
            itemBody: {
              content: mapV3ContentFragments(firstChildElement(root, "qti-item-body")!.children),
            },
          }
        : {}),
      ...(responseProcessingElement ? { responseProcessing: mapV3ResponseProcessing(responseProcessingElement) } : {}),
      ...(childElements(root, "qti-modal-feedback").length
        ? { modalFeedbacks: childElements(root, "qti-modal-feedback").map((element) => mapV3ModalFeedback(element)) }
        : {}),
    },
  };
}

function normalizeQti301AssessmentTest(root: QtiXmlElementNode) {
  const outcomeProcessingElement = firstChildElement(root, "qti-outcome-processing");

  return {
    assessmentTest: {
      identifier: requireAttribute(root, "identifier"),
      title: requireAttribute(root, "title"),
      ...optionalString(root.attributes, "tool-name", "toolName"),
      ...optionalString(root.attributes, "tool-version", "toolVersion"),
      ...(childElements(root, "qti-context-declaration").length
        ? {
            contextDeclarations: childElements(root, "qti-context-declaration").map((element) =>
              mapV3ContextDeclaration(element),
            ),
          }
        : {}),
      outcomeDeclarations: childElements(root, "qti-outcome-declaration").map((element) =>
        mapV3OutcomeDeclaration(element),
      ),
      ...(firstChildElement(root, "qti-time-limits")
        ? { timeLimits: mapV3TimeLimits(firstChildElement(root, "qti-time-limits")!) }
        : {}),
      ...(childElements(root, "qti-stylesheet").length
        ? { stylesheets: childElements(root, "qti-stylesheet").map((element) => mapV3StyleSheet(element)) }
        : {}),
      testParts: childElements(root, "qti-test-part").map((testPart) => ({
        identifier: requireAttribute(testPart, "identifier"),
        ...optionalString(testPart.attributes, "title", "title"),
        navigationMode: requireAttribute(testPart, "navigation-mode"),
        submissionMode: requireAttribute(testPart, "submission-mode"),
        ...(childElements(testPart, "qti-pre-condition").length
          ? { preConditions: childElements(testPart, "qti-pre-condition").map((child) => mapV3PreCondition(child)) }
          : {}),
        ...(childElements(testPart, "qti-branch-rule").length
          ? { branchRules: childElements(testPart, "qti-branch-rule").map((child) => mapV3BranchRule(child)) }
          : {}),
        ...(firstChildElement(testPart, "qti-item-session-control")
          ? { itemSessionControl: mapV3ItemSessionControl(firstChildElement(testPart, "qti-item-session-control")!) }
          : {}),
        ...(firstChildElement(testPart, "qti-time-limits")
          ? { timeLimits: mapV3TimeLimits(firstChildElement(testPart, "qti-time-limits")!) }
          : {}),
        ...(childElements(testPart, "qti-rubric-block").length
          ? { rubricBlocks: childElements(testPart, "qti-rubric-block").map((child) => mapV3TestRubricBlock(child)) }
          : {}),
        children: childElements(testPart)
          .filter((child) => child.localName === "qti-assessment-section")
          .map((section) => mapV3AssessmentSection(section)),
        ...(childElements(testPart, "qti-test-feedback").length
          ? { testFeedbacks: childElements(testPart, "qti-test-feedback").map((child) => mapV3TestFeedback(child)) }
          : {}),
      })),
      ...(outcomeProcessingElement
        ? {
            outcomeProcessing: {
              rules: childElements(outcomeProcessingElement).map((rule) => mapV3OutcomeRule(rule)),
            },
          }
        : {}),
      ...(childElements(root, "qti-test-feedback").length
        ? { testFeedbacks: childElements(root, "qti-test-feedback").map((child) => mapV3TestFeedback(child)) }
        : {}),
    },
  };
}

function normalizeQti301AssessmentResult(root: QtiXmlElementNode) {
  return {
    assessmentResult: {
      ...(firstChildElement(root, "context")
        ? { context: mapV3ResultContext(firstChildElement(root, "context")!) }
        : { context: {} }),
      ...(firstChildElement(root, "testResult")
        ? { testResult: mapV3TestResult(firstChildElement(root, "testResult")!) }
        : {}),
      ...(childElements(root, "itemResult").length
        ? { itemResults: childElements(root, "itemResult").map((itemResult) => mapV3ItemResult(itemResult)) }
        : {}),
    },
  };
}

export function normalizeQtiDocument(
  version: QtiVersion,
  schemaSelectionKey: QtiSchemaSelectionKey,
  root: QtiXmlElementNode,
): unknown {
  switch (`${version}:${schemaSelectionKey}`) {
    case "2.2:qtiAssessmentItemDocument":
      return normalizeQti22AssessmentItem(root);
    case "2.2:qtiManifestDocument":
      return normalizeQti22Manifest(root);
    case "3.0.1:qtiAssessmentItemDocument":
      return normalizeQti301AssessmentItem(root);
    case "3.0.1:qtiAssessmentTestDocument":
      return normalizeQti301AssessmentTest(root);
    case "3.0.1:qtiAssessmentResultDocument":
      return normalizeQti301AssessmentResult(root);
    default:
      throw new Error(`Normalization is not implemented for ${version} ${schemaSelectionKey}.`);
  }
}
