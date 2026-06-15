/**
 * Decompose a Common Cartridge (`.imscc`) into a neutral, typed structure: the manifest's
 * organization tree plus its resources, each classified by CC resource kind, alongside the raw
 * unzipped files. This is the artifact-shaped half of CC import (ADR-0022) — it interprets the
 * transport but maps nothing onto any consuming application's domain; the consumer routes each
 * resource (QTI → bridge, webcontent → static package, the rest → its own landing) itself.
 *
 * Parsing is deliberately **version-tolerant and structural**: real cartridges in the wild are
 * CC 1.1/1.2/1.3 as often as 1.4, so the walk reads the shared `imscp` shape they all share
 * rather than validating against a single version's schema (which would reject most real input).
 */

import { unzipSync, strFromU8 } from "fflate";

import { parseXmlDocument, type QtiXmlElementNode, type QtiXmlNode } from "@conform-ed/qti-xml";

export type CcVersion = "1.0" | "1.1" | "1.2" | "1.3" | "1.4" | "unknown";

export type CcResourceKind =
  | "qti-assessment"
  | "qti-question-bank"
  | "web-content"
  | "web-link"
  | "discussion-topic"
  | "lti-link"
  | "assignment"
  | "learning-application-resource"
  | "unknown";

export type CcResource = {
  identifier: string;
  /** Raw CC resource `type` attribute, verbatim. */
  type: string;
  kind: CcResourceKind;
  href: string | undefined;
  /** File paths declared by `<file href>` children. */
  files: string[];
  /** `identifierref`s of `<dependency>` children. */
  dependencies: string[];
};

export type CcOrganizationItem = {
  identifier: string | undefined;
  /** Points at a resource `identifier` (leaf items); absent for grouping items. */
  identifierref: string | undefined;
  title: string | undefined;
  children: CcOrganizationItem[];
};

export type DecomposedCartridge = {
  version: CcVersion;
  title: string | undefined;
  /** Roots of the default organization's item tree. */
  organizations: CcOrganizationItem[];
  resources: CcResource[];
  /** Every unzipped entry: path → bytes. */
  files: Record<string, Uint8Array>;
  /** Convenience: decode a file path as UTF-8 text (undefined if absent). */
  readText: (path: string) => string | undefined;
};

export class CommonCartridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommonCartridgeError";
  }
}

const MANIFEST_PATH = "imsmanifest.xml";

// --- node helpers ----------------------------------------------------------

function elements(node: QtiXmlElementNode, localName?: string): QtiXmlElementNode[] {
  return node.children.filter(
    (child): child is QtiXmlElementNode =>
      child.type === "element" && (localName === undefined || child.localName === localName),
  );
}

function firstElement(node: QtiXmlElementNode, localName: string): QtiXmlElementNode | undefined {
  return elements(node, localName)[0];
}

function attr(node: QtiXmlElementNode, name: string): string | undefined {
  return node.attributes[name];
}

function textOf(node: QtiXmlElementNode): string {
  const parts: string[] = [];
  const walk = (children: QtiXmlNode[]): void => {
    for (const child of children) {
      if (child.type === "text") parts.push(child.value);
      else walk(child.children);
    }
  };
  walk(node.children);
  return parts.join("").trim();
}

// --- classification --------------------------------------------------------

/** Map a raw CC resource `type` to a neutral kind (ADR-0022 routing table). */
export function classifyCcResourceType(type: string): CcResourceKind {
  const value = type.toLowerCase();
  if (value.startsWith("imsqti_")) {
    if (value.includes("question-bank") || value.includes("objectbank")) return "qti-question-bank";
    return "qti-assessment";
  }
  if (value === "webcontent" || value.startsWith("webcontent")) return "web-content";
  if (value.startsWith("imswl_")) return "web-link";
  if (value.startsWith("imsdt_")) return "discussion-topic";
  if (value.startsWith("imsbasiclti") || value.includes("lti")) return "lti-link";
  if (value.includes("assignment")) return "assignment";
  if (value.includes("learning-application-resource")) return "learning-application-resource";
  return "unknown";
}

// --- version detection -----------------------------------------------------

function detectVersion(manifest: QtiXmlElementNode, rawXml: string): CcVersion {
  const haystack = `${manifest.namespaceUri ?? ""} ${Object.values(manifest.attributes).join(" ")} ${rawXml.slice(0, 2000)}`;
  if (haystack.includes("imsccv1p4")) return "1.4";
  if (haystack.includes("imsccv1p3")) return "1.3";
  if (haystack.includes("imsccv1p2")) return "1.2";
  if (haystack.includes("imsccv1p1")) return "1.1";

  const schemaversion = firstElement(manifest, "metadata")
    ? textOf(firstElement(firstElement(manifest, "metadata")!, "schemaversion") ?? manifest)
    : "";
  if (schemaversion.startsWith("1.4")) return "1.4";
  if (schemaversion.startsWith("1.3")) return "1.3";
  if (schemaversion.startsWith("1.2")) return "1.2";
  if (schemaversion.startsWith("1.1")) return "1.1";
  if (schemaversion.startsWith("1.0")) return "1.0";
  return "unknown";
}

function extractTitle(manifest: QtiXmlElementNode): string | undefined {
  const metadata = firstElement(manifest, "metadata");
  if (!metadata) return undefined;
  const lom = firstElement(metadata, "lom");
  const general = lom ? firstElement(lom, "general") : undefined;
  const title = general ? firstElement(general, "title") : undefined;
  if (!title) return undefined;
  const string = firstElement(title, "string");
  const value = (string ? textOf(string) : textOf(title)).trim();
  return value.length > 0 ? value : undefined;
}

// --- manifest walk ---------------------------------------------------------

function mapOrganizationItem(item: QtiXmlElementNode): CcOrganizationItem {
  const titleNode = firstElement(item, "title");
  return {
    identifier: attr(item, "identifier"),
    identifierref: attr(item, "identifierref"),
    title: titleNode ? textOf(titleNode) : undefined,
    children: elements(item, "item").map(mapOrganizationItem),
  };
}

function mapResource(resource: QtiXmlElementNode): CcResource {
  const type = attr(resource, "type") ?? "";
  return {
    identifier: attr(resource, "identifier") ?? "",
    type,
    kind: classifyCcResourceType(type),
    href: attr(resource, "href"),
    files: elements(resource, "file")
      .map((file) => attr(file, "href"))
      .filter((href): href is string => href !== undefined),
    dependencies: elements(resource, "dependency")
      .map((dependency) => attr(dependency, "identifierref"))
      .filter((ref): ref is string => ref !== undefined),
  };
}

/**
 * Decompose a `.imscc` cartridge. Throws `CommonCartridgeError` if the archive cannot be
 * unzipped or has no parseable `imsmanifest.xml`; otherwise returns the neutral structure.
 */
export function decomposeCommonCartridge(bytes: Uint8Array): DecomposedCartridge {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (error) {
    throw new CommonCartridgeError(`Could not unzip cartridge: ${error instanceof Error ? error.message : "unknown"}`);
  }

  const manifestBytes = files[MANIFEST_PATH];
  if (!manifestBytes) {
    throw new CommonCartridgeError(`Cartridge has no ${MANIFEST_PATH}.`);
  }

  const manifestXml = strFromU8(manifestBytes);
  let manifest: QtiXmlElementNode;
  try {
    manifest = parseXmlDocument(manifestXml);
  } catch (error) {
    throw new CommonCartridgeError(
      `Could not parse ${MANIFEST_PATH}: ${error instanceof Error ? error.message : "invalid XML"}`,
    );
  }

  if (manifest.localName !== "manifest") {
    throw new CommonCartridgeError(`Expected <manifest> root in ${MANIFEST_PATH}, found <${manifest.localName}>.`);
  }

  const organizationsNode = firstElement(manifest, "organizations");
  const organization = organizationsNode ? firstElement(organizationsNode, "organization") : undefined;
  const organizations = organization ? elements(organization, "item").map(mapOrganizationItem) : [];

  const resourcesNode = firstElement(manifest, "resources");
  const resources = resourcesNode ? elements(resourcesNode, "resource").map(mapResource) : [];

  return {
    version: detectVersion(manifest, manifestXml),
    title: extractTitle(manifest),
    organizations,
    resources,
    files,
    readText: (path) => {
      const entry = files[path];
      return entry ? strFromU8(entry) : undefined;
    },
  };
}
