import { z } from "zod";

import {
  CALIPER_CONTEXT_V1P1,
  CALIPER_CONTEXT_V1P2,
  CaliperContextStringSchema,
  CaliperDateTimeSchema,
  CaliperEventIdSchema,
  CaliperExtensionsSchema,
  CaliperIriSchema,
  CaliperNestedContextSchema,
  createCaliperEntitySchema,
  createCaliperEventSchema,
  getReferenceType,
} from "./shared";
import { CALIPER_BOOTCAMP_ONLY_EVENT_TYPES, CALIPER_TEXTUAL_EVENT_RULES } from "./textual_requirements";

export const CALIPER_ACTIONS = [
  "Abandoned",
  "Accepted",
  "Activated",
  "Added",
  "Archived",
  "Attached",
  "Bookmarked",
  "ChangedResolution",
  "ChangedSize",
  "ChangedSpeed",
  "ChangedVolume",
  "Classified",
  "ClosedPopout",
  "Commented",
  "Completed",
  "Copied",
  "Created",
  "Deactivated",
  "Declined",
  "Deleted",
  "Described",
  "DisabledClosedCaptioning",
  "Disliked",
  "Downloaded",
  "EnabledClosedCaptioning",
  "Ended",
  "EnteredFullScreen",
  "ExitedFullScreen",
  "ForwardedTo",
  "Graded",
  "Hid",
  "Highlighted",
  "Identified",
  "JumpedTo",
  "Launched",
  "Liked",
  "Linked",
  "LoggedIn",
  "LoggedOut",
  "MarkedAsRead",
  "MarkedAsUnread",
  "Modified",
  "Muted",
  "NavigatedTo",
  "OpenedPopout",
  "OptedIn",
  "OptedOut",
  "Paused",
  "Posted",
  "Printed",
  "Published",
  "Questioned",
  "Ranked",
  "Recommended",
  "Removed",
  "Reset",
  "Restarted",
  "Restored",
  "Resumed",
  "Retrieved",
  "Returned",
  "Reviewed",
  "Rewound",
  "Saved",
  "Searched",
  "Sent",
  "Shared",
  "Showed",
  "Skipped",
  "Started",
  "Submitted",
  "Subscribed",
  "Tagged",
  "TimedOut",
  "Unmuted",
  "Unpublished",
  "Unsubscribed",
  "Uploaded",
  "Used",
  "Viewed",
] as const;

export const CALIPER_METRICS = [
  "AssessmentsPassed",
  "AssessmentsSubmitted",
  "MinutesOnTask",
  "SkillsMastered",
  "StandardsMastered",
  "UnitsCompleted",
  "UnitsPassed",
  "WordsRead",
] as const;

export const CALIPER_PROFILES = [
  "AnnotationProfile",
  "AssessmentProfile",
  "AssignableProfile",
  "FeedbackProfile",
  "ForumProfile",
  "GeneralProfile",
  "GradingProfile",
  "MediaProfile",
  "ReadingProfile",
  "ResourceManagementProfile",
  "SearchProfile",
  "SessionProfile",
  "SurveyProfile",
  "ToolLaunchProfile",
  "ToolUseProfile",
] as const;

export const CALIPER_STATUSES = ["Active", "Inactive"] as const;

/**
 * The Caliper 1.2 `Role` vocabulary — the eight base roles plus their `Base#Subrole`
 * specialisations (the LIS membership role terms). A Membership's `roles` are drawn from this
 * list. Kept verbatim from the Caliper model so {@link RoleSchema} verifies the full vocabulary.
 */
export const CALIPER_ROLES = [
  "Administrator",
  "ContentDeveloper",
  "Instructor",
  "Learner",
  "Manager",
  "Member",
  "Mentor",
  "Officer",
  "Administrator#Administrator",
  "Administrator#Developer",
  "Administrator#ExternalDeveloper",
  "Administrator#ExternalSupport",
  "Administrator#ExternalSystemAdministrator",
  "Administrator#Support",
  "Administrator#SystemAdministrator",
  "ContentDeveloper#ContentDeveloper",
  "ContentDeveloper#ContentExpert",
  "ContentDeveloper#ExternalContentExpert",
  "ContentDeveloper#Librarian",
  "Instructor#ExternalInstructor",
  "Instructor#Grader",
  "Instructor#GuestInstructor",
  "Instructor#Instructor",
  "Instructor#Lecturer",
  "Instructor#PrimaryInstructor",
  "Instructor#SecondaryInstructor",
  "Instructor#TeachingAssistant",
  "Instructor#TeachingAssistantGroup",
  "Instructor#TeachingAssistantOffering",
  "Instructor#TeachingAssistantSection",
  "Instructor#TeachingAssistantTemplate",
  "Learner#ExternalLearner",
  "Learner#GuestLearner",
  "Learner#Learner",
  "Learner#NonCreditLearner",
  "Manager#AreaManager",
  "Manager#CourseCoordinator",
  "Manager#Observer",
  "Manager#ExternalObserver",
  "Member#Member",
  "Mentor#Advisor",
  "Mentor#Auditor",
  "Mentor#ExternalAdvisor",
  "Mentor#ExternalAuditor",
  "Mentor#ExternalLearningFacilitator",
  "Mentor#ExternalMentor",
  "Mentor#ExternalReviewer",
  "Mentor#ExternalTutor",
  "Mentor#LearningFacilitator",
  "Mentor#Mentor",
  "Mentor#Reviewer",
  "Mentor#Tutor",
  "Officer#Chair",
  "Officer#Secretary",
  "Officer#Treasurer",
  "Officer#Vice-Chair",
] as const;

export const ActionSchema = z.enum(CALIPER_ACTIONS);
export const MetricSchema = z.enum(CALIPER_METRICS);
export const ProfileSchema = z.enum(CALIPER_PROFILES);
export const StatusSchema = z.enum(CALIPER_STATUSES);

const ActionValueSchema = z.union([ActionSchema, z.literal("MarkedAsUnRead")]);

const normalizeAction = (action: string): string => (action === "MarkedAsUnRead" ? "MarkedAsUnread" : action);

const ENTITY_SUPERTYPE_MEMBERS: Record<string, readonly string[]> = {
  Agent: ["Agent", "Organization", "CourseOffering", "CourseSection", "Group", "Person", "SoftwareApplication"],
  Annotation: ["Annotation", "BookmarkAnnotation", "HighlightAnnotation", "SharedAnnotation", "TagAnnotation"],
  DigitalResource: [
    "DigitalResource",
    "AssignableDigitalResource",
    "AssessmentItem",
    "Chapter",
    "Document",
    "Frame",
    "LtiLink",
    "MediaLocation",
    "MediaObject",
    "AudioObject",
    "ImageObject",
    "VideoObject",
    "Message",
    "Page",
    "Question",
    "DateTimeQuestion",
    "MultiselectQuestion",
    "OpenEndedQuestion",
    "RatingScaleQuestion",
    "QuestionnaireItem",
    "Reading",
    "SurveyInvitation",
    "WebPage",
    "epubChapter",
    "epubPart",
    "epubSubChapter",
    "epubVolume",
  ],
  MediaObject: ["MediaObject", "AudioObject", "ImageObject", "VideoObject"],
  Response: [
    "Response",
    "DateTimeResponse",
    "FillinBlankResponse",
    "MultiselectResponse",
    "MultipleChoiceResponse",
    "MultipleResponseResponse",
    "OpenEndedResponse",
    "RatingScaleResponse",
    "SelectTextResponse",
    "TrueFalseResponse",
  ],
};

const expandAllowedTypes = (types: readonly string[]) => {
  const expanded = new Set<string>();
  for (const type of types) {
    expanded.add(type);
    const members = ENTITY_SUPERTYPE_MEMBERS[type];
    if (members) {
      for (const member of members) {
        expanded.add(member);
      }
    }
  }
  return expanded;
};

const addReferenceTypeIssue = (
  value: unknown,
  allowedTypes: Set<string>,
  key: "actor" | "object" | "generated" | "target",
  ctx: z.RefinementCtx,
) => {
  if (typeof value === "string") {
    return;
  }

  const refType = getReferenceType(value);
  if (!refType) {
    return;
  }

  if (!allowedTypes.has(refType)) {
    ctx.addIssue({
      code: "custom",
      path: [key, "type"],
      message: `Unsupported ${key} type "${refType}"`,
    });
  }
};

const createCaliperEventWithRules = <TType extends string>(eventType: TType) => {
  const baseSchema = createCaliperEventSchema(eventType, ActionValueSchema);
  const textualRule = CALIPER_TEXTUAL_EVENT_RULES[eventType];

  if (!textualRule) {
    return baseSchema;
  }

  const allowedActionValues = new Set<string>(
    [...textualRule.supportedActions, ...textualRule.deprecatedActions].map((action) => normalizeAction(action)),
  );
  const allowedActorTypes = expandAllowedTypes(textualRule.supportedActors);
  const allowedObjectTypes = expandAllowedTypes(textualRule.supportedObjects);
  const allowedGeneratedTypes = expandAllowedTypes(textualRule.supportedGeneratedEntities);
  const allowedTargetTypes = expandAllowedTypes(textualRule.supportedTargetEntities);

  return baseSchema.superRefine((event, ctx) => {
    const action = normalizeAction(event.action);
    if (!allowedActionValues.has(action)) {
      ctx.addIssue({
        code: "custom",
        path: ["action"],
        message: `Action "${event.action}" is not supported for ${eventType}`,
      });
    }

    addReferenceTypeIssue(event.actor, allowedActorTypes, "actor", ctx);
    addReferenceTypeIssue(event.object, allowedObjectTypes, "object", ctx);

    if (event.generated !== undefined) {
      if (allowedGeneratedTypes.size === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["generated"],
          message: `${eventType} does not define a generated entity`,
        });
      } else {
        addReferenceTypeIssue(event.generated, allowedGeneratedTypes, "generated", ctx);
      }
    }

    if (event.target !== undefined) {
      if (allowedTargetTypes.size === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["target"],
          message: `${eventType} does not define a target entity`,
        });
      } else {
        addReferenceTypeIssue(event.target, allowedTargetTypes, "target", ctx);
      }
    }

    if (event.profile !== undefined && event.profile !== textualRule.profile) {
      ctx.addIssue({
        code: "custom",
        path: ["profile"],
        message: `Expected profile "${textualRule.profile}" for ${eventType}`,
      });
    }
  });
};

export const CaliperTypeDefinitionsSchema = z
  .object({
    extensions: CaliperExtensionsSchema.optional(),
  })
  .loose();

export const RoleSchema = z.enum(CALIPER_ROLES);
export const SelectorSchema = z.looseObject({});

export const TextPositionSelectorSchema = z
  .object({
    type: z.literal("TextPositionSelector"),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    "@context": CaliperNestedContextSchema.optional(),
    extensions: CaliperExtensionsSchema.optional(),
  })
  .strict();

export const CaliperDataSchema = z
  .object({
    id: CaliperEventIdSchema.optional(),
    context: z
      .union([CaliperContextStringSchema, z.array(z.string()).min(1), z.record(z.string(), z.unknown())])
      .optional(),
  })
  .loose();

export const SystemIdentifierSchema = z
  .object({
    type: z.literal("SystemIdentifier"),
    identifier: z.string(),
    identifierType: z.literal("LtiUserId"),
    source: z.looseObject({}).optional(),
    "@context": CaliperNestedContextSchema.optional(),
    extensions: CaliperExtensionsSchema.optional(),
  })
  .strict();

export const AgentSchema = createCaliperEntitySchema("Agent");
export const AggregateMeasureSchema = createCaliperEntitySchema("AggregateMeasure");
export const AggregateMeasureCollectionSchema = createCaliperEntitySchema("AggregateMeasureCollection");
export const AnnotationSchema = createCaliperEntitySchema("Annotation");
export const AssessmentSchema = createCaliperEntitySchema("Assessment");
export const AssessmentItemSchema = createCaliperEntitySchema("AssessmentItem");
export const AssignableDigitalResourceSchema = createCaliperEntitySchema("AssignableDigitalResource");
export const AttemptSchema = createCaliperEntitySchema("Attempt");
export const AudioObjectSchema = createCaliperEntitySchema("AudioObject");
export const ChapterSchema = createCaliperEntitySchema("Chapter");
export const CollectionSchema = createCaliperEntitySchema("Collection");
export const CommentSchema = createCaliperEntitySchema("Comment");
export const CourseOfferingSchema = createCaliperEntitySchema("CourseOffering");
export const CourseSectionSchema = createCaliperEntitySchema("CourseSection");
export const DateTimeQuestionSchema = createCaliperEntitySchema("DateTimeQuestion");
export const DateTimeResponseSchema = createCaliperEntitySchema("DateTimeResponse");
export const DigitalResourceSchema = createCaliperEntitySchema("DigitalResource");
export const DigitalResourceCollectionSchema = createCaliperEntitySchema("DigitalResourceCollection");
export const DocumentSchema = createCaliperEntitySchema("Document");
export const EntitySchema = createCaliperEntitySchema("Entity");
export const FillinBlankResponseSchema = createCaliperEntitySchema("FillinBlankResponse");
export const FrameSchema = createCaliperEntitySchema("Frame");
export const GroupSchema = createCaliperEntitySchema("Group");
export const ImageObjectSchema = createCaliperEntitySchema("ImageObject");
export const LearningObjectiveSchema = createCaliperEntitySchema("LearningObjective");
export const LikertScaleSchema = createCaliperEntitySchema("LikertScale");
export const LinkSchema = createCaliperEntitySchema("Link");
export const LtiLinkSchema = createCaliperEntitySchema("LtiLink");
export const LtiSessionSchema = createCaliperEntitySchema("LtiSession");
export const MediaLocationSchema = createCaliperEntitySchema("MediaLocation");
export const MediaObjectSchema = createCaliperEntitySchema("MediaObject");
export const MembershipSchema = createCaliperEntitySchema("Membership");
export const MessageSchema = createCaliperEntitySchema("Message");
export const MultipleChoiceResponseSchema = createCaliperEntitySchema("MultipleChoiceResponse");
export const MultipleResponseResponseSchema = createCaliperEntitySchema("MultipleResponseResponse");
export const MultiselectQuestionSchema = createCaliperEntitySchema("MultiselectQuestion");
export const MultiselectResponseSchema = createCaliperEntitySchema("MultiselectResponse");
export const MultiselectScaleSchema = createCaliperEntitySchema("MultiselectScale");
export const NumericScaleSchema = createCaliperEntitySchema("NumericScale");
export const OpenEndedQuestionSchema = createCaliperEntitySchema("OpenEndedQuestion");
export const OpenEndedResponseSchema = createCaliperEntitySchema("OpenEndedResponse");
export const OrganizationSchema = createCaliperEntitySchema("Organization");
export const PageSchema = createCaliperEntitySchema("Page");
export const PersonSchema = createCaliperEntitySchema("Person");
export const QuerySchema = createCaliperEntitySchema("Query");
export const QuestionSchema = createCaliperEntitySchema("Question");
export const QuestionnaireItemSchema = createCaliperEntitySchema("QuestionnaireItem");
export const RatingSchema = createCaliperEntitySchema("Rating");
export const RatingScaleQuestionSchema = createCaliperEntitySchema("RatingScaleQuestion");
export const RatingScaleResponseSchema = createCaliperEntitySchema("RatingScaleResponse");
export const ReadingSchema = createCaliperEntitySchema("Reading");
export const ResponseSchema = createCaliperEntitySchema("Response");
export const ResultSchema = createCaliperEntitySchema("Result");
export const ScaleSchema = createCaliperEntitySchema("Scale");
export const ScoreSchema = createCaliperEntitySchema("Score");
export const SearchResponseSchema = createCaliperEntitySchema("SearchResponse");
export const SelectTextResponseSchema = createCaliperEntitySchema("SelectTextResponse");
export const SessionSchema = createCaliperEntitySchema("Session");
export const SoftwareApplicationSchema = createCaliperEntitySchema("SoftwareApplication");
export const SurveySchema = createCaliperEntitySchema("Survey");
export const SurveyInvitationSchema = createCaliperEntitySchema("SurveyInvitation");
export const TrueFalseResponseSchema = createCaliperEntitySchema("TrueFalseResponse");
export const VideoObjectSchema = createCaliperEntitySchema("VideoObject");
export const WebPageSchema = createCaliperEntitySchema("WebPage");
export const EpubChapterSchema = createCaliperEntitySchema("epubChapter");
export const EpubPartSchema = createCaliperEntitySchema("epubPart");
export const EpubSubChapterSchema = createCaliperEntitySchema("epubSubChapter");
export const EpubVolumeSchema = createCaliperEntitySchema("epubVolume");
export const BookmarkAnnotationSchema = createCaliperEntitySchema("BookmarkAnnotation");
export const ForumSchema = createCaliperEntitySchema("Forum");
export const HighlightAnnotationSchema = createCaliperEntitySchema("HighlightAnnotation");
export const QuestionnaireSchema = createCaliperEntitySchema("Questionnaire");
export const SharedAnnotationSchema = createCaliperEntitySchema("SharedAnnotation");
export const TagAnnotationSchema = createCaliperEntitySchema("TagAnnotation");
export const ThreadSchema = createCaliperEntitySchema("Thread");

export const AnnotationEventSchema = createCaliperEventWithRules("AnnotationEvent");
export const AssessmentEventSchema = createCaliperEventWithRules("AssessmentEvent");
export const AssessmentItemEventSchema = createCaliperEventWithRules("AssessmentItemEvent");
export const AssignableEventSchema = createCaliperEventWithRules("AssignableEvent");
export const EventSchema = createCaliperEventWithRules("Event");
export const FeedbackEventSchema = createCaliperEventWithRules("FeedbackEvent");
export const ForumEventSchema = createCaliperEventWithRules("ForumEvent");
export const GradeEventSchema = createCaliperEventWithRules("GradeEvent");
export const MediaEventSchema = createCaliperEventWithRules("MediaEvent");
export const MessageEventSchema = createCaliperEventWithRules("MessageEvent");
export const NavigationEventSchema = createCaliperEventWithRules("NavigationEvent");
export const OutcomeEventSchema = createCaliperEventWithRules("OutcomeEvent");
export const QuestionnaireEventSchema = createCaliperEventWithRules("QuestionnaireEvent");
export const QuestionnaireItemEventSchema = createCaliperEventWithRules("QuestionnaireItemEvent");
export const ReadingEventSchema = createCaliperEventWithRules("ReadingEvent");
export const ResourceManagementEventSchema = createCaliperEventWithRules("ResourceManagementEvent");
export const SearchEventSchema = createCaliperEventWithRules("SearchEvent");
export const SessionEventSchema = createCaliperEventWithRules("SessionEvent");
export const SurveyEventSchema = createCaliperEventWithRules("SurveyEvent");
export const SurveyInvitationEventSchema = createCaliperEventWithRules("SurveyInvitationEvent");
export const ThreadEventSchema = createCaliperEventWithRules("ThreadEvent");
export const ToolLaunchEventSchema = createCaliperEventWithRules("ToolLaunchEvent");
export const ToolUseEventSchema = createCaliperEventWithRules("ToolUseEvent");
export const ViewEventSchema = createCaliperEventWithRules("ViewEvent");

export const CaliperEventDocumentSchema = z.union([
  AnnotationEventSchema,
  AssessmentEventSchema,
  AssessmentItemEventSchema,
  AssignableEventSchema,
  EventSchema,
  FeedbackEventSchema,
  ForumEventSchema,
  GradeEventSchema,
  MediaEventSchema,
  MessageEventSchema,
  NavigationEventSchema,
  OutcomeEventSchema,
  QuestionnaireEventSchema,
  QuestionnaireItemEventSchema,
  ReadingEventSchema,
  ResourceManagementEventSchema,
  SearchEventSchema,
  SessionEventSchema,
  SurveyEventSchema,
  SurveyInvitationEventSchema,
  ThreadEventSchema,
  ToolLaunchEventSchema,
  ToolUseEventSchema,
  ViewEventSchema,
]);

export const CaliperEntityDocumentSchema = z.union([
  AgentSchema,
  AggregateMeasureSchema,
  AggregateMeasureCollectionSchema,
  AnnotationSchema,
  AssessmentSchema,
  AssessmentItemSchema,
  AssignableDigitalResourceSchema,
  AttemptSchema,
  AudioObjectSchema,
  BookmarkAnnotationSchema,
  ChapterSchema,
  CollectionSchema,
  CommentSchema,
  CourseOfferingSchema,
  CourseSectionSchema,
  DateTimeQuestionSchema,
  DateTimeResponseSchema,
  DigitalResourceSchema,
  DigitalResourceCollectionSchema,
  DocumentSchema,
  EntitySchema,
  FillinBlankResponseSchema,
  ForumSchema,
  FrameSchema,
  GroupSchema,
  HighlightAnnotationSchema,
  ImageObjectSchema,
  LearningObjectiveSchema,
  LikertScaleSchema,
  LinkSchema,
  LtiLinkSchema,
  LtiSessionSchema,
  MediaLocationSchema,
  MediaObjectSchema,
  MembershipSchema,
  MessageSchema,
  MultipleChoiceResponseSchema,
  MultipleResponseResponseSchema,
  MultiselectQuestionSchema,
  MultiselectResponseSchema,
  MultiselectScaleSchema,
  NumericScaleSchema,
  OpenEndedQuestionSchema,
  OpenEndedResponseSchema,
  OrganizationSchema,
  PageSchema,
  PersonSchema,
  QuerySchema,
  QuestionSchema,
  QuestionnaireSchema,
  QuestionnaireItemSchema,
  RatingSchema,
  RatingScaleQuestionSchema,
  RatingScaleResponseSchema,
  ReadingSchema,
  ResponseSchema,
  ResultSchema,
  ScaleSchema,
  ScoreSchema,
  SearchResponseSchema,
  SelectTextResponseSchema,
  SessionSchema,
  SharedAnnotationSchema,
  SoftwareApplicationSchema,
  SurveySchema,
  SurveyInvitationSchema,
  TagAnnotationSchema,
  ThreadSchema,
  TrueFalseResponseSchema,
  VideoObjectSchema,
  WebPageSchema,
  EpubChapterSchema,
  EpubPartSchema,
  EpubSubChapterSchema,
  EpubVolumeSchema,
  SystemIdentifierSchema,
  TextPositionSelectorSchema,
]);

export const CaliperEnvelopeDataItemSchema = z.union([CaliperEventDocumentSchema, CaliperEntityDocumentSchema]);

export const EnvelopeSchema = z
  .object({
    sensor: CaliperIriSchema,
    sendTime: CaliperDateTimeSchema,
    dataVersion: CaliperContextStringSchema,
    data: z.array(CaliperEnvelopeDataItemSchema).min(1),
  })
  .strict();

export const CaliperV1P2JsonSchemaEntryPoints = {
  Action: ActionSchema,
  Agent: AgentSchema,
  AggregateMeasure: AggregateMeasureSchema,
  AggregateMeasureCollection: AggregateMeasureCollectionSchema,
  Annotation: AnnotationSchema,
  AnnotationEvent: AnnotationEventSchema,
  Assessment: AssessmentSchema,
  AssessmentEvent: AssessmentEventSchema,
  AssessmentItem: AssessmentItemSchema,
  AssessmentItemEvent: AssessmentItemEventSchema,
  AssignableDigitalResource: AssignableDigitalResourceSchema,
  AssignableEvent: AssignableEventSchema,
  Attempt: AttemptSchema,
  AudioObject: AudioObjectSchema,
  BookmarkAnnotation: BookmarkAnnotationSchema,
  CaliperData: CaliperDataSchema,
  CaliperTypeDefinitions: CaliperTypeDefinitionsSchema,
  Chapter: ChapterSchema,
  Collection: CollectionSchema,
  Comment: CommentSchema,
  CourseOffering: CourseOfferingSchema,
  CourseSection: CourseSectionSchema,
  DateTimeQuestion: DateTimeQuestionSchema,
  DateTimeResponse: DateTimeResponseSchema,
  DigitalResource: DigitalResourceSchema,
  DigitalResourceCollection: DigitalResourceCollectionSchema,
  Document: DocumentSchema,
  Entity: EntitySchema,
  Envelope: EnvelopeSchema,
  Event: EventSchema,
  FeedbackEvent: FeedbackEventSchema,
  FillinBlankResponse: FillinBlankResponseSchema,
  Forum: ForumSchema,
  ForumEvent: ForumEventSchema,
  Frame: FrameSchema,
  GradeEvent: GradeEventSchema,
  Group: GroupSchema,
  HighlightAnnotation: HighlightAnnotationSchema,
  ImageObject: ImageObjectSchema,
  LearningObjective: LearningObjectiveSchema,
  LikertScale: LikertScaleSchema,
  Link: LinkSchema,
  LtiLink: LtiLinkSchema,
  LtiSession: LtiSessionSchema,
  MediaEvent: MediaEventSchema,
  MediaLocation: MediaLocationSchema,
  MediaObject: MediaObjectSchema,
  Membership: MembershipSchema,
  Message: MessageSchema,
  MessageEvent: MessageEventSchema,
  Metric: MetricSchema,
  MultipleChoiceResponse: MultipleChoiceResponseSchema,
  MultipleResponseResponse: MultipleResponseResponseSchema,
  MultiselectQuestion: MultiselectQuestionSchema,
  MultiselectResponse: MultiselectResponseSchema,
  MultiselectScale: MultiselectScaleSchema,
  NavigationEvent: NavigationEventSchema,
  NumericScale: NumericScaleSchema,
  OpenEndedQuestion: OpenEndedQuestionSchema,
  OpenEndedResponse: OpenEndedResponseSchema,
  Organization: OrganizationSchema,
  OutcomeEvent: OutcomeEventSchema,
  Page: PageSchema,
  Person: PersonSchema,
  Profile: ProfileSchema,
  Query: QuerySchema,
  Question: QuestionSchema,
  Questionnaire: QuestionnaireSchema,
  QuestionnaireEvent: QuestionnaireEventSchema,
  QuestionnaireItem: QuestionnaireItemSchema,
  QuestionnaireItemEvent: QuestionnaireItemEventSchema,
  Rating: RatingSchema,
  RatingScaleQuestion: RatingScaleQuestionSchema,
  RatingScaleResponse: RatingScaleResponseSchema,
  Reading: ReadingSchema,
  ReadingEvent: ReadingEventSchema,
  ResourceManagementEvent: ResourceManagementEventSchema,
  Response: ResponseSchema,
  Result: ResultSchema,
  Role: RoleSchema,
  Scale: ScaleSchema,
  Score: ScoreSchema,
  SearchEvent: SearchEventSchema,
  SearchResponse: SearchResponseSchema,
  SelectTextResponse: SelectTextResponseSchema,
  Selector: SelectorSchema,
  Session: SessionSchema,
  SessionEvent: SessionEventSchema,
  SharedAnnotation: SharedAnnotationSchema,
  SoftwareApplication: SoftwareApplicationSchema,
  Status: StatusSchema,
  Survey: SurveySchema,
  SurveyEvent: SurveyEventSchema,
  SurveyInvitation: SurveyInvitationSchema,
  SurveyInvitationEvent: SurveyInvitationEventSchema,
  SystemIdentifier: SystemIdentifierSchema,
  TagAnnotation: TagAnnotationSchema,
  TextPositionSelector: TextPositionSelectorSchema,
  Thread: ThreadSchema,
  ThreadEvent: ThreadEventSchema,
  ToolLaunchEvent: ToolLaunchEventSchema,
  ToolUseEvent: ToolUseEventSchema,
  TrueFalseResponse: TrueFalseResponseSchema,
  VideoObject: VideoObjectSchema,
  ViewEvent: ViewEventSchema,
  WebPage: WebPageSchema,
  epubChapter: EpubChapterSchema,
  epubPart: EpubPartSchema,
  epubSubChapter: EpubSubChapterSchema,
  epubVolume: EpubVolumeSchema,
} as const;

export const CaliperV1P2ConformanceMetadata = {
  supportedTextualEventRules: CALIPER_TEXTUAL_EVENT_RULES,
  bootcampOnlyEventTypes: CALIPER_BOOTCAMP_ONLY_EVENT_TYPES,
  contextUris: {
    v1p1: CALIPER_CONTEXT_V1P1,
    v1p2: CALIPER_CONTEXT_V1P2,
  },
} as const;
// Inferred types from exported Zod validators.
export type Action = z.infer<typeof ActionSchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type CaliperTypeDefinitions = z.infer<typeof CaliperTypeDefinitionsSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Selector = z.infer<typeof SelectorSchema>;
export type TextPositionSelector = z.infer<typeof TextPositionSelectorSchema>;
export type CaliperData = z.infer<typeof CaliperDataSchema>;
export type SystemIdentifier = z.infer<typeof SystemIdentifierSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type AggregateMeasure = z.infer<typeof AggregateMeasureSchema>;
export type AggregateMeasureCollection = z.infer<typeof AggregateMeasureCollectionSchema>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type AssessmentItem = z.infer<typeof AssessmentItemSchema>;
export type AssignableDigitalResource = z.infer<typeof AssignableDigitalResourceSchema>;
export type Attempt = z.infer<typeof AttemptSchema>;
export type AudioObject = z.infer<typeof AudioObjectSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type CourseOffering = z.infer<typeof CourseOfferingSchema>;
export type CourseSection = z.infer<typeof CourseSectionSchema>;
export type DateTimeQuestion = z.infer<typeof DateTimeQuestionSchema>;
export type DateTimeResponse = z.infer<typeof DateTimeResponseSchema>;
export type DigitalResource = z.infer<typeof DigitalResourceSchema>;
export type DigitalResourceCollection = z.infer<typeof DigitalResourceCollectionSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type FillinBlankResponse = z.infer<typeof FillinBlankResponseSchema>;
export type Frame = z.infer<typeof FrameSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type ImageObject = z.infer<typeof ImageObjectSchema>;
export type LearningObjective = z.infer<typeof LearningObjectiveSchema>;
export type LikertScale = z.infer<typeof LikertScaleSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type LtiLink = z.infer<typeof LtiLinkSchema>;
export type LtiSession = z.infer<typeof LtiSessionSchema>;
export type MediaLocation = z.infer<typeof MediaLocationSchema>;
export type MediaObject = z.infer<typeof MediaObjectSchema>;
export type Membership = z.infer<typeof MembershipSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type MultipleChoiceResponse = z.infer<typeof MultipleChoiceResponseSchema>;
export type MultipleResponseResponse = z.infer<typeof MultipleResponseResponseSchema>;
export type MultiselectQuestion = z.infer<typeof MultiselectQuestionSchema>;
export type MultiselectResponse = z.infer<typeof MultiselectResponseSchema>;
export type MultiselectScale = z.infer<typeof MultiselectScaleSchema>;
export type NumericScale = z.infer<typeof NumericScaleSchema>;
export type OpenEndedQuestion = z.infer<typeof OpenEndedQuestionSchema>;
export type OpenEndedResponse = z.infer<typeof OpenEndedResponseSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type Query = z.infer<typeof QuerySchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionnaireItem = z.infer<typeof QuestionnaireItemSchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type RatingScaleQuestion = z.infer<typeof RatingScaleQuestionSchema>;
export type RatingScaleResponse = z.infer<typeof RatingScaleResponseSchema>;
export type Reading = z.infer<typeof ReadingSchema>;
export type Response = z.infer<typeof ResponseSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Scale = z.infer<typeof ScaleSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type SelectTextResponse = z.infer<typeof SelectTextResponseSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type SoftwareApplication = z.infer<typeof SoftwareApplicationSchema>;
export type Survey = z.infer<typeof SurveySchema>;
export type SurveyInvitation = z.infer<typeof SurveyInvitationSchema>;
export type TrueFalseResponse = z.infer<typeof TrueFalseResponseSchema>;
export type VideoObject = z.infer<typeof VideoObjectSchema>;
export type WebPage = z.infer<typeof WebPageSchema>;
export type EpubChapter = z.infer<typeof EpubChapterSchema>;
export type EpubPart = z.infer<typeof EpubPartSchema>;
export type EpubSubChapter = z.infer<typeof EpubSubChapterSchema>;
export type EpubVolume = z.infer<typeof EpubVolumeSchema>;
export type BookmarkAnnotation = z.infer<typeof BookmarkAnnotationSchema>;
export type Forum = z.infer<typeof ForumSchema>;
export type HighlightAnnotation = z.infer<typeof HighlightAnnotationSchema>;
export type Questionnaire = z.infer<typeof QuestionnaireSchema>;
export type SharedAnnotation = z.infer<typeof SharedAnnotationSchema>;
export type TagAnnotation = z.infer<typeof TagAnnotationSchema>;
export type Thread = z.infer<typeof ThreadSchema>;
export type AnnotationEvent = z.infer<typeof AnnotationEventSchema>;
export type AssessmentEvent = z.infer<typeof AssessmentEventSchema>;
export type AssessmentItemEvent = z.infer<typeof AssessmentItemEventSchema>;
export type AssignableEvent = z.infer<typeof AssignableEventSchema>;
export type Event = z.infer<typeof EventSchema>;
export type FeedbackEvent = z.infer<typeof FeedbackEventSchema>;
export type ForumEvent = z.infer<typeof ForumEventSchema>;
export type GradeEvent = z.infer<typeof GradeEventSchema>;
export type MediaEvent = z.infer<typeof MediaEventSchema>;
export type MessageEvent = z.infer<typeof MessageEventSchema>;
export type NavigationEvent = z.infer<typeof NavigationEventSchema>;
export type OutcomeEvent = z.infer<typeof OutcomeEventSchema>;
export type QuestionnaireEvent = z.infer<typeof QuestionnaireEventSchema>;
export type QuestionnaireItemEvent = z.infer<typeof QuestionnaireItemEventSchema>;
export type ReadingEvent = z.infer<typeof ReadingEventSchema>;
export type ResourceManagementEvent = z.infer<typeof ResourceManagementEventSchema>;
export type SearchEvent = z.infer<typeof SearchEventSchema>;
export type SessionEvent = z.infer<typeof SessionEventSchema>;
export type SurveyEvent = z.infer<typeof SurveyEventSchema>;
export type SurveyInvitationEvent = z.infer<typeof SurveyInvitationEventSchema>;
export type ThreadEvent = z.infer<typeof ThreadEventSchema>;
export type ToolLaunchEvent = z.infer<typeof ToolLaunchEventSchema>;
export type ToolUseEvent = z.infer<typeof ToolUseEventSchema>;
export type ViewEvent = z.infer<typeof ViewEventSchema>;
export type CaliperEventDocument = z.infer<typeof CaliperEventDocumentSchema>;
export type CaliperEntityDocument = z.infer<typeof CaliperEntityDocumentSchema>;
export type CaliperEnvelopeDataItem = z.infer<typeof CaliperEnvelopeDataItemSchema>;
export type Envelope = z.infer<typeof EnvelopeSchema>;
