import type { QtiRootDetection, QtiSchemaSelectionKey, QtiVersion } from "./types";

const qtiV22Namespace = "http://www.imsglobal.org/xsd/imsqti_v2p2";
const qtiV22MetadataNamespace = "http://www.imsglobal.org/xsd/imsqti_metadata_v2p2";
const qtiV22ResultsNamespace = "http://www.imsglobal.org/xsd/imsqti_result_v2p2";
const qtiV22UsageDataNamespace = "http://www.imsglobal.org/xsd/imsqti_usagedata_v2p2";
const qtiV22ManifestNamespace = "http://www.imsglobal.org/xsd/imscp_v1p1";
const qtiV30AsiNamespace = "http://www.imsglobal.org/xsd/imsqtiasi_v3p0";
const qtiV30ResultsNamespace = "http://www.imsglobal.org/xsd/imsqti_result_v3p0";
const qtiV30MetadataNamespace = "http://www.imsglobal.org/xsd/imsqti_metadata_v3p0";
const qtiV30ManifestNamespace = "http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1";
const qtiV30AfaPnpNamespace = "http://www.imsglobal.org/xsd/qti/qtiv3p0/imsafa3p0pnp_v1p0";

const attributePattern = /([A-Za-z_][A-Za-z0-9:._-]*)\s*=\s*("([^"]*)"|'([^']*)')/gu;

function stripLeadingXmlProlog(value: string): string {
  let remaining = value.replace(/^\uFEFF/u, "");

  while (true) {
    const next = remaining
      .replace(/^\s+/u, "")
      .replace(/^<\?xml[\s\S]*?\?>/u, "")
      .replace(/^\s+/u, "")
      .replace(/^<!--[\s\S]*?-->/u, "")
      .replace(/^\s+/u, "")
      .replace(/^<!DOCTYPE[\s\S]*?>/iu, "");

    if (next === remaining) {
      return remaining.replace(/^\s+/u, "");
    }

    remaining = next;
  }
}

function parseAttributes(rawAttributes: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of rawAttributes.matchAll(attributePattern)) {
    const name = match[1];
    if (!name) {
      continue;
    }
    const doubleQuoted = match[3];
    const singleQuoted = match[4];
    attributes[name] = doubleQuoted ?? singleQuoted ?? "";
  }

  return attributes;
}

function splitXmlName(name: string): { localName: string; prefix: string | undefined } {
  const [prefix, localName] = name.includes(":") ? name.split(":", 2) : [undefined, name];
  return {
    prefix,
    localName: localName ?? name,
  };
}

function inferVersion(namespaceUri: string | undefined, localName: string, xml: string): QtiVersion | undefined {
  if (
    namespaceUri === qtiV22Namespace ||
    namespaceUri === qtiV22MetadataNamespace ||
    namespaceUri === qtiV22ResultsNamespace ||
    namespaceUri === qtiV22UsageDataNamespace
  ) {
    return "2.2";
  }

  if (namespaceUri === qtiV22ManifestNamespace) {
    if (xml.includes("qtiv2p2") || xml.includes("QTIv2.2 Package")) {
      return "2.2";
    }
  }

  if (
    namespaceUri === qtiV30AsiNamespace ||
    namespaceUri === qtiV30ResultsNamespace ||
    namespaceUri === qtiV30MetadataNamespace ||
    namespaceUri === qtiV30AfaPnpNamespace
  ) {
    return "3.0.1";
  }

  if (namespaceUri === qtiV30ManifestNamespace) {
    return "3.0.1";
  }

  if (localName === "manifest" && xml.includes("qtiv2p2")) {
    return "2.2";
  }

  return undefined;
}

function inferSchemaSelectionKey(
  version: QtiVersion | undefined,
  namespaceUri: string | undefined,
  localName: string,
): QtiSchemaSelectionKey | undefined {
  if (!version) {
    return undefined;
  }

  if (version === "2.2") {
    if (namespaceUri === qtiV22Namespace) {
      switch (localName) {
        case "assessmentItem":
          return "qtiAssessmentItemDocument";
        case "assessmentSection":
          return "qtiAssessmentSectionDocument";
        case "assessmentStimulus":
          return "qtiAssessmentStimulusDocument";
        case "assessmentTest":
          return "qtiAssessmentTestDocument";
      }
    }

    if (namespaceUri === qtiV22MetadataNamespace && localName === "qtiMetadata") {
      return "qtiMetadataDocument";
    }

    if (namespaceUri === qtiV22ResultsNamespace && localName === "assessmentResult") {
      return "qtiAssessmentResultDocument";
    }

    if (namespaceUri === qtiV22ManifestNamespace && localName === "manifest") {
      return "qtiManifestDocument";
    }
  }

  if (version === "3.0.1") {
    if (namespaceUri === qtiV30AsiNamespace) {
      switch (localName) {
        case "qti-assessment-item":
          return "qtiAssessmentItemDocument";
        case "qti-assessment-section":
          return "qtiAssessmentSectionDocument";
        case "qti-assessment-stimulus":
          return "qtiAssessmentStimulusDocument";
        case "qti-assessment-test":
          return "qtiAssessmentTestDocument";
      }
    }

    if (namespaceUri === qtiV30MetadataNamespace && localName === "qtiMetadata") {
      return "qtiMetadataDocument";
    }

    if (namespaceUri === qtiV30ResultsNamespace && localName === "assessmentResult") {
      return "qtiAssessmentResultDocument";
    }

    if (namespaceUri === qtiV30AfaPnpNamespace) {
      switch (localName) {
        case "access-for-all-pnp":
          return "qtiAccessForAllPnpDocument";
        case "access-for-all-pnp-records":
          return "qtiAccessForAllPnpRecordsDocument";
      }
    }
  }

  return undefined;
}

export function detectQtiRoot(xml: string): QtiRootDetection | undefined {
  const stripped = stripLeadingXmlProlog(xml);
  const match = stripped.match(/^<([A-Za-z_][A-Za-z0-9:._-]*)([\s\S]*?)(?:\/?)>/u);

  if (!match) {
    return undefined;
  }

  const rootName = match[1];
  if (!rootName) {
    return undefined;
  }
  const rawAttributes = match[2] ?? "";
  const attributes = parseAttributes(rawAttributes);
  const { localName, prefix } = splitXmlName(rootName);
  const namespaceUri = prefix ? attributes[`xmlns:${prefix}`] : attributes["xmlns"];
  const inferredVersion = inferVersion(namespaceUri, localName, xml);
  const schemaSelectionKey = inferSchemaSelectionKey(inferredVersion, namespaceUri, localName);

  return {
    rootName,
    localName,
    ...(prefix !== undefined ? { prefix } : {}),
    ...(namespaceUri !== undefined ? { namespaceUri } : {}),
    ...(inferredVersion !== undefined ? { inferredVersion } : {}),
    ...(schemaSelectionKey !== undefined ? { schemaSelectionKey } : {}),
  };
}
