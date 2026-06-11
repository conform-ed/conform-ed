/**
 * The PCI Module Registry: AMD-compatible `define` evaluation (PCI v1 modules are
 * AMD), `qtiCustomInteractionContext.register` handshake, direct registration for
 * bundled modules, and URL loading with primary → fallback paths.
 */

import { describe, expect, test } from "bun:test";

import { createPciModuleRegistry } from "../src/pci";

const counterSource = `
define(["qtiCustomInteractionContext"], function (ctx) {
  var module = {
    typeIdentifier: "urn:example:pci:counter",
    getInstance: function (dom, configuration, state) {
      var instance = Object.create(this);
      instance._count = state ? JSON.parse(state).count : 0;
      instance.getResponse = function () { return { base: { integer: instance._count } }; };
      instance.getState = function () { return JSON.stringify({ count: instance._count }); };
      if (configuration.onready) { configuration.onready(instance, instance.getState()); }
      return instance;
    },
  };
  if (ctx) { ctx.register(module); }
  return module;
});
`;

describe("createPciModuleRegistry", () => {
  test("evaluates AMD source and resolves by id and by typeIdentifier", () => {
    const registry = createPciModuleRegistry();

    registry.evaluate(counterSource, { id: "counter" });

    const byId = registry.resolve("counter");
    const byType = registry.resolve("urn:example:pci:counter");

    expect(byId).toBeDefined();
    expect(byType).toBe(byId);
    expect(typeof byId?.getInstance).toBe("function");
  });

  test("resolves AMD dependencies between registered modules", () => {
    const registry = createPciModuleRegistry();

    registry.evaluate(`define([], function () { return { add: function (a, b) { return a + b; } }; });`, {
      id: "mathlib",
    });
    registry.evaluate(
      `define(["mathlib", "qtiCustomInteractionContext"], function (mathlib, ctx) {
        var module = {
          typeIdentifier: "urn:example:pci:adder",
          getInstance: function (dom, configuration, state) {
            return { getResponse: function () { return { base: { integer: mathlib.add(2, 3) } }; } };
          },
        };
        ctx.register(module);
        return module;
      });`,
      { id: "adder" },
    );

    const instance = registry.resolve("adder")!.getInstance({} as never, { properties: {} }, undefined);
    expect(instance?.getResponse()).toEqual({ base: { integer: 5 } });
  });

  test("unknown dependencies fail loudly with the module id", () => {
    const registry = createPciModuleRegistry();

    registry.evaluate(`define(["missing-lib"], function () { return {}; });`, { id: "broken" });

    expect(() => registry.resolve("broken")).toThrow(/missing-lib/);
  });

  test("registerModule registers a prebuilt module directly", () => {
    const registry = createPciModuleRegistry();
    const module = {
      typeIdentifier: "urn:example:pci:direct",
      getInstance: () => undefined,
    };

    registry.registerModule("direct", module);

    expect(registry.resolve("direct")).toBe(module);
    expect(registry.resolve("urn:example:pci:direct")).toBe(module);
  });

  test("load fetches the primary path and falls back on failure", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === "/modules/counter.js") {
          return new Response(counterSource, { headers: { "content-type": "text/javascript" } });
        }

        return new Response("not found", { status: 404 });
      },
    });

    try {
      const registry = createPciModuleRegistry({ baseUrl: `http://localhost:${server.port}/` });
      // The primary path is deliberately wrong — the corpus fractions items do exactly
      // this to demonstrate fallback-path behaviour.
      const module = await registry.load("counter", ["modules/counterXX.js", "modules/counter.js"]);

      expect(module.typeIdentifier).toBe("urn:example:pci:counter");
      expect(registry.resolve("urn:example:pci:counter")).toBe(module);
    } finally {
      await server.stop(true);
    }
  });

  test("load rejects when every candidate fails", async () => {
    const registry = createPciModuleRegistry({
      fetchText: async () => {
        throw new Error("offline");
      },
    });

    let failure: Error | null = null;

    try {
      await registry.load("ghost", ["a.js", "b.js"]);
    } catch (error) {
      failure = error as Error;
    }

    expect(failure?.message).toMatch(/ghost/);
  });

  test("paths config maps module ids to urls (module_resolution.js)", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === "/modules/tap.js") {
          return new Response(counterSource, { headers: { "content-type": "text/javascript" } });
        }

        return new Response("not found", { status: 404 });
      },
    });

    try {
      const registry = createPciModuleRegistry({
        baseUrl: `http://localhost:${server.port}/`,
        paths: { tap: "modules/tap" }, // resolution-config style: extension-less
      });

      const module = await registry.load("tap", []);
      expect(module).toBeDefined();
    } finally {
      await server.stop(true);
    }
  });
});
