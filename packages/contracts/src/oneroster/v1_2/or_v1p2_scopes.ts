import { z } from "zod";

// OneRoster 1.2 OAuth2 scope URIs — the protocol's `scope` token values. Repatriated from the
// consumer (emergent) so the scope vocabulary lives with the rest of the OneRoster contract: the
// shared OAuth2 authorization server and the OneRoster provider both validate a requested scope set
// against this canonical list, rather than each consumer re-declaring the strings.

export const ONEROSTER_SCOPE_ROSTER_CORE_READONLY =
  "https://purl.imsglobal.org/spec/or/v1p2/scope/roster-core.readonly";
export const ONEROSTER_SCOPE_ROSTER_READONLY = "https://purl.imsglobal.org/spec/or/v1p2/scope/roster.readonly";
export const ONEROSTER_SCOPE_ROSTER_DEMOGRAPHICS_READONLY =
  "https://purl.imsglobal.org/spec/or/v1p2/scope/roster-demographics.readonly";
export const ONEROSTER_SCOPE_GRADEBOOK_READONLY = "https://purl.imsglobal.org/spec/or/v1p2/scope/gradebook.readonly";
export const ONEROSTER_SCOPE_GRADEBOOK_CREATEPUT = "https://purl.imsglobal.org/spec/or/v1p2/scope/gradebook.createput";
export const ONEROSTER_SCOPE_GRADEBOOK_DELETE = "https://purl.imsglobal.org/spec/or/v1p2/scope/gradebook.delete";
export const ONEROSTER_SCOPE_RESOURCE_READONLY = "https://purl.imsglobal.org/spec/or/v1p2/scope/resource.readonly";

/** Every OneRoster 1.2 scope URI this contract recognizes. */
export const ONEROSTER_SCOPES = [
  ONEROSTER_SCOPE_ROSTER_CORE_READONLY,
  ONEROSTER_SCOPE_ROSTER_READONLY,
  ONEROSTER_SCOPE_ROSTER_DEMOGRAPHICS_READONLY,
  ONEROSTER_SCOPE_GRADEBOOK_READONLY,
  ONEROSTER_SCOPE_GRADEBOOK_CREATEPUT,
  ONEROSTER_SCOPE_GRADEBOOK_DELETE,
  ONEROSTER_SCOPE_RESOURCE_READONLY,
] as const;

export const OneRosterScopeSchema = z.enum(ONEROSTER_SCOPES);
export type OneRosterScope = z.infer<typeof OneRosterScopeSchema>;
