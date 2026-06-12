export type QtiFileKind = "html" | "other" | "xml" | "zip";
export type QtiXmlStatus = "malformed" | "not-xml" | "well-formed";
export type QtiSupportStatus =
  | "known-broken-example"
  | "not-xml"
  | "supported"
  | "unsupported-normalization"
  | "unsupported-root"
  | "zip-package";
export type QtiValidationStatus = "invalid" | "parse-error" | "unsupported" | "valid";
export type QtiVersion = "2.2" | "3.0.1";
export type QtiSchemaSelectionKey =
  | "qtiAccessForAllPnpDocument"
  | "qtiAccessForAllPnpRecordsDocument"
  | "qtiAssessmentItemDocument"
  | "qtiAssessmentResultDocument"
  | "qtiAssessmentSectionDocument"
  | "qtiAssessmentStimulusDocument"
  | "qtiAssessmentTestDocument"
  | "qtiManifestDocument"
  | "qtiMetadataDocument";

export interface QtiRootDetection {
  rootName: string;
  localName: string;
  prefix?: string;
  namespaceUri?: string;
  inferredVersion?: QtiVersion;
  schemaSelectionKey?: QtiSchemaSelectionKey;
}

export interface QtiExampleInventoryEntry {
  absolutePath: string;
  relativePath: string;
  sourceGroup: string;
  fileKind: QtiFileKind;
  xmlStatus: QtiXmlStatus;
  supportStatus: QtiSupportStatus;
  rootName?: string;
  localName?: string;
  namespaceUri?: string;
  inferredVersion?: QtiVersion;
  schemaSelectionKey?: QtiSchemaSelectionKey;
  contentHash: string;
  note?: string;
}

export interface QtiExampleInventorySummary {
  totalFiles: number;
  byFileKind: Record<QtiFileKind, number>;
  bySupportStatus: Record<QtiSupportStatus, number>;
  byVersion: Record<string, number>;
}

export interface QtiExampleInventoryReport {
  rootPath: string;
  generatedAt: string;
  entries: QtiExampleInventoryEntry[];
  summary: QtiExampleInventorySummary;
}

export interface QtiValidationIssue {
  path: string;
  message: string;
}

export interface QtiValidationResult {
  filePath: string;
  rootDetection?: QtiRootDetection;
  status: QtiValidationStatus;
  schemaSelectionKey?: QtiSchemaSelectionKey;
  normalizedDocument?: unknown;
  issues: QtiValidationIssue[];
}
