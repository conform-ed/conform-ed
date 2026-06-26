/**
 * ELM v3.3 Coverage Map sources (conform-ed ADR-0013 / ADR-0019). One {@link ElmProfileSource}
 * per application profile; each unions its vendored SHACL variant shapes and reconciles the
 * literal classes/properties against the conform-ed ELM Zod via the shared class registry.
 *
 * Vendored shapes under `vendor/elm/shapes/` are the literal denominator (see
 * `vendor/elm/PROVENANCE.md`); the Zod is `@conform-ed/contracts/elm/v3_3`.
 */

import { join } from "node:path";

import * as Elm from "@conform-ed/contracts/elm/v3_3";

import { buildElmCoverageMap, type ElmClassRegistry, type ElmProfileSource } from "../../src/elm";
import type { CoverageMap } from "../../src/types";
import type { ShaclVariantInput } from "../../src/walkers/shacl";

const shapesDir = join(import.meta.dir, "../../vendor/elm/shapes");
const shape = (name: string, variant: string): ShaclVariantInput => ({ path: join(shapesDir, name), variant });

/**
 * ELM class name → the conform-ed Zod that models it. Shared by all four profiles (the ELM
 * Core is profile-neutral). Abstract bases (Claim/Specification) and the VC base map to a
 * modelled subtype whose property set is a superset of theirs; classes absent here reconcile
 * as silent gaps (Mailbox/ShaclValidator2017 carry no properties, so their absence is inert).
 */
export const elmRegistry: ElmClassRegistry = {
  // EDC envelope + VC base
  EuropeanDigitalCredential: Elm.EuropeanDigitalCredentialSchema,
  EuropeanDigitalPresentation: Elm.EuropeanDigitalPresentationSchema,
  VerifiableCredential: Elm.EuropeanDigitalCredentialSchema,
  VerifiablePresentation: Elm.EuropeanDigitalPresentationSchema,
  Evidence: Elm.EdcEvidenceSchema,
  VerificationCheck: Elm.VerificationCheckSchema,
  // Agents
  Agent: Elm.AgentSchema,
  Person: Elm.PersonSchema,
  Organisation: Elm.OrganisationSchema,
  Group: Elm.GroupSchema,
  // Awarding
  AwardingProcess: Elm.AwardingProcessSchema,
  AwardingOpportunity: Elm.AwardingOpportunitySchema,
  // Claims (Claim base → a modelled subtype superset)
  Claim: Elm.LearningAchievementSchema,
  LearningAchievement: Elm.LearningAchievementSchema,
  LearningActivity: Elm.LearningActivitySchema,
  LearningAssessment: Elm.LearningAssessmentSchema,
  LearningEntitlement: Elm.LearningEntitlementSchema,
  // Specifications (Specification base → a modelled subtype superset)
  Specification: Elm.LearningAchievementSpecificationSchema,
  LearningAchievementSpecification: Elm.LearningAchievementSpecificationSchema,
  LearningActivitySpecification: Elm.LearningActivitySpecificationSchema,
  LearningAssessmentSpecification: Elm.LearningAssessmentSpecificationSchema,
  LearningEntitlementSpecification: Elm.LearningEntitlementSpecificationSchema,
  Qualification: Elm.QualificationSchema,
  LearningOpportunity: Elm.LearningOpportunitySchema,
  LearningOutcome: Elm.LearningOutcomeSchema,
  // Accreditation
  Accreditation: Elm.AccreditationSchema,
  // Leaves / value classes
  Concept: Elm.ConceptSchema,
  ConceptScheme: Elm.ConceptSchemeSchema,
  Note: Elm.NoteSchema,
  Identifier: Elm.IdentifierSchema,
  LegalIdentifier: Elm.LegalIdentifierSchema,
  MediaObject: Elm.MediaObjectSchema,
  WebResource: Elm.WebResourceSchema,
  Phone: Elm.PhoneSchema,
  Geometry: Elm.GeometrySchema,
  Address: Elm.AddressSchema,
  Location: Elm.LocationSchema,
  ContactPoint: Elm.ContactPointSchema,
  Amount: Elm.AmountSchema,
  PeriodOfTime: Elm.PeriodOfTimeSchema,
  CreditPoint: Elm.CreditPointSchema,
  DisplayParameter: Elm.DisplayParameterSchema,
  IndividualDisplay: Elm.IndividualDisplaySchema,
  DisplayDetail: Elm.DisplayDetailSchema,
  GradingScheme: Elm.GradingSchemeSchema,
  ResultCategory: Elm.ResultCategorySchema,
  ResultDistribution: Elm.ResultDistributionSchema,
  ShortenedGrading: Elm.ShortenedGradingSchema,
  Grant: Elm.GrantSchema,
  PriceDetail: Elm.PriceDetailSchema,
};

const common = { spec: "elm", version: "3.3", registry: elmRegistry } as const;

export const edcProfile: ElmProfileSource = {
  ...common,
  profile: "edc",
  variants: [
    shape("edc-generic-no-cv.ttl", "generic-no-cv"),
    shape("edc-generic-full.ttl", "generic-full"),
    shape("edc-accredited.ttl", "accredited"),
    shape("edc-converted.ttl", "converted"),
    shape("edc-issued-by-mandate.ttl", "issued-by-mandate"),
    shape("edc-diploma-supplement.ttl", "diploma-supplement"),
  ],
};

export const loqProfile: ElmProfileSource = {
  ...common,
  profile: "loq",
  variants: [shape("loq-constraints.ttl", "base"), shape("loq-constraints-mdr.ttl", "mdr")],
};

export const amsProfile: ElmProfileSource = {
  ...common,
  profile: "ams",
  variants: [shape("ams-constraints.ttl", "base"), shape("ams-constraints-mdr.ttl", "mdr")],
};

export const pidProfile: ElmProfileSource = {
  ...common,
  profile: "pid",
  variants: [shape("pid-constraints.ttl", "base")],
};

export const ELM_PROFILES: readonly ElmProfileSource[] = [edcProfile, loqProfile, amsProfile, pidProfile];

/** Coverage Map entries for the generate script (one committed map per profile). */
export const ELM_COVERAGE_ENTRIES: ReadonlyArray<{ build: (now?: string) => CoverageMap; file: string }> =
  ELM_PROFILES.map((profile) => ({
    build: (now?: string) => buildElmCoverageMap(profile, now !== undefined ? { now } : {}),
    file: `elm-${profile.profile}-v3.3.json`,
  }));
