import { describe, expect, test } from "bun:test";

import type { CoverageItem } from "../src/types";
import { walkXsd, type XsdWalkContext } from "../src/walkers/xsd";

const ctx: XsdWalkContext = { spec: "t", version: "1.0" };

// A synthetic schema exercising the constructs the walker maps: a global element
// root, a named complexType def, built-in + simpleType-enum + array elements, an
// attribute, a complexType reference (edge), and an `xs:any` extension group.
const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:t" xmlns="urn:t"
    elementFormDefault="qualified">
  <xs:group name="ext.group">
    <xs:sequence>
      <xs:any namespace="##other" processContents="strict" minOccurs="0" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:group>
  <xs:complexType name="Sub.Type">
    <xs:sequence>
      <xs:element name="label" type="xs:string" minOccurs="1" maxOccurs="1"/>
    </xs:sequence>
  </xs:complexType>
  <xs:complexType name="Thing.Type">
    <xs:annotation><xs:documentation>A Thing. The id MUST be unique.</xs:documentation></xs:annotation>
    <xs:sequence>
      <xs:element name="name" type="xs:string" minOccurs="1" maxOccurs="1"/>
      <xs:element name="count" type="xs:int" minOccurs="0" maxOccurs="1"/>
      <xs:element name="tag" type="xs:string" minOccurs="0" maxOccurs="unbounded"/>
      <xs:element name="status" minOccurs="1" maxOccurs="1">
        <xs:simpleType>
          <xs:restriction base="xs:string">
            <xs:enumeration value="a"/>
            <xs:enumeration value="b"/>
          </xs:restriction>
        </xs:simpleType>
      </xs:element>
      <xs:element name="child" type="Sub.Type" minOccurs="0" maxOccurs="1"/>
      <xs:group ref="ext.group"/>
    </xs:sequence>
    <xs:attribute name="id" use="required" type="xs:string"/>
  </xs:complexType>
  <xs:element name="thing" type="Thing.Type"/>
</xs:schema>`;

const { items, edges, docRootKey, sourceId } = walkXsd(xsd, "thing", ctx);
const byKey = new Map<string, CoverageItem>(items.map((i) => [i.key, i]));

describe("walkXsd", () => {
  test("emits the binding global element as the document root + target namespace", () => {
    expect(docRootKey).toBe("t:1.0:doc:thing");
    expect(byKey.get("t:1.0:doc:thing")?.kind).toBe("document");
    expect(sourceId).toBe("urn:t");
  });

  test("the document root edges to its named complexType", () => {
    expect(edges).toContainEqual({ from: "t:1.0:doc:thing", to: "t:1.0:def:Thing.Type" });
  });

  test("named complexTypes become definitions", () => {
    expect(byKey.get("t:1.0:def:Thing.Type")?.kind).toBe("definition");
    expect(byKey.get("t:1.0:def:Sub.Type")?.kind).toBe("definition");
  });

  test("child elements become properties under their owning type", () => {
    expect(byKey.has("t:1.0:def:Thing.Type/name")).toBe(true);
    expect(byKey.get("t:1.0:def:Thing.Type/name")?.jsonType).toBe("string");
  });

  test("maps XSD built-ins to JSON types", () => {
    expect(byKey.get("t:1.0:def:Thing.Type/count")?.jsonType).toBe("number");
  });

  test("minOccurs governs required", () => {
    expect(byKey.get("t:1.0:def:Thing.Type/name")?.required).toBe(true);
    expect(byKey.get("t:1.0:def:Thing.Type/count")?.required).toBeUndefined();
  });

  test("maxOccurs>1 produces an array layer with a `[]` element", () => {
    expect(byKey.get("t:1.0:def:Thing.Type/tag")?.jsonType).toBe("array");
    expect(byKey.get("t:1.0:def:Thing.Type/tag/[]")?.jsonType).toBe("string");
  });

  test("inline simpleType enumerations are captured", () => {
    expect(byKey.get("t:1.0:def:Thing.Type/status")?.enumValues).toEqual(["a", "b"]);
  });

  test("a complexType-typed element records a usage edge instead of inlining", () => {
    expect(edges).toContainEqual({ from: "t:1.0:def:Thing.Type/child", to: "t:1.0:def:Sub.Type" });
  });

  test("attributes become properties; use=required ⇒ required", () => {
    expect(byKey.get("t:1.0:def:Thing.Type/id")?.kind).toBe("property");
    expect(byKey.get("t:1.0:def:Thing.Type/id")?.required).toBe(true);
    expect(byKey.get("t:1.0:def:Thing.Type/id")?.jsonType).toBe("string");
  });

  test("a group ref records an edge; the group is walked once", () => {
    expect(edges).toContainEqual({ from: "t:1.0:def:Thing.Type", to: "t:1.0:def:ext.group" });
    expect(byKey.get("t:1.0:def:ext.group")?.kind).toBe("definition");
  });

  test("xs:any emits no named item (a wildcard is not an information-model node)", () => {
    expect([...byKey.keys()].some((k) => k.startsWith("t:1.0:def:ext.group/"))).toBe(false);
  });

  test("RFC-2119 prose in xs:documentation is flagged normative", () => {
    expect(byKey.get("t:1.0:def:Thing.Type")?.normative).toBe(true);
    expect(byKey.get("t:1.0:def:Thing.Type")?.description).toContain("The id MUST be unique.");
  });

  test("every usage edge targets a walked item", () => {
    const keys = new Set(items.map((i) => i.key));
    for (const edge of edges) expect(keys.has(edge.to)).toBe(true);
  });
});
