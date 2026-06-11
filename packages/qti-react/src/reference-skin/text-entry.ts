/**
 * Reference Skin for `textEntryInteraction` (ADR-0001): a controlled native text input.
 */

import { createElement, type ChangeEvent, type ReactNode } from "react";

import type { InteractionRenderProps } from "../runtime";

interface TextEntryNodeView {
  expectedLength?: number;
  placeholderText?: string;
}

export function TextEntryReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as TextEntryNodeView;
  const value = typeof props.value === "string" ? props.value : "";

  return createElement("input", {
    type: "text",
    value,
    placeholder: node.placeholderText,
    size: node.expectedLength,
    disabled: props.disabled,
    "aria-disabled": props.disabled,
    "data-qti-interaction": "textEntryInteraction",
    "data-status": props.status,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      props.setValue(event.target.value === "" ? null : event.target.value);
    },
  });
}
