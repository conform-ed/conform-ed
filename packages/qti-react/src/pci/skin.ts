/**
 * The PCI host skin: a thin React wrapper over `mountPci`. It renders the container,
 * mounts the module instance after first paint, registers a submit-time response
 * collector with the attempt store, and tears the instance down on unmount. Module
 * failures render an explicit error note — never a silent drop (ADR-0003).
 */

import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { InteractionRenderProps, InteractionSkin } from "../runtime";

import { mountPci, type PciInteractionNode, type PciMountHandle } from "./mount";
import type { PciModuleRegistry } from "./registry";

export interface PciSkinOptions {
  readonly registry: PciModuleRegistry;
}

export function createPciSkin(options: PciSkinOptions): InteractionSkin {
  return function PciHost(props: InteractionRenderProps): ReactNode {
    const node = props.node as unknown as PciInteractionNode;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const handleRef = useRef<PciMountHandle | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;

    const [mountError, setMountError] = useState<string | null>(null);

    useEffect(() => {
      const container = containerRef.current;

      if (!container) {
        return undefined;
      }

      let cancelled = false;
      let mounted: PciMountHandle | null = null;

      mountPci({
        container,
        node: propsRef.current.node as unknown as PciInteractionNode,
        registry: options.registry,
        ondone: (value) => propsRef.current.setValue(value),
      })
        .then((handle) => {
          if (cancelled) {
            handle.unmount();
            return;
          }

          mounted = handle;
          handleRef.current = handle;
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setMountError(error instanceof Error ? error.message : String(error));
          }
        });

      return () => {
        cancelled = true;
        mounted?.unmount();
        handleRef.current = null;
      };
    }, []);

    // The attempt store pulls the instance's response at submit time.
    useEffect(() => propsRef.current.registerResponseCollector(() => handleRef.current?.collectResponse()), []);

    return createElement(
      "div",
      {
        "data-qti-interaction": "portableCustomInteraction",
        "data-qti-pci-type": node.customInteractionTypeIdentifier,
        className: node.class?.join(" "),
      },
      createElement("div", { ref: containerRef, "data-qti-pci-container": "" }),
      mountError !== null
        ? createElement(
            "p",
            { role: "note", "data-qti-pci-error": "" },
            `Custom interaction failed to load: ${mountError}`,
          )
        : null,
    );
  };
}
