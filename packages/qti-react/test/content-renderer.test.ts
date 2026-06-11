/**
 * ContentRenderer: standalone rendering of flow content outside an item attempt —
 * test feedback, rubric-style copy. Same sanitizer and node walk as the item body;
 * printedVariable reads from the caller-supplied outcomes (e.g. test outcomes).
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type BodyNode } from "../src/runtime";

const runtime = createQtiRuntime({ interactions: [], skin: referenceSkin });

describe("ContentRenderer", () => {
  test("renders sanitized flow content", () => {
    const nodes: BodyNode[] = [
      { kind: "xml", name: "p", children: [{ kind: "text", value: "Well done." } as never] },
      { kind: "xml", name: "script", value: "alert(1)" },
    ];

    const html = renderToStaticMarkup(createElement(runtime.ContentRenderer, { nodes }));

    expect(html).toContain("Well done.");
    expect(html).not.toContain("alert(1)");
  });

  test("printedVariable reads the supplied outcomes", () => {
    const nodes: BodyNode[] = [
      {
        kind: "xml",
        name: "p",
        children: [
          { kind: "text", value: "Total: " } as never,
          { kind: "printedVariable", identifier: "TOTAL" } as never,
        ],
      },
    ];

    const html = renderToStaticMarkup(createElement(runtime.ContentRenderer, { nodes, outcomes: { TOTAL: 7 } }));

    expect(html).toContain('data-qti-printed-variable="TOTAL"');
    expect(html).toContain(">7</span>");
  });
});
