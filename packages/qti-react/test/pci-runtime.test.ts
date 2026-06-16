/**
 * PCI through the runtime: the capability gate stays closed until the consumer opts
 * in (descriptor + created skin), the host container renders, and a mounted instance
 * feeds scoring through the store's response collector at submit.
 */

import { describe, expect, test } from "bun:test";

import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { qtiCoreInteractions } from "../src/interactions";
import { createPciModuleRegistry, createPciSkin, mountPci, portableCustomInteraction } from "../src/pci";
import type { PciInteractionNode } from "../src/pci";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type AssessmentItemView, type BodyNode } from "../src/runtime";
import { createAttemptStore } from "../src/store";

const counterSource = `
define(["qtiCustomInteractionContext"], function (ctx) {
  var module = {
    typeIdentifier: "urn:example:pci:counter",
    getInstance: function (dom, configuration, state) {
      var instance = Object.create(this);
      instance._count = 0;
      var button = dom.querySelector("button.count");
      if (button) { button.addEventListener("click", function () { instance._count += 1; }); }
      instance.getResponse = function () { return { base: { integer: instance._count } }; };
      if (configuration.onready) { configuration.onready(instance); }
      return instance;
    },
  };
  ctx.register(module);
  return module;
});
`;

const pciNode: PciInteractionNode = {
  kind: "portableCustomInteraction",
  responseIdentifier: "RESPONSE",
  customInteractionTypeIdentifier: "urn:example:pci:counter",
  module: "counter",
  class: ["counter-demo"],
  interactionMarkup: {
    content: [
      { kind: "xml", name: "button", attributes: { class: "count" }, children: ["Count up"] },
    ] as unknown as BodyNode[],
  },
};

const item: AssessmentItemView = {
  responseDeclarations: [
    {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "integer",
      correctResponse: { values: [{ value: "2" }] },
    },
  ],
  outcomeDeclarations: [{ identifier: "SCORE", cardinality: "single", baseType: "float" }],
  responseProcessing: { template: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct" },
  itemBody: { content: [pciNode as never] },
};

describe("PCI capability gate", () => {
  test("undeliverable against the core runtime — PCI is opt-in", () => {
    const core = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });
    const report = core.canDeliver(item);

    expect(report.deliverable).toBe(false);
    expect(report.issues[0]).toMatchObject({
      type: "unsupported-interaction",
      name: "portableCustomInteraction",
    });
  });

  test("deliverable once the descriptor and a created skin are registered", () => {
    const registry = createPciModuleRegistry();
    const runtime = createQtiRuntime({
      interactions: [...qtiCoreInteractions, portableCustomInteraction],
      skin: { ...referenceSkin, portableCustomInteraction: createPciSkin({ registry }) },
    });

    expect(runtime.canDeliver(item).issues).toEqual([]);
  });

  test("the host container renders with the PCI type and author classes", () => {
    const registry = createPciModuleRegistry();
    const runtime = createQtiRuntime({
      interactions: [...qtiCoreInteractions, portableCustomInteraction],
      skin: { ...referenceSkin, portableCustomInteraction: createPciSkin({ registry }) },
    });

    const html = renderToStaticMarkup(createElement(runtime.ItemRenderer, { item }));

    expect(html).toContain('data-qti-interaction="portableCustomInteraction"');
    expect(html).toContain('data-qti-pci-type="urn:example:pci:counter"');
    expect(html).toContain('class="counter-demo"');
  });
});

// A state-bearing module: getState() serializes the tap count, and getInstance restores
// it from the `state` argument — the corpus tap.js archetype.
const statefulSource = `
define(["qtiCustomInteractionContext"], function (ctx) {
  var module = {
    typeIdentifier: "urn:example:pci:counter",
    getInstance: function (dom, configuration, state) {
      var instance = Object.create(this);
      instance._count = state ? JSON.parse(state).count : 0;
      var button = dom.querySelector("button.count");
      if (button) { button.addEventListener("click", function () { instance._count += 1; }); }
      instance.getResponse = function () { return { base: { integer: instance._count } }; };
      instance.getState = function () { return JSON.stringify({ count: instance._count }); };
      if (configuration.onready) { configuration.onready(instance); }
      return instance;
    },
  };
  ctx.register(module);
  return module;
});
`;

// This drives mountPci + the store directly, exactly as createPciSkin's effects do
// (initialState ← store.getSnapshot().interactionStates[responseIdentifier] → mount
// `state`; registerStateCollector(() => handle.getState())). The package has no
// client-render harness, so the skin's glue is verified through the same seam.
describe("PCI getState persistence through the store (ADR-0012)", () => {
  test("suspend captures the instance state; a resumed store re-mounts it", async () => {
    const registry = createPciModuleRegistry();
    registry.evaluate(statefulSource, { id: "counter" });

    const window = new Window();
    const firstContainer = window.document.createElement("div");
    window.document.body.appendChild(firstContainer);

    // First session: mount fresh (no prior state), interact, then suspend.
    const store = createAttemptStore(item.responseDeclarations, {}, { outcomeDeclarations: item.outcomeDeclarations });
    const initialState = store.getSnapshot().interactionStates["RESPONSE"];
    expect(initialState).toBeUndefined();

    const first = await mountPci({
      container: firstContainer as unknown as Element,
      node: pciNode,
      registry,
      ...(initialState !== undefined ? { state: initialState } : {}),
    });
    store.registerStateCollector("RESPONSE", () => first.getState());

    const button = firstContainer.querySelector("button.count") as unknown as { click: () => void };
    button.click();
    button.click();
    button.click();

    store.suspend();
    first.unmount();

    const captured = store.getSnapshot().interactionStates["RESPONSE"];
    expect(captured).toBe(JSON.stringify({ count: 3 }));

    // Resume: a store re-created from the persisted snapshot seeds the restore state,
    // and the re-mounted instance comes back with its in-progress count.
    const resumed = createAttemptStore(
      item.responseDeclarations,
      {},
      { outcomeDeclarations: item.outcomeDeclarations, initialInteractionStates: { RESPONSE: captured! } },
    );
    const secondContainer = window.document.createElement("div");
    window.document.body.appendChild(secondContainer);

    const restoreState = resumed.getSnapshot().interactionStates["RESPONSE"];
    expect(restoreState).toBe(captured!);

    const second = await mountPci({
      container: secondContainer as unknown as Element,
      node: pciNode,
      registry,
      ...(restoreState !== undefined ? { state: restoreState } : {}),
    });

    expect(second.collectResponse()).toBe("3");
    second.unmount();
  });
});

describe("PCI scoring through the response collector", () => {
  test("submit pulls the instance response and runs response processing", async () => {
    const registry = createPciModuleRegistry();
    registry.evaluate(counterSource, { id: "counter" });

    const window = new Window();
    const container = window.document.createElement("div");
    window.document.body.appendChild(container);

    const handle = await mountPci({ container: container as unknown as Element, node: pciNode, registry });

    const store = createAttemptStore(
      item.responseDeclarations,
      {},
      {
        outcomeDeclarations: item.outcomeDeclarations,
        responseProcessing: item.responseProcessing,
      },
    );
    store.registerResponseCollector("RESPONSE", () => handle.collectResponse());

    const button = container.querySelector("button.count") as unknown as { click: () => void };
    button.click();
    button.click();

    const scores = store.submit();

    expect(store.getSnapshot().responses["RESPONSE"]).toBe("2");
    expect(scores[0]?.correct).toBe(true);
    expect(store.getSnapshot().outcomes["SCORE"]).toBe(1);
  });
});
