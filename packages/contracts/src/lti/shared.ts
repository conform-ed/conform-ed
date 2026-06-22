import { z } from "zod";

export function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

const UriSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:.+$/u);

export const NonEmptyStringSchema = z.string().min(1);
export const UrlSchema = z.url();
export const UriReferenceSchema = UriSchema;
export const LtiVersionSchema = z.literal("1.3.0");
export const DocumentTargetSchema = z.enum(["embed", "frame", "iframe", "popup", "tab", "window"]);
// --- LTI role vocabulary -----------------------------------------------------------------
// LTI 1.3 core §5.3.3 (roles claim) plus the LIS v2 role vocabularies.
// https://www.imsglobal.org/spec/lti/v1p3/#role-vocabularies
//
// Roles travel as URIs in one of three namespaces. Only *context* roles may also appear as
// bare simple names (e.g. "Instructor"), retained for LTI 1.1 backward compatibility. Context
// roles additionally carry sub-roles, addressed as `<context>/<CoreRole>#<SubRole>`.
export const LtiRoleNamespacePrefixes = {
  context: "http://purl.imsglobal.org/vocab/lis/v2/membership",
  institution: "http://purl.imsglobal.org/vocab/lis/v2/institution/person",
  system: "http://purl.imsglobal.org/vocab/lis/v2/system/person",
} as const;

export type LtiRoleNamespace = keyof typeof LtiRoleNamespacePrefixes;

export const LtiContextCoreRoles = ["Administrator", "ContentDeveloper", "Instructor", "Learner", "Mentor"] as const;
export const LtiContextNonCoreRoles = ["Manager", "Member", "Officer"] as const;
export const LtiSystemRoles = [
  "AccountAdmin",
  "Administrator",
  "Creator",
  "None",
  "SysAdmin",
  "SysSupport",
  "User",
] as const;
export const LtiInstitutionRoles = [
  "Administrator",
  "Alumni",
  "Faculty",
  "Guest",
  "Instructor",
  "Learner",
  "Member",
  "Mentor",
  "None",
  "Observer",
  "Other",
  "ProspectiveStudent",
  "Staff",
  "Student",
] as const;

const ContextRoleNames: ReadonlySet<string> = new Set<string>([...LtiContextCoreRoles, ...LtiContextNonCoreRoles]);

export type NormalizedLtiRole = {
  namespace: LtiRoleNamespace;
  raw: string;
  role: string;
  subRole?: string;
};

// Classify a role token into its namespace and (sub-)role, or null when it is not a recognised
// LTI role. Unrecognised (e.g. vendor-extension) URIs return null by design — a tool ignores
// roles it does not understand — while the original value is preserved on every match.
export function normalizeRole(value: string): NormalizedLtiRole | null {
  const raw = value.trim();

  if (raw.length === 0) {
    return null;
  }

  // Context sub-role: `<context>/<CoreRole>#<SubRole>`.
  const contextSubRolePrefix = `${LtiRoleNamespacePrefixes.context}/`;

  if (raw.startsWith(contextSubRolePrefix)) {
    const [role, subRole] = raw.slice(contextSubRolePrefix.length).split("#");

    if (!role) {
      return null;
    }

    return { namespace: "context", raw, role, ...(subRole ? { subRole } : {}) };
  }

  // Namespaced core role: `<namespace>#<Role>`.
  for (const namespace of ["context", "institution", "system"] as const) {
    const corePrefix = `${LtiRoleNamespacePrefixes[namespace]}#`;

    if (raw.startsWith(corePrefix)) {
      const role = raw.slice(corePrefix.length);

      return role ? { namespace, raw, role } : null;
    }
  }

  // Bare simple name (context namespace only, LTI 1.1 backward compatibility).
  if (ContextRoleNames.has(raw)) {
    return { namespace: "context", raw, role: raw };
  }

  return null;
}

// A single role token in a launch `roles` array. Permissive on the URI side so vendor-extension
// role URIs stay valid (a tool ignores the ones it does not recognise); also accepts the bare
// context-role simple names the spec retains for LTI 1.1 compatibility.
export const LtiRoleSchema = z
  .string()
  .min(1)
  .refine((value) => UriSchema.safeParse(value).success || ContextRoleNames.has(value.trim()), {
    message: "Expected an LTI role URI or a context-role simple name",
  });

// The stricter recogniser: only roles drawn from the published LTI vocabularies, so an
// extension role is rejected. Useful for conformance assertions over a known launch.
export const KnownLtiRoleSchema = z
  .string()
  .min(1)
  .refine((value) => normalizeRole(value) !== null, {
    message: "Expected a recognised LTI role from the system, institution, or context vocabulary",
  });

export const LtiRoles = {
  namespaces: LtiRoleNamespacePrefixes,
  context: { core: LtiContextCoreRoles, nonCore: LtiContextNonCoreRoles },
  institution: LtiInstitutionRoles,
  system: LtiSystemRoles,
  normalize: normalizeRole,
  RoleSchema: LtiRoleSchema,
  KnownRoleSchema: KnownLtiRoleSchema,
} as const;

export const ResourceLinkSchema = strictObject({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema.optional(),
  description: z.string().optional(),
});

export const ContextSchema = strictObject({
  id: NonEmptyStringSchema,
  label: NonEmptyStringSchema.optional(),
  title: NonEmptyStringSchema.optional(),
  type: z.array(NonEmptyStringSchema).min(1).optional(),
});

export const LaunchPresentationSchema = strictObject({
  documentTarget: DocumentTargetSchema.optional(),
  locale: NonEmptyStringSchema.optional(),
  height: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  returnUrl: UrlSchema.optional(),
});

export const LisSchema = strictObject({
  personSourcedId: NonEmptyStringSchema.optional(),
  courseOfferingSourcedId: NonEmptyStringSchema.optional(),
  courseSectionSourcedId: NonEmptyStringSchema.optional(),
  membershipSourcedId: NonEmptyStringSchema.optional(),
});

export const RolesSchema = z.array(LtiRoleSchema).min(1);
export const CustomParametersSchema = z.record(z.string().min(1), z.union([z.string(), z.number(), z.boolean()]));

export const ImageResourceSchema = strictObject({
  url: UrlSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional(),
});
// Inferred types from exported Zod validators.
export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;
export type Url = z.infer<typeof UrlSchema>;
export type UriReference = z.infer<typeof UriReferenceSchema>;
export type LtiVersion = z.infer<typeof LtiVersionSchema>;
export type DocumentTarget = z.infer<typeof DocumentTargetSchema>;
export type LtiRole = z.infer<typeof LtiRoleSchema>;
export type ResourceLink = z.infer<typeof ResourceLinkSchema>;
export type Context = z.infer<typeof ContextSchema>;
export type LaunchPresentation = z.infer<typeof LaunchPresentationSchema>;
export type Lis = z.infer<typeof LisSchema>;
export type Roles = z.infer<typeof RolesSchema>;
export type CustomParameters = z.infer<typeof CustomParametersSchema>;
export type ImageResource = z.infer<typeof ImageResourceSchema>;
