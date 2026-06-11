import { z } from "zod";

import { defineInteraction } from "../runtime";
import type { ResponseValue } from "../types";

const orderInteractionNodeSchema = z.object({
  kind: z.literal("orderInteraction"),
  responseIdentifier: z.string().min(1),
  simpleChoices: z.array(z.looseObject({ identifier: z.string().min(1) })).min(1),
  shuffle: z.boolean().optional(),
  orientation: z.enum(["horizontal", "vertical"]).optional(),
});

export const orderInteraction = defineInteraction({
  kind: "orderInteraction",
  schema: orderInteractionNodeSchema,
  scoring: "qti-standard",
  initialResponse(): ResponseValue {
    return null;
  },
});
