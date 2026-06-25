export {
  XmlExtensionNodeListSchema as QtiXmlExtensionNodeListSchema,
  XmlExtensionNodeSchema as QtiXmlExtensionNodeSchema,
} from "./shared";

// QTI controlled-vocabulary enums (the closed value-sets the ASI binding enumerates) — public so
// consumers (and the conformance Coverage Map's value-set verification) can validate against them.
export {
  QtiAriaAutocompleteSchema,
  QtiAriaCheckedSchema,
  QtiAriaCurrentSchema,
  QtiAriaExpandedSchema,
  QtiAriaInvalidSchema,
  QtiAriaLiveSchema,
  QtiAriaOrientationSchema,
  QtiAriaPressedSchema,
  QtiAriaRoleSchema,
  QtiAriaSelectedSchema,
  QtiAriaSortSchema,
  QtiBaseTypeSchema,
  QtiCardinalitySchema,
  QtiDirectionSchema,
  QtiExternalScoredSchema,
  QtiNavigationModeSchema,
  QtiOrientationSchema,
  QtiShapeSchema,
  QtiShowHideSchema,
  QtiSubmissionModeSchema,
  QtiSuppressTtsSchema,
  QtiViewSchema,
} from "./shared";

export * from "./imsqti_asiv3p0p1_v1p0";
export * from "./imsqti_itemv3p0p1_v1p0";
export * from "./imsqti_metadatav3p0_v1p0";
export * from "./imsqti_outcomev3p0p1_v1p0";
export * from "./imsqti_responseprocessingv3p0p1_v1p0";
export * from "./imsqti_resultv3p0_v1p0";
export * from "./imsqti_sectionv3p0p1_v1p0";
export * from "./imsqti_stimulusv3p0p1_v1p0";
export * from "./imsqti_testv3p0p1_v1p0";
export * from "./imsqti_usagedatav3p0_v1p0";
export * from "./imsqtiv3p0_imscpv1p2_v1p0";
export * from "./imsqtiv3p0_afa3p0pnp_v1p0";

import { QtiAsiProfileDocumentSchema } from "./imsqti_asiv3p0p1_v1p0";
import { QtiAssessmentItemDocumentSchema, QtiItemProfileDocumentSchema } from "./imsqti_itemv3p0p1_v1p0";
import { QtiMetadataDocumentSchema } from "./imsqti_metadatav3p0_v1p0";
import { QtiOutcomeDeclarationDocumentSchema } from "./imsqti_outcomev3p0p1_v1p0";
import { QtiResponseProcessingDocumentSchema } from "./imsqti_responseprocessingv3p0p1_v1p0";
import { QtiAssessmentResultDocumentSchema } from "./imsqti_resultv3p0_v1p0";
import { QtiAssessmentSectionDocumentSchema } from "./imsqti_sectionv3p0p1_v1p0";
import { QtiAssessmentStimulusDocumentSchema } from "./imsqti_stimulusv3p0p1_v1p0";
import {
  QtiAssessmentTestDocumentSchema,
  QtiOutcomeProcessingDocumentSchema,
  QtiTestProfileDocumentSchema,
} from "./imsqti_testv3p0p1_v1p0";
import { QtiUsageDataDocumentSchema } from "./imsqti_usagedatav3p0_v1p0";
import { QtiAccessForAllPnpDocumentSchema, QtiAccessForAllPnpRecordsDocumentSchema } from "./imsqtiv3p0_afa3p0pnp_v1p0";
import { QtiManifestDocumentSchema } from "./imsqtiv3p0_imscpv1p2_v1p0";

export const Qti301DerivedZodTemplates = {
  qtiAsiProfileDocument: QtiAsiProfileDocumentSchema,
  qtiItemProfileDocument: QtiItemProfileDocumentSchema,
  qtiTestProfileDocument: QtiTestProfileDocumentSchema,
  qtiAssessmentItemDocument: QtiAssessmentItemDocumentSchema,
  qtiAssessmentSectionDocument: QtiAssessmentSectionDocumentSchema,
  qtiAssessmentStimulusDocument: QtiAssessmentStimulusDocumentSchema,
  qtiAssessmentTestDocument: QtiAssessmentTestDocumentSchema,
  qtiOutcomeDeclarationDocument: QtiOutcomeDeclarationDocumentSchema,
  qtiOutcomeProcessingDocument: QtiOutcomeProcessingDocumentSchema,
  qtiResponseProcessingDocument: QtiResponseProcessingDocumentSchema,
  qtiMetadataDocument: QtiMetadataDocumentSchema,
  qtiAssessmentResultDocument: QtiAssessmentResultDocumentSchema,
  qtiUsageDataDocument: QtiUsageDataDocumentSchema,
  qtiManifestDocument: QtiManifestDocumentSchema,
  qtiAccessForAllPnpDocument: QtiAccessForAllPnpDocumentSchema,
  qtiAccessForAllPnpRecordsDocument: QtiAccessForAllPnpRecordsDocumentSchema,
} as const;
