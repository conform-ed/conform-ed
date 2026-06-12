/**
 * Reference Skin for `drawingInteraction` (ADR-0001): a canvas drawing surface over
 * the stage image. The candidate draws freehand strokes with the pointer; the result
 * is captured as a PNG data URL into the `file` response (the upload convention).
 * Items using drawing are typically scored externally, not by client RP.
 */

import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import type { BodyNode, InteractionRenderProps } from "../runtime";

import type { ObjectView } from "./graphic-base";

interface DrawingNodeView {
  prompt?: { content?: readonly BodyNode[] };
  object: ObjectView;
}

const strokeStyle = "#c2410c";
const strokeWidth = 3;

export function DrawingReferenceSkin(props: InteractionRenderProps): ReactNode {
  const node = props.node as unknown as DrawingNodeView;
  const width = node.object.width ?? 400;
  const height = node.object.height ?? 300;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Paint the stage image as the drawing background (and again after a clear).
  const stageData = node.object.data;
  const paintBackground = useCallback(
    (canvas: HTMLCanvasElement): void => {
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);

      const image = new Image();

      image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = propsRef.current.resolveAsset(stageData);
    },
    [stageData],
  );

  useEffect(() => {
    if (canvasRef.current) {
      paintBackground(canvasRef.current);
    }
  }, [paintBackground]);

  const pointerPosition = (event: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (props.disabled) {
      return;
    }

    const context = event.currentTarget.getContext("2d");

    if (!context) {
      return;
    }

    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);

    const { x, y } = pointerPosition(event);

    context.strokeStyle = strokeStyle;
    context.lineWidth = strokeWidth;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x, y);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!drawingRef.current) {
      return;
    }

    const context = event.currentTarget.getContext("2d");

    if (!context) {
      return;
    }

    const { x, y } = pointerPosition(event);

    context.lineTo(x, y);
    context.stroke();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    // The committed response is the canvas content as a PNG data URL (file base type).
    props.setValue(event.currentTarget.toDataURL("image/png"));
  };

  const handleClear = (): void => {
    if (props.disabled) {
      return;
    }

    props.setValue(null);

    if (canvasRef.current) {
      paintBackground(canvasRef.current);
    }
  };

  return createElement(
    "div",
    { "data-qti-interaction": "drawingInteraction", "data-status": props.status },
    node.prompt ? createElement("div", { "data-qti-prompt": true }, props.renderContent(node.prompt.content)) : null,
    createElement("canvas", {
      ref: canvasRef,
      width,
      height,
      role: "img",
      "aria-label": "Drawing surface",
      "data-qti-drawing-stage": "",
      style: { touchAction: "none", border: "1px solid #d1d5db", maxWidth: "100%" },
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    }),
    createElement(
      "button",
      { type: "button", onClick: handleClear, disabled: props.disabled, "aria-disabled": props.disabled },
      "Clear",
    ),
  );
}
