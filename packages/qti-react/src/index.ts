// @conform-ed/qti-react — headless QTI 3 runtime (MIT). No Mantine; React + contracts only.

export const qtiReactPackageName = "@conform-ed/qti-react";

export {
  v0ContentModel,
  v0InteractionKinds,
  isAllowedFlowElement,
  isInteractionKind,
  sanitizeAttributes,
  type ContentModel,
  type V0InteractionKind,
} from "./content-model";

export { foldString, mapResponse, matchCorrect, mapResponsePoint, scoreResponse } from "./response-processing";

export { assessmentItemViewFromNormalized, assessmentTestViewFromNormalized } from "./normalized-item";

export { formatPoint, parseCoords, parsePoint, pointInShape, type Point, type QtiShape } from "./graphic";

export {
  applyCorrectResponseOverrides,
  collectRpIssues,
  collectTemplateIssues,
  executeResponseProcessing,
  executeTemplateProcessing,
  mulberry32,
  resolveTemplate,
} from "./rp";

export type {
  OutcomeDeclarationView,
  OutcomeValue,
  ResponseNormalization,
  ResponseProcessingContext,
  ResponseProcessingResult,
  ResponseProcessingView,
  RpConditionBranch,
  RpExpressionView,
  RpRuleView,
  RpScalar,
  TemplateConditionBranch,
  TemplateDeclarationView,
  TemplateProcessingContext,
  TemplateProcessingResult,
  TemplateProcessingView,
  TemplateRuleView,
} from "./rp";

export { createAttemptStore, type AttemptSnapshot, type AttemptStore, type AttemptStoreOptions } from "./store";

export {
  createTestController,
  createTestSessionStore,
  type TestSessionSnapshot,
  type TestSessionStore,
  type TestSessionStoreOptions,
  type AssessmentItemRefView,
  type AssessmentSectionView,
  type AssessmentTestView,
  type BranchRuleView,
  type OutcomeConditionBranch,
  type OutcomeRuleView,
  type TestController,
  type TestFeedbackView,
  type TestItemResult,
  type TestPartView,
  type TestPlan,
  type TestPlanItem,
  type TestPlanPart,
  type TestSessionState,
} from "./test";

export {
  createQtiRuntime,
  defineInteraction,
  type AssessmentItemView,
  type AttemptController,
  type BodyNode,
  type CapabilityIssue,
  type CapabilityIssueType,
  type CapabilityReport,
  type ContentRendererProps,
  type FeedbackView,
  type InteractionDescriptor,
  type InteractionNode,
  type InteractionRenderProps,
  type InteractionSkin,
  type InteractionStatus,
  type ItemRendererProps,
  type NodeOverrides,
  type OptionProps,
  type OptionStatus,
  type QtiRuntime,
  type QtiRuntimeConfig,
  type SkinRegistry,
  type XmlContentNode,
} from "./runtime";

export {
  associateInteraction,
  choiceInteraction,
  endAttemptInteraction,
  extendedTextInteraction,
  gapMatchInteraction,
  graphicAssociateInteraction,
  graphicGapMatchInteraction,
  graphicOrderInteraction,
  hotspotInteraction,
  hottextInteraction,
  inlineChoiceInteraction,
  matchInteraction,
  mediaInteraction,
  orderInteraction,
  positionObjectStage,
  qtiCoreInteractions,
  selectPointInteraction,
  sliderInteraction,
  textEntryInteraction,
  uploadInteraction,
} from "./interactions";

export {
  AssociateReferenceSkin,
  ChoiceReferenceSkin,
  EndAttemptReferenceSkin,
  ExtendedTextReferenceSkin,
  GapMatchReferenceSkin,
  GraphicAssociateReferenceSkin,
  GraphicGapMatchReferenceSkin,
  GraphicOrderReferenceSkin,
  GraphicStage,
  HotspotReferenceSkin,
  HottextReferenceSkin,
  InlineChoiceReferenceSkin,
  MatchReferenceSkin,
  MediaReferenceSkin,
  OrderReferenceSkin,
  PositionObjectReferenceSkin,
  SelectPointReferenceSkin,
  SliderReferenceSkin,
  TextEntryReferenceSkin,
  UploadReferenceSkin,
  referenceSkin,
  textOf,
} from "./reference-skin";

export type {
  AreaMapEntryView,
  AreaMappingView,
  Cardinality,
  CorrectResponseView,
  MapEntryView,
  MappingView,
  ResponseDeclarationView,
  ResponseValue,
  ScoreResult,
} from "./types";
