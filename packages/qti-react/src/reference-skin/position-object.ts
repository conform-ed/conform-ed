/**
 * Reference Skin for `positionObjectStage` (ADR-0001): click the stage to place the
 * movable object image, centered on the click point. The view models the common
 * single-interaction stage (one movable object per stage); multi-interaction stages
 * fail descriptor validation and surface through the capability gate.
 */

import { createElement, type ReactNode } from "react";

import { formatPoint, parsePoint, type Point } from "../graphic";
import type { BodyNode, InteractionRenderProps } from "../runtime";
import { GraphicStage, type ObjectView } from "./graphic-base";

interface PositionObjectNodeView {
  prompt?: { content?: readonly BodyNode[] };
  stageObject?: ObjectView;
  object?: ObjectView;
  maxChoices?: number;
}

export function PositionObjectReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as PositionObjectNodeView;
  const maxChoices = node.maxChoices ?? 1;
  const points =
    props.value === null
      ? []
      : typeof props.value === "string"
        ? [props.value]
        : Array.isArray(props.value)
          ? [...props.value]
          : [];

  if (!node.stageObject || !node.object) {
    return null;
  }

  const movable = node.object;

  function stageClick(point: Point): void {
    if (props.disabled) {
      return;
    }

    const formatted = formatPoint(point);

    if (maxChoices === 1) {
      props.setValue(formatted);
      return;
    }

    if (points.length < maxChoices) {
      props.setValue([...points, formatted]);
    }
  }

  return createElement(GraphicStage, {
    object: node.stageObject,
    resolveAsset: props.resolveAsset,
    interaction: "positionObjectStage",
    status: props.status,
    onStageClick: stageClick,
    prompt: node.prompt
      ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content))
      : null,
    overlay: points.map((value, index) => {
      const point = parsePoint(value);

      if (!point) {
        return null;
      }

      return createElement("image", {
        key: `${value}-${index}`,
        href: props.resolveAsset(movable.data),
        x: point.x - (movable.width ?? 0) / 2,
        y: point.y - (movable.height ?? 0) / 2,
        width: movable.width,
        height: movable.height,
        "data-qti-point": value,
        style: { pointerEvents: "none" },
      });
    }),
  });
}
