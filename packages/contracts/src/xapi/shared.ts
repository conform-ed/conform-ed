import { z } from "zod";

export function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

const UriSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:.+$/u);

export const NonEmptyStringSchema = z.string().min(1);
export const UuidSchema = z.string().uuid();
export const UriSchemaStrict = UriSchema;
export const IriSchema = UriSchema;
export const MediaTypeSchema = z.string().min(1);
export const LanguageTagSchema = z.string().regex(/^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/u);
export const XapiVersionSchema = z.string().regex(/^\d+\.\d+(?:\.\d+)?$/u);
export const Iso8601TimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((v) => !v.endsWith("-00:00"), {
    message: "Negative zero offset (-00:00) is not a valid xAPI timestamp",
  });
export const Iso8601DurationSchema = z
  .string()
  .regex(/^P(?=.)(?:(\d+W)|(?:(\d+Y)?(\d+M)?(\d+D)?(?:T(?=\d)(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?))$/u);

export const LanguageMapSchema = z.record(LanguageTagSchema, z.string());
export const ExtensionsSchema = z.record(UriSchema, z.unknown());
export const AttachmentSha2Schema = z.string().regex(/^[A-Fa-f0-9]{64}$/u);

export const AgentAccountSchema = strictObject({
  homePage: UriSchema,
  name: NonEmptyStringSchema,
});

function hasDefined(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export const AgentSchema = strictObject({
  objectType: z.literal("Agent").optional(),
  name: NonEmptyStringSchema.optional(),
  mbox: z
    .string()
    .regex(/^mailto:.+@.+$/u)
    .optional(),
  mbox_sha1sum: z
    .string()
    .regex(/^[A-Fa-f0-9]{40}$/u)
    .optional(),
  openid: UriSchema.optional(),
  account: AgentAccountSchema.optional(),
}).superRefine((value, ctx) => {
  const ifiCount = [value.mbox, value.mbox_sha1sum, value.openid, value.account].filter(hasDefined).length;
  if (ifiCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "An xAPI Agent requires exactly one Inverse Functional Identifier (mbox, mbox_sha1sum, openid, or account)",
    });
  }
});

export const GroupSchema = strictObject({
  objectType: z.literal("Group").optional(),
  name: NonEmptyStringSchema.optional(),
  mbox: z
    .string()
    .regex(/^mailto:.+@.+$/u)
    .optional(),
  mbox_sha1sum: z
    .string()
    .regex(/^[A-Fa-f0-9]{40}$/u)
    .optional(),
  openid: UriSchema.optional(),
  account: AgentAccountSchema.optional(),
  member: z.array(AgentSchema).min(1).optional(),
}).superRefine((value, ctx) => {
  const ifiCount = [value.mbox, value.mbox_sha1sum, value.openid, value.account].filter(hasDefined).length;
  if (ifiCount > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "An identified xAPI Group MUST have exactly one Inverse Functional Identifier",
    });
  }
  if (ifiCount === 0 && !hasDefined(value.member)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "An anonymous xAPI Group requires a member list",
    });
  }
});

export const PersonSchema = strictObject({
  objectType: z.literal("Person"),
  name: z.array(NonEmptyStringSchema).min(1).optional(),
  mbox: z
    .array(z.string().regex(/^mailto:.+@.+$/u))
    .min(1)
    .optional(),
  mbox_sha1sum: z
    .array(z.string().regex(/^[A-Fa-f0-9]{40}$/u))
    .min(1)
    .optional(),
  openid: z.array(UriSchema).min(1).optional(),
  account: z.array(AgentAccountSchema).min(1).optional(),
}).refine(
  (value) =>
    hasNonEmptyArray(value.name) ||
    hasNonEmptyArray(value.mbox) ||
    hasNonEmptyArray(value.mbox_sha1sum) ||
    hasNonEmptyArray(value.openid) ||
    hasNonEmptyArray(value.account),
  {
    message: "An xAPI Person requires at least one populated identifier or name array",
  },
);

export const VerbSchema = strictObject({
  id: IriSchema,
  display: LanguageMapSchema.optional(),
});

export const InteractionTypeSchema = z.enum([
  "true-false",
  "choice",
  "fill-in",
  "long-fill-in",
  "matching",
  "performance",
  "sequencing",
  "likert",
  "numeric",
  "other",
]);

export const InteractionComponentSchema = strictObject({
  id: NonEmptyStringSchema,
  description: LanguageMapSchema.optional(),
});

const interactionSubProperties = ["correctResponsesPattern", "choices", "scale", "source", "target", "steps"] as const;

export const ActivityDefinitionSchema = strictObject({
  name: LanguageMapSchema.optional(),
  description: LanguageMapSchema.optional(),
  type: IriSchema.optional(),
  moreInfo: IriSchema.optional(),
  interactionType: InteractionTypeSchema.optional(),
  correctResponsesPattern: z.array(NonEmptyStringSchema).min(1).optional(),
  choices: z.array(InteractionComponentSchema).min(1).optional(),
  scale: z.array(InteractionComponentSchema).min(1).optional(),
  source: z.array(InteractionComponentSchema).min(1).optional(),
  target: z.array(InteractionComponentSchema).min(1).optional(),
  steps: z.array(InteractionComponentSchema).min(1).optional(),
  extensions: ExtensionsSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.interactionType !== undefined) return;
  for (const prop of interactionSubProperties) {
    if (value[prop] !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Activity definition property '${prop}' requires interactionType to be set`,
        path: [prop],
      });
    }
  }
});

export const ActivitySchema = strictObject({
  objectType: z.literal("Activity").optional(),
  id: IriSchema,
  definition: ActivityDefinitionSchema.optional(),
});

export const StatementRefSchema = strictObject({
  objectType: z.literal("StatementRef"),
  id: UuidSchema,
});

export const ScoreSchema = strictObject({
  scaled: z.number().min(-1).max(1).optional(),
  raw: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
}).superRefine((value, ctx) => {
  const { min, max, raw } = value;
  if (min !== undefined && max !== undefined && min >= max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Score max must be greater than min",
      path: ["max"],
    });
  }
  if (raw !== undefined && min !== undefined && raw < min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Score raw must be greater than or equal to min",
      path: ["raw"],
    });
  }
  if (raw !== undefined && max !== undefined && raw > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Score raw must be less than or equal to max",
      path: ["raw"],
    });
  }
});

export const ResultSchema = strictObject({
  score: ScoreSchema.optional(),
  success: z.boolean().optional(),
  completion: z.boolean().optional(),
  response: z.string().optional(),
  duration: Iso8601DurationSchema.optional(),
  extensions: ExtensionsSchema.optional(),
});

export const ContextActivitiesSchema = strictObject({
  parent: z.array(ActivitySchema).min(1).optional(),
  category: z.array(ActivitySchema).min(1).optional(),
  grouping: z.array(ActivitySchema).min(1).optional(),
  other: z.array(ActivitySchema).min(1).optional(),
});

export const ContextSchema = strictObject({
  registration: UuidSchema.optional(),
  instructor: z.union([AgentSchema, GroupSchema]).optional(),
  team: GroupSchema.optional(),
  contextActivities: ContextActivitiesSchema.optional(),
  revision: NonEmptyStringSchema.optional(),
  platform: NonEmptyStringSchema.optional(),
  language: LanguageTagSchema.optional(),
  statement: StatementRefSchema.optional(),
  extensions: ExtensionsSchema.optional(),
});

export const AttachmentSchema = strictObject({
  usageType: IriSchema,
  display: LanguageMapSchema,
  description: LanguageMapSchema.optional(),
  contentType: MediaTypeSchema,
  length: z.number().int().nonnegative(),
  sha2: AttachmentSha2Schema,
  fileUrl: z.url().optional(),
  contentBase64: z.string().optional(),
});

export const XapiDocumentSchema = strictObject({
  contentType: MediaTypeSchema,
  body: z.unknown(),
  etag: NonEmptyStringSchema.optional(),
  lastModified: Iso8601TimestampSchema.optional(),
});

export const StatementSubmissionSchema = z.union([
  z.lazy(() => StatementSchema),
  z.array(z.lazy(() => StatementSchema)).min(1),
]);

export const AboutResourceSchema = strictObject({
  version: z.array(XapiVersionSchema).min(1),
  extensions: ExtensionsSchema.optional(),
});

export const StatementsQueryFormatSchema = z.enum(["ids", "exact", "canonical"]);

export const StatementsQuerySchema = strictObject({
  statementId: UuidSchema.optional(),
  voidedStatementId: UuidSchema.optional(),
  agent: AgentSchema.optional(),
  verb: IriSchema.optional(),
  activity: IriSchema.optional(),
  registration: UuidSchema.optional(),
  related_activities: z.boolean().optional(),
  related_agents: z.boolean().optional(),
  since: Iso8601TimestampSchema.optional(),
  until: Iso8601TimestampSchema.optional(),
  limit: z.number().int().positive().optional(),
  format: StatementsQueryFormatSchema.optional(),
  attachments: z.boolean().optional(),
  ascending: z.boolean().optional(),
}).refine((value) => !(hasDefined(value.statementId) && hasDefined(value.voidedStatementId)), {
  message: "Statements queries cannot specify both statementId and voidedStatementId",
});

export const AgentsResourceQuerySchema = strictObject({
  agent: AgentSchema,
});

export const ActivitiesResourceQuerySchema = strictObject({
  activityId: IriSchema,
});

export const StateDocumentQuerySchema = strictObject({
  activityId: IriSchema,
  agent: AgentSchema,
  registration: UuidSchema.optional(),
  stateId: NonEmptyStringSchema.optional(),
});

export const StateDocumentListingQuerySchema = strictObject({
  activityId: IriSchema,
  agent: AgentSchema,
  registration: UuidSchema.optional(),
  since: Iso8601TimestampSchema.optional(),
});

export const AgentProfileDocumentQuerySchema = strictObject({
  agent: AgentSchema,
  profileId: NonEmptyStringSchema.optional(),
});

export const AgentProfileDocumentListingQuerySchema = strictObject({
  agent: AgentSchema,
  since: Iso8601TimestampSchema.optional(),
});

export const ActivityProfileDocumentQuerySchema = strictObject({
  activityId: IriSchema,
  profileId: NonEmptyStringSchema.optional(),
});

export const ActivityProfileDocumentListingQuerySchema = strictObject({
  activityId: IriSchema,
  since: Iso8601TimestampSchema.optional(),
});

export const XapiDocumentIdListSchema = z.array(NonEmptyStringSchema);

// When Agent or Group is used as a Statement Object, objectType is required per spec.
// "When Agent is used as a Statement Object, the objectType property MUST be included."
export const AgentAsObjectSchema = AgentSchema.and(z.object({ objectType: z.literal("Agent") }));
export const GroupAsObjectSchema = GroupSchema.and(z.object({ objectType: z.literal("Group") }));

export const SubStatementSchema = strictObject({
  objectType: z.literal("SubStatement"),
  actor: z.union([AgentSchema, GroupSchema]),
  verb: VerbSchema,
  object: z.union([ActivitySchema, AgentAsObjectSchema, GroupAsObjectSchema, StatementRefSchema]),
  result: ResultSchema.optional(),
  context: ContextSchema.optional(),
  timestamp: Iso8601TimestampSchema.optional(),
});

export const StatementObjectSchema = z.union([
  ActivitySchema,
  AgentAsObjectSchema,
  GroupAsObjectSchema,
  StatementRefSchema,
  SubStatementSchema,
]);

export const StatementSchema = strictObject({
  id: UuidSchema.optional(),
  actor: z.union([AgentSchema, GroupSchema]),
  verb: VerbSchema,
  object: StatementObjectSchema,
  result: ResultSchema.optional(),
  context: ContextSchema.optional(),
  timestamp: Iso8601TimestampSchema.optional(),
  stored: Iso8601TimestampSchema.optional(),
  authority: z.union([AgentSchema, GroupSchema]).optional(),
  version: XapiVersionSchema.optional(),
  attachments: z.array(AttachmentSchema).min(1).optional(),
});

export const StatementResultMoreSchema = z.string().regex(/^$|^(?![A-Za-z][A-Za-z0-9+.-]*:)\S+$/u);

export const StatementResultSchema = strictObject({
  statements: z.array(StatementSchema),
  more: StatementResultMoreSchema.optional(),
});

export const XapiHttpMethodSchema = z.enum(["GET", "HEAD", "PUT", "POST", "DELETE"]);

export const XapiResourceSchema = strictObject({
  name: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  methods: z.array(XapiHttpMethodSchema).min(1),
});

export const XapiRequestHeaderSchema = z.enum([
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Content-Type",
  "Content-Length",
  "Content-Transfer-Encoding",
  "If-Match",
  "If-None-Match",
  "X-Experience-API-Hash",
  "X-Experience-API-Version",
]);

export const XapiResponseHeaderSchema = z.enum([
  "Content-Type",
  "Content-Length",
  "Last-Modified",
  "ETag",
  "Status",
  "X-Experience-API-Version",
  "X-Experience-API-Consistent-Through",
]);

export const XapiErrorCodeSchema = z.enum(["400", "401", "403", "404", "409", "411", "412", "413", "500", "501"]);

export const XapiErrorResponseSchema = strictObject({
  code: XapiErrorCodeSchema,
  message: NonEmptyStringSchema,
  details: NonEmptyStringSchema.optional(),
});

export const XapiConcurrencySchema = strictObject({
  etag: NonEmptyStringSchema.optional(),
  ifMatch: NonEmptyStringSchema.optional(),
  ifNoneMatch: NonEmptyStringSchema.optional(),
});

export const XapiMultipartAttachmentPartSchema = strictObject({
  headers: strictObject({
    "Content-Type": MediaTypeSchema,
    "Content-Transfer-Encoding": z.literal("binary"),
    "X-Experience-API-Hash": AttachmentSha2Schema,
  }),
  body: z.unknown(),
});

export const XapiMultipartRequestSchema = strictObject({
  contentType: z.literal("multipart/mixed"),
  parts: z.tuple([
    strictObject({
      contentType: z.literal("application/json"),
      body: z.union([StatementSchema, z.array(StatementSchema).min(1)]),
    }),
    z.array(XapiMultipartAttachmentPartSchema).min(1),
  ]),
});
// Inferred types from exported Zod validators.
export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type Iri = z.infer<typeof IriSchema>;
export type MediaType = z.infer<typeof MediaTypeSchema>;
export type LanguageTag = z.infer<typeof LanguageTagSchema>;
export type XapiVersion = z.infer<typeof XapiVersionSchema>;
export type Iso8601Timestamp = z.infer<typeof Iso8601TimestampSchema>;
export type Iso8601Duration = z.infer<typeof Iso8601DurationSchema>;
export type LanguageMap = z.infer<typeof LanguageMapSchema>;
export type Extensions = z.infer<typeof ExtensionsSchema>;
export type AttachmentSha2 = z.infer<typeof AttachmentSha2Schema>;
export type AgentAccount = z.infer<typeof AgentAccountSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type Verb = z.infer<typeof VerbSchema>;
export type InteractionType = z.infer<typeof InteractionTypeSchema>;
export type InteractionComponent = z.infer<typeof InteractionComponentSchema>;
export type ActivityDefinition = z.infer<typeof ActivityDefinitionSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type StatementRef = z.infer<typeof StatementRefSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type ContextActivities = z.infer<typeof ContextActivitiesSchema>;
export type Context = z.infer<typeof ContextSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type XapiDocument = z.infer<typeof XapiDocumentSchema>;
export type StatementSubmission = z.infer<typeof StatementSubmissionSchema>;
export type AboutResource = z.infer<typeof AboutResourceSchema>;
export type StatementsQueryFormat = z.infer<typeof StatementsQueryFormatSchema>;
export type StatementsQuery = z.infer<typeof StatementsQuerySchema>;
export type AgentsResourceQuery = z.infer<typeof AgentsResourceQuerySchema>;
export type ActivitiesResourceQuery = z.infer<typeof ActivitiesResourceQuerySchema>;
export type StateDocumentQuery = z.infer<typeof StateDocumentQuerySchema>;
export type StateDocumentListingQuery = z.infer<typeof StateDocumentListingQuerySchema>;
export type AgentProfileDocumentQuery = z.infer<typeof AgentProfileDocumentQuerySchema>;
export type AgentProfileDocumentListingQuery = z.infer<typeof AgentProfileDocumentListingQuerySchema>;
export type ActivityProfileDocumentQuery = z.infer<typeof ActivityProfileDocumentQuerySchema>;
export type ActivityProfileDocumentListingQuery = z.infer<typeof ActivityProfileDocumentListingQuerySchema>;
export type XapiDocumentIdList = z.infer<typeof XapiDocumentIdListSchema>;
export type SubStatement = z.infer<typeof SubStatementSchema>;
export type StatementObject = z.infer<typeof StatementObjectSchema>;
export type Statement = z.infer<typeof StatementSchema>;
export type StatementResultMore = z.infer<typeof StatementResultMoreSchema>;
export type StatementResult = z.infer<typeof StatementResultSchema>;
export type XapiHttpMethod = z.infer<typeof XapiHttpMethodSchema>;
export type XapiResource = z.infer<typeof XapiResourceSchema>;
export type XapiRequestHeader = z.infer<typeof XapiRequestHeaderSchema>;
export type XapiResponseHeader = z.infer<typeof XapiResponseHeaderSchema>;
export type XapiErrorCode = z.infer<typeof XapiErrorCodeSchema>;
export type XapiErrorResponse = z.infer<typeof XapiErrorResponseSchema>;
export type XapiConcurrency = z.infer<typeof XapiConcurrencySchema>;
export type XapiMultipartAttachmentPart = z.infer<typeof XapiMultipartAttachmentPartSchema>;
export type XapiMultipartRequest = z.infer<typeof XapiMultipartRequestSchema>;
