export * from "../shared";

import { z } from "zod";

import {
  ContextSchema,
  CustomParametersSchema,
  LaunchPresentationSchema,
  LisSchema,
  NonEmptyStringSchema,
  ResourceLinkSchema,
  RolesSchema,
  UrlSchema,
  LtiVersionSchema,
  strictObject,
} from "../shared";

export const CoreLaunchRequestSchema = strictObject({
  messageType: z.literal("LtiResourceLinkRequest"),
  version: LtiVersionSchema,
  deploymentId: NonEmptyStringSchema,
  targetLinkUri: UrlSchema,
  resourceLink: ResourceLinkSchema,
  subject: NonEmptyStringSchema,
  context: ContextSchema.optional(),
  roles: RolesSchema,
  lis: LisSchema.optional(),
  launchPresentation: LaunchPresentationSchema.optional(),
  custom: CustomParametersSchema.optional(),
  name: NonEmptyStringSchema.optional(),
  givenName: NonEmptyStringSchema.optional(),
  familyName: NonEmptyStringSchema.optional(),
  email: z.email().optional(),
  locale: NonEmptyStringSchema.optional(),
});

export const CoreLaunchClaimsSchema = CoreLaunchRequestSchema;

export const LtiV1_3 = {
  Schemas: {
    ResourceLink: ResourceLinkSchema,
    Context: ContextSchema,
    LaunchPresentation: LaunchPresentationSchema,
    Lis: LisSchema,
    CoreLaunchRequest: CoreLaunchRequestSchema,
    CoreLaunchClaims: CoreLaunchClaimsSchema,
  },

  Shared: {
    Version: LtiVersionSchema,
    Url: UrlSchema,
    NonEmptyString: NonEmptyStringSchema,
    Roles: RolesSchema,
  },
} as const;

export type LtiV1_3Schemas = typeof LtiV1_3.Schemas;

export const Lti13DerivedZodTemplates = {
  description: "LTI 1.3 Core Zod schemas for normalized launch claims and launch-shaped objects",
  specLinks: {
    main: "https://www.imsglobal.org/spec/lti/v1p3/",
    claims: "https://www.imsglobal.org/spec/lti/v1p3/#message-claims",
  },
  scope: "LTI 1.3 resource-link launch claims",
  claims: [
    "messageType",
    "version",
    "deploymentId",
    "targetLinkUri",
    "resourceLink",
    "context",
    "roles",
    "lis",
    "launchPresentation",
  ],
  notes: [
    "Normalized camelCase field names are used instead of raw JWT claim URIs.",
    "Identity fields remain optional beyond the subject claim to keep the schema useful for adapter stubs and launch fixtures.",
    "The roles array stays permissive (vendor-extension URIs and LTI 1.1 simple context-role names both pass); `normalizeRole`/`KnownLtiRoleSchema` (in shared) classify against the published vocabulary.",
  ],
} as const;
// Inferred types from exported Zod validators.
export type CoreLaunchRequest = z.infer<typeof CoreLaunchRequestSchema>;
export type CoreLaunchClaims = z.infer<typeof CoreLaunchClaimsSchema>;
