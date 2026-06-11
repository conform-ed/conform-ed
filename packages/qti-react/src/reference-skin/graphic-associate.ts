/**
 * Reference Skin for `graphicAssociateInteraction` (ADR-0001): click two hotspots to
 * connect them; connections draw as lines and list below with remove buttons. Pairs
 * are unordered (`pair` baseType).
 */

import { Fragment, createElement, useState, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";
import { GraphicStage, shapeCenter, shapeElement, type HotspotView, type ObjectView } from "./graphic-base";

interface GraphicAssociateNodeView {
  prompt?: { content?: readonly BodyNode[] };
  object?: ObjectView;
  associableHotspots?: readonly HotspotView[];
}

export function GraphicAssociateReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as GraphicAssociateNodeView;
  const pairs = Array.isArray(props.value) ? [...props.value] : [];
  // Ephemeral picker state only; the response itself lives in the core store.
  const [pending, setPending] = useState<string | null>(null);
  const hotspots = node.associableHotspots ?? [];
  const centersById = new Map(
    hotspots.map((hotspot) => [hotspot.identifier, shapeCenter(hotspot.shape, hotspot.coords)]),
  );

  if (!node.object) {
    return null;
  }

  function clickHotspot(identifier: string): void {
    if (props.disabled) {
      return;
    }

    if (pending === null) {
      setPending(identifier);
      return;
    }

    if (pending === identifier) {
      setPending(null);
      return;
    }

    const pair = `${pending} ${identifier}`;
    const reversed = `${identifier} ${pending}`;

    if (!pairs.includes(pair) && !pairs.includes(reversed)) {
      props.setValue([...pairs, pair]);
    }

    setPending(null);
  }

  return createElement(GraphicStage, {
    object: node.object,
    resolveAsset: props.resolveAsset,
    interaction: "graphicAssociateInteraction",
    status: props.status,
    prompt: node.prompt
      ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content))
      : null,
    overlay: createElement(
      Fragment,
      null,
      pairs.map((pair) => {
        const [a, b] = pair.split(/\s+/u);
        const from = centersById.get(a ?? "");
        const to = centersById.get(b ?? "");

        if (!from || !to) {
          return null;
        }

        return createElement("line", {
          key: pair,
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          stroke: "currentColor",
          strokeWidth: 2,
          "data-qti-pair": pair,
          style: { pointerEvents: "none" },
        });
      }),
      hotspots.map((hotspot) =>
        shapeElement(hotspot.shape, hotspot.coords, hotspot.identifier, {
          role: "button",
          tabIndex: 0,
          "aria-label": hotspot.identifier,
          "aria-pressed": pending === hotspot.identifier,
          "data-status": pending === hotspot.identifier ? "selected" : "idle",
          onClick: () => clickHotspot(hotspot.identifier),
          style: { cursor: props.disabled ? "default" : "pointer" },
        }),
      ),
    ),
    after: createElement(
      "ul",
      null,
      pairs.map((pair) =>
        createElement(
          "li",
          { key: pair },
          pair.replace(/\s+/u, " ↔ "),
          createElement(
            "button",
            {
              type: "button",
              disabled: props.disabled,
              "aria-label": `Remove association ${pair}`,
              onClick: () => props.setValue(pairs.filter((entry) => entry !== pair)),
            },
            "×",
          ),
        ),
      ),
    ),
  });
}
