import { z } from "zod";

import { defineInteraction } from "../runtime";
import type { ResponseValue } from "../types";

const extendedTextInteractionNodeSchema = z.object({
  kind: z.literal("extendedTextInteraction"),
  responseIdentifier: z.string().min(1),
  expectedLength: z.number().int().optional(),
  expectedLines: z.number().int().optional(),
  placeholderText: z.string().optional(),
});

export const extendedTextInteraction = defineInteraction({
  kind: "extendedTextInteraction",
  schema: extendedTextInteractionNodeSchema,
  scoring: "qti-standard",
  initialResponse(): ResponseValue {
    return null;
  },
});
