/**
 * LOQ — Learning Opportunities and Qualifications (ELM v3.3 application profile).
 *
 * A plain ELM dataset (no VC envelope, no seal): multi-rooted at LearningOpportunity,
 * Qualification, and the four Specification classes (ADR-0019). These are views over the
 * ELM Core; LOQ adds no new classes, only the set of roots a LOQ dataset is validated from.
 */

export {
  LearningAchievementSpecificationSchema,
  LearningActivitySpecificationSchema,
  LearningAssessmentSpecificationSchema,
  LearningEntitlementSpecificationSchema,
  LearningOpportunitySchema,
  LearningOutcomeSchema,
  QualificationSchema,
} from "./core";
