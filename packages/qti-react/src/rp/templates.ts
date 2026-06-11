/**
 * The QTI standard response-processing templates as built-in canonical rule trees
 * (ADR-0004): templates are interpreter inputs, not a separate scoring path. URIs are
 * matched by their final path segment, so both the QTI 2.x and 3.0 purl forms resolve.
 */

import type { RpRuleView } from "./types";

const matchCorrectRules: readonly RpRuleView[] = [
  {
    kind: "responseCondition",
    responseIf: {
      expression: {
        kind: "match",
        expressions: [
          { kind: "variable", identifier: "RESPONSE" },
          { kind: "correct", identifier: "RESPONSE" },
        ],
      },
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "baseValue", baseType: "float", value: 1 },
        },
      ],
    },
    responseElse: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "baseValue", baseType: "float", value: 0 },
        },
      ],
    },
  },
];

const mapResponseRules: readonly RpRuleView[] = [
  {
    kind: "responseCondition",
    responseIf: {
      expression: { kind: "isNull", expressions: [{ kind: "variable", identifier: "RESPONSE" }] },
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "baseValue", baseType: "float", value: 0 },
        },
      ],
    },
    responseElse: {
      rules: [
        { kind: "setOutcomeValue", identifier: "SCORE", expression: { kind: "mapResponse", identifier: "RESPONSE" } },
      ],
    },
  },
];

const mapResponsePointRules: readonly RpRuleView[] = [
  {
    kind: "responseCondition",
    responseIf: {
      expression: { kind: "isNull", expressions: [{ kind: "variable", identifier: "RESPONSE" }] },
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "baseValue", baseType: "float", value: 0 },
        },
      ],
    },
    responseElse: {
      rules: [
        {
          kind: "setOutcomeValue",
          identifier: "SCORE",
          expression: { kind: "mapResponsePoint", identifier: "RESPONSE" },
        },
      ],
    },
  },
];

const templatesBySegment: ReadonlyMap<string, readonly RpRuleView[]> = new Map([
  ["match_correct", matchCorrectRules],
  ["map_response", mapResponseRules],
  ["map_response_point", mapResponsePointRules],
]);

/** Resolve a standard-template URI to its canonical rules, or null when unknown. */
export function resolveTemplate(uri: string): readonly RpRuleView[] | null {
  const segment =
    uri
      .split("/")
      .at(-1)
      ?.replace(/\.xml$/u, "") ?? "";

  return templatesBySegment.get(segment) ?? null;
}
