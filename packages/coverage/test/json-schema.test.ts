import { describe, expect, test } from "bun:test";

import { refDefName, walkSchemaTree, type WalkContext } from "../src/walkers/json-schema";

const ctx: WalkContext = { spec: "x", version: "1.0" };

describe("refDefName", () => {
  test("resolves $defs and definitions refs", () => {
    expect(refDefName("#/$defs/Foo")).toBe("Foo");
    expect(refDefName("#/definitions/Bar")).toBe("Bar");
  });
  test("ignores external and deep-pointer refs", () => {
    expect(refDefName("https://example.com/x.json")).toBeUndefined();
    expect(refDefName("#/$defs/A/properties/b")).toBeUndefined();
  });
});

describe("walkSchemaTree", () => {
  const schema = {
    type: "object",
    required: ["id", "kind"],
    properties: {
      id: { type: "string", description: "The id MUST be a URI." },
      kind: { enum: ["a", "b"] },
      tags: { type: "array", items: { type: "string" } },
      owner: { $ref: "#/$defs/Person" },
      shape: { oneOf: [{ type: "string" }, { type: "object", properties: { n: { type: "number" } } }] },
    },
  };

  const { items, edges } = walkSchemaTree("x:1.0:doc:thing", "document", schema, ctx);
  const byKey = new Map(items.map((i) => [i.key, i]));

  test("emits the root document item", () => {
    expect(byKey.get("x:1.0:doc:thing")?.kind).toBe("document");
  });

  test("keys properties by canonical path", () => {
    expect(byKey.has("x:1.0:doc:thing/id")).toBe(true);
    expect(byKey.has("x:1.0:doc:thing/kind")).toBe(true);
  });

  test("marks required properties from the parent's required list", () => {
    expect(byKey.get("x:1.0:doc:thing/id")?.required).toBe(true);
    expect(byKey.get("x:1.0:doc:thing/tags")?.required).toBeUndefined();
  });

  test("detects RFC-2119 normative prose", () => {
    expect(byKey.get("x:1.0:doc:thing/id")?.normative).toBe(true);
    expect(byKey.get("x:1.0:doc:thing/kind")?.normative).toBeUndefined();
  });

  test("captures enum values", () => {
    expect(byKey.get("x:1.0:doc:thing/kind")?.enumValues).toEqual(["a", "b"]);
  });

  test("records array elements under a `[]` segment", () => {
    expect(byKey.has("x:1.0:doc:thing/tags/[]")).toBe(true);
  });

  test("records $ref as a usage edge instead of expanding inline", () => {
    expect(edges).toContainEqual({ from: "x:1.0:doc:thing/owner", to: "x:1.0:def:Person" });
    // the Person definition itself is NOT walked here (the caller walks it once)
    expect([...byKey.keys()].some((k) => k.startsWith("x:1.0:def:Person"))).toBe(false);
  });

  test("recurses combinator branches at the same path", () => {
    expect(byKey.has("x:1.0:doc:thing/shape/n")).toBe(true);
  });

  test("namespaces def edges when defNamespace is set", () => {
    const scoped = walkSchemaTree("x:1.0:doc:thing", "document", schema, {
      ...ctx,
      defNamespace: "thing",
    });
    expect(scoped.edges).toContainEqual({
      from: "x:1.0:doc:thing/owner",
      to: "x:1.0:def:thing.Person",
    });
  });
});
