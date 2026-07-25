/**
 * XML → `QtiXmlNode` tree, gated by a well-formedness check.
 *
 * ## Why the deprecated `XMLValidator` is deliberate
 *
 * fast-xml-parser >= 5.8 marks `XMLValidator` `@deprecated` in favour of the separate
 * `fast-xml-validator` package, and commit 67e43cc followed that advice — purely to
 * satisfy the `typescript/no-deprecated` lint rule, with no other motivation. That was a
 * mistake, reverted here, for two reasons.
 *
 * 1. Bundling. Every published `fast-xml-validator` (>= 1.2 at the time of writing)
 *    depends on `detailed-xml-validator@2.2` → `@nodable/flexible-xml-parser`, which
 *    relies on Node's `Buffer` global. `fast-xml-validator`'s barrel re-exports that tree
 *    unconditionally (`BusinessRulesValidator`), so any browser bundle carrying this
 *    package's barrel breaks unless the consumer's bundler tree-shakes the barrel
 *    perfectly — not a guarantee we can make on their behalf. fast-xml-parser's validator
 *    adds nothing to the dependency graph we already have.
 * 2. Behaviour. `fast-xml-validator@1.4.0` accepts a document with two sibling root
 *    elements (returns `true`); fast-xml-parser rejects it. Since `detectQtiRoot` only
 *    ever inspects the first element, the former silently validates a document whose
 *    second half was discarded. Rejecting multiple roots is the deliberate policy —
 *    pinned in test/xml-well-formedness.test.ts.
 *
 * So the deprecated API is used on purpose, with a scoped suppression at each call site
 * (the rule does not fire on the import — verified with `bun run lint`). Note the runtime
 * contracts differ and are NOT interchangeable: `SyntaxValidator.validate` *throws* a
 * `ValidationError`, while `XMLValidator.validate` *returns* `true | { err: { code, msg,
 * line, col } }` — the shape `parseValidationError` below was written for.
 *
 * Reopen trigger: fast-xml-parser v6 removing `XMLValidator`. At that point either
 * `fast-xml-validator` has shed the `detailed-xml-validator` dependency from its barrel
 * (adopt it, and convert the callers back to try/catch), or we vendor the ~300-line
 * syntax validator.
 */

import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface QtiXmlTextNode {
  type: "text";
  value: string;
}

export interface QtiXmlElementNode {
  type: "element";
  name: string;
  localName: string;
  prefix?: string;
  namespaceUri?: string;
  attributes: Record<string, string>;
  children: QtiXmlNode[];
}

export type QtiXmlNode = QtiXmlElementNode | QtiXmlTextNode;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  commentPropName: "#comment",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

function splitXmlName(name: string): { localName: string; prefix: string | undefined } {
  const [prefix, localName] = name.includes(":") ? name.split(":", 2) : [undefined, name];
  return {
    prefix,
    localName: localName ?? name,
  };
}

function parseValidationError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Invalid XML.";
  }

  const candidate = error as { err?: { msg?: string } };
  return candidate.err?.msg ?? JSON.stringify(error);
}

function buildNamespaceScope(
  parentScope: Record<string, string>,
  attributes: Record<string, string>,
): Record<string, string> {
  const nextScope = { ...parentScope };

  for (const [name, value] of Object.entries(attributes)) {
    if (name === "xmlns") {
      nextScope[""] = value;
      continue;
    }

    if (name.startsWith("xmlns:")) {
      nextScope[name.slice("xmlns:".length)] = value;
    }
  }

  return nextScope;
}

function stripNamespaceAttributes(attributes: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(attributes).filter(([name]) => name !== "xmlns" && !name.startsWith("xmlns:")),
  );
}

function buildXmlNodes(entries: unknown, parentScope: Record<string, string>): QtiXmlNode[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  const nodes: QtiXmlNode[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;

    const textValue = record["#text"];
    if (
      (typeof textValue === "string" || typeof textValue === "number" || typeof textValue === "boolean") &&
      !Array.isArray(textValue)
    ) {
      nodes.push({
        type: "text",
        value: String(textValue),
      });
      continue;
    }

    const elementName = Object.keys(record).find((key) => key !== ":@" && key !== "#comment" && !key.startsWith("?"));

    if (!elementName) {
      continue;
    }

    const rawAttributes = record[":@"];
    const attributes =
      rawAttributes && typeof rawAttributes === "object"
        ? Object.fromEntries(
            Object.entries(rawAttributes as Record<string, unknown>).map(([name, value]) => [name, String(value)]),
          )
        : {};
    const namespaceScope = buildNamespaceScope(parentScope, attributes);
    const strippedAttributes = stripNamespaceAttributes(attributes);
    const { localName, prefix } = splitXmlName(elementName);
    const namespaceUri = prefix ? namespaceScope[prefix] : namespaceScope[""];

    nodes.push({
      type: "element",
      name: elementName,
      localName,
      ...(prefix !== undefined ? { prefix } : {}),
      ...(namespaceUri !== undefined ? { namespaceUri } : {}),
      attributes: strippedAttributes,
      children: buildXmlNodes(record[elementName], namespaceScope),
    });
  }

  return nodes;
}

export function parseXmlDocument(xml: string): QtiXmlElementNode {
  // oxlint-disable-next-line typescript/no-deprecated -- deliberate; see the module comment.
  const validationResult = XMLValidator.validate(xml);
  if (validationResult !== true) {
    throw new Error(parseValidationError(validationResult));
  }

  const nodes = buildXmlNodes(parser.parse(xml), {});
  const root = nodes.find((node) => node.type === "element");

  if (!root || root.type !== "element") {
    throw new Error("XML document does not contain a root element.");
  }

  return root;
}
