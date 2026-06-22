import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { ltiV1_3 } from "../specs/lti/v1_3";
import { buildCoverageMap } from "../src/generate";

const ROLE_ITEM = "lti:1.3:doc:RoleVocabulary/role";

describe("value-set verification (ADR-0017)", () => {
  test("the LTI role vocabulary is fully modelled — every published member parses", () => {
    const map = buildCoverageMap(ltiV1_3, { now: "2026-01-01" });
    const roles = map.valueSets.find((v) => v.item === ROLE_ITEM);
    expect(roles).toBeDefined();
    expect(roles?.members).toBeGreaterThan(0);
    expect(roles?.modelled).toBe(roles?.members);
    expect(roles?.gaps).toEqual([]);
  });

  test("a model that rejects published members surfaces them as value-set gaps", () => {
    // Swap in a deliberately-narrow element: only the bare simple name "Learner" parses, so every
    // namespaced role URI the vocabulary lists must be reported as a value-set gap — the check the
    // structural property-join (which only matches names) cannot make.
    const narrowed = { ...ltiV1_3, valueSets: [{ item: ROLE_ITEM, element: z.literal("Learner") }] };
    const map = buildCoverageMap(narrowed, { now: "2026-01-01" });
    const roles = map.valueSets.find((v) => v.item === ROLE_ITEM);
    const gaps = roles?.gaps ?? [];

    expect(roles?.modelled).toBe(1);
    expect(gaps.length).toBeGreaterThan(30);
    expect(gaps).toContain("http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor");
    expect(map.rollup.valueSetGaps).toBe(gaps.length);
  });

  test("a value-set referencing an unknown item fails loudly", () => {
    const bad = { ...ltiV1_3, valueSets: [{ item: "lti:1.3:doc:NoSuchThing", element: z.string() }] };
    expect(() => buildCoverageMap(bad)).toThrow(/unknown item/u);
  });

  test("a value-set referencing an item with no enumValues fails loudly", () => {
    const bad = { ...ltiV1_3, valueSets: [{ item: "lti:1.3:doc:Score", element: z.string() }] };
    expect(() => buildCoverageMap(bad)).toThrow(/no enumValues/u);
  });
});
