import { describe, expect, test } from "bun:test";

import { isAllowedFlowElement, isInteractionKind, sanitizeAttributes, v0ContentModel } from "../src/content-model";

describe("content model allowlist", () => {
  test("allows v0 flow + language + media elements, rejects others", () => {
    expect(isAllowedFlowElement(v0ContentModel, "p")).toBe(true);
    expect(isAllowedFlowElement(v0ContentModel, "ruby")).toBe(true);
    expect(isAllowedFlowElement(v0ContentModel, "math")).toBe(true);
    expect(isAllowedFlowElement(v0ContentModel, "img")).toBe(true);
    expect(isAllowedFlowElement(v0ContentModel, "audio")).toBe(true);
    expect(isAllowedFlowElement(v0ContentModel, "script")).toBe(false);
    expect(isAllowedFlowElement(v0ContentModel, "iframe")).toBe(false);
  });

  test("recognizes shipped interaction kinds", () => {
    expect(isInteractionKind(v0ContentModel, "choiceInteraction")).toBe(true);
    expect(isInteractionKind(v0ContentModel, "uploadInteraction")).toBe(true);
    expect(isInteractionKind(v0ContentModel, "hotspotInteraction")).toBe(true);
    expect(isInteractionKind(v0ContentModel, "drawingInteraction")).toBe(false);
  });
});

describe("sanitizeAttributes", () => {
  test("keeps globally allowlisted attributes", () => {
    expect(sanitizeAttributes(v0ContentModel, "p", { class: "lead", lang: "ja", id: "q1" })).toEqual({
      class: "lead",
      lang: "ja",
      id: "q1",
    });
  });

  test("element-specific attributes apply only to their element", () => {
    expect(sanitizeAttributes(v0ContentModel, "img", { src: "a.png", alt: "art" })).toEqual({
      src: "a.png",
      alt: "art",
    });
    expect(sanitizeAttributes(v0ContentModel, "p", { src: "a.png" })).toEqual({});
  });

  test("drops event handlers, javascript: urls, style, and unknown attributes", () => {
    expect(
      sanitizeAttributes(v0ContentModel, "img", {
        onclick: "steal()",
        onLoad: "x()",
        src: "javascript:alert(1)",
        style: "color:red",
        "data-x": "1",
        class: "ok",
      }),
    ).toEqual({ class: "ok" });
  });

  test("handles missing attributes", () => {
    expect(sanitizeAttributes(v0ContentModel, "p", undefined)).toEqual({});
  });
});
