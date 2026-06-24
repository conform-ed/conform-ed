// Validity-window evaluation (OB-DSP-3 / CLR-DSP-3: a displayer determines expiry state).
//
// VC 2.0 names the bounds `validFrom` / `validUntil`; we also accept the VC 1.1 legacy
// names `issuanceDate` / `expirationDate` so third-party credentials still resolve a window.
// A missing/!unparseable bound is treated as open on that side; both-open is `unbounded`.

import type { ValidityWindow } from "./result";

function readDate(body: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function parseInstant(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? undefined : millis;
}

/**
 * Classify the credential against its validity window at `now` (default: wall clock).
 * Bounds that are present but unparseable are reported back verbatim while being treated
 * as open, so a displayer can still surface the raw value.
 */
export function evaluateValidityWindow(body: Record<string, unknown>, now: Date = new Date()): ValidityWindow {
  const validFrom = readDate(body, "validFrom", "issuanceDate");
  const validUntil = readDate(body, "validUntil", "expirationDate");

  const from = parseInstant(validFrom);
  const until = parseInstant(validUntil);
  const nowMillis = now.getTime();

  const window: ValidityWindow = { state: "unbounded" };
  if (validFrom !== undefined) {
    window.validFrom = validFrom;
  }
  if (validUntil !== undefined) {
    window.validUntil = validUntil;
  }

  if (from !== undefined && nowMillis < from) {
    window.state = "not-yet-valid";
    return window;
  }
  if (until !== undefined && nowMillis > until) {
    window.state = "expired";
    return window;
  }
  window.state = from !== undefined || until !== undefined ? "valid" : "unbounded";
  return window;
}
