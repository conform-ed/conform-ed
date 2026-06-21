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
  CommonCartridgeManifestProfileSchema as CommonCartridgeV1p3ManifestProfileSchema,
  type CommonCartridgeResourceType as CommonCartridgeV1p3ResourceType,
} from "@conform-ed/contracts/common-cartridge/v1_3";
import {
  type CommonCartridgeIntendedUse,
  CommonCartridgeManifestProfileSchema,
  type CommonCartridgeResourceType,
} from "@conform-ed/contracts/common-cartridge/v1_4";
import { type AttributeValue, XmlWriter } from "@conform-ed/qti-xml";

import { CommonCartridgeError } from "./decompose";

/** Which Common Cartridge version the producer emits. CC 1.4 carries QTI 3 natively; CC 1.3 reaches
 * legacy LMSes (its QTI binding is the lossy 1.2.1 one, so the caller down-converts before composing). */
export type CommonCartridgeVersion = "1.3" | "1.4";

const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
const MANIFEST_FILE_NAME = "imsmanifest.xml";

/** Per-version namespaces, schemaversion, and the manifest profile contract (the conformance gate). */
const VERSION_CONFIG: Record<
  CommonCartridgeVersion,
  {
    cartridgeNamespace: string;
    lomManifestNamespace: string;
    curriculumStandardsNamespace: string;
    schemaversion: string;
    profileSchema: typeof CommonCartridgeManifestProfileSchema | typeof CommonCartridgeV1p3ManifestProfileSchema;
  }
> = {
  // The `imsccv1pN` token in the content-packaging namespace is what decompose keys the version off.
  "1.3": {
    cartridgeNamespace: "http://www.imsglobal.org/xsd/imsccv1p3/imscp_v1p2",
    lomManifestNamespace: "http://ltsc.ieee.org/xsd/imsccv1p3/LOM/manifest",
    curriculumStandardsNamespace: "http://www.imsglobal.org/xsd/imsccv1p3/imscsmd_v1p0",
    schemaversion: "1.3.0",
    profileSchema: CommonCartridgeV1p3ManifestProfileSchema,
  },
  "1.4": {
    cartridgeNamespace: "http://www.imsglobal.org/xsd/imsccv1p4/imscp_v1p2",
    lomManifestNamespace: "http://ltsc.ieee.org/xsd/imsccv1p4/LOM/manifest",
    curriculumStandardsNamespace: "http://www.imsglobal.org/xsd/imsccv1p4/imscsmd_v1p1",
    schemaversion: "1.4.0",
    profileSchema: CommonCartridgeManifestProfileSchema,
  },
};

const DEFAULT_VERSION: CommonCartridgeVersion = "1.4";

export type ComposeCartridgeOptions = { version?: CommonCartridgeVersion };

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

/** A typed cartridge resource — the producer's analogue of a decomposed `CcResource`. The type is a
 * CC 1.3 **or** 1.4 resource type; the version's profile contract rejects a type it does not allow. */
export type ComposableResourceType = CommonCartridgeResourceType | CommonCartridgeV1p3ResourceType;

/** A typed cartridge resource — the producer's analogue of a decomposed `CcResource`. */
export type ComposableResource = {
  identifier: string;
  type: ComposableResourceType;
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
 * Map the neutral input onto the manifest model and validate it against the version's profile
 * contract. Throws `CommonCartridgeError` if non-conformant (the producer's conformance gate).
 */
function validateManifestModel(cartridge: ComposableCartridge, version: CommonCartridgeVersion): void {
  const config = VERSION_CONFIG[version];
  const organizationIdentifier = cartridge.organizationIdentifier ?? `${cartridge.identifier}-organization`;
  const model = {
    identifier: cartridge.identifier,
    metadata: {
      schema: "IMS Common Cartridge",
      schemaversion: config.schemaversion,
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

  const parsed = config.profileSchema.safeParse(model);
  if (!parsed.success) {
    throw new CommonCartridgeError(`Cartridge is not a conformant CC ${version} manifest: ${parsed.error.message}`);
  }
}

function writeStandardsMetadata(
  writer: XmlWriter,
  guids: readonly string[],
  curriculumStandardsNamespace: string,
): void {
  writer.element("curriculumStandardsMetadataSet", [["xmlns", curriculumStandardsNamespace]], () => {
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

function writeResource(writer: XmlWriter, resource: ComposableResource, curriculumStandardsNamespace: string): void {
  const attributes: Array<readonly [string, AttributeValue]> = [
    ["identifier", resource.identifier],
    ["type", resource.type],
  ];
  if (resource.href !== undefined) attributes.push(["href", resource.href]);
  if (resource.intendedUse !== undefined) attributes.push(["intendeduse", resource.intendedUse]);
  if (resource.protected === true) attributes.push(["protected", true]);
  writer.element("resource", attributes, () => {
    const guids = resource.standardsGuids ?? [];
    if (guids.length > 0) {
      writer.element("metadata", [], () => writeStandardsMetadata(writer, guids, curriculumStandardsNamespace));
    }
    for (const file of resource.files ?? []) writer.element("file", [["href", file.href]]);
    for (const identifierref of resource.dependencies ?? []) {
      writer.element("dependency", [["identifierref", identifierref]]);
    }
  });
}

/** Serialize a cartridge to its `imsmanifest.xml` (validated against the version's profile contract). */
export function serializeCommonCartridgeManifest(
  cartridge: ComposableCartridge,
  options?: ComposeCartridgeOptions,
): string {
  const version = options?.version ?? DEFAULT_VERSION;
  const config = VERSION_CONFIG[version];
  // Validate the manifest against the version's profile contract; throws if non-conformant.
  validateManifestModel(cartridge, version);

  const organizationIdentifier = cartridge.organizationIdentifier ?? `${cartridge.identifier}-organization`;
  const writer = new XmlWriter();
  writer.line('<?xml version="1.0" encoding="UTF-8"?>');
  writer.element(
    "manifest",
    [
      ["xmlns", config.cartridgeNamespace],
      ["xmlns:xsi", XSI_NAMESPACE],
      ["identifier", cartridge.identifier],
    ],
    () => {
      writer.element("metadata", [], () => {
        writer.element("schema", [], "IMS Common Cartridge");
        writer.element("schemaversion", [], config.schemaversion);
        writer.element("lom", [["xmlns", config.lomManifestNamespace]], () => {
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
        for (const resource of cartridge.resources) {
          writeResource(writer, resource, config.curriculumStandardsNamespace);
        }
      });
    },
  );

  return writer.toString();
}

/**
 * Compose a `.imscc` archive (CC 1.4 by default, or CC 1.3 via `options.version`): `imsmanifest.xml`
 * at the root plus every resource file at its declared `href`. Deterministic (no timestamps), so
 * identical inputs yield byte-identical archives. Throws `CommonCartridgeError` if not conformant.
 */
export function composeCommonCartridge(cartridge: ComposableCartridge, options?: ComposeCartridgeOptions): Uint8Array {
  const manifestXml = serializeCommonCartridgeManifest(cartridge, options);
  const entries: Record<string, Uint8Array> = { [MANIFEST_FILE_NAME]: strToU8(manifestXml) };
  for (const resource of cartridge.resources) {
    for (const file of resource.files ?? []) {
      entries[file.href] = file.bytes;
    }
  }
  return zipSync(entries);
}
