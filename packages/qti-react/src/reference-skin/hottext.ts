/**
 * Reference Skin for `hottextInteraction` (ADR-0001): the interaction's flow content is
 * rendered through the core walk with a `hottext` override, so selectable spans nested
 * anywhere in the prose become toggle buttons wired through the option prop-getters.
 */

import { createElement, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";

interface HottextNodeView {
  prompt?: { content?: readonly BodyNode[] };
  content?: readonly BodyNode[];
}

interface HottextChildView {
  identifier?: string;
  content?: readonly BodyNode[];
}

export function HottextReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as HottextNodeView;

  return createElement(
    "div",
    { "data-qti-interaction": "hottextInteraction", "data-status": props.status },
    node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
    props.renderContent(node.content, {
      hottext: (child, key) => {
        const view = child as HottextChildView;
        const identifier = view.identifier ?? "";
        const optionProps = props.getOptionProps(identifier);

        return createElement(
          "button",
          { key, type: "button", disabled: props.disabled, "data-qti-hottext": identifier, ...optionProps },
          props.renderContent(view.content) ?? identifier,
        );
      },
    }),
  );
}
