/**
 * XSD walker (L1) — the second schema-language walker described in conform-ed
 * ADR-0013, for the W3C XML Schema bindings (1EdTech Common Cartridge, QTI
 * 3.0.1 / 2.x). It walks the *literal* `.xsd` (the denominator) directly rather
 * than converting it to JSON Schema first: converters (xsd2jsonschema, Jsonix,
 * commercial GUIs) proved either dead, lossy (they drop `xs:documentation`, so the
 * normative-prose signal disappears), or non-reproducible in CI. Walking the XSD
 * keeps the published artifact as the denominator and preserves documentation.
 *
 * The emitted shape is identical to {@link walkSchemaTree}'s — {@link CoverageItem}s
 * keyed `spec:version:doc:<binding>/<path>` (a global element root) or
 * `spec:version:def:<TypeName>/<path>` (a named complexType / group /
 * attributeGroup), plus {@link UsageEdge}s for type / group / base references — so
 * the reconciler and Coverage Map contract are reused unchanged. The mapping:
 *
 * - global element named `<binding>`  → the `doc:` root; an edge to its type.
 * - named `complexType` / `group` / `attributeGroup` → a `def:` root.
 * - child `xs:element`                → a `property`; an edge when its type is a
 *                                        named complexType, inline `jsonType` for
 *                                        XSD built-ins / simpleType facets.
 * - `xs:attribute`                    → a `property` (XML attributes are object
 *                                        fields once parsed; `use="required"`
 *                                        ⇒ `required`).
 * - `complexContent` extension/restriction `base`, `xs:group ref`,
 *   `xs:attributeGroup ref` → edges, so the reconciler's transitive `$ref`
 *   resolution merges inherited / referenced members exactly as for JSON `$ref`.
 * - `xs:any` (a nameless wildcard) emits no item: it is an open extension point,
 *   not a named information-model node. conform-ed models such points as a named
 *   field (e.g. `extensions`), which therefore surfaces — correctly — as an
 *   `extension` residue until a `specRef` override bridges the rename.
 *
 * Built-in / namespace handling targets the 1EdTech XSD family, which uniformly
 * binds the XML Schema namespace to the `xs:` (or `xsd:`) prefix; a type whose
 * prefix is one of those is a built-in, anything else is a local type reference.
 */

import { XMLParser } from "fast-xml-parser";

import type { CoverageItem, ItemKind, UsageEdge } from "../types";

export interface XsdWalkContext {
  readonly spec: string;
  readonly version: string;
}

export interface XsdWalkResult {
  readonly items: readonly CoverageItem[];
  readonly edges: readonly UsageEdge[];
  /** The `doc:` root key produced for `binding` (for reconcile's documentRootKeys). */
  readonly docRootKey: string;
  /** The schema's `targetNamespace` (its published `$id` equivalent), if any. */
  readonly sourceId?: string;
}

type XmlNode = Record<string, unknown>;

const NORMATIVE_RE = /\b(?:MUST NOT|MUST|SHALL NOT|SHALL|REQUIRED)\b/;
const MAX_DESCRIPTION = 280;

// XML Schema built-in datatypes, grouped by the JSON type they reconcile against.
const XSD_STRING = new Set([
  "string",
  "normalizedString",
  "token",
  "language",
  "Name",
  "NCName",
  "NMTOKEN",
  "NMTOKENS",
  "ID",
  "IDREF",
  "IDREFS",
  "ENTITY",
  "ENTITIES",
  "anyURI",
  "QName",
  "NOTATION",
  "base64Binary",
  "hexBinary",
  "duration",
  "dateTime",
  "time",
  "date",
  "gYearMonth",
  "gYear",
  "gMonthDay",
  "gDay",
  "gMonth",
]);
const XSD_NUMBER = new Set([
  "decimal",
  "integer",
  "int",
  "long",
  "short",
  "byte",
  "nonNegativeInteger",
  "positiveInteger",
  "nonPositiveInteger",
  "negativeInteger",
  "unsignedLong",
  "unsignedInt",
  "unsignedShort",
  "unsignedByte",
  "float",
  "double",
]);
const XSD_PREFIXES = new Set(["xs", "xsd"]);

function isRecord(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): XmlNode[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).filter(isRecord);
}

function attr(node: XmlNode, name: string): string | undefined {
  const v = node[`@_${name}`];
  return typeof v === "string" ? v : undefined;
}

function localPart(qname: string): string {
  const colon = qname.indexOf(":");
  return colon === -1 ? qname : qname.slice(colon + 1);
}

function prefixOf(qname: string): string {
  const colon = qname.indexOf(":");
  return colon === -1 ? "" : qname.slice(0, colon);
}

function isBuiltin(qname: string): boolean {
  return XSD_PREFIXES.has(prefixOf(qname));
}

function builtinJsonType(qname: string): string | undefined {
  const local = localPart(qname);
  if (XSD_STRING.has(local)) return "string";
  if (XSD_NUMBER.has(local)) return "number";
  if (local === "boolean") return "boolean";
  return undefined; // anyType / anySimpleType and unknowns are left untyped
}

function collapse(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_DESCRIPTION ? `${flat.slice(0, MAX_DESCRIPTION - 1)}…` : flat;
}

/** Pull the `xs:annotation/xs:documentation` text off a node (handles arrays + `#text`). */
function readDoc(node: XmlNode): string | undefined {
  const parts: string[] = [];
  for (const annotation of toArray(node["annotation"])) {
    for (const doc of toArray(annotation["documentation"])) {
      const text = doc["#text"];
      if (typeof text === "string") parts.push(text);
    }
    // `<xs:documentation>plain text</xs:documentation>` parses to a bare string.
    const docValue = annotation["documentation"];
    if (typeof docValue === "string") parts.push(docValue);
  }
  if (parts.length === 0) return undefined;
  const collapsed = collapse(parts.join(" "));
  return collapsed.length > 0 ? collapsed : undefined;
}

function enumValuesOf(simpleType: XmlNode): readonly string[] | undefined {
  for (const restriction of toArray(simpleType["restriction"])) {
    const values = toArray(restriction["enumeration"])
      .map((e) => attr(e, "value"))
      .filter((v): v is string => v !== undefined);
    if (values.length > 0) return values;
  }
  return undefined;
}

function baseJsonTypeOf(simpleType: XmlNode): string | undefined {
  for (const restriction of toArray(simpleType["restriction"])) {
    const base = attr(restriction, "base");
    if (base !== undefined && isBuiltin(base)) return builtinJsonType(base);
  }
  return undefined;
}

/** jsonType / enum carried by an anonymous inline `<xs:simpleType>` on an element or attribute. */
function inlineSimpleInfo(node: XmlNode): { jsonType?: string; enumValues?: readonly string[] } {
  for (const st of toArray(node["simpleType"])) {
    const jsonType = baseJsonTypeOf(st);
    const enumValues = enumValuesOf(st);
    if (jsonType !== undefined || enumValues !== undefined) {
      return { ...(jsonType !== undefined ? { jsonType } : {}), ...(enumValues !== undefined ? { enumValues } : {}) };
    }
  }
  return {};
}

export function walkXsd(xsdText: string, binding: string, ctx: XsdWalkContext): XsdWalkResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });
  const parsed: unknown = parser.parse(xsdText);
  const schema = isRecord(parsed) && isRecord(parsed["schema"]) ? parsed["schema"] : undefined;
  if (schema === undefined) throw new Error("XSD root <schema> element not found");

  const complexTypes = new Map<string, XmlNode>();
  for (const ct of toArray(schema["complexType"])) {
    const name = attr(ct, "name");
    if (name !== undefined) complexTypes.set(name, ct);
  }
  const simpleTypes = new Map<string, XmlNode>();
  for (const st of toArray(schema["simpleType"])) {
    const name = attr(st, "name");
    if (name !== undefined) simpleTypes.set(name, st);
  }
  const groups = new Map<string, XmlNode>();
  for (const g of toArray(schema["group"])) {
    const name = attr(g, "name");
    if (name !== undefined) groups.set(name, g);
  }
  const attributeGroups = new Map<string, XmlNode>();
  for (const ag of toArray(schema["attributeGroup"])) {
    const name = attr(ag, "name");
    if (name !== undefined) attributeGroups.set(name, ag);
  }
  const elements = new Map<string, XmlNode>();
  for (const el of toArray(schema["element"])) {
    const name = attr(el, "name");
    if (name !== undefined) elements.set(name, el);
  }

  const items: CoverageItem[] = [];
  const edges: UsageEdge[] = [];
  const seen = new Set<string>();

  const emit = (item: CoverageItem): void => {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    items.push(item);
  };

  const buildItem = (
    key: string,
    kind: ItemKind,
    path: string,
    node: XmlNode,
    extra: Partial<CoverageItem>,
  ): CoverageItem => {
    const description = readDoc(node);
    return {
      key,
      kind,
      path,
      ...extra,
      ...(description !== undefined ? { description } : {}),
      ...(description !== undefined && NORMATIVE_RE.test(description) ? { normative: true } : {}),
    };
  };

  // Resolve an element/attribute `type` reference into either an inline jsonType
  // (built-in or local simpleType facet) or a `def:` edge (local complexType).
  const resolveTypeRef = (
    typeName: string | undefined,
    ownerKey: string,
  ): { jsonType?: string; enumValues?: readonly string[]; edgeTo?: string } => {
    if (typeName === undefined) return {};
    if (isBuiltin(typeName)) {
      const jsonType = builtinJsonType(typeName);
      return jsonType !== undefined ? { jsonType } : {};
    }
    const local = localPart(typeName);
    const simple = simpleTypes.get(local);
    if (simple !== undefined) {
      const jsonType = baseJsonTypeOf(simple);
      const enumValues = enumValuesOf(simple);
      return { ...(jsonType !== undefined ? { jsonType } : {}), ...(enumValues !== undefined ? { enumValues } : {}) };
    }
    if (complexTypes.has(local)) {
      edges.push({ from: ownerKey, to: `${ctx.spec}:${ctx.version}:def:${local}` });
      return { edgeTo: local };
    }
    return {}; // unknown / imported type: recorded as a plain untyped property
  };

  const defKey = (name: string): string => `${ctx.spec}:${ctx.version}:def:${name}`;
  const pending = new Set<string>(); // local type names still to be walked as defs

  const nameOrRef = (node: XmlNode): string | undefined => {
    const name = attr(node, "name");
    if (name !== undefined) return name;
    const ref = attr(node, "ref");
    return ref !== undefined ? localPart(ref) : undefined;
  };

  const emitElement = (el: XmlNode, rootKey: string, path: string): void => {
    const name = nameOrRef(el);
    if (name === undefined) return;
    const childPath = path === "" ? name : `${path}/${name}`;
    const childKey = `${rootKey}/${childPath}`;
    const required = (attr(el, "minOccurs") ?? "1") !== "0";
    const maxOccurs = attr(el, "maxOccurs");
    const isArray = maxOccurs === "unbounded" || (maxOccurs !== undefined && Number(maxOccurs) > 1);

    // The value node is the element itself, or its array element when repeatable.
    const valuePath = isArray ? `${childPath}/[]` : childPath;
    const valueKey = `${rootKey}/${valuePath}`;
    const ref = resolveTypeRef(attr(el, "type"), valueKey);
    const inline = inlineSimpleInfo(el);
    const jsonType = ref.jsonType ?? inline.jsonType;
    const enumValues = ref.enumValues ?? inline.enumValues;
    if (ref.edgeTo !== undefined) pending.add(ref.edgeTo);

    if (isArray) {
      emit(
        buildItem(childKey, "property", childPath, el, { jsonType: "array", ...(required ? { required: true } : {}) }),
      );
      // The `[]` value item carries the type; description stays on the named property only.
      emit(
        buildItem(
          valueKey,
          "property",
          valuePath,
          {},
          {
            ...(jsonType !== undefined ? { jsonType } : {}),
            ...(enumValues !== undefined ? { enumValues } : {}),
          },
        ),
      );
    } else {
      emit(
        buildItem(childKey, "property", childPath, el, {
          ...(required ? { required: true } : {}),
          ...(jsonType !== undefined ? { jsonType } : {}),
          ...(enumValues !== undefined ? { enumValues } : {}),
        }),
      );
    }

    // anonymous inline complexType → its members hang off the value path
    for (const inlineCt of toArray(el["complexType"])) collectMembers(inlineCt, rootKey, valuePath);
  };

  const emitAttribute = (att: XmlNode, rootKey: string, path: string): void => {
    const name = nameOrRef(att);
    if (name === undefined) return;
    const childPath = path === "" ? name : `${path}/${name}`;
    const childKey = `${rootKey}/${childPath}`;
    const required = attr(att, "use") === "required";
    const ref = resolveTypeRef(attr(att, "type"), childKey);
    const inline = inlineSimpleInfo(att);
    // XML attributes default to xs:anySimpleType, which reconciles as a string.
    const jsonType = ref.jsonType ?? inline.jsonType ?? "string";
    const enumValues = ref.enumValues ?? inline.enumValues;
    if (ref.edgeTo !== undefined) pending.add(ref.edgeTo);
    emit(
      buildItem(childKey, "property", childPath, att, {
        ...(required ? { required: true } : {}),
        jsonType,
        ...(enumValues !== undefined ? { enumValues } : {}),
      }),
    );
  };

  // Walk the members of a content container (a complexType body, an extension /
  // restriction body, or a nested model group), emitting children at `path`.
  function collectMembers(node: XmlNode, rootKey: string, path: string): void {
    const nodeKey = path === "" ? rootKey : `${rootKey}/${path}`;

    // complexContent / simpleContent: edge to the base type, then its own members.
    for (const content of [...toArray(node["complexContent"]), ...toArray(node["simpleContent"])]) {
      for (const derivation of [...toArray(content["extension"]), ...toArray(content["restriction"])]) {
        const base = attr(derivation, "base");
        if (base !== undefined && !isBuiltin(base) && complexTypes.has(localPart(base))) {
          edges.push({ from: nodeKey, to: defKey(localPart(base)) });
          pending.add(localPart(base));
        }
        collectMembers(derivation, rootKey, path);
      }
    }

    // model groups nest at the same path level (like JSON combinators)
    for (const groupKind of ["sequence", "choice", "all"] as const) {
      for (const group of toArray(node[groupKind])) collectMembers(group, rootKey, path);
    }

    for (const el of toArray(node["element"])) emitElement(el, rootKey, path);
    for (const att of toArray(node["attribute"])) emitAttribute(att, rootKey, path);

    // `xs:group ref` / `xs:attributeGroup ref` → edges; the named def is walked once.
    for (const g of toArray(node["group"])) {
      const ref = attr(g, "ref");
      if (ref !== undefined) {
        edges.push({ from: nodeKey, to: defKey(localPart(ref)) });
        pending.add(localPart(ref));
      }
    }
    for (const ag of toArray(node["attributeGroup"])) {
      const ref = attr(ag, "ref");
      if (ref !== undefined) {
        edges.push({ from: nodeKey, to: defKey(localPart(ref)) });
        pending.add(localPart(ref));
      }
    }
    // `xs:any` is intentionally not emitted (a nameless wildcard is not a named item).
  }

  const walkComplexType = (name: string): void => {
    const rootKey = defKey(name);
    if (seen.has(rootKey)) return;
    const node = complexTypes.get(name);
    if (node === undefined) return;
    emit(buildItem(rootKey, "definition", "", node, {}));
    collectMembers(node, rootKey, "");
  };

  const walkGroupLike = (name: string, source: ReadonlyMap<string, XmlNode>): void => {
    const rootKey = defKey(name);
    if (seen.has(rootKey)) return;
    const node = source.get(name);
    if (node === undefined) return;
    emit(buildItem(rootKey, "definition", "", node, {}));
    collectMembers(node, rootKey, "");
  };

  // 1. Walk the binding's global element as the document root.
  const rootElement = elements.get(binding);
  if (rootElement === undefined) {
    throw new Error(`global <xs:element name="${binding}"> not found in schema`);
  }
  const docRootKey = `${ctx.spec}:${ctx.version}:doc:${binding}`;
  const rootResolved = resolveTypeRef(attr(rootElement, "type"), docRootKey);
  emit(
    buildItem(docRootKey, "document", "", rootElement, {
      ...(rootResolved.jsonType !== undefined ? { jsonType: rootResolved.jsonType } : {}),
    }),
  );
  if (rootResolved.edgeTo !== undefined) pending.add(rootResolved.edgeTo);
  for (const inlineCt of toArray(rootElement["complexType"])) collectMembers(inlineCt, docRootKey, "");

  // 2. Walk every named complexType / group / attributeGroup as a shared definition
  //    (drain the worklist so transitively-referenced types are all walked once).
  for (const name of complexTypes.keys()) walkComplexType(name);
  for (const name of groups.keys()) walkGroupLike(name, groups);
  for (const name of attributeGroups.keys()) walkGroupLike(name, attributeGroups);
  // Anything still pending must already be covered by the full sweeps above; drain defensively.
  for (const name of pending) {
    if (seen.has(defKey(name))) continue;
    if (complexTypes.has(name)) walkComplexType(name);
    else if (groups.has(name)) walkGroupLike(name, groups);
    else if (attributeGroups.has(name)) walkGroupLike(name, attributeGroups);
  }

  const targetNamespace = attr(schema, "targetNamespace");
  return {
    items,
    edges,
    docRootKey,
    ...(targetNamespace !== undefined ? { sourceId: targetNamespace } : {}),
  };
}
