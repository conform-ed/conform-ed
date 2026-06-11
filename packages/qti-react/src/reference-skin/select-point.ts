/**
 * Reference Skin for `selectPointInteraction` (ADR-0001): click the stage to record a
 * point (image coordinates). With maxChoices 1 a new click replaces the point;
 * otherwise clicks append until maxChoices is reached.
 */

import { Fragment, createElement, type ReactNode } from "react";

import { formatPoint, type Point } from "../graphic";
import type { BodyNode, InteractionRenderProps } from "../runtime";
import { GraphicStage, type ObjectView } from "./graphic-base";

interface SelectPointNodeView {
  prompt?: { content?: readonly BodyNode[] };
  object?: ObjectView;
  maxChoices?: number;
}

export function SelectPointReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as SelectPointNodeView;
  const maxChoices = node.maxChoices ?? 1;
  const points = props.value === null ? [] : typeof props.value === "string" ? [props.value] : [...props.value];

  if (!node.object) {
    return null;
  }

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
    object: node.object,
    resolveAsset: props.resolveAsset,
    interaction: "selectPointInteraction",
    status: props.status,
    onStageClick: stageClick,
    prompt: node.prompt
      ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content))
      : null,
    overlay: points.map((value, index) => {
      const [x, y] = value.split(/\s+/u).map(Number);

      return createElement(
        Fragment,
        { key: `${value}-${index}` },
        createElement("circle", {
          cx: x,
          cy: y,
          r: 5,
          fill: "currentColor",
          "data-qti-point": value,
          style: { pointerEvents: "none" },
        }),
      );
    }),
    after: createElement(
      "button",
      {
        type: "button",
        disabled: props.disabled || points.length === 0,
        onClick: () => props.setValue(null),
      },
      "Clear points",
    ),
  });
}
