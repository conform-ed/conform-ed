import { expect, test } from "bun:test";

import { ClrV2_0, OneRosterV1_2, OpenBadgesV3_0 } from "../src";

test("OpenBadgeConnectScopeSchema accepts the spec scope URIs and rejects others", () => {
  expect(
    OpenBadgesV3_0.OpenBadgeConnectScopeSchema.safeParse(OpenBadgesV3_0.OB_SCOPE_CREDENTIAL_READONLY).success,
  ).toBe(true);
  expect(OpenBadgesV3_0.OpenBadgeConnectScopeSchema.safeParse(OpenBadgesV3_0.OB_SCOPE_CREDENTIAL_UPSERT).success).toBe(
    true,
  );
  expect(OpenBadgesV3_0.OpenBadgeConnectScopeSchema.safeParse("https://example.com/scope/other").success).toBe(false);
  expect(OpenBadgesV3_0.OPEN_BADGE_CONNECT_SCOPES).toHaveLength(4);
});

test("ClrBadgeConnectScopeSchema carries the CLR 2.0 scope URIs", () => {
  expect(ClrV2_0.ClrBadgeConnectScopeSchema.safeParse(ClrV2_0.CLR_SCOPE_CREDENTIAL_READONLY).success).toBe(true);
  expect(ClrV2_0.ClrBadgeConnectScopeSchema.safeParse(ClrV2_0.CLR_SCOPE_CREDENTIAL_UPSERT).success).toBe(true);
  expect(ClrV2_0.ClrBadgeConnectScopeSchema.safeParse(OpenBadgesV3_0.OB_SCOPE_CREDENTIAL_READONLY).success).toBe(false);
});

test("OneRosterScopeSchema is the repatriated OneRoster 1.2 scope vocabulary", () => {
  expect(OneRosterV1_2.OneRosterScopeSchema.safeParse(OneRosterV1_2.ONEROSTER_SCOPE_ROSTER_CORE_READONLY).success).toBe(
    true,
  );
  expect(OneRosterV1_2.OneRosterScopeSchema.safeParse(OneRosterV1_2.ONEROSTER_SCOPE_GRADEBOOK_DELETE).success).toBe(
    true,
  );
  expect(OneRosterV1_2.ONEROSTER_SCOPES).toHaveLength(7);
});

test("BadgeConnectManifestSchema parses a realistic .well-known/badgeconnect.json", () => {
  const parsed = OpenBadgesV3_0.BadgeConnectManifestSchema.safeParse({
    "@context": "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    badgeConnectAPI: [
      {
        name: "Emergent",
        image: "https://emergent.example/logo.png",
        apiBase: "https://emergent.example/ims/ob/v3p0",
        scopesOffered: [
          OpenBadgesV3_0.OB_SCOPE_CREDENTIAL_READONLY,
          OpenBadgesV3_0.OB_SCOPE_CREDENTIAL_UPSERT,
          OpenBadgesV3_0.OB_SCOPE_PROFILE_READONLY,
        ],
        authorizationUrl: "https://emergent.example/o/authorize",
        tokenUrl: "https://emergent.example/o/token",
        registrationUrl: "https://emergent.example/o/register",
        termsOfServiceUrl: "https://emergent.example/tos",
        privacyPolicyUrl: "https://emergent.example/privacy",
      },
    ],
  });

  expect(parsed.success).toBe(true);
});

test("BadgeConnectManifestSchema requires at least one badgeConnectAPI entry", () => {
  const parsed = OpenBadgesV3_0.BadgeConnectManifestSchema.safeParse({
    "@context": "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    badgeConnectAPI: [],
  });

  expect(parsed.success).toBe(false);
});

test("ClientRegistrationRequestSchema follows RFC 7591 (client_name + redirect_uris required)", () => {
  const valid = OpenBadgesV3_0.ClientRegistrationRequestSchema.safeParse({
    client_name: "Example Wallet",
    redirect_uris: ["https://wallet.example/callback"],
    token_endpoint_auth_method: "client_secret_basic",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: `${OpenBadgesV3_0.OB_SCOPE_CREDENTIAL_READONLY} ${OpenBadgesV3_0.OB_SCOPE_CREDENTIAL_UPSERT}`,
  });
  expect(valid.success).toBe(true);

  // Missing redirect_uris is a registration error.
  expect(OpenBadgesV3_0.ClientRegistrationRequestSchema.safeParse({ client_name: "No redirects" }).success).toBe(false);
});

test("ClientRegistrationResponseSchema echoes the request and adds the issued client_id", () => {
  const parsed = OpenBadgesV3_0.ClientRegistrationResponseSchema.safeParse({
    client_name: "Example Wallet",
    redirect_uris: ["https://wallet.example/callback"],
    client_id: "client-abc",
    client_secret: "s3cr3t",
    client_id_issued_at: 1_700_000_000,
    registration_access_token: "rat-xyz",
    registration_client_uri: "https://emergent.example/o/register/client-abc",
  });

  expect(parsed.success).toBe(true);
  expect(parsed.success && parsed.data.client_id).toBe("client-abc");
});
