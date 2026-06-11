/**
 * Reference Skin for `graphicGapMatchInteraction` (ADR-0001): pick a gap image from
 * the tray, then click a hotspot to place it — no drag-and-drop. Placed images draw
 * at the hotspot center; responses are directedPairs gapImg→hotspot.
 */

import { Fragment, createElement, useState, type ReactNode } from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";
import { GraphicStage, shapeCenter, shapeElement, type HotspotView, type ObjectView } from "./graphic-base";

interface GapImgView {
  identifier: string;
  object?: ObjectView;
  matchMax?: number;
}

interface GraphicGapMatchNodeView {
  prompt?: { content?: readonly BodyNode[] };
  object?: ObjectView;
  gapImgs?: readonly GapImgView[];
  associableHotspots?: readonly HotspotView[];
}

export function GraphicGapMatchReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as GraphicGapMatchNodeView;
  const pairs = Array.isArray(props.value) ? [...props.value] : [];
  // Ephemeral tray selection only; the response itself lives in the core store.
  const [selectedGapImg, setSelectedGapImg] = useState<string | null>(null);
  const gapImgs = node.gapImgs ?? [];
  const gapImgsById = new Map(gapImgs.map((gapImg) => [gapImg.identifier, gapImg]));

  if (!node.object) {
    return null;
  }

  function placedIn(hotspotIdentifier: string): string | null {
    const pair = pairs.find((entry) => entry.split(/\s+/u)[1] === hotspotIdentifier);

    return pair?.split(/\s+/u)[0] ?? null;
  }

  function clickHotspot(hotspotIdentifier: string): void {
    if (props.disabled) {
      return;
    }

    const kept = pairs.filter((entry) => entry.split(/\s+/u)[1] !== hotspotIdentifier);

    if (selectedGapImg === null) {
      // No tray selection: clicking a filled hotspot clears it.
      if (kept.length !== pairs.length) {
        props.setValue(kept.length === 0 ? null : kept);
      }

      return;
    }

    props.setValue([...kept, `${selectedGapImg} ${hotspotIdentifier}`]);
    setSelectedGapImg(null);
  }

  return createElement(GraphicStage, {
    object: node.object,
    resolveAsset: props.resolveAsset,
    interaction: "graphicGapMatchInteraction",
    status: props.status,
    prompt: createElement(
      Fragment,
      null,
      node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
      createElement(
        "div",
        { role: "group", "aria-label": "Gap images" },
        gapImgs.map((gapImg) =>
          createElement(
            "button",
            {
              key: gapImg.identifier,
              type: "button",
              disabled: props.disabled,
              "aria-pressed": selectedGapImg === gapImg.identifier,
              "data-status": selectedGapImg === gapImg.identifier ? "selected" : "idle",
              "data-qti-gap-img": gapImg.identifier,
              onClick: () => setSelectedGapImg(selectedGapImg === gapImg.identifier ? null : gapImg.identifier),
            },
            gapImg.object
              ? createElement("img", {
                  src: props.resolveAsset(gapImg.object.data),
                  width: gapImg.object.width,
                  height: gapImg.object.height,
                  alt: gapImg.identifier,
                })
              : gapImg.identifier,
          ),
        ),
      ),
    ),
    overlay: (node.associableHotspots ?? []).map((hotspot) => {
      const placed = placedIn(hotspot.identifier);
      const placedObject = placed === null ? undefined : gapImgsById.get(placed)?.object;
      const center = shapeCenter(hotspot.shape, hotspot.coords);

      return createElement(
        Fragment,
        { key: hotspot.identifier },
        shapeElement(hotspot.shape, hotspot.coords, `${hotspot.identifier}-shape`, {
          role: "button",
          tabIndex: 0,
          "aria-label": `${hotspot.identifier}${placed === null ? "" : `, contains ${placed}`}`,
          "data-status": placed === null ? "idle" : "selected",
          onClick: () => clickHotspot(hotspot.identifier),
          style: { cursor: props.disabled ? "default" : "pointer" },
        }),
        placedObject
          ? createElement("image", {
              href: props.resolveAsset(placedObject.data),
              x: center.x - (placedObject.width ?? 0) / 2,
              y: center.y - (placedObject.height ?? 0) / 2,
              width: placedObject.width,
              height: placedObject.height,
              style: { pointerEvents: "none" },
            })
          : null,
      );
    }),
  });
}
