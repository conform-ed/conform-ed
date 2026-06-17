import { describe, expect, test } from "bun:test";

import type { CoverageItem } from "../src/types";
import type { WalkContext } from "../src/walkers/json-schema";
import { walkOpenApi } from "../src/walkers/openapi";

const ctx: WalkContext = { spec: "x", version: "1.0" };

const doc = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0" },
  components: {
    schemas: {
      Thing: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "The id MUST be unique." },
          owner: { $ref: "#/components/schemas/Person" },
        },
      },
      Person: { type: "object", properties: { name: { type: "string" } } },
    },
  },
});

const { items, edges, docRootKey, sourceId } = walkOpenApi(doc, "Thing", ctx);
const byKey = new Map<string, CoverageItem>(items.map((i) => [i.key, i]));

describe("walkOpenApi", () => {
  test("each component schema becomes a definition", () => {
    expect(byKey.get("x:1.0:def:Thing")?.kind).toBe("definition");
    expect(byKey.get("x:1.0:def:Person")?.kind).toBe("definition");
    expect(byKey.get("x:1.0:def:Thing/id")?.required).toBe(true);
    expect(byKey.get("x:1.0:def:Thing/id")?.normative).toBe(true);
  });

  test("the binding is exposed as a document root edged to its definition", () => {
    expect(docRootKey).toBe("x:1.0:doc:Thing");
    expect(byKey.get("x:1.0:doc:Thing")?.kind).toBe("document");
    expect(edges).toContainEqual({ from: "x:1.0:doc:Thing", to: "x:1.0:def:Thing" });
  });

  test("a #/components/schemas/ ref becomes a usage edge", () => {
    expect(edges).toContainEqual({ from: "x:1.0:def:Thing/owner", to: "x:1.0:def:Person" });
  });

  test("carries the document's info title + version as provenance", () => {
    expect(sourceId).toBe("Test API v1.0");
  });
});
