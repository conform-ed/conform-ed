/**
 * PCI markup serialization: `qti-interaction-markup` content back to an HTML string
 * for injection into the host container. PCI markup is module-owned — the module
 * queries and mutates it directly — so unlike flow content it is not constrained to
 * the content-model element allowlist. The serializer still strips what must never
 * reach the DOM statically: event-handler attributes, script-scheme URLs, and
 * `<script>` elements (modules bring behaviour through the registry, not markup).
 */

import type { BodyNode, XmlContentNode } from "../runtime";

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

const blockedElements = new Set(["script", "iframe", "object", "embed"]);

const urlAttributes = new Set(["src", "href", "xlink:href", "poster", "data"]);

function escapeText(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/gu, "&quot;");
}

function isUnsafeMarkupAttribute(name: string, value: string): boolean {
  if (/^on/iu.test(name)) {
    return true;
  }

  return urlAttributes.has(name.toLowerCase()) && /^\s*(?:javascript|vbscript|data:text\/html)/iu.test(value);
}

function serializeAttributes(attributes: Record<string, unknown> | undefined): string {
  if (!attributes) {
    return "";
  }

  let result = "";

  for (const [name, raw] of Object.entries(attributes)) {
    // Attribute values are strings after normalization; anything else is dropped.
    const value =
      typeof raw === "string" ? raw : typeof raw === "number" || typeof raw === "boolean" ? String(raw) : undefined;

    if (value !== undefined && !isUnsafeMarkupAttribute(name, value)) {
      result += ` ${name}="${escapeAttribute(value)}"`;
    }
  }

  return result;
}

function serializeNode(node: BodyNode | string): string {
  if (typeof node === "string") {
    return escapeText(node);
  }

  if (node.kind === "text") {
    return escapeText((node as { value?: string }).value ?? "");
  }

  if (node.kind !== "xml") {
    return ""; // interactions and QTI constructs cannot nest inside PCI markup
  }

  const xmlNode = node as XmlContentNode;
  const name = xmlNode.name.toLowerCase();

  if (blockedElements.has(name)) {
    return "";
  }

  const attributes = serializeAttributes(xmlNode.attributes);

  if (voidElements.has(name)) {
    return `<${name}${attributes}>`;
  }

  const children = (xmlNode.children ?? []).map(serializeNode).join("");
  const text = xmlNode.value !== undefined ? escapeText(xmlNode.value) : "";

  return `<${name}${attributes}>${text}${children}</${name}>`;
}

export function serializePciMarkup(nodes: ReadonlyArray<BodyNode | string> | undefined): string {
  return (nodes ?? []).map(serializeNode).join("");
}
