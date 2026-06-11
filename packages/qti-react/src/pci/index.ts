// PCI (IMS Portable Custom Interactions v1) support. Opt-in by design: PCI executes
// item-supplied JavaScript, so nothing here is part of qtiCoreInteractions — consumers
// add the descriptor and a created skin explicitly (ADR-0003: no silent capability).

export { pciResponseToValue, valueToPciResponse } from "./response";

export {
  createPciModuleRegistry,
  type PciConfiguration,
  type PciInstance,
  type PciModule,
  type PciModuleRegistry,
  type PciModuleRegistryOptions,
} from "./registry";

export { serializePciMarkup } from "./markup";

export { mountPci, type PciInteractionNode, type PciMountHandle, type PciMountOptions } from "./mount";

export { portableCustomInteraction } from "./interaction";

export { createPciSkin, type PciSkinOptions } from "./skin";
