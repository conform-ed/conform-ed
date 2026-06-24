import { z } from "zod";

// CLR 2.0 Badge Connect-style API scope vocabulary. CLR 2.0 reuses Open Badges 3.0's Badge Connect
// service manifest + RFC 7591 client registration shapes (see open-badges/v3_0 —
// BadgeConnectManifestSchema, ClientRegistrationRequestSchema/ResponseSchema); only the scope URIs
// are CLR-specific.

export const CLR_SCOPE_CREDENTIAL_READONLY = "https://purl.imsglobal.org/spec/clr/v2p0/scope/credential.readonly";
export const CLR_SCOPE_CREDENTIAL_UPSERT = "https://purl.imsglobal.org/spec/clr/v2p0/scope/credential.upsert";

/** Every CLR 2.0 Badge Connect scope URI. */
export const CLR_BADGE_CONNECT_SCOPES = [CLR_SCOPE_CREDENTIAL_READONLY, CLR_SCOPE_CREDENTIAL_UPSERT] as const;

export const ClrBadgeConnectScopeSchema = z.enum(CLR_BADGE_CONNECT_SCOPES);
export type ClrBadgeConnectScope = z.infer<typeof ClrBadgeConnectScopeSchema>;
