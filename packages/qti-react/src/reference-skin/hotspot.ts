/**
 * Reference Skin for `hotspotInteraction` (ADR-0001): SVG hotspot shapes over the
 * stage image, wired through the option prop-getters (selection semantics identical
 * to choiceInteraction).
 */

import { createElement, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";
import { GraphicStage, shapeElement, type HotspotView, type ObjectView } from "./graphic-base";

interface HotspotNodeView {
  prompt?: { content?: readonly BodyNode[] };
  object?: ObjectView;
  hotspotChoices?: readonly HotspotView[];
}

export function HotspotReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as HotspotNodeView;

  if (!node.object) {
    return null;
  }

  return createElement(GraphicStage, {
    object: node.object,
    resolveAsset: props.resolveAsset,
    interaction: "hotspotInteraction",
    status: props.status,
    prompt: node.prompt
      ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content))
      : null,
    overlay: (node.hotspotChoices ?? []).map((hotspot) => {
      const optionProps = props.getOptionProps(hotspot.identifier);

      return shapeElement(hotspot.shape, hotspot.coords, hotspot.identifier, {
        ...optionProps,
        "aria-label": hotspot.identifier,
        style: { cursor: props.disabled ? "default" : "pointer" },
      });
    }),
  });
}
