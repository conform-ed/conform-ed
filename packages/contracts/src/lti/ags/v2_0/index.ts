export * from "../../shared";

import { z } from "zod";

import { NonEmptyStringSchema, UrlSchema, strictObject } from "../../shared";

export const AgsScopeSchema = z.enum([
  "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
  "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
  "https://purl.imsglobal.org/spec/lti-ags/scope/score",
]);

export const EndpointSchema = strictObject({
  scope: z.array(AgsScopeSchema).min(1),
  lineitems: UrlSchema,
  lineitem: UrlSchema.optional(),
});

export const LineItemSchema = strictObject({
  id: UrlSchema.optional(),
  label: NonEmptyStringSchema,
  scoreMaximum: z.number().nonnegative(),
  resourceId: NonEmptyStringSchema.optional(),
  resourceLinkId: NonEmptyStringSchema.optional(),
  tag: NonEmptyStringSchema.optional(),
  startDateTime: z.iso.datetime().optional(),
  endDateTime: z.iso.datetime().optional(),
  gradesReleased: z.boolean().optional(),
});

export const ScoreProgressSchema = z.enum(["Completed", "InProgress", "Initialized", "Submitted", "Started"]);
export const GradingProgressSchema = z.enum(["Failed", "FullyGraded", "NotReady", "Pending", "PendingManual"]);

export const ScoreSubmissionSchema = strictObject({
  startedAt: z.iso.datetime().optional(),
  submittedAt: z.iso.datetime().optional(),
});

export const ScoreSchema = strictObject({
  userId: NonEmptyStringSchema,
  scoreGiven: z.number().optional(),
  scoreMaximum: z.number().optional(),
  activityProgress: ScoreProgressSchema.optional(),
  gradingProgress: GradingProgressSchema.optional(),
  timestamp: z.iso.datetime().optional(),
  submission: ScoreSubmissionSchema.optional(),
  comment: z.string().optional(),
  scorePublished: z.boolean().optional(),
});

export const ResultSchema = strictObject({
  id: UrlSchema.optional(),
  scoreOf: UrlSchema.optional(),
  userId: NonEmptyStringSchema,
  resultScore: z.number().optional(),
  resultMaximum: z.number().optional(),
  scoringUserId: NonEmptyStringSchema.optional(),
  comment: z.string().optional(),
});

// The AGS container media types (`application/vnd.ims.lis.v2.lineitemcontainer+json`,
// `application/vnd.ims.lis.v2.resultcontainer+json`) are simply paged arrays of the
// item resources — no envelope object. Modelled as arrays so the Coverage Map's
// lineitemcontainer/resultcontainer bindings reconcile (conform-ed ADR-0013).
export const LineItemContainerSchema = z.array(LineItemSchema);
export const ResultContainerSchema = z.array(ResultSchema);

export const LtiAgsV2_0 = {
  Schemas: {
    Endpoint: EndpointSchema,
    LineItem: LineItemSchema,
    LineItemContainer: LineItemContainerSchema,
    Score: ScoreSchema,
    ScoreSubmission: ScoreSubmissionSchema,
    Result: ResultSchema,
    ResultContainer: ResultContainerSchema,
    AgsScope: AgsScopeSchema,
    ScoreProgress: ScoreProgressSchema,
    GradingProgress: GradingProgressSchema,
  },
} as const;

export type LtiAgsV2_0Schemas = typeof LtiAgsV2_0.Schemas;

export const LtiAgsV2_0DerivedZodTemplates = {
  description: "LTI AGS v2.0 Zod schemas for normalized endpoint, line item, score, and result objects",
  specLinks: {
    main: "https://www.imsglobal.org/spec/lti-ags/v2p0/",
  },
  scope: "Assignment and Grade Services endpoint, line item, score, and result payloads",
  claims: ["endpoint"],
  notes: [
    "The endpoint claim is modeled in normalized camelCase form with explicit scope validation.",
    "Score and result payloads are strict JSON objects suitable for adapter/reference app contracts.",
  ],
} as const;
// Inferred types from exported Zod validators.
export type AgsScope = z.infer<typeof AgsScopeSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type ScoreProgress = z.infer<typeof ScoreProgressSchema>;
export type GradingProgress = z.infer<typeof GradingProgressSchema>;
export type ScoreSubmission = z.infer<typeof ScoreSubmissionSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type LineItemContainer = z.infer<typeof LineItemContainerSchema>;
export type ResultContainer = z.infer<typeof ResultContainerSchema>;
