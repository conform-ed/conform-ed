/**
 * Reference Skin for `extendedTextInteraction` (ADR-0001): a controlled textarea.
 */

import { createElement, type ChangeEvent, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";

interface ExtendedTextNodeView {
  prompt?: { content?: readonly BodyNode[] };
  expectedLength?: number;
  expectedLines?: number;
  placeholderText?: string;
}

export function ExtendedTextReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as ExtendedTextNodeView;
  const value = typeof props.value === "string" ? props.value : "";

  return createElement(
    "div",
    { "data-qti-interaction": "extendedTextInteraction", "data-status": props.status },
    node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
    createElement("textarea", {
      value,
      rows: node.expectedLines ?? 4,
      placeholder: node.placeholderText,
      disabled: props.disabled,
      "aria-disabled": props.disabled,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
        props.setValue(event.target.value === "" ? null : event.target.value);
      },
    }),
  );
}
