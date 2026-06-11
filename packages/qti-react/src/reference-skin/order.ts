/**
 * Reference Skin for `orderInteraction` (ADR-0001): an ordered list with per-item
 * move-up/move-down buttons — keyboard-accessible reordering without drag-and-drop.
 * The displayed order is the response; the first move answers with the full order.
 */

import { createElement, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";

interface OrderChoiceView {
  identifier: string;
  content?: readonly BodyNode[];
}

interface OrderNodeView {
  prompt?: { content?: readonly BodyNode[] };
  simpleChoices?: readonly OrderChoiceView[];
}

export function OrderReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as OrderNodeView;
  const choices = node.simpleChoices ?? [];
  const declared = choices.map((choice) => choice.identifier);
  const order = Array.isArray(props.value) ? [...props.value] : declared;
  const choicesById = new Map(choices.map((choice) => [choice.identifier, choice]));

  function move(index: number, delta: -1 | 1): void {
    const target = index + delta;

    if (target < 0 || target >= order.length) {
      return;
    }

    const next = [...order];
    const moved = next[index]!;

    next[index] = next[target]!;
    next[target] = moved;
    props.setValue(next);
  }

  return createElement(
    "div",
    { "data-qti-interaction": "orderInteraction", "data-status": props.status },
    node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
    createElement(
      "ol",
      null,
      order.map((identifier, index) =>
        createElement(
          "li",
          { key: identifier },
          props.renderContent(choicesById.get(identifier)?.content) ?? identifier,
          createElement(
            "button",
            {
              type: "button",
              "aria-label": `Move ${identifier} up`,
              disabled: props.disabled || index === 0,
              onClick: () => move(index, -1),
            },
            "↑",
          ),
          createElement(
            "button",
            {
              type: "button",
              "aria-label": `Move ${identifier} down`,
              disabled: props.disabled || index === order.length - 1,
              onClick: () => move(index, 1),
            },
            "↓",
          ),
        ),
      ),
    ),
  );
}
