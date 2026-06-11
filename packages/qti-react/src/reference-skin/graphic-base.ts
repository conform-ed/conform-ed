/**
 * Shared scaffolding for the graphic Reference Skins (ADR-0001): a stage (the image
 * with an SVG overlay in image coordinates) plus QTI shape → SVG element mapping.
 */

import { createElement, type MouseEvent, type ReactNode, type SVGProps } from "react";

import type { Point } from "../graphic";

export interface ObjectView {
  data: string;
  width?: number;
  height?: number;
  type?: string;
}

export interface HotspotView {
  identifier: string;
  shape: string;
  coords: readonly number[];
  matchMax?: number;
}

/** The geometric center of a shape, for badges, lines, and placed images. */
export function shapeCenter(shape: string, coords: readonly number[]): Point {
  switch (shape) {
    case "circle":
    case "ellipse":
      return { x: coords[0] ?? 0, y: coords[1] ?? 0 };

    case "rect":
      return { x: ((coords[0] ?? 0) + (coords[2] ?? 0)) / 2, y: ((coords[1] ?? 0) + (coords[3] ?? 0)) / 2 };

    case "poly": {
      let x = 0;
      let y = 0;
      const pointCount = Math.floor(coords.length / 2);

      for (let i = 0; i < pointCount * 2; i += 2) {
        x += coords[i] ?? 0;
        y += coords[i + 1] ?? 0;
      }

      return pointCount === 0 ? { x: 0, y: 0 } : { x: x / pointCount, y: y / pointCount };
    }

    default:
      return { x: 0, y: 0 };
  }
}

/** Extra props a shape may carry, including data-* attributes. */
export type ShapeProps = SVGProps<SVGElement> & { [dataAttribute: `data-${string}`]: string | number | boolean };

/** Map a QTI (shape, coords) to an SVG element with the given extra props. */
export function shapeElement(shape: string, coords: readonly number[], key: string, props: ShapeProps): ReactNode {
  const base = { key, fill: "transparent", stroke: "currentColor", strokeWidth: 1, ...props };

  switch (shape) {
    case "circle":
      return createElement("circle", { ...base, cx: coords[0], cy: coords[1], r: coords[2] });

    case "rect":
      return createElement("rect", {
        ...base,
        x: coords[0],
        y: coords[1],
        width: (coords[2] ?? 0) - (coords[0] ?? 0),
        height: (coords[3] ?? 0) - (coords[1] ?? 0),
      });

    case "ellipse":
      return createElement("ellipse", { ...base, cx: coords[0], cy: coords[1], rx: coords[2], ry: coords[3] });

    case "poly": {
      const points: string[] = [];

      for (let i = 0; i + 1 < coords.length; i += 2) {
        points.push(`${coords[i]},${coords[i + 1]}`);
      }

      return createElement("polygon", { ...base, points: points.join(" ") });
    }

    default:
      // `default` (whole image) renders as a full-stage rect; the stage passes 100%.
      return createElement("rect", { ...base, x: 0, y: 0, width: "100%", height: "100%" });
  }
}

export interface GraphicStageProps {
  object: ObjectView;
  resolveAsset: (href: string) => string;
  interaction: string;
  status: string;
  /** Stage click in image coordinates (from the SVG overlay). */
  onStageClick?: (point: Point) => void;
  prompt?: ReactNode;
  overlay?: ReactNode;
  after?: ReactNode;
}

/** The image + coordinate-space SVG overlay every graphic interaction shares. */
export function GraphicStage(props: GraphicStageProps): ReactNode {
  const width = props.object.width ?? 0;
  const height = props.object.height ?? 0;

  return createElement(
    "div",
    { "data-qti-interaction": props.interaction, "data-status": props.status },
    props.prompt,
    createElement(
      "div",
      { style: { position: "relative", display: "inline-block", lineHeight: 0 } },
      createElement("img", {
        src: props.resolveAsset(props.object.data),
        width: width || undefined,
        height: height || undefined,
        alt: "",
      }),
      createElement(
        "svg",
        {
          viewBox: `0 0 ${width || 100} ${height || 100}`,
          width: width || undefined,
          height: height || undefined,
          style: { position: "absolute", inset: 0 },
          onClick: props.onStageClick
            ? (event: MouseEvent<SVGSVGElement>) => {
                props.onStageClick?.({
                  x: Math.round(event.nativeEvent.offsetX),
                  y: Math.round(event.nativeEvent.offsetY),
                });
              }
            : undefined,
        },
        props.overlay,
      ),
    ),
    props.after,
  );
}
