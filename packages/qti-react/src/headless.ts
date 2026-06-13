/**
 * Headless (React-free) surface of @conform-ed/qti-react: the normalize → view adapters
 * and the capability gate, importable on a server (e.g. a QTI ingest pipeline) without
 * pulling React. Exposed at `@conform-ed/qti-react/headless`; everything here is also
 * re-exported from the package root for React consumers.
 *
 * Keep this entry free of React-coupled imports — only ./normalized-item and
 * ./item-capability (value) plus type-only re-exports.
 */

export {
  assessmentItemViewFromNormalized,
  assessmentTestViewFromNormalized,
  stimulusContentFromNormalized,
} from "./normalized-item";
export { referenceInteractionKinds, reportItemCapability, type ItemCapabilityOptions } from "./item-capability";
export type { CapabilityIssue, CapabilityIssueType, CapabilityReport } from "./capability";
export type {
  AssessmentItemView,
  AssessmentStimulusRefView,
  BodyNode,
  InteractionNode,
  StimulusContentView,
  XmlContentNode,
} from "./runtime";
export type { AssessmentTestView } from "./test";
