/**
 * Reference Skin for `graphicOrderInteraction` (ADR-0001): click hotspots in sequence;
 * each selected hotspot shows its position badge. Clicking a selected hotspot removes
 * it (and renumbers the rest).
 */

import { Fragment, createElement, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";
import { GraphicStage, shapeCenter, shapeElement, type HotspotView, type ObjectView } from "./graphic-base";

interface GraphicOrderNodeView {
  prompt?: { content?: readonly BodyNode[] };
  object?: ObjectView;
  hotspotChoices?: readonly HotspotView[];
}

export function GraphicOrderReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as GraphicOrderNodeView;
  const order = Array.isArray(props.value) ? [...props.value] : [];

  if (!node.object) {
    return null;
  }

  function toggle(identifier: string): void {
    if (props.disabled) {
      return;
    }

    const next = order.includes(identifier) ? order.filter((entry) => entry !== identifier) : [...order, identifier];

    props.setValue(next.length === 0 ? null : next);
  }

  return createElement(GraphicStage, {
    object: node.object,
    resolveAsset: props.resolveAsset,
    interaction: "graphicOrderInteraction",
    status: props.status,
    prompt: node.prompt
      ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content))
      : null,
    overlay: (node.hotspotChoices ?? []).map((hotspot) => {
      const position = order.indexOf(hotspot.identifier);
      const center = shapeCenter(hotspot.shape, hotspot.coords);

      return createElement(
        Fragment,
        { key: hotspot.identifier },
        shapeElement(hotspot.shape, hotspot.coords, `${hotspot.identifier}-shape`, {
          role: "button",
          tabIndex: 0,
          "aria-label": `${hotspot.identifier}${position === -1 ? "" : `, position ${position + 1}`}`,
          "data-status": position === -1 ? "idle" : "selected",
          onClick: () => toggle(hotspot.identifier),
          style: { cursor: props.disabled ? "default" : "pointer" },
        }),
        position === -1
          ? null
          : createElement(
              "text",
              {
                x: center.x,
                y: center.y,
                textAnchor: "middle",
                dominantBaseline: "central",
                "data-qti-order-badge": hotspot.identifier,
                style: { pointerEvents: "none" },
              },
              String(position + 1),
            ),
      );
    }),
  });
}
