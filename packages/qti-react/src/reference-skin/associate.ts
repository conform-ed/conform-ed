/**
 * Reference Skin for `associateInteraction` (ADR-0001): a pair builder — two selects
 * over the same choice set, an "Add pair" button, and a removable list of the pairs
 * built so far. Pairs are unordered (`pair` baseType); scoring handles reversal.
 */

import { createElement, useState, type ChangeEvent, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";
import { textOf } from "./content";

interface AssociableChoiceView {
  identifier: string;
  content?: readonly BodyNode[];
}

interface AssociateNodeView {
  prompt?: { content?: readonly BodyNode[] };
  simpleAssociableChoices?: readonly AssociableChoiceView[];
}

export function AssociateReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as AssociateNodeView;
  const choices = node.simpleAssociableChoices ?? [];
  const pairs = Array.isArray(props.value) ? props.value : [];
  // Ephemeral picker state only; the response itself lives in the core store.
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");

  function labelFor(identifier: string): string {
    const choice = choices.find((candidate) => candidate.identifier === identifier);

    return choice ? textOf(choice.content) || choice.identifier : identifier;
  }

  function addPair(): void {
    if (first === "" || second === "" || first === second) {
      return;
    }

    const pair = `${first} ${second}`;

    if (!pairs.includes(pair) && !pairs.includes(`${second} ${first}`)) {
      props.setValue([...pairs, pair]);
    }

    setFirst("");
    setSecond("");
  }

  function picker(value: string, setValue: (next: string) => void, label: string): ReactNode {
    return createElement(
      "select",
      {
        value,
        disabled: props.disabled,
        "aria-label": label,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => setValue(event.target.value),
      },
      createElement("option", { key: "", value: "" }, ""),
      choices.map((choice) =>
        createElement("option", { key: choice.identifier, value: choice.identifier }, labelFor(choice.identifier)),
      ),
    );
  }

  return createElement(
    "div",
    { "data-qti-interaction": "associateInteraction", "data-status": props.status },
    node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
    picker(first, setFirst, "First member"),
    picker(second, setSecond, "Second member"),
    createElement("button", { type: "button", disabled: props.disabled, onClick: addPair }, "Add pair"),
    createElement(
      "ul",
      null,
      pairs.map((pair) => {
        const [a, b] = pair.split(/\s+/u);

        return createElement(
          "li",
          { key: pair, "data-qti-pair": pair },
          `${labelFor(a ?? "")} ↔ ${labelFor(b ?? "")} `,
          createElement(
            "button",
            {
              type: "button",
              disabled: props.disabled,
              "aria-label": `Remove pair ${pair}`,
              onClick: () => props.setValue(pairs.filter((entry) => entry !== pair)),
            },
            "×",
          ),
        );
      }),
    ),
  );
}
