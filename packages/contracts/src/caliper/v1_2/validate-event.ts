/**
 * `validateCaliperEvent` — the reusable per-profile Caliper 1.2 event validator (conform-ed
 * ADR-0018). It promotes {@link CALIPER_TEXTUAL_EVENT_RULES} from data into a callable check so any
 * Caliper Sensor or Endpoint (emergent's projection seam and conformance lane) can validate an
 * emitted event without re-deriving the rules.
 *
 * The per-event Zod schemas already embed each profile's actor / action / object / generated /
 * target constraints (via `createCaliperEventWithRules`'s `superRefine`); this picks the schema by
 * the event's `type`, `safeParse`s it, and reports the metric profile and whether a per-profile rule
 * applied.
 *
 * Coverage caveat (honest residue): 14 event types carry full per-profile textual rules
 * (`hasProfileRule: true`); the {@link CALIPER_BOOTCAMP_ONLY_EVENT_TYPES} (FeedbackEvent,
 * OutcomeEvent, Questionnaire(Item)Event, ReadingEvent, ResourceManagementEvent, SearchEvent,
 * Survey(Invitation)Event, ToolLaunchEvent, and the generic Event) validate at the STRUCTURAL level
 * only (a well-formed Caliper Event whose action is drawn from the global action vocabulary) —
 * their per-profile action subsets are pending extraction from the Caliper 1.2 prose spec, which is
 * not in the vendored denominator. `hasProfileRule: false` flags exactly those.
 */

import type { ZodType } from "zod";

import { CaliperV1P2JsonSchemaEntryPoints } from "./caliper_v1p2_bootcamp_schema";
import { getReferenceType } from "./shared";
import { CALIPER_BOOTCAMP_ONLY_EVENT_TYPES, CALIPER_TEXTUAL_EVENT_RULES } from "./textual_requirements";

/** The 24 Caliper 1.2 event types (the 14 profile-ruled + the {@link CALIPER_BOOTCAMP_ONLY_EVENT_TYPES}). */
export const CALIPER_EVENT_TYPES: readonly string[] = [
  ...Object.keys(CALIPER_TEXTUAL_EVENT_RULES),
  ...CALIPER_BOOTCAMP_ONLY_EVENT_TYPES,
].filter((value, index, all) => all.indexOf(value) === index);

const EVENT_TYPE_SET = new Set(CALIPER_EVENT_TYPES);

export interface CaliperEventValidation {
  /** True when the value is a structurally-valid Caliper Event of a known type. */
  readonly valid: boolean;
  /** The event's `type`, or null if absent / not a string. */
  readonly eventType: string | null;
  /** The metric profile this event belongs to, when a per-profile textual rule exists. */
  readonly profile: string | null;
  /** True when a full per-profile actor/action/object rule was applied (the 14 profile-ruled events). */
  readonly hasProfileRule: boolean;
  /** Flattened Zod issues (`path: message`); empty when valid. */
  readonly errors: readonly string[];
}

/**
 * Validate a candidate Caliper 1.2 event. Picks the per-event schema by `type` and reports the
 * metric profile + whether a per-profile rule applied. A non-event type or a missing/garbled `type`
 * is `valid: false`.
 */
export function validateCaliperEvent(event: unknown): CaliperEventValidation {
  const eventType = getReferenceType(event);
  if (eventType === null) {
    return {
      valid: false,
      eventType: null,
      profile: null,
      hasProfileRule: false,
      errors: ["missing or non-string `type`"],
    };
  }
  if (!EVENT_TYPE_SET.has(eventType)) {
    return {
      valid: false,
      eventType,
      profile: null,
      hasProfileRule: false,
      errors: [`"${eventType}" is not a Caliper 1.2 Event type`],
    };
  }

  const schema = (CaliperV1P2JsonSchemaEntryPoints as Record<string, ZodType>)[eventType] as ZodType;
  const rule = CALIPER_TEXTUAL_EVENT_RULES[eventType];
  const result = schema.safeParse(event);
  return {
    valid: result.success,
    eventType,
    profile: rule?.profile ?? null,
    hasProfileRule: rule !== undefined,
    errors: result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}
