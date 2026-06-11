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
