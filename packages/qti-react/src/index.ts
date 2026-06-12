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

export {
  assessmentItemViewFromNormalized,
  assessmentTestViewFromNormalized,
  stimulusContentFromNormalized,
} from "./normalized-item";

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
  CustomOperatorImplementation,
  InterpolationTableEntryView,
  InterpolationTableView,
  MatchTableEntryView,
  MatchTableView,
  MaybeRpValue,
  OutcomeDeclarationView,
  OutcomeValue,
  ResponseNormalization,
  ResponseProcessingContext,
  ResponseProcessingResult,
  ResponseProcessingView,
  RpConditionBranch,
  RpExpressionView,
  RpRecordField,
  RpRuleView,
  RpScalar,
  RpValue,
  TemplateConditionBranch,
  TemplateDeclarationView,
  TemplateProcessingContext,
  TemplateProcessingResult,
  TemplateProcessingView,
  TemplateRuleView,
} from "./rp";

export { createAttemptStore, type AttemptSnapshot, type AttemptStore, type AttemptStoreOptions } from "./store";

export {
  collectInteractionConstraints,
  collectResponseViolations,
  type InteractionConstraint,
  type ResponseConstraintKind,
  type ResponseViolation,
} from "./response-validity";

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
  type ItemSessionControlView,
  type OutcomeConditionBranch,
  type OutcomeRuleView,
  type TestController,
  type TestFeedbackView,
  type TestItemResult,
  type RejectedSubmission,
  type TemplateDefaultView,
  type TestPartView,
  type TestPlan,
  type TestPlanItem,
  type TestPlanPart,
  type TestPlanSection,
  type TestSessionState,
  type TestTimingState,
  type TimeLimitsView,
  type TimingScopeRef,
} from "./test";

export {
  createQtiRuntime,
  defineInteraction,
  type AssessmentItemView,
  type AssessmentStimulusRefView,
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
  type StimulusContentView,
  type XmlContentNode,
} from "./runtime";

export {
  createPciModuleRegistry,
  createPciSkin,
  mountPci,
  pciResponseToValue,
  portableCustomInteraction,
  serializePciMarkup,
  valueToPciResponse,
  type PciConfiguration,
  type PciInstance,
  type PciInteractionNode,
  type PciModule,
  type PciModuleRegistry,
  type PciModuleRegistryOptions,
  type PciMountHandle,
  type PciMountOptions,
  type PciSkinOptions,
} from "./pci";

export {
  associateInteraction,
  choiceInteraction,
  drawingInteraction,
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
  DrawingReferenceSkin,
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
