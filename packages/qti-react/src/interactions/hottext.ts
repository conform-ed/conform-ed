import { z } from "zod";

import { defineInteraction } from "../runtime";
import type { ResponseValue } from "../types";

const hottextInteractionNodeSchema = z.object({
  kind: z.literal("hottextInteraction"),
  responseIdentifier: z.string().min(1),
  maxChoices: z.number().int().optional(),
  // Flow content with `kind: "hottext"` nodes nested anywhere inside it.
  content: z.array(z.looseObject({ kind: z.string().min(1) })).min(1),
});

export const hottextInteraction = defineInteraction({
  kind: "hottextInteraction",
  schema: hottextInteractionNodeSchema,
  scoring: "qti-standard",
  initialResponse(): ResponseValue {
    return null;
  },
});
