import { z } from "zod";

import { defineInteraction } from "../runtime";
import type { ResponseValue } from "../types";

const associateInteractionNodeSchema = z.object({
  kind: z.literal("associateInteraction"),
  responseIdentifier: z.string().min(1),
  simpleAssociableChoices: z
    .array(z.looseObject({ identifier: z.string().min(1), matchMax: z.number().int().optional() }))
    .min(2),
  maxAssociations: z.number().int().optional(),
});

export const associateInteraction = defineInteraction({
  kind: "associateInteraction",
  schema: associateInteractionNodeSchema,
  scoring: "qti-standard",
  initialResponse(): ResponseValue {
    return null;
  },
});
