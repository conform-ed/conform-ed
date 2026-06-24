// Revocation / suspension evaluation (OB-DSP-4 / CLR-DSP-4: a displayer determines the
// issuer-driven status of a credential). The credential carries a `credentialStatus` entry
// (e.g. a BitstringStatusListEntry) pointing at a status-list credential; dereferencing and
// decoding that list is host I/O, supplied through the injected StatusResolver.
//
// Semantics, chosen so absence is honest and a present-but-uncheckable status fails safe:
//   - no `credentialStatus`                       → not-checked (nothing to determine)
//   - `credentialStatus` present, no resolver     → unknown (cannot assert non-revocation)
//   - `credentialStatus` present, resolver given  → active | revoked | suspended | unknown

import type { StatusResolver } from "./resolvers";
import type { RevocationCheck } from "./result";

function firstStatusEntry(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const status = body["credentialStatus"];
  if (Array.isArray(status)) {
    return status.find((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null);
  }
  if (typeof status === "object" && status !== null) {
    return status as Record<string, unknown>;
  }
  return undefined;
}

export async function evaluateRevocation(
  body: Record<string, unknown>,
  statusResolver?: StatusResolver,
): Promise<RevocationCheck> {
  const entry = firstStatusEntry(body);
  if (!entry) {
    return { state: "not-checked" };
  }

  const statusType = typeof entry["type"] === "string" ? entry["type"] : "(unknown)";
  if (!statusResolver) {
    return {
      state: "unknown",
      statusType,
      reason: "The credential carries a credentialStatus entry but no status resolver was supplied.",
    };
  }

  try {
    const lookup = await statusResolver.resolveStatus({ type: statusType, entry });
    return { state: lookup.state, statusType, ...(lookup.reason ? { reason: lookup.reason } : {}) };
  } catch (error) {
    return {
      state: "unknown",
      statusType,
      reason: `Status list could not be evaluated: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
