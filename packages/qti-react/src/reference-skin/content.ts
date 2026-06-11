/**
 * Plain-text extraction for places where the DOM only accepts text (e.g. `<option>`
 * children). Walks a BodyNode fragment and concatenates its text values.
 */

import type { BodyNode } from "../runtime";

export function textOf(nodes: readonly BodyNode[] | undefined): string {
  if (!nodes) {
    return "";
  }

  let text = "";

  for (const node of nodes) {
    const value = (node as { value?: string }).value;

    if (typeof value === "string") {
      text += value;
    }

    const children = (node as { children?: readonly BodyNode[] }).children;

    if (children) {
      text += textOf(children);
    }
  }

  return text;
}
