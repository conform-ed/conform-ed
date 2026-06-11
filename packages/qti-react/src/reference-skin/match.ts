/**
 * Reference Skin for `matchInteraction` (ADR-0001): a table grid — rows are the first
 * match set, columns the second; each cell is a checkbox toggling the directedPair
 * "ROW COL". Conservative and screen-reader friendly; no drag-and-drop.
 */

import { createElement, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";
import { textOf } from "./content";

interface AssociableChoiceView {
  identifier: string;
  content?: readonly BodyNode[];
}

interface MatchNodeView {
  prompt?: { content?: readonly BodyNode[] };
  simpleMatchSets?: ReadonlyArray<{ simpleAssociableChoices?: readonly AssociableChoiceView[] }>;
}

export function MatchReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as MatchNodeView;
  const rows = node.simpleMatchSets?.[0]?.simpleAssociableChoices ?? [];
  const columns = node.simpleMatchSets?.[1]?.simpleAssociableChoices ?? [];
  const pairs = Array.isArray(props.value) ? props.value : [];

  function togglePair(pair: string): void {
    props.setValue(pairs.includes(pair) ? pairs.filter((entry) => entry !== pair) : [...pairs, pair]);
  }

  return createElement(
    "div",
    { "data-qti-interaction": "matchInteraction", "data-status": props.status },
    node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
    createElement(
      "table",
      null,
      createElement(
        "thead",
        null,
        createElement(
          "tr",
          null,
          createElement("td", null),
          columns.map((column) =>
            createElement("th", { key: column.identifier, scope: "col" }, textOf(column.content) || column.identifier),
          ),
        ),
      ),
      createElement(
        "tbody",
        null,
        rows.map((row) =>
          createElement(
            "tr",
            { key: row.identifier },
            createElement("th", { scope: "row" }, textOf(row.content) || row.identifier),
            columns.map((column) => {
              const pair = `${row.identifier} ${column.identifier}`;

              return createElement(
                "td",
                { key: column.identifier },
                createElement("input", {
                  type: "checkbox",
                  checked: pairs.includes(pair),
                  disabled: props.disabled,
                  "aria-label": `${textOf(row.content) || row.identifier} — ${textOf(column.content) || column.identifier}`,
                  "data-qti-pair": pair,
                  onChange: () => togglePair(pair),
                }),
              );
            }),
          ),
        ),
      ),
    ),
  );
}
