/**
 * The hash-pinned PCI catalog: a policy wrapper over the registry's `paths` +
 * `fetchText` seam. It allowlists module ids to vetted URLs (default-deny) and verifies
 * each fetched module's sha256 against the pinned integrity before the registry may
 * evaluate it — turning "evaluate whatever the content points at" into an explicit,
 * verifiable publishing decision (ADR-0012).
 */

import { describe, expect, test } from "bun:test";

import { createPciCatalog, createPciModuleRegistry } from "../src/pci";

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

function bytesOf(source: string): Uint8Array {
  return encoder.encode(source);
}

async function hexDigest(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));

  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sriDigest(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));

  return `sha256-${btoa(String.fromCharCode(...digest))}`;
}

/** Resolve to the error a promise rejects with (the repo's rejection-assertion idiom). */
async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }

  throw new Error("expected the promise to reject, but it resolved");
}

/** A `fetchBytes` that serves a fixed in-memory map (no network) — what a consumer injects. */
function serveFrom(map: Readonly<Record<string, Uint8Array>>): (url: string) => Promise<Uint8Array> {
  return async (url) => {
    const bytes = map[url];

    if (!bytes) {
      throw new Error(`unexpected fetch for ${url}`);
    }

    return bytes;
  };
}

const counterUrl = "https://cdn.example.test/modules/counter.js";

describe("createPciCatalog", () => {
  test("exposes paths + has for vetted module ids", async () => {
    const bytes = bytesOf(counterSource);
    const catalog = createPciCatalog({
      entries: { counter: { url: counterUrl, integrity: await hexDigest(bytes) } },
      fetchBytes: serveFrom({ [counterUrl]: bytes }),
    });

    expect(catalog.paths).toEqual({ counter: counterUrl });
    expect(catalog.has("counter")).toBe(true);
    expect(catalog.has("not-vetted")).toBe(false);
  });

  test("a vetted module loads through the registry when its integrity matches", async () => {
    const bytes = bytesOf(counterSource);
    const catalog = createPciCatalog({
      entries: { counter: { url: counterUrl, integrity: await hexDigest(bytes) } },
      fetchBytes: serveFrom({ [counterUrl]: bytes }),
    });

    const registry = createPciModuleRegistry({ paths: catalog.paths, fetchText: catalog.fetchText });
    const module = await registry.load("counter", []);

    expect(module.typeIdentifier).toBe("urn:example:pci:counter");
  });

  test("accepts the SRI `sha256-<base64>` integrity form", async () => {
    const bytes = bytesOf(counterSource);
    const catalog = createPciCatalog({
      entries: { counter: { url: counterUrl, integrity: await sriDigest(bytes) } },
      fetchBytes: serveFrom({ [counterUrl]: bytes }),
    });

    const registry = createPciModuleRegistry({ paths: catalog.paths, fetchText: catalog.fetchText });

    expect((await registry.load("counter", [])).typeIdentifier).toBe("urn:example:pci:counter");
  });

  test("default-denies a URL no catalog entry vetted (loud refusal, never blind-eval)", async () => {
    const bytes = bytesOf(counterSource);
    const catalog = createPciCatalog({
      entries: { counter: { url: counterUrl, integrity: await hexDigest(bytes) } },
      fetchBytes: serveFrom({ [counterUrl]: bytes }),
    });

    const error = await rejection(catalog.fetchText("https://evil.example.test/inject.js"));
    expect(error.message).toMatch(/not in the hash-pinned catalog/u);
  });

  test("fails closed when the fetched source does not match the pinned integrity", async () => {
    const tampered = bytesOf(`${counterSource}\n/* injected */`);
    const catalog = createPciCatalog({
      // Pin the hash of the honest source, but serve a tampered body.
      entries: { counter: { url: counterUrl, integrity: await hexDigest(bytesOf(counterSource)) } },
      fetchBytes: serveFrom({ [counterUrl]: tampered }),
    });

    const registry = createPciModuleRegistry({ paths: catalog.paths, fetchText: catalog.fetchText });

    const error = await rejection(registry.load("counter", []));
    expect(error.message).toMatch(/integrity check/u);
  });

  test("a signed URL with a query string round-trips verbatim (toUrl leaves it complete)", async () => {
    const signedUrl = "https://storage.example.test/object/sign/pci/counter?token=abc.def";
    const bytes = bytesOf(counterSource);
    const catalog = createPciCatalog({
      entries: { counter: { url: signedUrl, integrity: await hexDigest(bytes) } },
      fetchBytes: serveFrom({ [signedUrl]: bytes }),
    });

    const registry = createPciModuleRegistry({ paths: catalog.paths, fetchText: catalog.fetchText });

    expect((await registry.load("counter", [])).typeIdentifier).toBe("urn:example:pci:counter");
  });
});
