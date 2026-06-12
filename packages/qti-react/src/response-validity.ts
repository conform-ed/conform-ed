/**
 * Response validity (ItemSessionControl validate-responses): "An invalid response is
 * defined to be a response which does not satisfy the constraints imposed by the
 * interaction with which it is associated." The constraint vocabulary is what the
 * view model carries on interaction nodes — min/max-choices, min/max-associations,
 * min-strings, pattern-mask, min-plays. Only authored attributes are validated:
 * rendering defaults (e.g. a radio group's single choice) are interaction behavior,
 * not submission constraints.
 */

import { compile as compileXsdPattern } from "xspattern";

import { isInteractionKind, v0ContentModel } from "./content-model";
import type { BodyNode } from "./runtime";
import { isResponseRecord } from "./types";
import type { ResponseValue } from "./types";

export type ResponseConstraintKind =
  | "minChoices"
  | "maxChoices"
  | "minAssociations"
  | "maxAssociations"
  | "minStrings"
  | "patternMask"
  | "minPlays";

export interface InteractionConstraint {
  readonly responseIdentifier: string;
  readonly kind: ResponseConstraintKind;
  /** The declared bound: a count for the min/max constraints, the XSD regex for patternMask. */
  readonly bound: number | string;
}

/** A constraint the current response fails — the reason a submission is invalid. */
export type ResponseViolation = InteractionConstraint;

const countConstraintKinds = ["minChoices", "maxChoices", "minAssociations", "maxAssociations", "minStrings"] as const;

/**
 * Walk the item body and collect the constraint attributes its interactions carry.
 * Zero bounds impose nothing: "If max-choices is 0 then there is no restriction";
 * "If min-choices is 0 then the candidate is not required to select any choices."
 */
export function collectInteractionConstraints(content: readonly BodyNode[] | undefined): InteractionConstraint[] {
  const constraints: InteractionConstraint[] = [];

  function walk(node: BodyNode): void {
    const record = node as unknown as Record<string, unknown>;

    if (isInteractionKind(v0ContentModel, node.kind) && typeof record["responseIdentifier"] === "string") {
      const responseIdentifier = record["responseIdentifier"];

      for (const kind of [...countConstraintKinds, "minPlays"] as const) {
        const bound = record[kind];

        if (typeof bound === "number" && bound > 0) {
          constraints.push({ responseIdentifier, kind, bound });
        }
      }

      const patternMask = record["patternMask"];

      if (typeof patternMask === "string" && patternMask !== "") {
        constraints.push({ responseIdentifier, kind: "patternMask", bound: patternMask });
      }

      return; // interactions do not nest
    }

    for (const key of ["content", "children"] as const) {
      const nested = record[key];

      if (Array.isArray(nested)) {
        for (const child of nested as readonly BodyNode[]) {
          walk(child);
        }
      }
    }
  }

  for (const node of content ?? []) {
    walk(node);
  }

  return constraints;
}

/** Selected members of a response: choices picked, associations made, strings entered. */
function memberCount(value: ResponseValue): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.filter((member) => member !== null && member !== "").length;
  }

  return 1;
}

/** The non-empty strings a pattern mask applies to (each container member must match). */
function stringMembers(value: ResponseValue): string[] {
  if (typeof value === "string") {
    return value === "" ? [] : [value];
  }

  if (Array.isArray(value)) {
    return value.filter((member): member is string => typeof member === "string" && member !== "");
  }

  return [];
}

function violates(constraint: InteractionConstraint, value: ResponseValue): boolean {
  switch (constraint.kind) {
    case "minChoices":
    case "minAssociations":
    case "minStrings":
      return memberCount(value) < Number(constraint.bound);
    case "maxChoices":
    case "maxAssociations":
      return memberCount(value) > Number(constraint.bound);
    case "minPlays": {
      // "Failure to play the media object the minimum number of times constitutes an
      // invalid response." The media response variable counts the plays.
      const plays = typeof value === "number" ? value : 0;

      return plays < Number(constraint.bound);
    }
    case "patternMask": {
      // "the pattern-mask specifies a regular expression that the candidate's
      // response must match in order to be considered valid" — XSD regex dialect.
      // An unanswered interaction is governed by the min* constraints, not the
      // pattern, and an uncompilable pattern never blocks the candidate.
      const members = stringMembers(value);

      if (members.length === 0) {
        return false;
      }

      try {
        const matches = compileXsdPattern(String(constraint.bound), { language: "xsd" });

        return !members.every((member) => matches(member));
      } catch {
        return false;
      }
    }
  }
}

/** The constraints the current responses fail; empty means the responses are valid. */
export function collectResponseViolations(
  constraints: readonly InteractionConstraint[],
  responses: Readonly<Record<string, ResponseValue>>,
): ResponseViolation[] {
  return constraints.filter((constraint) => {
    const value = responses[constraint.responseIdentifier] ?? null;

    // Record responses (PCI-style composites) carry no countable selection.
    return !isResponseRecord(value) && violates(constraint, value);
  });
}
