/**
 * The graphic interaction family: descriptors share the object (stage image) and
 * hotspot (shape/coords) schemas. Coordinates are numbers in image space, normalized
 * upstream from the QTI coords attribute.
 */

import { z } from "zod";

import { defineInteraction } from "../runtime";
import type { ResponseValue } from "../types";

const objectSchema = z.object({
  data: z.string().min(1),
  width: z.number().optional(),
  height: z.number().optional(),
  type: z.string().optional(),
});

const hotspotSchema = z.looseObject({
  identifier: z.string().min(1),
  shape: z.string().min(1),
  coords: z.array(z.number()),
});

function nullInitial(): ResponseValue {
  return null;
}

export const hotspotInteraction = defineInteraction({
  kind: "hotspotInteraction",
  schema: z.object({
    kind: z.literal("hotspotInteraction"),
    responseIdentifier: z.string().min(1),
    object: objectSchema,
    hotspotChoices: z.array(hotspotSchema).min(1),
    maxChoices: z.number().int().optional(),
  }),
  scoring: "qti-standard",
  initialResponse: nullInitial,
});

export const graphicOrderInteraction = defineInteraction({
  kind: "graphicOrderInteraction",
  schema: z.object({
    kind: z.literal("graphicOrderInteraction"),
    responseIdentifier: z.string().min(1),
    object: objectSchema,
    hotspotChoices: z.array(hotspotSchema).min(1),
  }),
  scoring: "qti-standard",
  initialResponse: nullInitial,
});

export const graphicAssociateInteraction = defineInteraction({
  kind: "graphicAssociateInteraction",
  schema: z.object({
    kind: z.literal("graphicAssociateInteraction"),
    responseIdentifier: z.string().min(1),
    object: objectSchema,
    associableHotspots: z.array(hotspotSchema).min(2),
    maxAssociations: z.number().int().optional(),
  }),
  scoring: "qti-standard",
  initialResponse: nullInitial,
});

export const graphicGapMatchInteraction = defineInteraction({
  kind: "graphicGapMatchInteraction",
  schema: z.object({
    kind: z.literal("graphicGapMatchInteraction"),
    responseIdentifier: z.string().min(1),
    object: objectSchema,
    gapImgs: z.array(z.looseObject({ identifier: z.string().min(1), object: objectSchema.optional() })).min(1),
    associableHotspots: z.array(hotspotSchema).min(1),
  }),
  scoring: "qti-standard",
  initialResponse: nullInitial,
});

export const selectPointInteraction = defineInteraction({
  kind: "selectPointInteraction",
  schema: z.object({
    kind: z.literal("selectPointInteraction"),
    responseIdentifier: z.string().min(1),
    object: objectSchema,
    maxChoices: z.number().int().optional(),
  }),
  scoring: "qti-standard",
  initialResponse: nullInitial,
});

/** The common single-interaction stage; multi-interaction stages fail validation. */
export const positionObjectStage = defineInteraction({
  kind: "positionObjectStage",
  schema: z.object({
    kind: z.literal("positionObjectStage"),
    responseIdentifier: z.string().min(1),
    stageObject: objectSchema,
    object: objectSchema,
    maxChoices: z.number().int().optional(),
  }),
  scoring: "qti-standard",
  initialResponse: nullInitial,
});
