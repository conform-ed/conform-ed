export * from "./clr_v2p0_clrcredential_schema";
export * from "./clr_v2p0_achievementcredential_schema";
export * from "./clr_v2p0_endorsementcredential_schema";
export * from "./clr_v2p0_profile_schema";
export * from "./clr_v2p0_getclrcredentialsresponse_schema";
export * from "./clr_v2p0_imsx_statusinfo_schema";
export * from "./clr_v2p0_badgeconnect";

import { AchievementCredentialSchema } from "./clr_v2p0_achievementcredential_schema";
import { ClrCredentialSchema } from "./clr_v2p0_clrcredential_schema";
import { EndorsementCredentialSchema } from "./clr_v2p0_endorsementcredential_schema";
import { GetClrCredentialsResponseSchema } from "./clr_v2p0_getclrcredentialsresponse_schema";
import { ImsxStatusInfoSchema } from "./clr_v2p0_imsx_statusinfo_schema";
import { ProfileSchema } from "./clr_v2p0_profile_schema";

export const Clr20DerivedZodTemplates = {
  clrCredential: ClrCredentialSchema,
  achievementCredential: AchievementCredentialSchema,
  endorsementCredential: EndorsementCredentialSchema,
  getClrCredentialsResponse: GetClrCredentialsResponseSchema,
  profile: ProfileSchema,
  imsxStatusInfo: ImsxStatusInfoSchema,
} as const;
