/**
 * PCI against the real corpus (runs only with tmp/qti-examples checked out): the
 * pci-simple measuring_ph item normalizes, adapts, passes the capability gate of a
 * PCI-enabled runtime, and its actual tap.js module (HMH, Apache-2.0) loads through
 * the registry and runs the full getInstance → interact → getResponse lifecycle.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { validateQtiXmlFile } from "@conform-ed/qti-xml";

import { qtiCoreInteractions } from "../src/interactions";
import { assessmentItemViewFromNormalized } from "../src/normalized-item";
import { createPciModuleRegistry, createPciSkin, mountPci, portableCustomInteraction } from "../src/pci";
import type { PciInteractionNode } from "../src/pci";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type BodyNode } from "../src/runtime";

const corpusRoot = fileURLToPath(new URL("../../../tmp/qti-examples", import.meta.url));
const packageRoot = path.join(corpusRoot, "qtiv3-examples/packaging/pci-simple/src");
const corpusTest = existsSync(packageRoot) ? test : test.skip;

function findPciNode(nodes: readonly BodyNode[] | undefined): PciInteractionNode | null {
  for (const node of nodes ?? []) {
    if (node.kind === "portableCustomInteraction") {
      return node as unknown as PciInteractionNode;
    }

    const children = (node as { children?: readonly BodyNode[] }).children;
    const found = findPciNode(children);

    if (found) {
      return found;
    }
  }

  return null;
}

corpusTest("measuring_ph delivers and its real tap.js module runs the PCI lifecycle", async () => {
  const result = await validateQtiXmlFile(path.join(packageRoot, "measuring_ph.xml"));
  expect(result.status).toBe("valid");

  const item = assessmentItemViewFromNormalized(result.normalizedDocument)!;
  expect(item).not.toBeNull();

  const registry = createPciModuleRegistry();
  const runtime = createQtiRuntime({
    interactions: [...qtiCoreInteractions, portableCustomInteraction],
    skin: { ...referenceSkin, portableCustomInteraction: createPciSkin({ registry }) },
  });

  expect(runtime.canDeliver(item).issues).toEqual([]);

  const pciNode = findPciNode(item.itemBody.content)!;
  expect(pciNode).not.toBeNull();
  expect(pciNode.module).toBe("tap");
  expect(pciNode.properties).toMatchObject({ toggle: "true" });

  // Load the package's actual module file, as a package loader would (the package's
  // module_resolution.js maps "tap" → "modules/tap").
  registry.evaluate(await readFile(path.join(packageRoot, "modules/tap.js"), "utf8"), { id: "tap" });

  // tap.js touches the global document at instance time (style injection).
  const window = new Window();
  const previousDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = window.document;

  try {
    const container = window.document.createElement("div");
    window.document.body.appendChild(container);

    const handle = await mountPci({ container: container as unknown as Element, node: pciNode, registry });

    expect(handle.instance.typeIdentifier).toBe("urn:fdc:hmhco.com:pci:tapToReveal");
    expect(container.querySelectorAll("button.hmh-tap-image").length).toBe(3);
    expect(handle.collectResponse()).toBe("0"); // numReveals starts at zero

    (container.querySelector("button.hmh-tap-image") as unknown as { click: () => void }).click();
    expect(handle.collectResponse()).toBe("1");

    handle.unmount();
  } finally {
    (globalThis as { document?: unknown }).document = previousDocument;
  }
});
