export * from "../../shared";

import { z } from "zod";

import { LineItemSchema } from "../../ags/v2_0";
import {
  ContextSchema,
  CustomParametersSchema,
  ImageResourceSchema,
  LaunchPresentationSchema,
  LisSchema,
  NonEmptyStringSchema,
  ResourceLinkSchema,
  RolesSchema,
  UrlSchema,
  LtiVersionSchema,
  strictObject,
} from "../../shared";

export const ContentItemTypeSchema = z.enum(["file", "html", "image", "link", "ltiResourceLink"]);

export const DeepLinkingSettingsSchema = strictObject({
  deepLinkReturnUrl: UrlSchema,
  acceptTypes: z.array(ContentItemTypeSchema).min(1),
  acceptPresentationDocumentTargets: z.array(z.enum(["embed", "frame", "iframe", "popup", "tab", "window"])).optional(),
  acceptMediaTypes: z.union([NonEmptyStringSchema, z.array(NonEmptyStringSchema).min(1)]).optional(),
  acceptMultiple: z.boolean().optional(),
  autoCreate: z.boolean().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  data: z.string().optional(),
});

export const DeepLinkingRequestSchema = strictObject({
  messageType: z.literal("LtiDeepLinkingRequest"),
  version: LtiVersionSchema,
  deploymentId: NonEmptyStringSchema,
  deepLinkingSettings: DeepLinkingSettingsSchema,
  subject: NonEmptyStringSchema.optional(),
  resourceLink: ResourceLinkSchema.optional(),
  context: ContextSchema.optional(),
  roles: RolesSchema.optional(),
  lis: LisSchema.optional(),
  launchPresentation: LaunchPresentationSchema.optional(),
  custom: CustomParametersSchema.optional(),
});

// Presentation sub-objects shared across link-like content items.
const EmbedSchema = strictObject({
  html: NonEmptyStringSchema,
});

const WindowSchema = strictObject({
  targetName: z.string().optional(),
  windowFeatures: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const IframeSchema = strictObject({
  src: UrlSchema.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const AvailabilityWindowSchema = strictObject({
  startDateTime: z.iso.datetime().optional(),
  endDateTime: z.iso.datetime().optional(),
});

export const LinkContentItemSchema = strictObject({
  type: z.literal("link"),
  url: UrlSchema,
  title: z.string().optional(),
  text: z.string().optional(),
  icon: ImageResourceSchema.optional(),
  thumbnail: ImageResourceSchema.optional(),
  embed: EmbedSchema.optional(),
  window: WindowSchema.optional(),
  iframe: IframeSchema.optional(),
});

export const LtiResourceLinkContentItemSchema = strictObject({
  type: z.literal("ltiResourceLink"),
  url: UrlSchema.optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  icon: ImageResourceSchema.optional(),
  thumbnail: ImageResourceSchema.optional(),
  custom: CustomParametersSchema.optional(),
  lineItem: LineItemSchema.optional(),
  available: AvailabilityWindowSchema.optional(),
  submission: AvailabilityWindowSchema.optional(),
  window: WindowSchema.optional(),
  iframe: IframeSchema.optional(),
});

export const FileContentItemSchema = strictObject({
  type: z.literal("file"),
  url: UrlSchema,
  title: z.string().optional(),
  text: z.string().optional(),
  icon: ImageResourceSchema.optional(),
  thumbnail: ImageResourceSchema.optional(),
  mediaType: NonEmptyStringSchema.optional(),
  expiresAt: z.iso.datetime().optional(),
});

export const HtmlContentItemSchema = strictObject({
  type: z.literal("html"),
  html: NonEmptyStringSchema,
  title: z.string().optional(),
  text: z.string().optional(),
});

export const ImageContentItemSchema = strictObject({
  type: z.literal("image"),
  url: UrlSchema,
  title: z.string().optional(),
  text: z.string().optional(),
  icon: ImageResourceSchema.optional(),
  thumbnail: ImageResourceSchema.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

// Each Deep Linking content-item type carries a distinct property set; modelling them as a
// discriminated union makes the `html` payload of an `html` item required, validates an
// `image` item's dimensions, and surfaces a `file` item's media metadata — none of which a
// single permissive object could express (LTI Deep Linking 2.0 §content-item-types).
export const ContentItemSchema = z.discriminatedUnion("type", [
  LinkContentItemSchema,
  LtiResourceLinkContentItemSchema,
  FileContentItemSchema,
  HtmlContentItemSchema,
  ImageContentItemSchema,
]);

export const DeepLinkingResponseSchema = strictObject({
  messageType: z.literal("LtiDeepLinkingResponse"),
  version: LtiVersionSchema,
  deploymentId: NonEmptyStringSchema.optional(),
  contentItems: z.array(ContentItemSchema).min(1),
  data: z.string().optional(),
  message: z.string().optional(),
  log: z.string().optional(),
  errorMessage: z.string().optional(),
  errorLog: z.string().optional(),
});

export const LtiDeepLinkingV2_0 = {
  Schemas: {
    ContentItemType: ContentItemTypeSchema,
    DeepLinkingSettings: DeepLinkingSettingsSchema,
    DeepLinkingRequest: DeepLinkingRequestSchema,
    ContentItem: ContentItemSchema,
    LinkContentItem: LinkContentItemSchema,
    LtiResourceLinkContentItem: LtiResourceLinkContentItemSchema,
    FileContentItem: FileContentItemSchema,
    HtmlContentItem: HtmlContentItemSchema,
    ImageContentItem: ImageContentItemSchema,
    DeepLinkingResponse: DeepLinkingResponseSchema,
  },
} as const;

export type LtiDeepLinkingV2_0Schemas = typeof LtiDeepLinkingV2_0.Schemas;

export const LtiDeepLinkingV2_0DerivedZodTemplates = {
  description: "LTI Deep Linking v2.0 Zod schemas for normalized request settings and response content items",
  specLinks: {
    main: "https://www.imsglobal.org/spec/lti-dl/v2p0/",
  },
  scope: "Deep linking request settings and response content items",
  claims: ["deep_linking_settings", "content_items"],
  notes: [
    "Accept-media-types is intentionally permissive because implementations vary between comma-delimited strings and arrays.",
    "Content items are a discriminated union keyed on `type`: each of link, ltiResourceLink, file, html and image carries its own property set (e.g. the html item's `html` payload, the image item's dimensions, the file item's mediaType/expiresAt).",
    "The ltiResourceLink item reuses the AGS line-item schema when a deep-linked resource declares grading metadata.",
  ],
} as const;
// Inferred types from exported Zod validators.
export type ContentItemType = z.infer<typeof ContentItemTypeSchema>;
export type DeepLinkingSettings = z.infer<typeof DeepLinkingSettingsSchema>;
export type DeepLinkingRequest = z.infer<typeof DeepLinkingRequestSchema>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type LinkContentItem = z.infer<typeof LinkContentItemSchema>;
export type LtiResourceLinkContentItem = z.infer<typeof LtiResourceLinkContentItemSchema>;
export type FileContentItem = z.infer<typeof FileContentItemSchema>;
export type HtmlContentItem = z.infer<typeof HtmlContentItemSchema>;
export type ImageContentItem = z.infer<typeof ImageContentItemSchema>;
export type DeepLinkingResponse = z.infer<typeof DeepLinkingResponseSchema>;
