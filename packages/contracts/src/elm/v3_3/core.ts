/**
 * ELM Core — the VC-agnostic European Learning Model v3.3 ontology, modelled as Zod
 * (conform-ed ADR-0019). One profile-neutral set of classes shared by all four application
 * profiles; the EDC profile (edc.ts) layers a W3C VC envelope + JAdES seal over it, while
 * LOQ/AMS/PID (loq.ts/ams.ts/pid.ts) are plain-dataset views over the same classes.
 *
 * Property names follow the literal SHACL shapes (the coverage reconciler joins by name).
 * Values are typed where the real EU corpus pins them and kept permissive (`z.unknown()`)
 * elsewhere so the 10 EU examples round-trip; deepening value types is a follow-on pass.
 * Every class is a {@link passthroughObject} so unmodelled long-tail fields never drop.
 *
 * Two ELM-specific serialisation facts (from the corpus, not the W3C VC base):
 *  - language-tagged text is `{ "<lang>": ["value", …] }` — a locale → string[] map;
 *  - `type` is a bare class-name string/array discriminator, not a node object.
 */

import { z } from "zod";

import { oneOrMany, passthroughObject } from "../../vc-data-model/v2_0/shared";

/** ELM language-tagged literal: `{ en: ["…"] }`. Kept permissive for round-trip. */
export const LangStringSchema = z.union([z.string(), z.record(z.string(), z.union([z.string(), z.array(z.string())]))]);

/** xsd:date / xsd:dateTime — kept as a string (the corpus mixes both); tighten later. */
const Dt = z.string();
/** A numeric ELM value (some are serialised as strings). */
const Num = z.union([z.number(), z.string()]);
/** The `type` discriminator: a class-name string or array of them. */
const TypeTag = oneOrMany(z.string());
/** Unknown-but-preserved value (named field, opaque shape) — always round-trips. */
const U = z.unknown();

/** A reference property: one-or-many of (bare IRI string | inline node), lazily typed. */
function link(target: () => z.ZodType) {
  return oneOrMany(z.union([z.string(), z.lazy(target)]));
}

// ───────────────────────────── Leaf / value classes ─────────────────────────────

export const ConceptSchemeSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
});

export const ConceptSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  prefLabel: LangStringSchema.optional(),
  altLabel: LangStringSchema.optional(),
  notation: U.optional(),
  inScheme: link(() => ConceptSchemeSchema).optional(),
  definition: LangStringSchema.optional(),
});

export const NoteSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  noteLiteral: LangStringSchema,
  noteFormat: link(() => ConceptSchema).optional(),
  language: link(() => ConceptSchema).optional(),
  subject: link(() => ConceptSchema).optional(),
});

export const IdentifierSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  notation: z.string(),
  schemeName: z.string().optional(),
  schemeId: z.string().optional(),
  schemeAgency: LangStringSchema.optional(),
  schemeVersion: z.string().optional(),
  issued: Dt.optional(),
  creator: U.optional(),
});

export const LegalIdentifierSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  notation: z.string(),
  schemeName: z.string().optional(),
  schemeId: z.string().optional(),
  schemeAgency: LangStringSchema.optional(),
  schemeVersion: z.string().optional(),
  issued: Dt.optional(),
  spatial: U,
  creator: U.optional(),
});

export const MediaObjectSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  content: z.string(),
  contentType: link(() => ConceptSchema),
  contentEncoding: link(() => ConceptSchema),
  contentUrl: z.string().optional(),
  contentSize: Num.optional(),
  attachmentType: link(() => ConceptSchema).optional(),
  title: LangStringSchema.optional(),
  description: LangStringSchema.optional(),
});

export const WebResourceSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  contentUrl: z.string(),
  title: LangStringSchema.optional(),
  language: link(() => ConceptSchema).optional(),
});

export const PhoneSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  phoneNumber: z.string().optional(),
  countryDialing: z.string().optional(),
  areaDialing: z.string().optional(),
  dialNumber: z.string().optional(),
});

export const GeometrySchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export const AddressSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  countryCode: link(() => ConceptSchema),
  fullAddress: link(() => NoteSchema).optional(),
  identifier: link(() => IdentifierSchema).optional(),
});

export const LocationSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  address: link(() => AddressSchema),
  geographicName: LangStringSchema.optional(),
  geometry: link(() => GeometrySchema).optional(),
  spatialCode: link(() => ConceptSchema).optional(),
  description: LangStringSchema.optional(),
  identifier: link(() => IdentifierSchema).optional(),
});

export const ContactPointSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  emailAddress: U.optional(),
  phone: link(() => PhoneSchema).optional(),
  contactForm: link(() => WebResourceSchema).optional(),
  address: link(() => AddressSchema).optional(),
  description: LangStringSchema.optional(),
  additionalNote: link(() => NoteSchema).optional(),
});

export const AmountSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  unit: link(() => ConceptSchema),
  value: Num,
});

export const PeriodOfTimeSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  startDate: Dt.optional(),
  endDate: Dt.optional(),
  prefLabel: LangStringSchema.optional(),
});

export const CreditPointSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  framework: link(() => ConceptSchema),
  point: z.string(),
});

export const DisplayDetailSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  image: link(() => MediaObjectSchema),
  page: Num,
});

export const IndividualDisplaySchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  language: link(() => ConceptSchema),
  displayDetail: oneOrMany(z.lazy(() => DisplayDetailSchema)),
});

export const DisplayParameterSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  title: LangStringSchema,
  language: oneOrMany(z.lazy(() => ConceptSchema)),
  primaryLanguage: link(() => ConceptSchema),
  individualDisplay: oneOrMany(z.lazy(() => IndividualDisplaySchema)),
  description: LangStringSchema.optional(),
  summaryDisplay: z.string().optional(),
});

export const GradingSchemeSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  title: LangStringSchema,
  description: LangStringSchema.optional(),
  identifier: link(() => IdentifierSchema).optional(),
  supplementaryDocument: link(() => WebResourceSchema).optional(),
});

export const ResultCategorySchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  label: z.string(),
  score: z.string().optional(),
  maxScore: z.string().optional(),
  minScore: z.string().optional(),
  count: Num,
});

export const ResultDistributionSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  resultCategory: oneOrMany(z.lazy(() => ResultCategorySchema)).optional(),
  description: LangStringSchema.optional(),
});

export const ShortenedGradingSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  percentageLower: z.number(),
  percentageEqual: z.number(),
  percentageHigher: z.number(),
});

export const GrantSchema = passthroughObject({
  id: z.string().optional(),
  type: link(() => ConceptSchema).optional(),
  title: LangStringSchema,
  description: LangStringSchema.optional(),
  contentUrl: z.string().optional(),
  supplementaryDocument: link(() => WebResourceSchema).optional(),
});

export const PriceDetailSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  prefLabel: LangStringSchema.optional(),
  amount: link(() => AmountSchema).optional(),
  description: LangStringSchema.optional(),
  identifier: link(() => IdentifierSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
});

export const VerificationCheckSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag,
  subject: U,
  verificationStatus: link(() => ConceptSchema),
  description: LangStringSchema.optional(),
});

// ───────────────────────────── Agents ─────────────────────────────

export const AgentSchema: z.ZodType = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  identifier: link(() => IdentifierSchema).optional(),
  prefLabel: LangStringSchema.optional(),
  altLabel: LangStringSchema.optional(),
  contactPoint: link(() => ContactPointSchema).optional(),
  location: link(() => LocationSchema).optional(),
  groupMemberOf: link(() => GroupSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
  modified: Dt.optional(),
});

export const OrganisationSchema: z.ZodType = passthroughObject({
  id: z.string().optional(),
  type: link(() => ConceptSchema).optional(),
  legalName: LangStringSchema,
  location: oneOrMany(z.lazy(() => LocationSchema)),
  identifier: link(() => IdentifierSchema).optional(),
  altLabel: LangStringSchema.optional(),
  homepage: link(() => WebResourceSchema).optional(),
  accreditation: link(() => AccreditationSchema).optional(),
  eidasLegalIdentifier: link(() => LegalIdentifierSchema).optional(),
  vatIdentifier: link(() => LegalIdentifierSchema).optional(),
  taxIdentifier: link(() => LegalIdentifierSchema).optional(),
  registration: link(() => LegalIdentifierSchema).optional(),
  logo: link(() => MediaObjectSchema).optional(),
  contactPoint: link(() => ContactPointSchema).optional(),
  hasMember: link(() => AgentSchema).optional(),
  hasSubOrganization: link(() => OrganisationSchema).optional(),
  subOrganizationOf: link(() => OrganisationSchema).optional(),
  groupMemberOf: link(() => GroupSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
  modified: Dt.optional(),
});

export const GroupSchema: z.ZodType = passthroughObject({
  id: z.string().optional(),
  type: link(() => ConceptSchema).optional(),
  prefLabel: LangStringSchema,
  altLabel: LangStringSchema.optional(),
  member: link(() => AgentSchema).optional(),
  contactPoint: link(() => ContactPointSchema).optional(),
  location: link(() => LocationSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
});

export const PersonSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  identifier: link(() => IdentifierSchema).optional(),
  nationalId: link(() => LegalIdentifierSchema).optional(),
  fullName: LangStringSchema.optional(),
  givenName: LangStringSchema.optional(),
  familyName: LangStringSchema.optional(),
  birthName: LangStringSchema.optional(),
  patronymicName: LangStringSchema.optional(),
  dateOfBirth: Dt.optional(),
  placeOfBirth: link(() => LocationSchema).optional(),
  gender: link(() => ConceptSchema).optional(),
  citizenshipCountry: link(() => ConceptSchema).optional(),
  contactPoint: link(() => ContactPointSchema).optional(),
  location: link(() => LocationSchema).optional(),
  hasClaim: oneOrMany(z.lazy(() => ClaimSchema)),
  hasCredential: U.optional(),
  memberOf: link(() => OrganisationSchema).optional(),
  groupMemberOf: link(() => GroupSchema).optional(),
  modified: Dt.optional(),
});

// ───────────────────────────── Awarding ─────────────────────────────

export const AwardingProcessSchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  awardingBody: oneOrMany(z.union([z.string(), z.lazy(() => AgentSchema), z.lazy(() => OrganisationSchema)])),
  awardingDate: Dt.optional(),
  awards: U.optional(),
  used: U.optional(),
  description: LangStringSchema.optional(),
  location: link(() => LocationSchema).optional(),
  educationalSystemNote: link(() => NoteSchema).optional(),
  identifier: link(() => IdentifierSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
});

export const AwardingOpportunitySchema = passthroughObject({
  id: z.string().optional(),
  type: TypeTag.optional(),
  awardingBody: oneOrMany(z.union([z.string(), z.lazy(() => AgentSchema), z.lazy(() => OrganisationSchema)])),
  identifier: link(() => IdentifierSchema).optional(),
  learningAchievementSpecification: U.optional(),
  location: link(() => LocationSchema).optional(),
  temporal: link(() => PeriodOfTimeSchema).optional(),
});

// ───────────────────────────── Claims ─────────────────────────────

const claimBase = {
  id: z.string().optional(),
  type: oneOrMany(z.union([z.string(), z.lazy(() => ConceptSchema)])).optional(),
  title: LangStringSchema,
  description: LangStringSchema.optional(),
  identifier: link(() => IdentifierSchema).optional(),
  awardedBy: z.lazy(() => AwardingProcessSchema),
  supplementaryDocument: link(() => WebResourceSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
} as const;

export const LearningAchievementSchema = passthroughObject({
  ...claimBase,
  specifiedBy: U.optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  influencedBy: U.optional(),
  provenBy: U.optional(),
  entitlesTo: U.optional(),
  creditReceived: link(() => CreditPointSchema).optional(),
  learningOpportunity: link(() => LearningOpportunitySchema).optional(),
});

export const LearningActivitySchema = passthroughObject({
  ...claimBase,
  specifiedBy: U.optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  directedBy: U.optional(),
  influences: U.optional(),
  levelOfCompletion: link(() => ConceptSchema).optional(),
  workload: Dt.optional(),
  temporal: link(() => PeriodOfTimeSchema).optional(),
  location: link(() => LocationSchema).optional(),
  learningOpportunity: link(() => LearningOpportunitySchema).optional(),
});

export const LearningAssessmentSchema = passthroughObject({
  ...claimBase,
  grade: oneOrMany(z.union([z.string(), z.lazy(() => NoteSchema)])),
  gradeStatus: link(() => ConceptSchema).optional(),
  shortenedGrading: link(() => ShortenedGradingSchema).optional(),
  resultDistribution: link(() => ResultDistributionSchema).optional(),
  idVerification: link(() => ConceptSchema).optional(),
  specifiedBy: U.optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  proves: U.optional(),
  assessedBy: U.optional(),
  issued: Dt.optional(),
  location: link(() => LocationSchema).optional(),
});

export const LearningEntitlementSchema = passthroughObject({
  ...claimBase,
  specifiedBy: U.optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  entitledBy: U.optional(),
  issued: Dt.optional(),
  expiryDate: Dt.optional(),
});

export const ClaimSchema = z.union([
  LearningAchievementSchema,
  LearningActivitySchema,
  LearningAssessmentSchema,
  LearningEntitlementSchema,
  passthroughObject(claimBase),
]);

// ───────────────────────────── Specifications ─────────────────────────────

const specBase = {
  id: z.string().optional(),
  type: oneOrMany(z.union([z.string(), z.lazy(() => ConceptSchema)])).optional(),
  title: LangStringSchema,
  altLabel: LangStringSchema.optional(),
  description: LangStringSchema.optional(),
  identifier: link(() => IdentifierSchema).optional(),
  category: LangStringSchema.optional(),
  homepage: link(() => WebResourceSchema).optional(),
  supplementaryDocument: link(() => WebResourceSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
  status: z.string().optional(),
  modified: Dt.optional(),
} as const;

export const LearningOutcomeSchema = passthroughObject({
  id: z.string().optional(),
  type: link(() => ConceptSchema).optional(),
  title: LangStringSchema,
  identifier: link(() => IdentifierSchema).optional(),
  relatedSkill: link(() => ConceptSchema).optional(),
  relatedESCOSkill: link(() => ConceptSchema).optional(),
  reusabilityLevel: link(() => ConceptSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
});

export const LearningAchievementSpecificationSchema = passthroughObject({
  ...specBase,
  language: link(() => ConceptSchema).optional(),
  mode: link(() => ConceptSchema).optional(),
  learningSetting: link(() => ConceptSchema).optional(),
  learningOutcome: link(() => LearningOutcomeSchema).optional(),
  learningOutcomeSummary: link(() => NoteSchema).optional(),
  creditPoint: link(() => CreditPointSchema).optional(),
  volumeOfLearning: Dt.optional(),
  maximumDuration: Dt.optional(),
  educationLevel: link(() => ConceptSchema).optional(),
  educationSubject: link(() => ConceptSchema).optional(),
  ISCEDFCode: link(() => ConceptSchema).optional(),
  targetGroup: link(() => ConceptSchema).optional(),
  entryRequirement: link(() => NoteSchema).optional(),
  awardingOpportunity: link(() => AwardingOpportunitySchema).optional(),
  entitlesTo: U.optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  specialisationOf: U.optional(),
  generalisationOf: U.optional(),
  influencedBy: U.optional(),
  provenBy: U.optional(),
});

export const LearningActivitySpecificationSchema = passthroughObject({
  ...specBase,
  language: link(() => ConceptSchema).optional(),
  mode: link(() => ConceptSchema).optional(),
  contactHour: Dt.optional(),
  volumeOfLearning: Dt.optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  specialisationOf: U.optional(),
  generalisationOf: U.optional(),
  influences: U.optional(),
});

export const LearningAssessmentSpecificationSchema = passthroughObject({
  ...specBase,
  language: link(() => ConceptSchema).optional(),
  mode: link(() => ConceptSchema).optional(),
  gradingScheme: link(() => GradingSchemeSchema).optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  specialisationOf: U.optional(),
  generalisationOf: U.optional(),
  proves: U.optional(),
});

export const LearningEntitlementSpecificationSchema = passthroughObject({
  ...specBase,
  entitlementStatus: link(() => ConceptSchema),
  limitJurisdiction: link(() => ConceptSchema).optional(),
  limitOccupation: link(() => ConceptSchema).optional(),
  limitNationalOccupation: link(() => ConceptSchema).optional(),
  limitOrganisation: link(() => OrganisationSchema).optional(),
  entitledBy: U.optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  specialisationOf: U.optional(),
  generalisationOf: U.optional(),
});

export const QualificationSchema = passthroughObject({
  ...specBase,
  language: link(() => ConceptSchema).optional(),
  mode: link(() => ConceptSchema).optional(),
  learningSetting: link(() => ConceptSchema).optional(),
  learningOutcome: link(() => LearningOutcomeSchema).optional(),
  learningOutcomeSummary: link(() => NoteSchema).optional(),
  creditPoint: link(() => CreditPointSchema).optional(),
  volumeOfLearning: Dt.optional(),
  maximumDuration: Dt.optional(),
  educationLevel: link(() => ConceptSchema).optional(),
  educationSubject: link(() => ConceptSchema).optional(),
  ISCEDFCode: link(() => ConceptSchema).optional(),
  EQFLevel: link(() => ConceptSchema).optional(),
  NQFLevel: link(() => ConceptSchema).optional(),
  qualificationCode: link(() => ConceptSchema).optional(),
  isPartialQualification: z.boolean().optional(),
  targetGroup: link(() => ConceptSchema).optional(),
  entryRequirement: link(() => NoteSchema).optional(),
  accreditation: link(() => AccreditationSchema).optional(),
  awardingOpportunity: link(() => AwardingOpportunitySchema).optional(),
  entitlesTo: U.optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  specialisationOf: U.optional(),
  generalisationOf: U.optional(),
  influencedBy: U.optional(),
  provenBy: U.optional(),
});

export const LearningOpportunitySchema = passthroughObject({
  id: z.string().optional(),
  type: link(() => ConceptSchema).optional(),
  title: LangStringSchema,
  description: LangStringSchema.optional(),
  descriptionHtml: U.optional(),
  identifier: link(() => IdentifierSchema).optional(),
  providedBy: link(() => OrganisationSchema),
  learningAchievementSpecification: U.optional(),
  learningActivitySpecification: U.optional(),
  defaultLanguage: link(() => ConceptSchema).optional(),
  mode: link(() => ConceptSchema).optional(),
  location: link(() => LocationSchema).optional(),
  duration: Dt.optional(),
  temporal: link(() => PeriodOfTimeSchema).optional(),
  schedule: U.optional(),
  scheduleInformation: U.optional(),
  learningSchedule: U.optional(),
  additionalNote: link(() => NoteSchema).optional(),
  admissionProcedure: link(() => NoteSchema).optional(),
  applicationDeadline: Dt.optional(),
  priceDetail: link(() => PriceDetailSchema).optional(),
  grant: link(() => GrantSchema).optional(),
  bannerImage: link(() => MediaObjectSchema).optional(),
  homepage: link(() => WebResourceSchema).optional(),
  supplementaryDocument: link(() => WebResourceSchema).optional(),
  hasPart: U.optional(),
  isPartOf: U.optional(),
  status: z.string().optional(),
  modified: Dt.optional(),
});

// ───────────────────────────── Accreditation ─────────────────────────────

export const AccreditationSchema: z.ZodType = passthroughObject({
  id: z.string().optional(),
  type: link(() => ConceptSchema),
  title: LangStringSchema,
  description: LangStringSchema.optional(),
  accreditingAgent: z.lazy(() => OrganisationSchema),
  organisation: link(() => OrganisationSchema).optional(),
  limitQualification: U.optional(),
  limitField: link(() => ConceptSchema).optional(),
  limitEQFLevel: link(() => ConceptSchema).optional(),
  limitJurisdiction: link(() => ConceptSchema).optional(),
  limitCredentialType: link(() => ConceptSchema).optional(),
  decision: link(() => ConceptSchema).optional(),
  report: link(() => WebResourceSchema).optional(),
  status: z.string().optional(),
  identifier: link(() => IdentifierSchema).optional(),
  landingPage: link(() => WebResourceSchema).optional(),
  homepage: link(() => WebResourceSchema).optional(),
  supplementaryDocument: link(() => WebResourceSchema).optional(),
  additionalNote: link(() => NoteSchema).optional(),
  issued: Dt.optional(),
  modified: Dt.optional(),
  valid: Dt.optional(),
  expiryDate: Dt.optional(),
  reviewDate: Dt.optional(),
});

// Inferred types.
export type LangString = z.infer<typeof LangStringSchema>;
export type Concept = z.infer<typeof ConceptSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type Organisation = z.infer<typeof OrganisationSchema>;
export type Accreditation = z.infer<typeof AccreditationSchema>;
export type LearningAchievement = z.infer<typeof LearningAchievementSchema>;
export type Qualification = z.infer<typeof QualificationSchema>;
export type LearningOpportunity = z.infer<typeof LearningOpportunitySchema>;
export type DisplayParameter = z.infer<typeof DisplayParameterSchema>;
