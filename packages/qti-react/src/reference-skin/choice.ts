/**
 * Reference Skin for `choiceInteraction` (ADR-0001): unstyled, semantic, a11y-correct.
 * Native `<button>` elements carry the option prop-getters so Space/Enter activation is
 * free; all visual state is exposed as data attributes for downstream styling.
 */

import { createElement, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";

interface SimpleChoiceView {
  identifier: string;
  content?: readonly BodyNode[];
}

interface ChoiceNodeView {
  prompt?: { content?: readonly BodyNode[] };
  simpleChoices?: readonly SimpleChoiceView[];
}

export function ChoiceReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as ChoiceNodeView;
  const choices = node.simpleChoices ?? [];
  const isRadio = choices.length > 0 && props.getOptionProps(choices[0]!.identifier).role === "radio";

  return createElement(
    "div",
    {
      role: isRadio ? "radiogroup" : "group",
      "data-qti-interaction": "choiceInteraction",
      "data-status": props.status,
    },
    node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
    choices.map((choice) => {
      const optionProps = props.getOptionProps(choice.identifier);

      return createElement(
        "button",
        { key: choice.identifier, type: "button", disabled: props.disabled, ...optionProps },
        props.renderContent(choice.content) ?? choice.identifier,
      );
    }),
  );
}
