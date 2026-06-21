/**
 * Compose a Common Cartridge 1.4 (`.imscc`) from a neutral, typed structure — the inverse of
 * `decomposeCommonCartridge` (the CC *producer* side; ADR-0022 named the import direction, the
 * producer extends it). A consuming application maps its own domain onto the neutral
 * `ComposableCartridge` (an organization tree + typed resources carrying their file bytes); this
 * module emits the `imsmanifest.xml` and zips it together with the resource files.
 *
 * The manifest model is validated against the CC 1.4 manifest *profile* contract before
 * serialization, so the primitive refuses to emit a non-conformant cartridge — it is the
 * producer's conformance gate, the mirror of decompose's structural read. Like
 * `buildQtiItemContentPackage`, the zip is deterministic (no timestamps): identical inputs yield
 * byte-identical archives.
 */

import { strToU8, zipSync } from "fflate";

import {
  type CommonCartridgeIntendedUse,
  CommonCartridgeManifestProfileSchema,
  type CommonCartridgeManifestRaw,
  type CommonCartridgeResourceType,
} from "@conform-ed/contracts/common-cartridge/v1_4";
import { type AttributeValue, XmlWriter } from "@conform-ed/qti-xml";

import { CommonCartridgeError } from "./decompose";

/** The CC 1.4 content-packaging namespace; carries the `imsccv1p4` token decompose keys version off. */
const CARTRIDGE_NAMESPACE = "http://www.imsglobal.org/xsd/imsccv1p4/imscp_v1p2";
const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
const LOM_MANIFEST_NAMESPACE = "http://ltsc.ieee.org/xsd/imsccv1p4/LOM/manifest";
const CURRICULUM_STANDARDS_NAMESPACE = "http://www.imsglobal.org/xsd/imsccv1p4/imscsmd_v1p1";
const MANIFEST_FILE_NAME = "imsmanifest.xml";

/** A node in the organization (course-structure) tree the manifest carries. */
export type ComposableOrganizationItem = {
  identifier: string;
  /** Set on a leaf item that points at a resource; omit for a grouping item. */
  identifierref?: string;
  title: string;
  children?: readonly ComposableOrganizationItem[];
};

/** A file carried by a resource: its archive path (also listed as `<file href>`) plus its bytes. */
export type ComposableFile = {
  href: string;
  bytes: Uint8Array;
};

/** A typed cartridge resource — the producer's analogue of a decomposed `CcResource`. */
export type ComposableResource = {
  identifier: string;
  type: CommonCartridgeResourceType;
  /** Entry href. Omit for the profile-forbidden types (imsdt / imswl / the QTI 1.2.1 bindings). */
  href?: string;
  intendedUse?: CommonCartridgeIntendedUse;
  /** Marks the resource access-controlled (the imsccauth `protected` attribute). */
  protected?: boolean;
  /** Curriculum-standard GUIDs (a CASE alignment) → the resource's curriculumStandardsMetadataSet. */
  standardsGuids?: readonly string[];
  files?: readonly ComposableFile[];
  dependencies?: readonly string[];
};

/** The neutral input a consumer maps its domain onto; the inverse of `DecomposedCartridge`. */
export type ComposableCartridge = {
  /** Manifest identifier. */
  identifier: string;
  title: string;
  /** Default-organization identifier (defaults to `<identifier>-organization`). */
  organizationIdentifier?: string;
  /** Top-level items under the implicit rooted-hierarchy root item. */
  organizations: readonly ComposableOrganizationItem[];
  resources: readonly ComposableResource[];
};

function toManifestItem(item: ComposableOrganizationItem): Record<string, unknown> {
  const children = (item.children ?? []).map(toManifestItem);
  return {
    identifier: item.identifier,
    ...(item.identifierref === undefined ? {} : { identifierref: item.identifierref }),
    title: item.title,
    ...(children.length > 0 ? { item: children } : {}),
  };
}

function toManifestResourceMetadata(resource: ComposableResource): Record<string, unknown> | undefined {
  const guids = resource.standardsGuids ?? [];
  if (guids.length === 0) return undefined;
  return {
    curriculumStandardsMetadataSet: [
      {
        curriculumStandardsMetadata: [{ setOfGUIDs: [{ labelledGUID: guids.map((guid) => ({ GUID: guid })) }] }],
      },
    ],
  };
}

function toManifestResource(resource: ComposableResource): Record<string, unknown> {
  const metadata = toManifestResourceMetadata(resource);
  const files = resource.files ?? [];
  const dependencies = resource.dependencies ?? [];
  return {
    identifier: resource.identifier,
    type: resource.type,
    ...(resource.href === undefined ? {} : { href: resource.href }),
    ...(resource.intendedUse === undefined ? {} : { intendeduse: resource.intendedUse }),
    ...(resource.protected === undefined ? {} : { protected: resource.protected }),
    ...(metadata === undefined ? {} : { metadata }),
    ...(files.length > 0 ? { file: files.map((file) => ({ href: file.href })) } : {}),
    ...(dependencies.length > 0 ? { dependency: dependencies.map((identifierref) => ({ identifierref })) } : {}),
  };
}

/**
 * Map the neutral input onto the CC 1.4 manifest model and validate it against the profile
 * contract. Returns the validated model; throws `CommonCartridgeError` if non-conformant.
 */
function buildManifestModel(cartridge: ComposableCartridge): CommonCartridgeManifestRaw {
  const organizationIdentifier = cartridge.organizationIdentifier ?? `${cartridge.identifier}-organization`;
  const model = {
    identifier: cartridge.identifier,
    metadata: {
      schema: "IMS Common Cartridge",
      schemaversion: "1.4.0",
      lom: { general: { title: { string: [{ value: cartridge.title }] } } },
    },
    organizations: {
      organization: {
        identifier: organizationIdentifier,
        structure: "rooted-hierarchy",
        item: {
          identifier: `${organizationIdentifier}-root`,
          ...(cartridge.organizations.length > 0 ? { item: cartridge.organizations.map(toManifestItem) } : {}),
        },
      },
    },
    resources: { resource: cartridge.resources.map(toManifestResource) },
  };

  const parsed = CommonCartridgeManifestProfileSchema.safeParse(model);
  if (!parsed.success) {
    throw new CommonCartridgeError(`Cartridge is not a conformant CC 1.4 manifest: ${parsed.error.message}`);
  }
  return parsed.data;
}

function writeStandardsMetadata(writer: XmlWriter, guids: readonly string[]): void {
  writer.element("curriculumStandardsMetadataSet", [["xmlns", CURRICULUM_STANDARDS_NAMESPACE]], () => {
    writer.element("curriculumStandardsMetadata", [], () => {
      writer.element("setOfGUIDs", [], () => {
        for (const guid of guids) {
          writer.element("labelledGUID", [], () => writer.element("GUID", [], guid));
        }
      });
    });
  });
}

function writeOrganizationItem(writer: XmlWriter, item: ComposableOrganizationItem): void {
  const attributes: Array<readonly [string, AttributeValue]> = [["identifier", item.identifier]];
  if (item.identifierref !== undefined) attributes.push(["identifierref", item.identifierref]);
  writer.element("item", attributes, () => {
    writer.element("title", [], item.title);
    for (const child of item.children ?? []) writeOrganizationItem(writer, child);
  });
}

function writeResource(writer: XmlWriter, resource: ComposableResource): void {
  const attributes: Array<readonly [string, AttributeValue]> = [
    ["identifier", resource.identifier],
    ["type", resource.type],
  ];
  if (resource.href !== undefined) attributes.push(["href", resource.href]);
  if (resource.intendedUse !== undefined) attributes.push(["intendeduse", resource.intendedUse]);
  if (resource.protected === true) attributes.push(["protected", true]);
  writer.element("resource", attributes, () => {
    const guids = resource.standardsGuids ?? [];
    if (guids.length > 0) writer.element("metadata", [], () => writeStandardsMetadata(writer, guids));
    for (const file of resource.files ?? []) writer.element("file", [["href", file.href]]);
    for (const identifierref of resource.dependencies ?? []) {
      writer.element("dependency", [["identifierref", identifierref]]);
    }
  });
}

/** Serialize a CC 1.4 cartridge to its `imsmanifest.xml` (validated against the profile contract). */
export function serializeCommonCartridgeManifest(cartridge: ComposableCartridge): string {
  // Validate the manifest against the CC 1.4 profile contract; throws if non-conformant.
  buildManifestModel(cartridge);

  const organizationIdentifier = cartridge.organizationIdentifier ?? `${cartridge.identifier}-organization`;
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');
  writer.element(
    "manifest",
    [
      ["xmlns", CARTRIDGE_NAMESPACE],
      ["xmlns:xsi", XSI_NAMESPACE],
      ["identifier", cartridge.identifier],
    ],
    () => {
      writer.element("metadata", [], () => {
        writer.element("schema", [], "IMS Common Cartridge");
        writer.element("schemaversion", [], "1.4.0");
        writer.element("lom", [["xmlns", LOM_MANIFEST_NAMESPACE]], () => {
          writer.element("general", [], () => {
            writer.element("title", [], () => writer.element("string", [], cartridge.title));
          });
        });
      });

      writer.element("organizations", [], () => {
        writer.element(
          "organization",
          [
            ["identifier", organizationIdentifier],
            ["structure", "rooted-hierarchy"],
          ],
          () => {
            writer.element("item", [["identifier", `${organizationIdentifier}-root`]], () => {
              for (const item of cartridge.organizations) writeOrganizationItem(writer, item);
            });
          },
        );
      });

      writer.element("resources", [], () => {
        for (const resource of cartridge.resources) writeResource(writer, resource);
      });
    },
  );

  return writer.toString();
}

/**
 * Compose a CC 1.4 `.imscc` archive: `imsmanifest.xml` at the root plus every resource file at its
 * declared `href`. Deterministic (no timestamps), so identical inputs yield byte-identical archives.
 * Throws `CommonCartridgeError` if the manifest is not conformant.
 */
export function composeCommonCartridge(cartridge: ComposableCartridge): Uint8Array {
  const manifestXml = serializeCommonCartridgeManifest(cartridge);
  const entries: Record<string, Uint8Array> = { [MANIFEST_FILE_NAME]: strToU8(manifestXml) };
  for (const resource of cartridge.resources) {
    for (const file of resource.files ?? []) {
      entries[file.href] = file.bytes;
    }
  }
  return zipSync(entries);
}
