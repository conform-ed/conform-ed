import { z } from "zod";

function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

function extensibleEnum<Values extends readonly [string, ...string[]]>(values: Values) {
  return z.union([z.enum(values), ExtensibleVocabularyValueSchema]);
}

export const UuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[8-9a-b][0-9a-f]{3}-[0-9a-f]{12}$/u);
const UriSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:.+$/u);
const DateSchema = z.iso.date();
export const DateTimeSchema = z.iso.datetime();

export const ExtensionEnumSchema = extensibleEnum;

const ExtensibleVocabularyValueSchema = z.string().regex(/^(ext:)[a-zA-Z0-9.\-_]+$/u);

const ASSOCIATION_TYPES = [
  "isChildOf",
  "isPeerOf",
  "isPartOf",
  "exactMatchOf",
  "precedes",
  "isRelatedTo",
  "replacedBy",
  "exemplar",
  "hasSkillLevel",
  "isTranslationOf",
] as const;

const LinkTargetTypeSchema = extensibleEnum(["CASE"]);
const AssociationTypeSchema = extensibleEnum(ASSOCIATION_TYPES);

export const CFAssociationExtensionSchema = z.record(z.string(), z.unknown());
export const CFAssociationGroupingExtensionSchema = z.record(z.string(), z.unknown());
export const CFConceptExtensionSchema = z.record(z.string(), z.unknown());
export const CFDefinitionExtensionSchema = z.record(z.string(), z.unknown());
export const CFDocumentExtensionSchema = z.record(z.string(), z.unknown());
export const CFItemExtensionSchema = z.record(z.string(), z.unknown());
export const CFItemTypeExtensionSchema = z.record(z.string(), z.unknown());
export const CFLicenseExtensionSchema = z.record(z.string(), z.unknown());
export const CFPackageExtensionSchema = z.record(z.string(), z.unknown());
export const CFRubricExtensionSchema = z.record(z.string(), z.unknown());
export const CFRubricCriterionExtensionSchema = z.record(z.string(), z.unknown());
export const CFRubricCriterionLevelExtensionSchema = z.record(z.string(), z.unknown());
export const CFSubjectExtensionSchema = z.record(z.string(), z.unknown());

export const LinkUriSchema = strictObject({
  title: z.string(),
  identifier: UuidSchema,
  uri: UriSchema,
});

export const LinkGenUriSchema = strictObject({
  title: z.string(),
  identifier: z.string(),
  uri: UriSchema,
  targetType: LinkTargetTypeSchema.optional(),
});

export const CFConceptSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  title: z.string(),
  keywords: z.string().optional(),
  hierarchyCode: z.string(),
  description: z.string().optional(),
  lastChangeDateTime: DateTimeSchema,
  extensions: CFConceptExtensionSchema.optional(),
});

export const CFConceptSetSchema = strictObject({
  CFConcepts: z.array(CFConceptSchema),
});

export const CFSubjectSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  title: z.string(),
  hierarchyCode: z.string(),
  description: z.string().optional(),
  lastChangeDateTime: DateTimeSchema,
  extensions: CFSubjectExtensionSchema.optional(),
});

export const CFSubjectSetSchema = strictObject({
  CFSubjects: z.array(CFSubjectSchema),
});

export const CFLicenseSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  title: z.string(),
  description: z.string().optional(),
  licenseText: z.string(),
  lastChangeDateTime: DateTimeSchema,
  extensions: CFLicenseExtensionSchema.optional(),
});

export const CFItemTypeSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  title: z.string(),
  description: z.string(),
  hierarchyCode: z.string(),
  typeCode: z.string().optional(),
  lastChangeDateTime: DateTimeSchema,
  extensions: CFItemTypeExtensionSchema.optional(),
});

export const CFItemTypeSetSchema = strictObject({
  CFItemTypes: z.array(CFItemTypeSchema),
});

export const CFAssociationGroupingSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  title: z.string(),
  description: z.string().optional(),
  lastChangeDateTime: DateTimeSchema,
  extensions: CFAssociationGroupingExtensionSchema.optional(),
});

export const CFAssociationSchema = strictObject({
  identifier: UuidSchema,
  associationType: AssociationTypeSchema,
  sequenceNumber: z.number().int().optional(),
  uri: UriSchema,
  originNodeURI: LinkGenUriSchema,
  destinationNodeURI: LinkGenUriSchema,
  CFAssociationGroupingURI: LinkUriSchema.optional(),
  lastChangeDateTime: DateTimeSchema,
  notes: z.string().optional(),
  extensions: CFAssociationExtensionSchema.optional(),
  CFDocumentURI: LinkUriSchema.optional(),
});

export const CFPckgAssociationSchema = strictObject({
  identifier: UuidSchema,
  associationType: AssociationTypeSchema,
  sequenceNumber: z.number().int().optional(),
  uri: UriSchema,
  originNodeURI: LinkGenUriSchema,
  destinationNodeURI: LinkGenUriSchema,
  CFAssociationGroupingURI: LinkUriSchema.optional(),
  lastChangeDateTime: DateTimeSchema,
  notes: z.string().optional(),
  extensions: CFAssociationExtensionSchema.optional(),
});

export const CFPckgDocumentSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  frameworkType: z.string().optional(),
  caseVersion: z.literal("1.1").optional(),
  creator: z.string(),
  title: z.string(),
  lastChangeDateTime: DateTimeSchema,
  officialSourceURL: UriSchema.optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  subject: z.array(z.string()).optional(),
  subjectURI: z.array(LinkUriSchema).optional(),
  language: z.string().optional(),
  version: z.string().optional(),
  adoptionStatus: z.string().optional(),
  statusStartDate: DateSchema.optional(),
  statusEndDate: DateSchema.optional(),
  licenseURI: LinkUriSchema.optional(),
  notes: z.string().optional(),
  extensions: CFDocumentExtensionSchema.optional(),
});

export const CFDocumentSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  frameworkType: z.string().optional(),
  caseVersion: z.literal("1.1").optional(),
  creator: z.string(),
  title: z.string(),
  lastChangeDateTime: DateTimeSchema,
  officialSourceURL: UriSchema.optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  subject: z.array(z.string()).optional(),
  subjectURI: z.array(LinkUriSchema).optional(),
  language: z.string().optional(),
  version: z.string().optional(),
  adoptionStatus: z.string().optional(),
  statusStartDate: DateSchema.optional(),
  statusEndDate: DateSchema.optional(),
  licenseURI: LinkUriSchema.optional(),
  notes: z.string().optional(),
  extensions: CFDocumentExtensionSchema.optional(),
  CFPackageURI: LinkUriSchema,
});

export const CFDocumentSetSchema = strictObject({
  CFDocuments: z.array(CFDocumentSchema),
});

export const CFPckgItemSchema = strictObject({
  identifier: UuidSchema,
  fullStatement: z.string(),
  alternativeLabel: z.string().optional(),
  CFItemType: z.string().optional(),
  uri: UriSchema,
  humanCodingScheme: z.string().optional(),
  listEnumeration: z.string().optional(),
  abbreviatedStatement: z.string().optional(),
  conceptKeywords: z.array(z.string()).optional(),
  conceptKeywordsURI: LinkUriSchema.optional(),
  notes: z.string().optional(),
  subject: z.array(z.string()).optional(),
  subjectURI: z.array(LinkUriSchema).optional(),
  language: z.string().optional(),
  educationLevel: z.array(z.string()).optional(),
  CFItemTypeURI: LinkUriSchema.optional(),
  licenseURI: LinkUriSchema.optional(),
  statusStartDate: DateSchema.optional(),
  statusEndDate: DateSchema.optional(),
  lastChangeDateTime: DateTimeSchema,
  extensions: CFItemExtensionSchema.optional(),
});

export const CFItemSchema = strictObject({
  identifier: UuidSchema,
  fullStatement: z.string(),
  alternativeLabel: z.string().optional(),
  CFItemType: z.string().optional(),
  uri: UriSchema,
  humanCodingScheme: z.string().optional(),
  listEnumeration: z.string().optional(),
  abbreviatedStatement: z.string().optional(),
  conceptKeywords: z.array(z.string()).optional(),
  conceptKeywordsURI: LinkUriSchema.optional(),
  notes: z.string().optional(),
  subject: z.array(z.string()).optional(),
  subjectURI: z.array(LinkUriSchema).optional(),
  language: z.string().optional(),
  educationLevel: z.array(z.string()).optional(),
  CFItemTypeURI: LinkUriSchema.optional(),
  licenseURI: LinkUriSchema.optional(),
  statusStartDate: DateSchema.optional(),
  statusEndDate: DateSchema.optional(),
  lastChangeDateTime: DateTimeSchema,
  extensions: CFItemExtensionSchema.optional(),
  CFDocumentURI: LinkUriSchema,
});

export const CFAssociationSetSchema = strictObject({
  CFItem: CFItemSchema,
  CFAssociations: z.array(CFPckgAssociationSchema),
});

export const CFRubricCriterionLevelSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  description: z.string().optional(),
  quality: z.string().optional(),
  score: z.number().optional(),
  feedback: z.string().optional(),
  position: z.number().int().optional(),
  rubricCriterionId: UuidSchema.optional(),
  lastChangeDateTime: DateTimeSchema,
  extensions: z.array(CFRubricCriterionLevelExtensionSchema).optional(),
});

export const CFRubricCriterionSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  category: z.string().optional(),
  description: z.string().optional(),
  CFItemURI: LinkUriSchema.optional(),
  weight: z.number().optional(),
  position: z.number().int().optional(),
  rubricId: UuidSchema.optional(),
  lastChangeDateTime: DateTimeSchema,
  CFRubricCriterionLevels: z.array(CFRubricCriterionLevelSchema).optional(),
  extensions: CFRubricCriterionExtensionSchema.optional(),
});

export const CFRubricSchema = strictObject({
  identifier: UuidSchema,
  uri: UriSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  lastChangeDateTime: DateTimeSchema,
  CFRubricCriteria: z.array(CFRubricCriterionSchema).optional(),
  extensions: CFRubricExtensionSchema.optional(),
});

export const CFDefinitionSchema = strictObject({
  CFConcepts: z.array(CFConceptSchema).optional(),
  CFSubjects: z.array(CFSubjectSchema).optional(),
  CFLicenses: z.array(CFLicenseSchema).optional(),
  CFItemTypes: z.array(CFItemTypeSchema).optional(),
  CFAssociationGroupings: z.array(CFAssociationGroupingSchema).optional(),
  extensions: CFDefinitionExtensionSchema.optional(),
});

export const CFPackageSchema = strictObject({
  CFDocument: CFPckgDocumentSchema,
  CFItems: z.array(CFPckgItemSchema).optional(),
  CFAssociations: z.array(CFPckgAssociationSchema).optional(),
  CFDefinitions: CFDefinitionSchema.optional(),
  CFRubrics: z.array(CFRubricSchema).optional(),
  extensions: CFPackageExtensionSchema.optional(),
});

// The imsx status-info controlled vocabularies (the 1EdTech REST status envelope codes).
export const ImsxCodeMinorFieldValueSchema = z.enum([
  "forbidden",
  "fullsuccess",
  "internal_server_error",
  "invalid_selection_field",
  "invalid_sort_field",
  "invalid_uuid",
  "server_busy",
  "unauthorised_request",
  "unknownobject",
]);
export const ImsxCodeMajorSchema = z.enum(["failure", "processing", "success", "unsupported"]);
export const ImsxSeveritySchema = z.enum(["error", "status", "warning"]);

export const ImsxCodeMinorFieldSchema = strictObject({
  imsx_codeMinorFieldName: z.string(),
  imsx_codeMinorFieldValue: ImsxCodeMinorFieldValueSchema,
});

export const ImsxCodeMinorSchema = strictObject({
  imsx_codeMinorField: z.array(ImsxCodeMinorFieldSchema),
});

export const ImsxStatusInfoSchema = strictObject({
  imsx_codeMajor: ImsxCodeMajorSchema,
  imsx_severity: ImsxSeveritySchema,
  imsx_description: z.string().optional(),
  imsx_codeMinor: ImsxCodeMinorSchema.optional(),
});

export { strictObject };
// Inferred types from exported Zod validators.
export type Uuid = z.infer<typeof UuidSchema>;
export type DateTime = z.infer<typeof DateTimeSchema>;
export type ExtensionEnum = z.infer<typeof ExtensionEnumSchema>;
export type CFAssociationExtension = z.infer<typeof CFAssociationExtensionSchema>;
export type CFAssociationGroupingExtension = z.infer<typeof CFAssociationGroupingExtensionSchema>;
export type CFConceptExtension = z.infer<typeof CFConceptExtensionSchema>;
export type CFDefinitionExtension = z.infer<typeof CFDefinitionExtensionSchema>;
export type CFDocumentExtension = z.infer<typeof CFDocumentExtensionSchema>;
export type CFItemExtension = z.infer<typeof CFItemExtensionSchema>;
export type CFItemTypeExtension = z.infer<typeof CFItemTypeExtensionSchema>;
export type CFLicenseExtension = z.infer<typeof CFLicenseExtensionSchema>;
export type CFPackageExtension = z.infer<typeof CFPackageExtensionSchema>;
export type CFRubricExtension = z.infer<typeof CFRubricExtensionSchema>;
export type CFRubricCriterionExtension = z.infer<typeof CFRubricCriterionExtensionSchema>;
export type CFRubricCriterionLevelExtension = z.infer<typeof CFRubricCriterionLevelExtensionSchema>;
export type CFSubjectExtension = z.infer<typeof CFSubjectExtensionSchema>;
export type LinkUri = z.infer<typeof LinkUriSchema>;
export type LinkGenUri = z.infer<typeof LinkGenUriSchema>;
export type CFConcept = z.infer<typeof CFConceptSchema>;
export type CFConceptSet = z.infer<typeof CFConceptSetSchema>;
export type CFSubject = z.infer<typeof CFSubjectSchema>;
export type CFSubjectSet = z.infer<typeof CFSubjectSetSchema>;
export type CFLicense = z.infer<typeof CFLicenseSchema>;
export type CFItemType = z.infer<typeof CFItemTypeSchema>;
export type CFItemTypeSet = z.infer<typeof CFItemTypeSetSchema>;
export type CFAssociationGrouping = z.infer<typeof CFAssociationGroupingSchema>;
export type CFAssociation = z.infer<typeof CFAssociationSchema>;
export type CFPckgAssociation = z.infer<typeof CFPckgAssociationSchema>;
export type CFPckgDocument = z.infer<typeof CFPckgDocumentSchema>;
export type CFDocument = z.infer<typeof CFDocumentSchema>;
export type CFDocumentSet = z.infer<typeof CFDocumentSetSchema>;
export type CFPckgItem = z.infer<typeof CFPckgItemSchema>;
export type CFItem = z.infer<typeof CFItemSchema>;
export type CFAssociationSet = z.infer<typeof CFAssociationSetSchema>;
export type CFRubricCriterionLevel = z.infer<typeof CFRubricCriterionLevelSchema>;
export type CFRubricCriterion = z.infer<typeof CFRubricCriterionSchema>;
export type CFRubric = z.infer<typeof CFRubricSchema>;
export type CFDefinition = z.infer<typeof CFDefinitionSchema>;
export type CFPackage = z.infer<typeof CFPackageSchema>;
export type ImsxCodeMinorField = z.infer<typeof ImsxCodeMinorFieldSchema>;
export type ImsxCodeMinor = z.infer<typeof ImsxCodeMinorSchema>;
export type ImsxStatusInfo = z.infer<typeof ImsxStatusInfoSchema>;
