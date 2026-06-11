/**
 * The harness's sample PCI: a genuine AMD module (the format real PCI packages ship)
 * evaluated through the PCI Module Registry — a dice roller whose response is the
 * number of rolls it took to land a six. Demonstrates the full PCI v1 lifecycle:
 * `qtiCustomInteractionContext.register`, `getInstance(dom, configuration, state)`,
 * markup ownership, `getResponse`, `getState`, and `oncompleted`.
 */

import { createPciModuleRegistry } from "@conform-ed/qti-react";

const diceRollerSource = String.raw`
define(["qtiCustomInteractionContext"], function (ctx) {
  var module = {
    typeIdentifier: "urn:conform-ed:pci:dice-roller",
    getInstance: function (dom, configuration, state) {
      var instance = Object.create(this);
      var props = configuration.properties || {};
      var target = parseInt(props.target || "6", 10);
      var saved = state ? JSON.parse(state) : { rolls: 0, last: null };

      instance._rolls = saved.rolls;
      instance._last = saved.last;

      var button = dom.querySelector("button.roll");
      var output = dom.querySelector("output.face");

      function show() {
        if (output) {
          output.textContent = instance._last === null
            ? "Not rolled yet"
            : "Rolled " + instance._last + " after " + instance._rolls + " roll(s)";
        }
      }

      if (button) {
        instance._listener = function () {
          if (instance._last === target) { return; }
          instance._rolls += 1;
          instance._last = 1 + Math.floor(Math.random() * 6);
          show();
        };
        button.addEventListener("click", instance._listener);
      }

      show();

      instance.getResponse = function () {
        return instance._last === target ? { base: { integer: instance._rolls } } : { base: null };
      };
      instance.getState = function () {
        return JSON.stringify({ rolls: instance._rolls, last: instance._last });
      };
      instance.oncompleted = function () {
        if (button && instance._listener) { button.removeEventListener("click", instance._listener); }
      };

      if (configuration.onready) { configuration.onready(instance, instance.getState()); }
      return instance;
    },
  };
  ctx.register(module);
  return module;
});
`;

export const harnessPciRegistry = createPciModuleRegistry();

harnessPciRegistry.evaluate(diceRollerSource, { id: "dice-roller" });

// Install-model wiring (ADR-0007): the math-entry PCI is an installed package, not
// content-loaded code. Its descriptor knowledge is eager (the type identifier in
// items.ts gates deliverability); the heavy implementation (MathLive + compute-engine)
// loads via lazy import() so non-math visitors never download it. Guarded because the
// MathLive custom element requires a browser environment (tests import this file).
if (typeof HTMLElement !== "undefined") {
  void import("@conform-ed/pci-math-entry/module").then(({ mathEntryModule }) => {
    harnessPciRegistry.registerModule("math-entry", mathEntryModule);
  });
}
