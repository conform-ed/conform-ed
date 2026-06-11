/**
 * XInclude resolution: `xi:include` elements splice their target's root element (or
 * text, for parse="text") into the including document before normalization, resolving
 * hrefs relative to each including file. Recursion is cycle-guarded; a failed include
 * uses its `xi:fallback` children when present and otherwise fails loudly — the
 * corpus's shared-fragment items depend on this happening at the file boundary, the
 * only layer that knows the path.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseXmlDocument, type QtiXmlElementNode, type QtiXmlNode } from "./parse-xml";

const xincludeNamespace = "http://www.w3.org/2001/XInclude";

function isXinclude(element: QtiXmlElementNode, localName: string): boolean {
  return element.localName === localName && (element.namespaceUri === xincludeNamespace || element.prefix === "xi");
}

async function resolveInclude(
  include: QtiXmlElementNode,
  baseFilePath: string,
  stack: string[],
): Promise<QtiXmlNode[]> {
  const href = include.attributes["href"];

  if (href === undefined || href === "") {
    throw new Error("<xi:include> requires an href.");
  }

  const targetPath = path.resolve(path.dirname(baseFilePath), href);

  if (stack.includes(targetPath)) {
    throw new Error(`XInclude cycle detected at ${href} (${[...stack, targetPath].join(" -> ")}).`);
  }

  let content: string;

  try {
    content = await readFile(targetPath, "utf8");
  } catch (error) {
    const fallback = include.children.find(
      (child): child is QtiXmlElementNode => child.type === "element" && isXinclude(child, "fallback"),
    );

    if (fallback) {
      // Fallback children may themselves contain includes, relative to this file.
      await resolveChildren(fallback, baseFilePath, stack);

      return fallback.children;
    }

    throw new Error(
      `XInclude target "${href}" could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (include.attributes["parse"] === "text") {
    return [{ type: "text", value: content }];
  }

  const fragmentRoot = parseXmlDocument(content);

  await resolveChildren(fragmentRoot, targetPath, [...stack, targetPath]);

  return [fragmentRoot];
}

async function resolveChildren(element: QtiXmlElementNode, baseFilePath: string, stack: string[]): Promise<void> {
  const resolved: QtiXmlNode[] = [];

  for (const child of element.children) {
    if (child.type === "element") {
      if (isXinclude(child, "include")) {
        resolved.push(...(await resolveInclude(child, baseFilePath, stack)));
        continue;
      }

      await resolveChildren(child, baseFilePath, stack);
    }

    resolved.push(child);
  }

  element.children = resolved;
}

/** Resolve every `xi:include` under `root` in place, relative to the document's file. */
export async function resolveXIncludes(root: QtiXmlElementNode, filePath: string): Promise<void> {
  await resolveChildren(root, filePath, [path.resolve(filePath)]);
}
