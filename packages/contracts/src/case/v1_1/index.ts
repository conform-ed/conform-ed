import * as CaseV1P1Association from "./case_v1p1_cfassociation_jsonschema1";
import * as CaseV1P1AssociationGrouping from "./case_v1p1_cfassociationgrouping_jsonschema1";
import * as CaseV1P1AssociationSet from "./case_v1p1_cfassociationset_jsonschema1";
import * as CaseV1P1ConceptSet from "./case_v1p1_cfconceptset_jsonschema1";
import * as CaseV1P1Document from "./case_v1p1_cfdocument_jsonschema1";
import * as CaseV1P1DocumentSet from "./case_v1p1_cfdocumentset_jsonschema1";
import * as CaseV1P1Item from "./case_v1p1_cfitem_jsonschema1";
import * as CaseV1P1ItemTypeSet from "./case_v1p1_cfitemtypeset_jsonschema1";
import * as CaseV1P1License from "./case_v1p1_cflicense_jsonschema1";
import * as CaseV1P1Package from "./case_v1p1_cfpackage_jsonschema1";
import * as CaseV1P1Rubric from "./case_v1p1_cfrubric_jsonschema1";
import * as CaseV1P1SubjectSet from "./case_v1p1_cfsubjectset_jsonschema1";
import * as CaseV1P1Status from "./case_v1p1_imsx_statusinfo_jsonschema1";
import { CaseV1P1RestBindingOperations } from "./case_v1p1_openapi3_restbinding_schema";
import {
  CFAssociationGroupingSchema,
  CFAssociationSchema,
  CFAssociationSetSchema,
  CFConceptSetSchema,
  CFDocumentSchema,
  CFDocumentSetSchema,
  CFItemSchema,
  CFItemTypeSetSchema,
  CFLicenseSchema,
  CFPackageSchema,
  CFRubricSchema,
  CFSubjectSetSchema,
  ImsxStatusInfoSchema,
  LinkUriSchema,
  LinkGenUriSchema,
  UuidSchema,
  DateTimeSchema,
  ExtensionEnumSchema,
} from "./shared";

export const CaseV1_1 = {
  JsonSchema: {
    AssociationGrouping: CaseV1P1AssociationGrouping,
    Association: CaseV1P1Association,
    AssociationSet: CaseV1P1AssociationSet,
    ConceptSet: CaseV1P1ConceptSet,
    Document: CaseV1P1Document,
    DocumentSet: CaseV1P1DocumentSet,
    Item: CaseV1P1Item,
    ItemTypeSet: CaseV1P1ItemTypeSet,
    License: CaseV1P1License,
    Package: CaseV1P1Package,
    Rubric: CaseV1P1Rubric,
    SubjectSet: CaseV1P1SubjectSet,
    Status: CaseV1P1Status,
  },

  Schemas: {
    CFAssociation: CFAssociationSchema,
    CFAssociationGrouping: CFAssociationGroupingSchema,
    CFAssociationSet: CFAssociationSetSchema,
    CFConceptSet: CFConceptSetSchema,
    CFDocument: CFDocumentSchema,
    CFDocumentSet: CFDocumentSetSchema,
    CFItem: CFItemSchema,
    CFItemTypeSet: CFItemTypeSetSchema,
    CFLicense: CFLicenseSchema,
    CFPackage: CFPackageSchema,
    CFRubric: CFRubricSchema,
    CFSubjectSet: CFSubjectSetSchema,
    ImsxStatusInfo: ImsxStatusInfoSchema,
  },

  Shared: {
    LinkUri: LinkUriSchema,
    LinkGenUri: LinkGenUriSchema,
    Uuid: UuidSchema,
    DateTime: DateTimeSchema,
    ExtensionEnum: ExtensionEnumSchema,
  },

  RestBinding: {
    Operations: CaseV1P1RestBindingOperations,
  },
} as const;

export type CaseV1_1Schemas = typeof CaseV1_1.Schemas;

export const Case11DerivedZodTemplates = {
  description: "CASE v1.1 Zod schemas derived from official 1EdTech JSON Schema and OpenAPI3 specifications",
  specLinks: {
    base: "https://www.imsglobal.org/spec/case/v1p1",
    jsonSchema: "https://purl.imsglobal.org/spec/case/v1p1/schema/json/",
    openApi: "https://purl.imsglobal.org/spec/case/v1p1/schema/openapi/",
  },
  scopes: {
    jsonSchema: ["CFAssociation", "CFPackage", "CFItem", "CFRubric", "CFConceptSet"],
    restBinding: ["GET operations for all major entity types"],
  },
  notes: [
    "CASE v1.1 introduces Competency and Academic Standards modeling in JSON Schema format.",
    "Core entities are modeled as strict Zod schemas with UUID identifiers and datetime tracking.",
    "REST binding operations expose structured method/path/payload contracts for direct API implementation.",
    "Extensible vocabularies use open enum pattern (standard values + ext:* custom extensions).",
  ],
};
