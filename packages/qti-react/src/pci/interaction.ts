import { z } from "zod";

import { defineInteraction } from "../runtime";
import type { ResponseValue } from "../types";

const interactionModuleSchema = z.object({
  id: z.string().min(1),
  primaryPath: z.string().optional(),
  fallbackPath: z.string().optional(),
});

const pciNodeSchema = z.object({
  kind: z.literal("portableCustomInteraction"),
  responseIdentifier: z.string().min(1),
  customInteractionTypeIdentifier: z.string().min(1),
  module: z.string().optional(),
  properties: z.record(z.string(), z.string()).optional(),
  // Markup is module-owned and deliberately opaque to the content model.
  interactionMarkup: z.object({ content: z.array(z.unknown()).optional() }).optional(),
  interactionModules: z
    .object({
      primaryConfiguration: z.string().optional(),
      secondaryConfiguration: z.string().optional(),
      modules: z.array(interactionModuleSchema).optional(),
    })
    .optional(),
});

/**
 * The PCI interaction descriptor. Deliberately NOT part of `qtiCoreInteractions`:
 * delivering a PCI executes item-supplied JavaScript, so consumers opt in by adding
 * this descriptor plus a skin from `createPciSkin` (ADR-0003 — the capability gate
 * keeps PCI items undeliverable until then).
 */
export const portableCustomInteraction = defineInteraction({
  kind: "portableCustomInteraction",
  schema: pciNodeSchema,
  scoring: "qti-standard",
  initialResponse(): ResponseValue {
    return null;
  },
});
