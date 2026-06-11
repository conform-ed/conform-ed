/**
 * Reference Skin for `gapMatchInteraction` (ADR-0001): the interaction's flow content
 * renders through the core walk with a `gap` override — each gap becomes a select over
 * the gap texts. Choosing a gap text records the directedPair "GAPTEXT GAP".
 */

import { createElement, type ChangeEvent, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";
import { textOf } from "./content";

interface GapTextView {
  identifier: string;
  content?: readonly BodyNode[];
}

interface GapMatchNodeView {
  prompt?: { content?: readonly BodyNode[] };
  gapTexts?: readonly GapTextView[];
  content?: readonly BodyNode[];
}

interface GapChildView {
  identifier?: string;
}

export function GapMatchReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as GapMatchNodeView;
  const gapTexts = node.gapTexts ?? [];
  const pairs = Array.isArray(props.value) ? props.value : [];

  function fillGap(gapIdentifier: string, gapTextIdentifier: string): void {
    const kept = pairs.filter((pair) => pair.split(/\s+/u)[1] !== gapIdentifier);

    props.setValue(gapTextIdentifier === "" ? kept : [...kept, `${gapTextIdentifier} ${gapIdentifier}`]);
  }

  return createElement(
    "div",
    { "data-qti-interaction": "gapMatchInteraction", "data-status": props.status },
    node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
    props.renderContent(node.content, {
      gap: (child, key) => {
        const gapIdentifier = (child as GapChildView).identifier ?? "";
        const filledBy = pairs.find((pair) => pair.split(/\s+/u)[1] === gapIdentifier)?.split(/\s+/u)[0] ?? "";

        return createElement(
          "select",
          {
            key,
            value: filledBy,
            disabled: props.disabled,
            "aria-label": `Gap ${gapIdentifier}`,
            "data-qti-gap": gapIdentifier,
            onChange: (event: ChangeEvent<HTMLSelectElement>) => fillGap(gapIdentifier, event.target.value),
          },
          createElement("option", { key: "", value: "" }, ""),
          gapTexts.map((gapText) =>
            createElement(
              "option",
              { key: gapText.identifier, value: gapText.identifier },
              textOf(gapText.content) || gapText.identifier,
            ),
          ),
        );
      },
    }),
  );
}
