// Model-schema validation (OB-DSP / CLR-DSP: a displayer checks the credential against its
// model). The body is matched against the conform-ed Zod schema for its credential type —
// the same schemas the issuer side validates against — so "schema-valid" here means exactly
// what 1EdTech's model requires. Validation is an injected axis (the host opts in via
// `schemaValidator`): a strict schema can legitimately reject an extended-but-authentic
// credential, so whether that downgrades the verdict is the consumer's call.

import type { z } from "zod";

import { ClrCredentialSchema } from "@conform-ed/contracts/clr/v2_0";
import { AchievementCredentialSchema, OpenBadgeCredentialSchema } from "@conform-ed/contracts/open-badges/v3_0";
import { VerifiableCredentialSchema } from "@conform-ed/contracts/vc-data-model/v2_0";

import type { SchemaValidation, SchemaValidator } from "./resolvers";

function credentialTypes(credential: Record<string, unknown>): string[] {
  const type = credential["type"];
  if (typeof type === "string") {
    return [type];
  }
  return Array.isArray(type) ? type.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Pick the most specific conform-ed schema for the credential's declared `type` set. */
function selectSchema(credential: Record<string, unknown>): { name: string; schema: z.ZodType } {
  const types = credentialTypes(credential);
  if (types.includes("ClrCredential")) {
    return { name: "ClrCredential", schema: ClrCredentialSchema };
  }
  if (types.includes("OpenBadgeCredential")) {
    return { name: "OpenBadgeCredential", schema: OpenBadgeCredentialSchema };
  }
  if (types.includes("AchievementCredential")) {
    return { name: "AchievementCredential", schema: AchievementCredentialSchema };
  }
  return { name: "VerifiableCredential", schema: VerifiableCredentialSchema };
}

/** A SchemaValidator backed by conform-ed's OB 3.0 / CLR 2.0 / VC 2.0 Zod schemas. */
export const conformedSchemaValidator: SchemaValidator = {
  validate(credential: Record<string, unknown>): SchemaValidation {
    const { name, schema } = selectSchema(credential);
    const result = schema.safeParse(credential);
    if (result.success) {
      return { state: "valid", schema: name };
    }
    return {
      state: "invalid",
      schema: name,
      issues: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    };
  },
};
