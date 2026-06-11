import { z } from "zod";

import { defineInteraction } from "../runtime";
import type { ResponseValue } from "../types";

const gapMatchInteractionNodeSchema = z.object({
  kind: z.literal("gapMatchInteraction"),
  responseIdentifier: z.string().min(1),
  gapTexts: z.array(z.looseObject({ identifier: z.string().min(1), matchMax: z.number().int().optional() })).min(1),
  // Flow content with `kind: "gap"` nodes nested anywhere inside it. Responses are
  // directedPairs gapText→gap.
  content: z.array(z.looseObject({ kind: z.string().min(1) })).min(1),
});

export const gapMatchInteraction = defineInteraction({
  kind: "gapMatchInteraction",
  schema: gapMatchInteractionNodeSchema,
  scoring: "qti-standard",
  initialResponse(): ResponseValue {
    return null;
  },
});
