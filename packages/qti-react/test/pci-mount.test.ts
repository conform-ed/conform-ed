/**
 * The PCI mount lifecycle against a real DOM (happy-dom Window, no global
 * registration): markup injection, getInstance configuration (properties, boundTo,
 * onready), response collection, state capture, and teardown via oncompleted.
 */

import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

import { createPciModuleRegistry, mountPci, serializePciMarkup, type PciInteractionNode } from "../src/pci";
import type { BodyNode } from "../src/runtime";

/** Adapter output uses bare strings as text children; the static type doesn't. */
function markup(nodes: unknown[]): BodyNode[] {
  return nodes as BodyNode[];
}

function makeContainer(): Element {
  const window = new Window();
  const container = window.document.createElement("div");

  window.document.body.appendChild(container);

  return container as unknown as Element;
}

const tapLikeSource = `
define(["qtiCustomInteractionContext"], function (ctx) {
  var module = {
    typeIdentifier: "urn:example:pci:tap",
    getInstance: function (dom, configuration, state) {
      var instance = Object.create(this);
      instance._dom = dom;
      instance._config = configuration;
      instance._taps = state ? JSON.parse(state).taps : 0;
      instance._cleanedUp = false;
      var buttons = dom.querySelectorAll("button.tap");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", function () { instance._taps += 1; });
      }
      instance.getResponse = function () { return { base: { integer: instance._taps } }; };
      instance.getState = function () { return JSON.stringify({ taps: instance._taps }); };
      instance.oncompleted = function () { instance._cleanedUp = true; };
      if (configuration.onready) { configuration.onready(instance, instance.getState()); }
      return instance;
    },
  };
  ctx.register(module);
  return module;
});
`;

const node: PciInteractionNode = {
  kind: "portableCustomInteraction",
  responseIdentifier: "RESPONSE",
  customInteractionTypeIdentifier: "urn:example:pci:tap",
  module: "tap-like",
  properties: { toggle: "true", "tap-message": "Tap to reveal" },
  interactionMarkup: {
    content: markup([
      {
        kind: "xml",
        name: "section",
        attributes: { class: "border" },
        children: [
          { kind: "xml", name: "button", attributes: { class: "tap", onclick: "alert(1)" }, children: ["Tap A"] },
          { kind: "xml", name: "button", attributes: { class: "tap" }, children: ["Tap B"] },
        ],
      },
    ]),
  },
};

describe("serializePciMarkup", () => {
  test("serializes markup, strips handlers and script elements", () => {
    const html = serializePciMarkup(node.interactionMarkup!.content);

    expect(html).toContain('<section class="border">');
    expect(html).toContain(">Tap A</button>");
    expect(html).not.toContain("onclick");

    expect(serializePciMarkup(markup([{ kind: "xml", name: "script", children: ["alert(1)"] }]))).toBe("");
    expect(serializePciMarkup([{ kind: "xml", name: "img", attributes: { src: "vinegar.svg", alt: "Vinegar" } }])).toBe(
      '<img src="vinegar.svg" alt="Vinegar">',
    );
  });
});

describe("mountPci", () => {
  test("mounts the instance over injected markup and collects its response", async () => {
    const registry = createPciModuleRegistry();
    registry.evaluate(tapLikeSource, { id: "tap-like" });

    const container = makeContainer();
    const handle = await mountPci({ container, node, registry });

    // Markup landed inside the conventional wrapper.
    expect(container.querySelector(".qti-interaction-markup")).not.toBeNull();
    expect(container.querySelectorAll("button.tap")).toHaveLength(2);

    // Configuration carried the PCI properties.
    const config = (handle.instance as unknown as { _config: { properties: Record<string, string> } })._config;
    expect(config.properties["tap-message"]).toBe("Tap to reveal");

    // Interaction → response collection.
    expect(handle.collectResponse()).toBe("0");
    (container.querySelector("button.tap") as unknown as { click: () => void }).click();
    (container.querySelector("button.tap") as unknown as { click: () => void }).click();
    expect(handle.collectResponse()).toBe("2");
    expect(handle.getState()).toBe(JSON.stringify({ taps: 2 }));
  });

  test("restores a previous state and tears down through oncompleted", async () => {
    const registry = createPciModuleRegistry();
    registry.evaluate(tapLikeSource, { id: "tap-like" });

    const container = makeContainer();
    const handle = await mountPci({ container, node, registry, state: JSON.stringify({ taps: 7 }) });

    expect(handle.collectResponse()).toBe("7");

    handle.unmount();
    expect((handle.instance as unknown as { _cleanedUp: boolean })._cleanedUp).toBe(true);
    expect(container.childNodes).toHaveLength(0);
  });

  test("passes boundTo when the declaration is supplied", async () => {
    const registry = createPciModuleRegistry();
    registry.evaluate(tapLikeSource, { id: "tap-like" });

    const handle = await mountPci({
      container: makeContainer(),
      node,
      registry,
      declaration: { identifier: "RESPONSE", cardinality: "single", baseType: "integer" },
      boundValue: "3",
    });

    const config = (handle.instance as unknown as { _config: { boundTo: Record<string, unknown> } })._config;
    expect(config.boundTo["RESPONSE"]).toEqual({ base: { integer: 3 } });
  });

  test("fails loudly when no module can be resolved", async () => {
    const registry = createPciModuleRegistry({
      fetchText: async () => {
        throw new Error("offline");
      },
    });

    let failure: Error | null = null;

    try {
      await mountPci({ container: makeContainer(), node, registry });
    } catch (error) {
      failure = error as Error;
    }

    expect(failure?.message).toMatch(/tap-like|urn:example/u);
  });
});
