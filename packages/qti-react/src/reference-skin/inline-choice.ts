/**
 * Reference Skin for `inlineChoiceInteraction` (ADR-0001): a controlled native select.
 * Option labels must be text, so choice content goes through plain-text extraction.
 */

import { createElement, type ChangeEvent, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";
import { textOf } from "./content";

interface InlineChoiceView {
  identifier: string;
  content?: readonly BodyNode[];
}

interface InlineChoiceNodeView {
  inlineChoices?: readonly InlineChoiceView[];
}

export function InlineChoiceReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as InlineChoiceNodeView;
  const choices = node.inlineChoices ?? [];
  const value = typeof props.value === "string" ? props.value : "";

  return createElement(
    "select",
    {
      value,
      disabled: props.disabled,
      "aria-disabled": props.disabled,
      "data-qti-interaction": "inlineChoiceInteraction",
      "data-status": props.status,
      onChange: (event: ChangeEvent<HTMLSelectElement>) => {
        props.setValue(event.target.value === "" ? null : event.target.value);
      },
    },
    createElement("option", { key: "", value: "" }, ""),
    choices.map((choice) =>
      createElement("option", { key: choice.identifier, value: choice.identifier }, textOf(choice.content)),
    ),
  );
}
