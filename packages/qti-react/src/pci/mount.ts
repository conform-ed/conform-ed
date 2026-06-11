/**
 * The PCI mount lifecycle, framework-free (the React skin is a thin wrapper): resolve
 * the module through the registry (declared interaction modules with primary →
 * fallback paths, then the bare `module` name), inject the serialized markup, call
 * `getInstance(dom, configuration, state)`, and hand back a handle the host uses to
 * collect the response at submit time and to tear the instance down.
 */

import type { BodyNode } from "../runtime";
import type { ResponseDeclarationView, ResponseValue } from "../types";

import { serializePciMarkup } from "./markup";
import type { PciConfiguration, PciInstance, PciModule, PciModuleRegistry } from "./registry";
import { pciResponseToValue, valueToPciResponse } from "./response";

/** The adapter's shape for a `portableCustomInteraction` body node. */
export interface PciInteractionNode {
  readonly kind: "portableCustomInteraction";
  readonly responseIdentifier: string;
  readonly customInteractionTypeIdentifier: string;
  readonly module?: string;
  readonly class?: readonly string[];
  readonly properties?: Readonly<Record<string, string>>;
  readonly interactionMarkup?: { readonly content?: ReadonlyArray<BodyNode | string> };
  readonly interactionModules?: {
    readonly primaryConfiguration?: string;
    readonly modules?: ReadonlyArray<{
      readonly id: string;
      readonly primaryPath?: string;
      readonly fallbackPath?: string;
    }>;
  };
}

export interface PciMountOptions {
  readonly container: Element;
  readonly node: PciInteractionNode;
  readonly registry: PciModuleRegistry;
  /** The bound response variable's declaration and current value (for `boundTo`). */
  readonly declaration?: ResponseDeclarationView;
  readonly boundValue?: ResponseValue;
  /** A state string from a previous instance's getState() (session restore). */
  readonly state?: string;
  /** PCI `ondone`: the instance finished on its own and reports its response. */
  readonly ondone?: (value: ResponseValue, state?: string) => void;
}

export interface PciMountHandle {
  readonly instance: PciInstance;
  /** The instance's current response as a runtime ResponseValue. */
  readonly collectResponse: () => ResponseValue | undefined;
  readonly getState: () => string | undefined;
  readonly unmount: () => void;
}

async function resolveModule(node: PciInteractionNode, registry: PciModuleRegistry): Promise<PciModule> {
  const preRegistered =
    registry.resolve(node.customInteractionTypeIdentifier) ??
    (node.module !== undefined ? registry.resolve(node.module) : undefined);

  if (preRegistered) {
    return preRegistered;
  }

  const declared = node.interactionModules?.modules ?? [];

  for (const entry of declared) {
    const candidates = [entry.primaryPath, entry.fallbackPath].filter(
      (candidate): candidate is string => candidate !== undefined,
    );

    await registry.load(entry.id, candidates);
  }

  if (declared.length === 0 && node.module !== undefined) {
    await registry.load(node.module, []);
  }

  const loaded =
    registry.resolve(node.customInteractionTypeIdentifier) ??
    (node.module !== undefined ? registry.resolve(node.module) : undefined) ??
    (declared.length === 1 ? registry.resolve(declared[0]!.id) : undefined);

  if (!loaded) {
    throw new Error(`No PCI module registered for "${node.customInteractionTypeIdentifier}".`);
  }

  return loaded;
}

export async function mountPci(options: PciMountOptions): Promise<PciMountHandle> {
  const { container, node, registry } = options;
  const module = await resolveModule(node, registry);

  const markupHost = container.ownerDocument!.createElement("div");
  markupHost.className = "qti-interaction-markup";
  markupHost.innerHTML = serializePciMarkup(node.interactionMarkup?.content);
  container.appendChild(markupHost);

  let resolveReady!: (instance: PciInstance) => void;
  const ready = new Promise<PciInstance>((resolve) => {
    resolveReady = resolve;
  });

  const configuration: PciConfiguration = {
    properties: node.properties ?? {},
    responseIdentifier: node.responseIdentifier,
    ...(options.declaration
      ? { boundTo: { [node.responseIdentifier]: valueToPciResponse(options.boundValue ?? null, options.declaration) } }
      : {}),
    status: "interacting",
    onready: (instance) => resolveReady(instance),
    ondone: (instance, response, state) => options.ondone?.(pciResponseToValue(response), state),
  };

  // The spec delivers the instance via onready; implementations commonly also return
  // it from getInstance. Accept either, first one wins.
  const returned = module.getInstance(container, configuration, options.state);

  if (returned) {
    resolveReady(returned);
  }

  const instance = await ready;

  return {
    instance,
    collectResponse: () => pciResponseToValue(instance.getResponse()),
    getState: () => instance.getState?.(),
    unmount: () => {
      instance.oncompleted?.();
      container.replaceChildren();
    },
  };
}
