/**
 * Package module loading (ADR-0012, BACKLOG #4): a self-contained package's PCI modules
 * become a hash-pinned catalog. `module_resolution.js` is parsed as *data* (never
 * executed); package-local modules are integrity-pinned to bytes computed from the
 * package file map; absolute-URL and not-shipped modules are omitted (default-deny).
 */

import { describe, expect, test } from "bun:test";

import { createPackagePciCatalog, createPciModuleRegistry, parsePciModuleResolution } from "../src/pci";

const counterSource = `
define(["qtiCustomInteractionContext"], function (ctx) {
  var module = {
    typeIdentifier: "urn:example:pci:counter",
    getInstance: function (dom, configuration, state) {
      return { getResponse: function () { return { base: { integer: 0 } }; } };
    },
  };
  ctx.register(module);
  return module;
});
`;

const encoder = new TextEncoder();
const bytes = (text: string): Uint8Array => encoder.encode(text);

/** Resolve to the error a promise rejects with (the repo's rejection-assertion idiom). */
async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }

  throw new Error("expected the promise to reject, but it resolved");
}

describe("parsePciModuleResolution", () => {
  test("parses the 1EdTech pure-JSON form", () => {
    const source = `{ "waitSeconds": 60, "paths": { "tap": "modules/tap", "jquery": "https://cdn/jquery" } }`;

    expect(parsePciModuleResolution(source)).toEqual({ tap: "modules/tap", jquery: "https://cdn/jquery" });
  });

  test("parses the `var require = {…}` RequireJS wrapper", () => {
    const source = `var require = { "paths": { "tap": "modules/tap" } };`;

    expect(parsePciModuleResolution(source)).toEqual({ tap: "modules/tap" });
  });

  test("parses the `require.config({…})` wrapper", () => {
    const source = `require.config({ "paths": { "tap": "modules/tap" } });`;

    expect(parsePciModuleResolution(source)).toEqual({ tap: "modules/tap" });
  });

  test("returns an empty map for a config without paths or a non-JSON (unquoted-key) literal", () => {
    expect(parsePciModuleResolution(`{ "waitSeconds": 60 }`)).toEqual({});
    expect(parsePciModuleResolution(`var require = { paths: { tap: "modules/tap" } };`)).toEqual({});
    expect(parsePciModuleResolution(`not a config at all`)).toEqual({});
  });
});

describe("createPackagePciCatalog", () => {
  test("pins package-local modules and resolves them through a registry", async () => {
    const files = {
      "modules/module_resolution.js": bytes(`{ "paths": { "counter": "modules/counter" } }`),
      "modules/counter.js": bytes(counterSource),
      "measuring.xml": bytes("<qti-assessment-item/>"),
    };

    const catalog = await createPackagePciCatalog(files);

    expect(catalog.has("counter")).toBe(true);
    expect(catalog.paths["counter"]).toBe("modules/counter.js");

    const registry = createPciModuleRegistry({ paths: catalog.paths, fetchText: catalog.fetchText });

    expect((await registry.load("counter", [])).typeIdentifier).toBe("urn:example:pci:counter");
  });

  test("omits absolute-URL modules (a package hosts widgets, not internet trust)", async () => {
    const files = {
      "module_resolution.js": bytes(`{ "paths": { "counter": "modules/counter", "jquery": "https://cdn/jquery" } }`),
      "modules/counter.js": bytes(counterSource),
    };

    const catalog = await createPackagePciCatalog(files);

    expect(catalog.has("counter")).toBe(true);
    expect(catalog.has("jquery")).toBe(false);
    expect(Object.keys(catalog.paths)).toEqual(["counter"]);
  });

  test("omits a module the package declares but does not ship", async () => {
    const files = {
      "module_resolution.js": bytes(`{ "paths": { "counter": "modules/counter", "ghost": "modules/ghost" } }`),
      "modules/counter.js": bytes(counterSource),
    };

    const catalog = await createPackagePciCatalog(files);

    expect(catalog.has("counter")).toBe(true);
    expect(catalog.has("ghost")).toBe(false);
  });

  test("default-denies a package file that module_resolution.js did not declare", async () => {
    const catalog = await createPackagePciCatalog({
      "module_resolution.js": bytes(`{ "paths": { "counter": "modules/counter" } }`),
      "modules/counter.js": bytes(counterSource),
      // Present in the package, but never declared as a module — must not be loadable.
      "modules/sneaky.js": bytes(counterSource),
    });

    expect(await catalog.fetchText("modules/counter.js")).toContain("urn:example:pci:counter");

    const error = await rejection(catalog.fetchText("modules/sneaky.js"));
    expect(error.message).toMatch(/not in the hash-pinned catalog/u);
  });
});
