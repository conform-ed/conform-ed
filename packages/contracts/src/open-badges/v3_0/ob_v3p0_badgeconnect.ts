import { z } from "zod";

// Open Badges 3.0 Badge Connect API — the OAuth2-secured host protocol a wallet uses to discover a
// provider, register as a client (RFC 7591), and pull or push credentials (getCredentials / upsert).
// conform-ed owns the spec-defined contract layer (ADR-0038): the scope vocabulary, the
// `.well-known/badgeconnect.json` service manifest, and the RFC 7591 dynamic client registration
// request/response. CLR 2.0 reuses this manifest + registration shape (see clr/v2_0); only its scope
// URIs differ. Objects are intentionally non-strict — both the manifest and RFC 7591 metadata permit
// implementation extensions, so unknown keys are tolerated, not rejected.

// --- Scope vocabulary --------------------------------------------------------

export const OB_SCOPE_CREDENTIAL_READONLY = "https://purl.imsglobal.org/spec/ob/v3p0/scope/credential.readonly";
export const OB_SCOPE_CREDENTIAL_UPSERT = "https://purl.imsglobal.org/spec/ob/v3p0/scope/credential.upsert";
export const OB_SCOPE_PROFILE_READONLY = "https://purl.imsglobal.org/spec/ob/v3p0/scope/profile.readonly";
export const OB_SCOPE_PROFILE_UPDATE = "https://purl.imsglobal.org/spec/ob/v3p0/scope/profile.update";

/** Every Open Badges 3.0 Badge Connect scope URI. */
export const OPEN_BADGE_CONNECT_SCOPES = [
  OB_SCOPE_CREDENTIAL_READONLY,
  OB_SCOPE_CREDENTIAL_UPSERT,
  OB_SCOPE_PROFILE_READONLY,
  OB_SCOPE_PROFILE_UPDATE,
] as const;

export const OpenBadgeConnectScopeSchema = z.enum(OPEN_BADGE_CONNECT_SCOPES);
export type OpenBadgeConnectScope = z.infer<typeof OpenBadgeConnectScopeSchema>;

// --- `.well-known/badgeconnect.json` service manifest ------------------------

/** One Badge Connect API a host advertises (a `badgeConnectAPI[]` entry). */
export const BadgeConnectServiceSchema = z.object({
  name: z.string().min(1),
  image: z.url().optional(),
  apiBase: z.url(),
  scopesOffered: z.array(z.string().min(1)).min(1),
  authorizationUrl: z.url(),
  tokenUrl: z.url(),
  registrationUrl: z.url(),
  termsOfServiceUrl: z.url().optional(),
  privacyPolicyUrl: z.url().optional(),
});
export type BadgeConnectService = z.infer<typeof BadgeConnectServiceSchema>;

/** The host discovery document served at `/.well-known/badgeconnect.json`. */
export const BadgeConnectManifestSchema = z.object({
  "@context": z.url(),
  id: z.url().optional(),
  badgeConnectAPI: z.array(BadgeConnectServiceSchema).min(1),
});
export type BadgeConnectManifest = z.infer<typeof BadgeConnectManifestSchema>;

// --- RFC 7591 dynamic client registration ------------------------------------

export const BadgeConnectTokenEndpointAuthMethodSchema = z.enum(["client_secret_basic", "client_secret_post", "none"]);
export type BadgeConnectTokenEndpointAuthMethod = z.infer<typeof BadgeConnectTokenEndpointAuthMethodSchema>;

/** RFC 7591 client metadata a wallet POSTs to the registration endpoint. */
export const ClientRegistrationRequestSchema = z.object({
  client_name: z.string().min(1),
  redirect_uris: z.array(z.url()).min(1),
  client_uri: z.url().optional(),
  logo_uri: z.url().optional(),
  tos_uri: z.url().optional(),
  policy_uri: z.url().optional(),
  software_id: z.string().min(1).optional(),
  software_version: z.string().min(1).optional(),
  contacts: z.array(z.string().min(1)).optional(),
  token_endpoint_auth_method: BadgeConnectTokenEndpointAuthMethodSchema.optional(),
  grant_types: z.array(z.string().min(1)).optional(),
  response_types: z.array(z.string().min(1)).optional(),
  scope: z.string().optional(),
});
export type ClientRegistrationRequest = z.infer<typeof ClientRegistrationRequestSchema>;

/** The RFC 7591 registration response: the submitted metadata plus the issued client credentials. */
export const ClientRegistrationResponseSchema = ClientRegistrationRequestSchema.extend({
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
  client_id_issued_at: z.number().int().optional(),
  client_secret_expires_at: z.number().int().optional(),
  registration_access_token: z.string().optional(),
  registration_client_uri: z.url().optional(),
});
export type ClientRegistrationResponse = z.infer<typeof ClientRegistrationResponseSchema>;
