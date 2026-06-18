import { describe, expect, test } from "bun:test";

import type { CoverageItem } from "../src/types";
import type { WalkContext } from "../src/walkers/json-schema";
import { walkOpenApi, walkOpenApiPaths } from "../src/walkers/openapi";

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

const restDoc = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Roster API", version: "1.2" },
  components: {
    securitySchemes: { OAuth2CC: { type: "oauth2", description: "Client Credentials." } },
  },
  paths: {
    "/things": {
      get: {
        operationId: "getAllThings",
        summary: "List things.",
        parameters: [
          { name: "limit", in: "query" },
          { name: "offset", in: "query" },
        ],
        security: [{ OAuth2CC: [] }],
      },
    },
    "/things/{sourcedId}": {
      get: { summary: "Get one.", parameters: [{ name: "fields", in: "query" }], security: [{ OAuth2CC: [] }] },
      put: { summary: "Replace one." },
    },
  },
});

describe("walkOpenApiPaths (transport axis)", () => {
  const { items, edges, sourceId } = walkOpenApiPaths(restDoc, "svc", ctx);
  const byKey = new Map<string, CoverageItem>(items.map((i) => [i.key, i]));

  test("each METHOD+template becomes a service-scoped operation item", () => {
    expect(byKey.get("x:1.0:path:svc/GET /things")?.kind).toBe("operation");
    expect(byKey.get("x:1.0:path:svc/GET /things/{sourcedId}")?.kind).toBe("operation");
    expect(byKey.get("x:1.0:path:svc/PUT /things/{sourcedId}")?.kind).toBe("operation");
  });

  test("distinct query parameters become shared parameter items, edged from their operations", () => {
    for (const p of ["limit", "offset", "fields"]) expect(byKey.get(`x:1.0:param:${p}`)?.kind).toBe("parameter");
    expect(edges).toContainEqual({ from: "x:1.0:path:svc/GET /things", to: "x:1.0:param:limit" });
  });

  test("security schemes become security items, edged from the operations that use them", () => {
    expect(byKey.get("x:1.0:sec:OAuth2CC")?.kind).toBe("security");
    expect(edges).toContainEqual({ from: "x:1.0:path:svc/GET /things", to: "x:1.0:sec:OAuth2CC" });
  });

  test("transport items carry no modelled verdict and report provenance", () => {
    for (const item of items) expect(item.modelled).toBeUndefined();
    expect(sourceId).toBe("Roster API v1.2");
  });
});
