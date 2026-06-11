import { z } from "zod";

import { defineInteraction } from "../runtime";
import type { ResponseValue } from "../types";

const simpleMatchSetSchema = z.object({
  simpleAssociableChoices: z
    .array(z.looseObject({ identifier: z.string().min(1), matchMax: z.number().int().optional() }))
    .min(1),
});

const matchInteractionNodeSchema = z.object({
  kind: z.literal("matchInteraction"),
  responseIdentifier: z.string().min(1),
  // QTI: exactly two match sets; responses are directedPairs source→target.
  simpleMatchSets: z.array(simpleMatchSetSchema).length(2),
  maxAssociations: z.number().int().optional(),
});

export const matchInteraction = defineInteraction({
  kind: "matchInteraction",
  schema: matchInteractionNodeSchema,
  scoring: "qti-standard",
  initialResponse(): ResponseValue {
    return null;
  },
});
