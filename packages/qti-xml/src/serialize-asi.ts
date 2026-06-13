/**
 * QTI 3 ASI (Assessment, Section & Item) XML serialization — the authoring-system
 * EXPORT direction. Takes the normalized/contracts document shape and emits an
 * instance against the official ASI binding (namespace imsqtiasi_v3p0), the exact
 * inverse of the normalizer in normalize.ts. The export-conformance gate is the model
 * round trip (serialize → parse → normalize → strict contracts schema → deep-equal),
 * proven across the whole vendored corpus in serialize-asi-corpus.local.test.ts.
 *
 * Element/attribute spellings mirror the normalizer's reads exactly (kebab-case in the
 * XSD, e.g. `qti-hottext` not `qti-hot-text`, `base-type`, `response-identifier`). The
 * normalizer is lossy in known ways — element @id, comments, the optional
 * <qti-content-body> wrapper, the item-ref/section-ref distinction for bare refs — and
 * those losses are exactly what this writer need not reproduce: re-normalization drops
 * the same nothing, so model idempotence holds.
 */

import { XmlWriter, type AttributeValue } from "./xml-writer";

export const asiNamespace = "http://www.imsglobal.org/xsd/imsqtiasi_v3p0";
const asiSchemaLocation = `${asiNamespace} https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd`;

// ---------------------------------------------------------------------------
// Model accessors — the normalized document is a tree of plain objects keyed by
// `kind`; these read fields without leaking `any`.
// ---------------------------------------------------------------------------

type Node = Record<string, unknown>;
type Attrs = ReadonlyArray<readonly [string, AttributeValue]>;

function asNode(value: unknown): Node {
  return (value ?? {}) as Node;
}

function str(node: Node, key: string): string | undefined {
  const value = node[key];
  return typeof value === "string" ? value : undefined;
}

function scalar(value: unknown): AttributeValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function attr(node: Node, key: string): AttributeValue {
  return scalar(node[key]);
}

function list(node: Node, key: string): string | undefined {
  const value = node[key];
  return Array.isArray(value) && value.length ? value.map((entry) => String(entry)).join(" ") : undefined;
}

function nodes(node: Node, key: string): Node[] {
  const value = node[key];
  return Array.isArray(value) ? value.map((entry) => asNode(entry)) : [];
}

function fragments(node: Node, key: string): unknown[] {
  const value = node[key];
  return Array.isArray(value) ? value : [];
}

// ---------------------------------------------------------------------------
// Content fragments and the generic foreign-XML node (HTML flow, MathML, SSML).
// ---------------------------------------------------------------------------

const domainKinds = new Set([
  "prompt",
  "simpleChoice",
  "choiceInteraction",
  "orderInteraction",
  "inlineChoice",
  "inlineChoiceInteraction",
  "textEntryInteraction",
  "extendedTextInteraction",
  "hotText",
  "hotTextInteraction",
  "matchInteraction",
  "simpleAssociableChoice",
  "associateInteraction",
  "gap",
  "gapText",
  "gapImg",
  "gapMatchInteraction",
  "hotspotChoice",
  "associableHotspot",
  "hotspotInteraction",
  "graphicOrderInteraction",
  "graphicAssociateInteraction",
  "graphicGapMatchInteraction",
  "selectPointInteraction",
  "positionObjectStage",
  "positionObjectInteraction",
  "mediaInteraction",
  "uploadInteraction",
  "sliderInteraction",
  "endAttemptInteraction",
  "feedbackInline",
  "feedbackBlock",
  "templateInline",
  "templateBlock",
  "printedVariable",
  "rubricBlock",
  "testRubricBlock",
  "include",
  "portableCustomInteraction",
  "customInteraction",
  "drawingInteraction",
]);

function writeContent(writer: XmlWriter, content: readonly unknown[], ambient: string): void {
  for (const fragment of content) {
    if (typeof fragment === "string") {
      writer.text(fragment);
      continue;
    }

    const node = asNode(fragment);
    if (node["kind"] === "xml") {
      writeXmlNode(writer, node, ambient);
      continue;
    }
    if (typeof node["kind"] === "string" && domainKinds.has(node["kind"] as string)) {
      writeDomainNode(writer, node, ambient);
      continue;
    }
  }
}

/** A generic foreign element: HTML flow in the ASI namespace, or MathML/SSML/SVG. */
function writeXmlNode(writer: XmlWriter, node: Node, ambient: string): void {
  const name = str(node, "name") ?? "span";
  const rawAttributes = (node["attributes"] ?? {}) as Record<string, string>;
  const namespace = str(node, "namespace");
  const attributes: Array<readonly [string, AttributeValue]> = Object.entries(rawAttributes);

  let childAmbient = ambient;
  if (namespace !== undefined && namespace !== ambient) {
    // Redeclare the default namespace on this element; the normalizer keeps only
    // localName + namespaceUri, so a default-xmlns form round-trips the prefix away.
    attributes.push(["xmlns", namespace]);
    childAmbient = namespace;
  }

  const children = node["children"];
  if (Array.isArray(children) && children.length) {
    writer.element(name, attributes, () => writeContent(writer, children, childAmbient));
    return;
  }

  const value = str(node, "value");
  if (value !== undefined) {
    writer.element(name, attributes, value);
    return;
  }

  writer.element(name, attributes);
}

// ---------------------------------------------------------------------------
// Catalogs (§5.26–5.29) and companion materials (§2.13.1).
// ---------------------------------------------------------------------------

function dataAttributePairs(node: Node): Array<readonly [string, AttributeValue]> {
  const data = node["dataAttributes"];
  if (!data || typeof data !== "object") {
    return [];
  }
  return Object.entries(data as Record<string, unknown>).map(([key, value]) => [`data-${key}`, scalar(value)]);
}

function writeCatalogHtmlContent(writer: XmlWriter, html: Node): void {
  const attributes: Attrs = [["xml:lang", str(html, "xmlLang")], ...dataAttributePairs(html)];
  const content = fragments(html, "content");
  if (content.length) {
    writer.element("qti-html-content", attributes, () => writeContent(writer, content, asiNamespace));
    return;
  }
  writer.element("qti-html-content", attributes);
}

function writeCardContent(writer: XmlWriter, container: Node): void {
  const html = container["htmlContent"];
  if (html) {
    writeCatalogHtmlContent(writer, asNode(html));
  }
  for (const fileHref of nodes(container, "fileHrefs")) {
    writer.element("qti-file-href", [["mime-type", str(fileHref, "mimeType")]], str(fileHref, "href") ?? "");
  }
}

function writeCard(writer: XmlWriter, card: Node): void {
  const attributes: Attrs = [
    ["support", str(card, "support")],
    ["xml:lang", str(card, "xmlLang")],
  ];
  const entries = nodes(card, "cardEntries");

  writer.element("qti-card", attributes, () => {
    if (entries.length) {
      for (const entry of entries) {
        const entryAttributes: Attrs = [
          ["xml:lang", str(entry, "xmlLang")],
          ["default", attr(entry, "default")],
          ...dataAttributePairs(entry),
        ];
        writer.element("qti-card-entry", entryAttributes, () => writeCardContent(writer, entry));
      }
      return;
    }
    writeCardContent(writer, card);
  });
}

function writeCatalogInfo(writer: XmlWriter, node: Node): void {
  const catalogInfo = node["catalogInfo"];
  if (!catalogInfo) {
    return;
  }
  writer.element("qti-catalog-info", [], () => {
    for (const catalog of nodes(asNode(catalogInfo), "catalogs")) {
      writer.element("qti-catalog", [["id", str(catalog, "id")]], () => {
        for (const card of nodes(catalog, "cards")) {
          writeCard(writer, card);
        }
      });
    }
  });
}

function writeMeasurementValue(writer: XmlWriter, tag: string, value: Node): void {
  writer.element(tag, [["unit", str(value, "unit")]], String(scalar(value["value"]) ?? 0));
}

function writeItemFileInfo(writer: XmlWriter, tag: string, info: Node): void {
  writer.element(
    tag,
    [
      ["mime-type", str(info, "mimeType")],
      ["label", str(info, "label")],
    ],
    () => {
      writer.element("qti-file-href", [], str(info, "fileHref") ?? "");
      const icon = str(info, "resourceIcon");
      if (icon !== undefined) {
        writer.element("qti-resource-icon", [], icon);
      }
    },
  );
}

function writeRuleSystem(writer: XmlWriter, tag: string, system: Node): void {
  writer.element(tag, [], () => {
    writer.element("qti-minimum-length", [], String(scalar(system["minimumLength"]) ?? 0));
    const minor = system["minorIncrement"];
    if (minor) {
      writeMeasurementValue(writer, "qti-minor-increment", asNode(minor));
    }
    writeMeasurementValue(writer, "qti-major-increment", asNode(system["majorIncrement"]));
  });
}

function writeProtractorIncrement(writer: XmlWriter, tag: string, increment: Node): void {
  writer.element(tag, [], () => {
    const minor = increment["minorIncrement"];
    if (minor) {
      writeMeasurementValue(writer, "qti-minor-increment", asNode(minor));
    }
    writeMeasurementValue(writer, "qti-major-increment", asNode(increment["majorIncrement"]));
  });
}

function writeCompanionMaterials(writer: XmlWriter, node: Node): void {
  const info = node["companionMaterialsInfo"];
  if (!info) {
    return;
  }
  const materials = asNode(info);

  writer.element("qti-companion-materials-info", [], () => {
    for (const calculator of nodes(materials, "calculators")) {
      writer.element("qti-calculator", [], () => {
        writer.element("qti-calculator-type", [], str(calculator, "calculatorType") ?? "");
        writer.element("qti-description", [], str(calculator, "description") ?? "");
        const calculatorInfo = calculator["calculatorInfo"];
        if (calculatorInfo) {
          writeItemFileInfo(writer, "qti-calculator-info", asNode(calculatorInfo));
        }
      });
    }
    for (const rule of nodes(materials, "rules")) {
      writer.element("qti-rule", [], () => {
        writer.element("qti-description", [], str(rule, "description") ?? "");
        if (rule["ruleSystemSi"]) {
          writeRuleSystem(writer, "qti-rule-system-si", asNode(rule["ruleSystemSi"]));
        }
        if (rule["ruleSystemUs"]) {
          writeRuleSystem(writer, "qti-rule-system-us", asNode(rule["ruleSystemUs"]));
        }
      });
    }
    for (const protractor of nodes(materials, "protractors")) {
      writer.element("qti-protractor", [], () => {
        writer.element("qti-description", [], str(protractor, "description") ?? "");
        if (protractor["incrementSi"]) {
          writeProtractorIncrement(writer, "qti-increment-si", asNode(protractor["incrementSi"]));
        }
        if (protractor["incrementUs"]) {
          writeProtractorIncrement(writer, "qti-increment-us", asNode(protractor["incrementUs"]));
        }
      });
    }
    for (const material of nodes(materials, "digitalMaterials")) {
      writeItemFileInfo(writer, "qti-digital-material", material);
    }
    for (const material of fragments(materials, "physicalMaterials")) {
      writer.element("qti-physical-material", [], String(material));
    }
  });
}

// ---------------------------------------------------------------------------
// Expressions (inverse of mapV3Expression).
// ---------------------------------------------------------------------------

const childOnlyExpressionTags = new Map<string, string>([
  ["and", "qti-and"],
  ["contains", "qti-contains"],
  ["containerSize", "qti-container-size"],
  ["delete", "qti-delete"],
  ["divide", "qti-divide"],
  ["durationGte", "qti-duration-gte"],
  ["durationLt", "qti-duration-lt"],
  ["gcd", "qti-gcd"],
  ["gt", "qti-gt"],
  ["gte", "qti-gte"],
  ["integerDivide", "qti-integer-divide"],
  ["integerModulus", "qti-integer-modulus"],
  ["integerToFloat", "qti-integer-to-float"],
  ["isNull", "qti-is-null"],
  ["lcm", "qti-lcm"],
  ["lt", "qti-lt"],
  ["lte", "qti-lte"],
  ["match", "qti-match"],
  ["max", "qti-max"],
  ["member", "qti-member"],
  ["min", "qti-min"],
  ["multiple", "qti-multiple"],
  ["not", "qti-not"],
  ["or", "qti-or"],
  ["ordered", "qti-ordered"],
  ["power", "qti-power"],
  ["product", "qti-product"],
  ["random", "qti-random"],
  ["round", "qti-round"],
  ["subtract", "qti-subtract"],
  ["sum", "qti-sum"],
  ["truncate", "qti-truncate"],
]);

function writeExpressionChildren(writer: XmlWriter, expression: Node): void {
  for (const child of nodes(expression, "children")) {
    writeExpression(writer, child);
  }
}

function subsetAttributes(expression: Node): Attrs {
  return [
    ["section-identifier", str(expression, "sectionIdentifier")],
    ["include-category", list(expression, "includeCategory")],
    ["exclude-category", list(expression, "excludeCategory")],
  ];
}

function writeExpression(writer: XmlWriter, expression: Node): void {
  const kind = str(expression, "kind") ?? "";

  const childOnly = childOnlyExpressionTags.get(kind);
  if (childOnly !== undefined) {
    writer.element(childOnly, [], () => writeExpressionChildren(writer, expression));
    return;
  }

  const withChildren = (tag: string, attributes: Attrs): void => {
    writer.element(tag, attributes, () => writeExpressionChildren(writer, expression));
  };

  switch (kind) {
    case "null":
      writer.element("qti-null", []);
      return;
    case "baseValue":
      writer.element("qti-base-value", [["base-type", str(expression, "baseType")]], str(expression, "value") ?? "");
      return;
    case "variable":
      writer.element("qti-variable", [
        ["identifier", str(expression, "identifier")],
        ["weight-identifier", str(expression, "weightIdentifier")],
      ]);
      return;
    case "correct":
      writer.element("qti-correct", [["identifier", str(expression, "identifier")]]);
      return;
    case "default":
      writer.element("qti-default", [["identifier", str(expression, "identifier")]]);
      return;
    case "mapResponse":
      writer.element("qti-map-response", [["identifier", str(expression, "identifier")]]);
      return;
    case "mapResponsePoint":
      writer.element("qti-map-response-point", [["identifier", str(expression, "identifier")]]);
      return;
    case "randomInteger":
      writer.element("qti-random-integer", [
        ["min", attr(expression, "min")],
        ["max", attr(expression, "max")],
        ["step", attr(expression, "step")],
      ]);
      return;
    case "randomFloat":
      writer.element("qti-random-float", [
        ["min", attr(expression, "min")],
        ["max", attr(expression, "max")],
      ]);
      return;
    case "mathConstant":
      writer.element("qti-math-constant", [["name", str(expression, "name")]]);
      return;
    case "mathOperator":
      withChildren("qti-math-operator", [["name", str(expression, "name")]]);
      return;
    case "statsOperator":
      withChildren("qti-stats-operator", [["name", str(expression, "name")]]);
      return;
    case "anyN":
      withChildren("qti-any-n", [
        ["min", attr(expression, "min")],
        ["max", attr(expression, "max")],
      ]);
      return;
    case "equal":
      withChildren("qti-equal", [
        ["tolerance-mode", str(expression, "toleranceMode")],
        ["tolerance", list(expression, "tolerance")],
        ["include-lower-bound", attr(expression, "includeLowerBound")],
        ["include-upper-bound", attr(expression, "includeUpperBound")],
      ]);
      return;
    case "equalRounded":
      withChildren("qti-equal-rounded", [
        ["rounding-mode", str(expression, "roundingMode")],
        ["figures", attr(expression, "figures")],
      ]);
      return;
    case "roundTo":
      withChildren("qti-round-to", [
        ["rounding-mode", str(expression, "roundingMode")],
        ["figures", attr(expression, "figures")],
      ]);
      return;
    case "fieldValue":
      withChildren("qti-field-value", [["field-identifier", str(expression, "fieldIdentifier")]]);
      return;
    case "index":
      withChildren("qti-index", [["n", attr(expression, "n")]]);
      return;
    case "inside":
      withChildren("qti-inside", [
        ["shape", str(expression, "shape")],
        ["coords", str(expression, "coords")],
      ]);
      return;
    case "patternMatch":
      withChildren("qti-pattern-match", [["pattern", str(expression, "pattern")]]);
      return;
    case "stringMatch":
      withChildren("qti-string-match", [
        ["case-sensitive", attr(expression, "caseSensitive")],
        ["substring", attr(expression, "substring")],
      ]);
      return;
    case "substring":
      withChildren("qti-substring", [["case-sensitive", attr(expression, "caseSensitive")]]);
      return;
    case "repeat":
      withChildren("qti-repeat", [["number-repeats", attr(expression, "numberRepeats")]]);
      return;
    case "customOperator":
      withChildren("qti-custom-operator", [
        ["class", str(expression, "class")],
        ["definition", str(expression, "definition")],
      ]);
      return;
    case "numberCorrect":
      writer.element("qti-number-correct", subsetAttributes(expression));
      return;
    case "numberIncorrect":
      writer.element("qti-number-incorrect", subsetAttributes(expression));
      return;
    case "numberPresented":
      writer.element("qti-number-presented", subsetAttributes(expression));
      return;
    case "numberResponded":
      writer.element("qti-number-responded", subsetAttributes(expression));
      return;
    case "numberSelected":
      writer.element("qti-number-selected", subsetAttributes(expression));
      return;
    case "outcomeMinimum":
      writer.element("qti-outcome-minimum", [
        ...subsetAttributes(expression),
        ["outcome-identifier", str(expression, "outcomeIdentifier")],
        ["weight-identifier", str(expression, "weightIdentifier")],
      ]);
      return;
    case "outcomeMaximum":
      writer.element("qti-outcome-maximum", [
        ...subsetAttributes(expression),
        ["outcome-identifier", str(expression, "outcomeIdentifier")],
        ["weight-identifier", str(expression, "weightIdentifier")],
      ]);
      return;
    case "testVariables":
      writer.element("qti-test-variables", [
        ...subsetAttributes(expression),
        ["variable-identifier", str(expression, "variableIdentifier")],
        ["weight-identifier", str(expression, "weightIdentifier")],
        ["base-type", str(expression, "baseType")],
      ]);
      return;
    default:
      throw new Error(`Cannot serialize QTI 3.0.1 expression of kind "${kind}".`);
  }
}

// ---------------------------------------------------------------------------
// Response / template / outcome rules.
// ---------------------------------------------------------------------------

function writeConditionBranch(
  writer: XmlWriter,
  tag: string,
  branch: Node,
  writeRule: (rule: Node) => void,
  withExpression: boolean,
): void {
  writer.element(tag, [], () => {
    if (withExpression && branch["expression"]) {
      writeExpression(writer, asNode(branch["expression"]));
    }
    for (const action of nodes(branch, "actions")) {
      writeRule(action);
    }
  });
}

function writeSetExpressionRule(writer: XmlWriter, tag: string, rule: Node): void {
  writer.element(tag, [["identifier", str(rule, "identifier")]], () => {
    if (rule["expression"]) {
      writeExpression(writer, asNode(rule["expression"]));
    }
  });
}

function writeResponseRule(writer: XmlWriter, rule: Node): void {
  switch (str(rule, "kind")) {
    case "responseCondition":
      writer.element("qti-response-condition", [], () => {
        writeConditionBranch(
          writer,
          "qti-response-if",
          asNode(rule["responseIf"]),
          (r) => writeResponseRule(writer, r),
          true,
        );
        for (const elseIf of nodes(rule, "responseElseIf")) {
          writeConditionBranch(writer, "qti-response-else-if", elseIf, (r) => writeResponseRule(writer, r), true);
        }
        if (rule["responseElse"]) {
          writeConditionBranch(
            writer,
            "qti-response-else",
            asNode(rule["responseElse"]),
            (r) => writeResponseRule(writer, r),
            false,
          );
        }
      });
      return;
    case "setOutcomeValue":
      writeSetExpressionRule(writer, "qti-set-outcome-value", rule);
      return;
    case "lookupOutcomeValue":
      writeSetExpressionRule(writer, "qti-lookup-outcome-value", rule);
      return;
    case "exitResponse":
      writer.element("qti-exit-response", []);
      return;
    case "responseProcessingFragment":
      writer.element("qti-response-processing-fragment", [], () => {
        for (const inner of nodes(rule, "rules")) {
          writeResponseRule(writer, inner);
        }
      });
      return;
    default:
      throw new Error(`Cannot serialize QTI 3.0.1 response rule of kind "${str(rule, "kind")}".`);
  }
}

function writeTemplateRule(writer: XmlWriter, rule: Node): void {
  switch (str(rule, "kind")) {
    case "templateCondition":
      writer.element("qti-template-condition", [], () => {
        writeConditionBranch(
          writer,
          "qti-template-if",
          asNode(rule["templateIf"]),
          (r) => writeTemplateRule(writer, r),
          true,
        );
        for (const elseIf of nodes(rule, "templateElseIf")) {
          writeConditionBranch(writer, "qti-template-else-if", elseIf, (r) => writeTemplateRule(writer, r), true);
        }
        if (rule["templateElse"]) {
          writeConditionBranch(
            writer,
            "qti-template-else",
            asNode(rule["templateElse"]),
            (r) => writeTemplateRule(writer, r),
            false,
          );
        }
      });
      return;
    case "setTemplateValue":
      writeSetExpressionRule(writer, "qti-set-template-value", rule);
      return;
    case "setDefaultValue":
      writeSetExpressionRule(writer, "qti-set-default-value", rule);
      return;
    case "setCorrectResponse":
      writeSetExpressionRule(writer, "qti-set-correct-response", rule);
      return;
    case "templateConstraint":
      writer.element("qti-template-constraint", [], () => {
        if (rule["expression"]) {
          writeExpression(writer, asNode(rule["expression"]));
        }
      });
      return;
    case "exitTemplate":
      writer.element("qti-exit-template", []);
      return;
    default:
      throw new Error(`Cannot serialize QTI 3.0.1 template rule of kind "${str(rule, "kind")}".`);
  }
}

function writeOutcomeRule(writer: XmlWriter, rule: Node): void {
  switch (str(rule, "kind")) {
    case "outcomeCondition":
      writer.element("qti-outcome-condition", [], () => {
        writeConditionBranch(
          writer,
          "qti-outcome-if",
          asNode(rule["outcomeIf"]),
          (r) => writeOutcomeRule(writer, r),
          true,
        );
        for (const elseIf of nodes(rule, "outcomeElseIf")) {
          writeConditionBranch(writer, "qti-outcome-else-if", elseIf, (r) => writeOutcomeRule(writer, r), true);
        }
        if (rule["outcomeElse"]) {
          writeConditionBranch(
            writer,
            "qti-outcome-else",
            asNode(rule["outcomeElse"]),
            (r) => writeOutcomeRule(writer, r),
            false,
          );
        }
      });
      return;
    case "setOutcomeValue":
      writeSetExpressionRule(writer, "qti-set-outcome-value", rule);
      return;
    case "lookupOutcomeValue":
      writeSetExpressionRule(writer, "qti-lookup-outcome-value", rule);
      return;
    case "exitTest":
      writer.element("qti-exit-test", []);
      return;
    case "outcomeProcessingFragment":
      writer.element("qti-outcome-processing-fragment", [], () => {
        for (const inner of nodes(rule, "rules")) {
          writeOutcomeRule(writer, inner);
        }
      });
      return;
    default:
      throw new Error(`Cannot serialize QTI 3.0.1 outcome rule of kind "${str(rule, "kind")}".`);
  }
}

function writeResponseProcessing(writer: XmlWriter, processing: Node): void {
  const attributes: Attrs = [
    ["template", str(processing, "template")],
    ["template-location", str(processing, "templateLocation")],
  ];
  const rules = nodes(processing, "rules");
  if (!rules.length) {
    writer.element("qti-response-processing", attributes);
    return;
  }
  writer.element("qti-response-processing", attributes, () => {
    for (const rule of rules) {
      writeResponseRule(writer, rule);
    }
  });
}

// ---------------------------------------------------------------------------
// Declarations.
// ---------------------------------------------------------------------------

function writeValues(writer: XmlWriter, container: Node): void {
  for (const value of nodes(container, "values")) {
    writer.element(
      "qti-value",
      [
        ["base-type", str(value, "baseType")],
        ["field-identifier", str(value, "fieldIdentifier")],
      ],
      str(value, "value") ?? "",
    );
  }
}

function writeDefaultValue(writer: XmlWriter, declaration: Node): void {
  const defaultValue = declaration["defaultValue"];
  if (defaultValue) {
    writer.element("qti-default-value", [], () => writeValues(writer, asNode(defaultValue)));
  }
}

function writeMappingBounds(node: Node): Attrs {
  return [
    ["lower-bound", attr(node, "lowerBound")],
    ["upper-bound", attr(node, "upperBound")],
    ["default-value", attr(node, "defaultValue")],
  ];
}

function writeResponseDeclaration(writer: XmlWriter, declaration: Node): void {
  writer.element(
    "qti-response-declaration",
    [
      ["identifier", str(declaration, "identifier")],
      ["cardinality", str(declaration, "cardinality")],
      ["base-type", str(declaration, "baseType")],
    ],
    () => {
      writeDefaultValue(writer, declaration);
      const correct = declaration["correctResponse"];
      if (correct) {
        writer.element("qti-correct-response", [], () => writeValues(writer, asNode(correct)));
      }
      const mapping = declaration["mapping"];
      if (mapping) {
        writer.element("qti-mapping", writeMappingBounds(asNode(mapping)), () => {
          for (const entry of nodes(asNode(mapping), "mapEntries")) {
            writer.element("qti-map-entry", [
              ["map-key", str(entry, "mapKey")],
              ["mapped-value", attr(entry, "mappedValue")],
              ["case-sensitive", attr(entry, "caseSensitive")],
            ]);
          }
        });
      }
      const areaMapping = declaration["areaMapping"];
      if (areaMapping) {
        writer.element("qti-area-mapping", writeMappingBounds(asNode(areaMapping)), () => {
          for (const entry of nodes(asNode(areaMapping), "areaMapEntries")) {
            writer.element("qti-area-map-entry", [
              ["shape", str(entry, "shape")],
              ["coords", str(entry, "coords")],
              ["mapped-value", attr(entry, "mappedValue")],
            ]);
          }
        });
      }
    },
  );
}

function writeOutcomeDeclaration(writer: XmlWriter, declaration: Node): void {
  writer.element(
    "qti-outcome-declaration",
    [
      ["identifier", str(declaration, "identifier")],
      ["cardinality", str(declaration, "cardinality")],
      ["base-type", str(declaration, "baseType")],
      ["view", list(declaration, "view")],
      ["external-scored", str(declaration, "externalScored")],
      ["interpretation", str(declaration, "interpretation")],
      ["long-interpretation", str(declaration, "longInterpretation")],
      ["normal-maximum", attr(declaration, "normalMaximum")],
      ["normal-minimum", attr(declaration, "normalMinimum")],
      ["mastery-value", attr(declaration, "masteryValue")],
    ],
    () => {
      writeDefaultValue(writer, declaration);
      const matchTable = declaration["matchTable"];
      if (matchTable) {
        writer.element("qti-match-table", [["default-value", str(asNode(matchTable), "defaultValue")]], () => {
          for (const entry of nodes(asNode(matchTable), "matchTableEntries")) {
            writer.element("qti-match-table-entry", [
              ["source-value", attr(entry, "sourceValue")],
              ["target-value", str(entry, "targetValue")],
            ]);
          }
        });
      }
      const interpolationTable = declaration["interpolationTable"];
      if (interpolationTable) {
        writer.element(
          "qti-interpolation-table",
          [["default-value", str(asNode(interpolationTable), "defaultValue")]],
          () => {
            for (const entry of nodes(asNode(interpolationTable), "interpolationTableEntries")) {
              writer.element("qti-interpolation-table-entry", [
                ["source-value", attr(entry, "sourceValue")],
                ["target-value", str(entry, "targetValue")],
                ["include-boundary", attr(entry, "includeBoundary")],
              ]);
            }
          },
        );
      }
    },
  );
}

function writeTemplateDeclaration(writer: XmlWriter, declaration: Node): void {
  writer.element(
    "qti-template-declaration",
    [
      ["identifier", str(declaration, "identifier")],
      ["cardinality", str(declaration, "cardinality")],
      ["base-type", str(declaration, "baseType")],
      ["param-variable", attr(declaration, "paramVariable")],
      ["math-variable", attr(declaration, "mathVariable")],
    ],
    () => writeDefaultValue(writer, declaration),
  );
}

function writeContextDeclaration(writer: XmlWriter, declaration: Node): void {
  writer.element(
    "qti-context-declaration",
    [
      ["identifier", str(declaration, "identifier")],
      ["cardinality", str(declaration, "cardinality")],
      ["base-type", str(declaration, "baseType")],
    ],
    () => writeDefaultValue(writer, declaration),
  );
}

function writeStylesheet(writer: XmlWriter, stylesheet: Node): void {
  writer.element("qti-stylesheet", [
    ["href", str(stylesheet, "href")],
    ["type", str(stylesheet, "type")],
    ["media", str(stylesheet, "media")],
    ["title", str(stylesheet, "title")],
  ]);
}

// ---------------------------------------------------------------------------
// Interaction / body domain nodes.
// ---------------------------------------------------------------------------

function writePrompt(writer: XmlWriter, node: Node, ambient: string): void {
  const prompt = node["prompt"];
  if (prompt) {
    writer.element("qti-prompt", [], () => writeContent(writer, fragments(asNode(prompt), "content"), ambient));
  }
}

function writeBodyContent(writer: XmlWriter, node: Node, ambient: string): void {
  writeContent(writer, fragments(node, "content"), ambient);
}

/**
 * Block containers (feedback-block, modal-feedback, rubric-block, test-rubric-block,
 * template-block, test-feedback) wrap their flow content in <qti-content-body> — the
 * ASI XSD requires it for several of them. The normalizer unwraps it transparently,
 * so this stays round-trip-faithful while satisfying the official schema.
 */
function writeContentBody(writer: XmlWriter, node: Node, ambient: string): void {
  writer.element("qti-content-body", [], () => writeContent(writer, fragments(node, "content"), ambient));
}

function writeChoices(writer: XmlWriter, choices: Node[], ambient: string): void {
  for (const choice of choices) {
    writeDomainNode(writer, choice, ambient);
  }
}

function writeHotspot(writer: XmlWriter, tag: string, node: Node): void {
  writer.element(tag, [
    ["identifier", str(node, "identifier")],
    ["shape", str(node, "shape")],
    ["coords", str(node, "coords")],
    ["match-max", attr(node, "matchMax")],
    ["hotspot-label", str(node, "hotspotLabel")],
    ["match-group", list(node, "matchGroup")],
  ]);
}

function writeDomainNode(writer: XmlWriter, node: Node, ambient: string): void {
  const kind = str(node, "kind") ?? "";

  switch (kind) {
    case "prompt":
      writer.element("qti-prompt", [], () => writeContent(writer, fragments(node, "content"), ambient));
      return;

    case "simpleChoice":
      writer.element(
        "qti-simple-choice",
        [
          ["identifier", str(node, "identifier")],
          ["fixed", attr(node, "fixed")],
          ["template-identifier", str(node, "templateIdentifier")],
          ["show-hide", str(node, "showHide")],
        ],
        () => writeBodyContent(writer, node, ambient),
      );
      return;

    case "choiceInteraction":
    case "orderInteraction":
      writer.element(
        kind === "choiceInteraction" ? "qti-choice-interaction" : "qti-order-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["shuffle", attr(node, "shuffle")],
          ["max-choices", attr(node, "maxChoices")],
          ["min-choices", attr(node, "minChoices")],
          ["orientation", str(node, "orientation")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          writeChoices(writer, nodes(node, "simpleChoices"), ambient);
        },
      );
      return;

    case "inlineChoice":
      writer.element(
        "qti-inline-choice",
        [
          ["identifier", str(node, "identifier")],
          ["fixed", attr(node, "fixed")],
          ["template-identifier", str(node, "templateIdentifier")],
          ["show-hide", str(node, "showHide")],
        ],
        () => writeBodyContent(writer, node, ambient),
      );
      return;

    case "inlineChoiceInteraction":
      writer.element(
        "qti-inline-choice-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["shuffle", attr(node, "shuffle")],
          ["required", attr(node, "required")],
          ["min-choices", attr(node, "minChoices")],
          ["data-prompt", str(node, "dataPrompt")],
        ],
        () => writeChoices(writer, nodes(node, "inlineChoices"), ambient),
      );
      return;

    case "textEntryInteraction":
      writer.element("qti-text-entry-interaction", [
        ["response-identifier", str(node, "responseIdentifier")],
        ["base", attr(node, "base")],
        ["string-identifier", str(node, "stringIdentifier")],
        ["expected-length", attr(node, "expectedLength")],
        ["pattern-mask", str(node, "patternMask")],
        ["placeholder-text", str(node, "placeholderText")],
        ["format", str(node, "format")],
      ]);
      return;

    case "extendedTextInteraction":
      writer.element(
        "qti-extended-text-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["base", attr(node, "base")],
          ["string-identifier", str(node, "stringIdentifier")],
          ["expected-length", attr(node, "expectedLength")],
          ["pattern-mask", str(node, "patternMask")],
          ["placeholder-text", str(node, "placeholderText")],
          ["max-strings", attr(node, "maxStrings")],
          ["min-strings", attr(node, "minStrings")],
          ["expected-lines", attr(node, "expectedLines")],
          ["format", str(node, "format")],
        ],
        () => writePrompt(writer, node, ambient),
      );
      return;

    case "hotText":
      writer.element(
        "qti-hottext",
        [
          ["identifier", str(node, "identifier")],
          ["template-identifier", str(node, "templateIdentifier")],
          ["show-hide", str(node, "showHide")],
        ],
        () => writeBodyContent(writer, node, ambient),
      );
      return;

    case "hotTextInteraction":
      writer.element(
        "qti-hottext-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["max-choices", attr(node, "maxChoices")],
          ["min-choices", attr(node, "minChoices")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          writeBodyContent(writer, node, ambient);
        },
      );
      return;

    case "matchInteraction":
      writer.element(
        "qti-match-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["shuffle", attr(node, "shuffle")],
          ["max-associations", attr(node, "maxAssociations")],
          ["min-associations", attr(node, "minAssociations")],
          ["data-first-column-header", str(node, "dataFirstColumnHeader")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          for (const set of nodes(node, "simpleMatchSets")) {
            writer.element("qti-simple-match-set", [], () => {
              for (const choice of nodes(set, "simpleAssociableChoices")) {
                writeDomainNode(writer, choice, ambient);
              }
            });
          }
        },
      );
      return;

    case "simpleAssociableChoice":
      writer.element(
        "qti-simple-associable-choice",
        [
          ["identifier", str(node, "identifier")],
          ["match-max", attr(node, "matchMax")],
          ["match-min", attr(node, "matchMin")],
          ["fixed", attr(node, "fixed")],
          ["match-group", list(node, "matchGroup")],
        ],
        () => writeBodyContent(writer, node, ambient),
      );
      return;

    case "associateInteraction":
      writer.element(
        "qti-associate-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["shuffle", attr(node, "shuffle")],
          ["max-associations", attr(node, "maxAssociations")],
          ["min-associations", attr(node, "minAssociations")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          for (const choice of nodes(node, "simpleAssociableChoices")) {
            writeDomainNode(writer, choice, ambient);
          }
        },
      );
      return;

    case "gap":
      writer.element("qti-gap", [
        ["identifier", str(node, "identifier")],
        ["required", attr(node, "required")],
        ["template-identifier", str(node, "templateIdentifier")],
        ["show-hide", str(node, "showHide")],
      ]);
      return;

    case "gapText":
      writer.element(
        "qti-gap-text",
        [
          ["identifier", str(node, "identifier")],
          ["match-max", attr(node, "matchMax")],
          ["match-min", attr(node, "matchMin")],
        ],
        () => writeBodyContent(writer, node, ambient),
      );
      return;

    case "gapImg":
      writer.element(
        "qti-gap-img",
        [
          ["identifier", str(node, "identifier")],
          ["match-max", attr(node, "matchMax")],
          ["match-min", attr(node, "matchMin")],
          ["object-label", str(node, "objectLabel")],
          ["top", str(node, "top")],
          ["left", str(node, "left")],
        ],
        () => writeXmlNode(writer, asNode(node["media"]), ambient),
      );
      return;

    case "gapMatchInteraction":
      writer.element(
        "qti-gap-match-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["shuffle", attr(node, "shuffle")],
          ["max-associations", attr(node, "maxAssociations")],
          ["min-associations", attr(node, "minAssociations")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          for (const choice of nodes(node, "gapChoices")) {
            writeDomainNode(writer, choice, ambient);
          }
          writeBodyContent(writer, node, ambient);
        },
      );
      return;

    case "hotspotChoice":
      writeHotspot(writer, "qti-hotspot-choice", node);
      return;

    case "associableHotspot":
      writeHotspot(writer, "qti-associable-hotspot", node);
      return;

    case "hotspotInteraction":
    case "graphicOrderInteraction":
      writer.element(
        kind === "hotspotInteraction" ? "qti-hotspot-interaction" : "qti-graphic-order-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["max-choices", attr(node, "maxChoices")],
          ["min-choices", attr(node, "minChoices")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          writeXmlNode(writer, asNode(node["image"]), ambient);
          for (const choice of nodes(node, "hotspotChoices")) {
            writeHotspot(writer, "qti-hotspot-choice", choice);
          }
        },
      );
      return;

    case "graphicAssociateInteraction":
      writer.element(
        "qti-graphic-associate-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["max-associations", attr(node, "maxAssociations")],
          ["min-associations", attr(node, "minAssociations")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          writeXmlNode(writer, asNode(node["image"]), ambient);
          for (const choice of nodes(node, "associableHotspots")) {
            writeHotspot(writer, "qti-associable-hotspot", choice);
          }
        },
      );
      return;

    case "graphicGapMatchInteraction":
      writer.element(
        "qti-graphic-gap-match-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["max-associations", attr(node, "maxAssociations")],
          ["min-associations", attr(node, "minAssociations")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          writeXmlNode(writer, asNode(node["image"]), ambient);
          for (const choice of nodes(node, "gapChoices")) {
            writeDomainNode(writer, choice, ambient);
          }
          for (const choice of nodes(node, "associableHotspots")) {
            writeHotspot(writer, "qti-associable-hotspot", choice);
          }
        },
      );
      return;

    case "selectPointInteraction":
      writer.element(
        "qti-select-point-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["max-choices", attr(node, "maxChoices")],
          ["min-choices", attr(node, "minChoices")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          writeXmlNode(writer, asNode(node["image"]), ambient);
        },
      );
      return;

    case "positionObjectStage":
      writer.element("qti-position-object-stage", [], () => {
        writeXmlNode(writer, asNode(node["image"]), ambient);
        for (const interaction of nodes(node, "positionObjectInteractions")) {
          writeDomainNode(writer, interaction, ambient);
        }
      });
      return;

    case "positionObjectInteraction":
      // The XSD requires the stage image on both the stage and each interaction; the
      // normalizer copied the stage image onto each interaction, so emit it here too.
      writer.element(
        "qti-position-object-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["center-point", list(node, "centerPoint")],
          ["min-choices", attr(node, "minChoices")],
          ["max-choices", attr(node, "maxChoices")],
        ],
        () => writeXmlNode(writer, asNode(node["image"]), ambient),
      );
      return;

    case "mediaInteraction":
      writer.element(
        "qti-media-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["autostart", attr(node, "autostart")],
          ["min-plays", attr(node, "minPlays")],
          ["max-plays", attr(node, "maxPlays")],
          ["loop", attr(node, "loop")],
          ["coords", str(node, "coords")],
        ],
        () => {
          writePrompt(writer, node, ambient);
          writeXmlNode(writer, asNode(node["media"]), ambient);
        },
      );
      return;

    case "uploadInteraction":
      writer.element(
        "qti-upload-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["type", list(node, "acceptedTypes")],
        ],
        () => writePrompt(writer, node, ambient),
      );
      return;

    case "sliderInteraction":
      writer.element(
        "qti-slider-interaction",
        [
          ["response-identifier", str(node, "responseIdentifier")],
          ["lower-bound", attr(node, "lowerBound")],
          ["upper-bound", attr(node, "upperBound")],
          ["step", attr(node, "step")],
          ["step-label", attr(node, "stepLabel")],
          ["orientation", str(node, "orientation")],
          ["reverse", attr(node, "reverse")],
        ],
        () => writePrompt(writer, node, ambient),
      );
      return;

    case "endAttemptInteraction":
      writer.element("qti-end-attempt-interaction", [
        ["response-identifier", str(node, "responseIdentifier")],
        ["title", str(node, "title")],
      ]);
      return;

    case "feedbackInline":
      writer.element(
        "qti-feedback-inline",
        [
          ["outcome-identifier", str(node, "outcomeIdentifier")],
          ["identifier", str(node, "identifier")],
          ["show-hide", str(node, "showHide")],
        ],
        () => {
          writeBodyContent(writer, node, ambient);
          writeCatalogInfo(writer, node);
        },
      );
      return;

    case "feedbackBlock":
      writer.element(
        "qti-feedback-block",
        [
          ["outcome-identifier", str(node, "outcomeIdentifier")],
          ["identifier", str(node, "identifier")],
          ["show-hide", str(node, "showHide")],
        ],
        () => {
          writeContentBody(writer, node, ambient);
          writeCatalogInfo(writer, node);
        },
      );
      return;

    case "templateInline":
      writer.element(
        "qti-template-inline",
        [
          ["template-identifier", str(node, "templateIdentifier")],
          ["identifier", str(node, "identifier")],
          ["show-hide", str(node, "showHide")],
        ],
        () => {
          writeBodyContent(writer, node, ambient);
          writeCatalogInfo(writer, node);
        },
      );
      return;

    case "templateBlock":
      writer.element(
        "qti-template-block",
        [
          ["template-identifier", str(node, "templateIdentifier")],
          ["identifier", str(node, "identifier")],
          ["show-hide", str(node, "showHide")],
        ],
        () => {
          writeContentBody(writer, node, ambient);
          writeCatalogInfo(writer, node);
        },
      );
      return;

    case "printedVariable":
      writer.element("qti-printed-variable", [
        ["identifier", str(node, "identifier")],
        ["format", str(node, "format")],
        ["base", attr(node, "base")],
        ["index", attr(node, "index")],
        ["power-form", attr(node, "powerForm")],
        ["field", str(node, "field")],
        ["delimiter", str(node, "delimiter")],
        ["mapping-indicator", str(node, "mappingIndicator")],
      ]);
      return;

    case "rubricBlock":
    case "testRubricBlock":
      writer.element(
        "qti-rubric-block",
        [
          ["view", list(node, "view")],
          ["use", str(node, "use")],
        ],
        () => {
          writeContentBody(writer, node, ambient);
          writeCatalogInfo(writer, node);
        },
      );
      return;

    case "include":
      writer.element("qti-include", [
        ["href", str(node, "href")],
        ["parse", str(node, "parse")],
        ["xpointer", str(node, "xpointer")],
      ]);
      return;

    case "portableCustomInteraction":
      writePortableCustomInteraction(writer, node, ambient);
      return;

    case "customInteraction":
      writer.element("qti-custom-interaction", [["response-identifier", str(node, "responseIdentifier")]], () =>
        writeBodyContent(writer, node, ambient),
      );
      return;

    case "drawingInteraction":
      writer.element("qti-drawing-interaction", [["response-identifier", str(node, "responseIdentifier")]], () => {
        writePrompt(writer, node, ambient);
        writeBodyContent(writer, node, ambient);
      });
      return;

    default:
      throw new Error(`Cannot serialize QTI 3.0.1 content node of kind "${kind}".`);
  }
}

function writePortableCustomInteraction(writer: XmlWriter, node: Node, ambient: string): void {
  const properties = node["properties"];
  const propertyAttributes: Array<readonly [string, AttributeValue]> =
    properties && typeof properties === "object"
      ? Object.entries(properties as Record<string, unknown>).map(([key, value]) => [`data-${key}`, scalar(value)])
      : [];

  writer.element(
    "qti-portable-custom-interaction",
    [
      ["response-identifier", str(node, "responseIdentifier")],
      ["custom-interaction-type-identifier", str(node, "customInteractionTypeIdentifier")],
      ["module", str(node, "module")],
      ["class", list(node, "class")],
      ["data-catalog-idref", str(node, "dataCatalogIdref")],
      ...propertyAttributes,
    ],
    () => {
      // XSD sequence: qti-interaction-modules?, qti-interaction-markup, …, qti-catalog-info?.
      const modules = node["interactionModules"];
      if (modules) {
        const modulesNode = asNode(modules);
        writer.element(
          "qti-interaction-modules",
          [
            ["primary-configuration", str(modulesNode, "primaryConfiguration")],
            ["secondary-configuration", str(modulesNode, "secondaryConfiguration")],
          ],
          () => {
            for (const moduleNode of nodes(modulesNode, "modules")) {
              writer.element("qti-interaction-module", [
                ["id", str(moduleNode, "id")],
                ["primary-path", str(moduleNode, "primaryPath")],
                ["fallback-path", str(moduleNode, "fallbackPath")],
              ]);
            }
          },
        );
      }

      const markup = node["interactionMarkup"];
      if (markup) {
        const markupContent = fragments(asNode(markup), "content");
        if (markupContent.length) {
          writer.element("qti-interaction-markup", [], () => writeContent(writer, markupContent, ambient));
        } else {
          writer.element("qti-interaction-markup", []);
        }
      }

      writeCatalogInfo(writer, node);
    },
  );
}

// ---------------------------------------------------------------------------
// Shared section/test structural pieces.
// ---------------------------------------------------------------------------

function writeItemSessionControl(writer: XmlWriter, control: Node): void {
  writer.element("qti-item-session-control", [
    ["allow-review", attr(control, "allowReview")],
    ["max-attempts", attr(control, "maxAttempts")],
    ["show-feedback", attr(control, "showFeedback")],
    ["show-solution", attr(control, "showSolution")],
    ["allow-comment", attr(control, "allowComment")],
    ["allow-skipping", attr(control, "allowSkipping")],
    ["validate-responses", attr(control, "validateResponses")],
  ]);
}

function writeTimeLimits(writer: XmlWriter, limits: Node): void {
  writer.element("qti-time-limits", [
    ["min-time", attr(limits, "minTime")],
    ["max-time", attr(limits, "maxTime")],
    ["allow-late-submission", attr(limits, "allowLateSubmission")],
  ]);
}

function writePreCondition(writer: XmlWriter, condition: Node): void {
  writer.element("qti-pre-condition", [], () => {
    if (condition["expression"]) {
      writeExpression(writer, asNode(condition["expression"]));
    }
  });
}

function writeBranchRule(writer: XmlWriter, rule: Node): void {
  writer.element("qti-branch-rule", [["target", str(rule, "target")]], () => {
    if (rule["expression"]) {
      writeExpression(writer, asNode(rule["expression"]));
    }
  });
}

function writeRubricBlocks(writer: XmlWriter, container: Node, ambient: string): void {
  for (const rubric of nodes(container, "rubricBlocks")) {
    writeDomainNode(writer, rubric, ambient);
  }
}

function writeTestFeedback(writer: XmlWriter, feedback: Node, ambient: string): void {
  writer.element(
    "qti-test-feedback",
    [
      ["access", str(feedback, "access")],
      ["outcome-identifier", str(feedback, "outcomeIdentifier")],
      ["show-hide", str(feedback, "showHide")],
      ["identifier", str(feedback, "identifier")],
      ["title", str(feedback, "title")],
    ],
    () => {
      writeContentBody(writer, feedback, ambient);
      writeCatalogInfo(writer, feedback);
    },
  );
}

function writeAdaptiveRef(writer: XmlWriter, tag: string, ref: Node): void {
  writer.element(tag, [
    ["identifier", str(ref, "identifier")],
    ["href", str(ref, "href")],
  ]);
}

function writeSelectionOrdering(writer: XmlWriter, section: Node): void {
  const adaptive = section["adaptiveSelection"];
  if (adaptive) {
    const adaptiveNode = asNode(adaptive);
    writer.element("qti-adaptive-selection", [], () => {
      writeAdaptiveRef(writer, "qti-adaptive-engine-ref", asNode(adaptiveNode["adaptiveEngineRef"]));
      if (adaptiveNode["adaptiveSettingsRef"]) {
        writeAdaptiveRef(writer, "qti-adaptive-settings-ref", asNode(adaptiveNode["adaptiveSettingsRef"]));
      }
      if (adaptiveNode["usagedataRef"]) {
        writeAdaptiveRef(writer, "qti-usagedata-ref", asNode(adaptiveNode["usagedataRef"]));
      }
      if (adaptiveNode["metadataRef"]) {
        writeAdaptiveRef(writer, "qti-metadata-ref", asNode(adaptiveNode["metadataRef"]));
      }
    });
  }
  const selection = section["selection"];
  if (selection) {
    writer.element("qti-selection", [
      ["select", attr(asNode(selection), "select")],
      ["with-replacement", attr(asNode(selection), "withReplacement")],
    ]);
  }
  const ordering = section["ordering"];
  if (ordering) {
    writer.element("qti-ordering", [["shuffle", attr(asNode(ordering), "shuffle")]]);
  }
}

function writeItemRef(writer: XmlWriter, ref: Node): void {
  writer.element(
    "qti-assessment-item-ref",
    [
      ["identifier", str(ref, "identifier")],
      ["href", str(ref, "href")],
      ["required", attr(ref, "required")],
      ["fixed", attr(ref, "fixed")],
      ["category", list(ref, "category")],
    ],
    () => {
      for (const condition of nodes(ref, "preConditions")) {
        writePreCondition(writer, condition);
      }
      for (const rule of nodes(ref, "branchRules")) {
        writeBranchRule(writer, rule);
      }
      if (ref["itemSessionControl"]) {
        writeItemSessionControl(writer, asNode(ref["itemSessionControl"]));
      }
      if (ref["timeLimits"]) {
        writeTimeLimits(writer, asNode(ref["timeLimits"]));
      }
      for (const weight of nodes(ref, "weights")) {
        writer.element("qti-weight", [
          ["identifier", str(weight, "identifier")],
          ["value", attr(weight, "value")],
        ]);
      }
      for (const mapping of nodes(ref, "variableMappings")) {
        writer.element("qti-variable-mapping", [
          ["source-identifier", str(mapping, "sourceIdentifier")],
          ["target-identifier", str(mapping, "targetIdentifier")],
        ]);
      }
      for (const templateDefault of nodes(ref, "templateDefaults")) {
        writer.element(
          "qti-template-default",
          [["template-identifier", str(templateDefault, "templateIdentifier")]],
          () => {
            if (templateDefault["expression"]) {
              writeExpression(writer, asNode(templateDefault["expression"]));
            }
          },
        );
      }
    },
  );
}

function writeSectionChild(writer: XmlWriter, child: Node, ambient: string): void {
  // A nested section is the only child carrying a title; everything else is a ref.
  // Bare item-refs and section-refs coalesce to {identifier, href} in the model, so
  // emitting an item-ref for both round-trips identically (documented in ADR-0010).
  if (str(child, "title") !== undefined && child["visible"] !== undefined) {
    writeSection(writer, child, ambient);
    return;
  }
  writeItemRef(writer, child);
}

function writeSection(writer: XmlWriter, section: Node, ambient: string): void {
  writer.element(
    "qti-assessment-section",
    [
      ["identifier", str(section, "identifier")],
      ["title", str(section, "title")],
      ["visible", attr(section, "visible")],
      ["required", attr(section, "required")],
      ["fixed", attr(section, "fixed")],
      ["keep-together", attr(section, "keepTogether")],
    ],
    () => {
      for (const condition of nodes(section, "preConditions")) {
        writePreCondition(writer, condition);
      }
      for (const rule of nodes(section, "branchRules")) {
        writeBranchRule(writer, rule);
      }
      if (section["itemSessionControl"]) {
        writeItemSessionControl(writer, asNode(section["itemSessionControl"]));
      }
      if (section["timeLimits"]) {
        writeTimeLimits(writer, asNode(section["timeLimits"]));
      }
      writeSelectionOrdering(writer, section);
      writeRubricBlocks(writer, section, ambient);
      for (const child of nodes(section, "children")) {
        writeSectionChild(writer, child, ambient);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Roots.
// ---------------------------------------------------------------------------

function rootAttributes(extra: Attrs): Attrs {
  return [
    ["xmlns", asiNamespace],
    ["xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"],
    ["xsi:schemaLocation", asiSchemaLocation],
    ...extra,
  ];
}

function writeDeclarations(writer: XmlWriter, container: Node): void {
  for (const declaration of nodes(container, "contextDeclarations")) {
    writeContextDeclaration(writer, declaration);
  }
  for (const declaration of nodes(container, "responseDeclarations")) {
    writeResponseDeclaration(writer, declaration);
  }
  for (const declaration of nodes(container, "outcomeDeclarations")) {
    writeOutcomeDeclaration(writer, declaration);
  }
  for (const declaration of nodes(container, "templateDeclarations")) {
    writeTemplateDeclaration(writer, declaration);
  }
}

/** Serialize a qti-assessment-item document against the ASI binding. */
export function serializeQtiAssessmentItem(document: unknown): string {
  const item = asNode(asNode(document)["assessmentItem"]);
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');

  writer.element(
    "qti-assessment-item",
    rootAttributes([
      ["identifier", str(item, "identifier")],
      ["title", str(item, "title")],
      ["label", str(item, "label")],
      ["xml:lang", str(item, "xmlLang")],
      ["tool-name", str(item, "toolName")],
      ["tool-version", str(item, "toolVersion")],
      ["adaptive", attr(item, "adaptive")],
      ["time-dependent", attr(item, "timeDependent")],
    ]),
    () => {
      writeDeclarations(writer, item);

      const templateProcessing = item["templateProcessing"];
      if (templateProcessing) {
        writer.element("qti-template-processing", [], () => {
          for (const rule of nodes(asNode(templateProcessing), "rules")) {
            writeTemplateRule(writer, rule);
          }
        });
      }

      for (const ref of nodes(item, "assessmentStimulusRefs")) {
        writer.element("qti-assessment-stimulus-ref", [
          ["identifier", str(ref, "identifier")],
          ["href", str(ref, "href")],
          ["title", str(ref, "title")],
        ]);
      }

      writeCompanionMaterials(writer, item);

      for (const stylesheet of nodes(item, "stylesheets")) {
        writeStylesheet(writer, stylesheet);
      }

      const itemBody = item["itemBody"];
      if (itemBody) {
        writer.element("qti-item-body", [], () =>
          writeContent(writer, fragments(asNode(itemBody), "content"), asiNamespace),
        );
      }

      writeCatalogInfo(writer, item);

      const responseProcessing = item["responseProcessing"];
      if (responseProcessing) {
        writeResponseProcessing(writer, asNode(responseProcessing));
      }

      for (const feedback of nodes(item, "modalFeedbacks")) {
        writer.element(
          "qti-modal-feedback",
          [
            ["outcome-identifier", str(feedback, "outcomeIdentifier")],
            ["identifier", str(feedback, "identifier")],
            ["show-hide", str(feedback, "showHide")],
            ["title", str(feedback, "title")],
          ],
          () => {
            writeContentBody(writer, feedback, asiNamespace);
            writeCatalogInfo(writer, feedback);
          },
        );
      }
    },
  );

  return writer.toString();
}

/** Serialize a qti-assessment-stimulus document against the ASI binding. */
export function serializeQtiAssessmentStimulus(document: unknown): string {
  const stimulus = asNode(asNode(document)["assessmentStimulus"]);
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');

  writer.element(
    "qti-assessment-stimulus",
    rootAttributes([
      ["identifier", str(stimulus, "identifier")],
      ["title", str(stimulus, "title")],
      ["label", str(stimulus, "label")],
      ["xml:lang", str(stimulus, "xmlLang")],
      ["tool-name", str(stimulus, "toolName")],
      ["tool-version", str(stimulus, "toolVersion")],
    ]),
    () => {
      for (const stylesheet of nodes(stimulus, "stylesheets")) {
        writeStylesheet(writer, stylesheet);
      }
      const body = asNode(stimulus["stimulusBody"]);
      writer.element("qti-stimulus-body", [], () => writeContent(writer, fragments(body, "content"), asiNamespace));
      writeCatalogInfo(writer, stimulus);
    },
  );

  return writer.toString();
}

/** Serialize a qti-assessment-test document against the ASI binding. */
export function serializeQtiAssessmentTest(document: unknown): string {
  const test = asNode(asNode(document)["assessmentTest"]);
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');

  writer.element(
    "qti-assessment-test",
    rootAttributes([
      ["identifier", str(test, "identifier")],
      ["title", str(test, "title")],
      ["tool-name", str(test, "toolName")],
      ["tool-version", str(test, "toolVersion")],
    ]),
    () => {
      for (const declaration of nodes(test, "contextDeclarations")) {
        writeContextDeclaration(writer, declaration);
      }
      for (const declaration of nodes(test, "outcomeDeclarations")) {
        writeOutcomeDeclaration(writer, declaration);
      }
      if (test["timeLimits"]) {
        writeTimeLimits(writer, asNode(test["timeLimits"]));
      }
      for (const stylesheet of nodes(test, "stylesheets")) {
        writeStylesheet(writer, stylesheet);
      }
      writeRubricBlocks(writer, test, asiNamespace);

      for (const part of nodes(test, "testParts")) {
        writer.element(
          "qti-test-part",
          [
            ["identifier", str(part, "identifier")],
            ["navigation-mode", str(part, "navigationMode")],
            ["submission-mode", str(part, "submissionMode")],
            ["title", str(part, "title")],
          ],
          () => {
            for (const condition of nodes(part, "preConditions")) {
              writePreCondition(writer, condition);
            }
            for (const rule of nodes(part, "branchRules")) {
              writeBranchRule(writer, rule);
            }
            if (part["itemSessionControl"]) {
              writeItemSessionControl(writer, asNode(part["itemSessionControl"]));
            }
            if (part["timeLimits"]) {
              writeTimeLimits(writer, asNode(part["timeLimits"]));
            }
            writeRubricBlocks(writer, part, asiNamespace);
            for (const section of nodes(part, "children")) {
              writeSection(writer, section, asiNamespace);
            }
            for (const feedback of nodes(part, "testFeedbacks")) {
              writeTestFeedback(writer, feedback, asiNamespace);
            }
          },
        );
      }

      const outcomeProcessing = test["outcomeProcessing"];
      if (outcomeProcessing) {
        writer.element("qti-outcome-processing", [], () => {
          for (const rule of nodes(asNode(outcomeProcessing), "rules")) {
            writeOutcomeRule(writer, rule);
          }
        });
      }

      for (const feedback of nodes(test, "testFeedbacks")) {
        writeTestFeedback(writer, feedback, asiNamespace);
      }
    },
  );

  return writer.toString();
}

/** Serialize a standalone qti-assessment-section document. */
export function serializeQtiAssessmentSection(document: unknown): string {
  const section = asNode(asNode(document)["assessmentSection"]);
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');

  // The root section is the shared section structure with the binding namespace
  // attributes added on the root element.
  writer.element(
    "qti-assessment-section",
    rootAttributes([
      ["identifier", str(section, "identifier")],
      ["title", str(section, "title")],
      ["visible", attr(section, "visible")],
      ["required", attr(section, "required")],
      ["fixed", attr(section, "fixed")],
      ["keep-together", attr(section, "keepTogether")],
    ]),
    () => {
      for (const condition of nodes(section, "preConditions")) {
        writePreCondition(writer, condition);
      }
      for (const rule of nodes(section, "branchRules")) {
        writeBranchRule(writer, rule);
      }
      if (section["itemSessionControl"]) {
        writeItemSessionControl(writer, asNode(section["itemSessionControl"]));
      }
      if (section["timeLimits"]) {
        writeTimeLimits(writer, asNode(section["timeLimits"]));
      }
      writeSelectionOrdering(writer, section);
      writeRubricBlocks(writer, section, asiNamespace);
      for (const child of nodes(section, "children")) {
        writeSectionChild(writer, child, asiNamespace);
      }
    },
  );

  return writer.toString();
}

/** Serialize a standalone qti-response-processing document (best-practice templates). */
export function serializeQtiResponseProcessingDocument(document: unknown): string {
  const processing = asNode(asNode(document)["responseProcessing"]);
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');

  writer.element(
    "qti-response-processing",
    rootAttributes([
      ["template", str(processing, "template")],
      ["template-location", str(processing, "templateLocation")],
    ]),
    () => {
      for (const rule of nodes(processing, "rules")) {
        writeResponseRule(writer, rule);
      }
    },
  );

  return writer.toString();
}

/** Serialize a standalone qti-outcome-declaration document. */
export function serializeQtiOutcomeDeclarationDocument(document: unknown): string {
  const declaration = asNode(asNode(document)["outcomeDeclaration"]);
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');

  writer.element(
    "qti-outcome-declaration",
    rootAttributes([
      ["identifier", str(declaration, "identifier")],
      ["cardinality", str(declaration, "cardinality")],
      ["base-type", str(declaration, "baseType")],
      ["view", list(declaration, "view")],
      ["external-scored", str(declaration, "externalScored")],
      ["interpretation", str(declaration, "interpretation")],
      ["long-interpretation", str(declaration, "longInterpretation")],
      ["normal-maximum", attr(declaration, "normalMaximum")],
      ["normal-minimum", attr(declaration, "normalMinimum")],
      ["mastery-value", attr(declaration, "masteryValue")],
    ]),
    () => {
      writeDefaultValue(writer, declaration);
      const matchTable = declaration["matchTable"];
      if (matchTable) {
        writer.element("qti-match-table", [["default-value", str(asNode(matchTable), "defaultValue")]], () => {
          for (const entry of nodes(asNode(matchTable), "matchTableEntries")) {
            writer.element("qti-match-table-entry", [
              ["source-value", attr(entry, "sourceValue")],
              ["target-value", str(entry, "targetValue")],
            ]);
          }
        });
      }
      const interpolationTable = declaration["interpolationTable"];
      if (interpolationTable) {
        writer.element(
          "qti-interpolation-table",
          [["default-value", str(asNode(interpolationTable), "defaultValue")]],
          () => {
            for (const entry of nodes(asNode(interpolationTable), "interpolationTableEntries")) {
              writer.element("qti-interpolation-table-entry", [
                ["source-value", attr(entry, "sourceValue")],
                ["target-value", str(entry, "targetValue")],
                ["include-boundary", attr(entry, "includeBoundary")],
              ]);
            }
          },
        );
      }
    },
  );

  return writer.toString();
}

/** Serialize a standalone qti-outcome-processing document. */
export function serializeQtiOutcomeProcessingDocument(document: unknown): string {
  const processing = asNode(asNode(document)["outcomeProcessing"]);
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');

  writer.element("qti-outcome-processing", rootAttributes([]), () => {
    for (const rule of nodes(processing, "rules")) {
      writeOutcomeRule(writer, rule);
    }
  });

  return writer.toString();
}
