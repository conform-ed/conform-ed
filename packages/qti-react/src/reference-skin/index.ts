/**
 * The Reference Skin (ADR-0001): the unstyled, semantic-HTML, a11y-correct Skin set
 * conform-ed ships so every interaction can be exercised, demoed, and conformance-
 * tested without a downstream product. Deliberately not a product UI: no styling
 * beyond data attributes (`data-qti-interaction`, `data-status`) as styling hooks.
 */

import type { SkinRegistry } from "../runtime";

import { AssociateReferenceSkin } from "./associate";
import { ChoiceReferenceSkin } from "./choice";
import { ExtendedTextReferenceSkin } from "./extended-text";
import { GapMatchReferenceSkin } from "./gap-match";
import { GraphicAssociateReferenceSkin } from "./graphic-associate";
import { GraphicGapMatchReferenceSkin } from "./graphic-gap-match";
import { GraphicOrderReferenceSkin } from "./graphic-order";
import { HotspotReferenceSkin } from "./hotspot";
import { PositionObjectReferenceSkin } from "./position-object";
import { SelectPointReferenceSkin } from "./select-point";
import { HottextReferenceSkin } from "./hottext";
import { InlineChoiceReferenceSkin } from "./inline-choice";
import { MatchReferenceSkin } from "./match";
import { MediaReferenceSkin } from "./media";
import { OrderReferenceSkin } from "./order";
import { SliderReferenceSkin } from "./slider";
import { TextEntryReferenceSkin } from "./text-entry";
import { UploadReferenceSkin } from "./upload";

export { textOf } from "./content";
export { AssociateReferenceSkin } from "./associate";
export { ChoiceReferenceSkin } from "./choice";
export { ExtendedTextReferenceSkin } from "./extended-text";
export { GapMatchReferenceSkin } from "./gap-match";
export { GraphicAssociateReferenceSkin } from "./graphic-associate";
export { GraphicGapMatchReferenceSkin } from "./graphic-gap-match";
export { GraphicOrderReferenceSkin } from "./graphic-order";
export { GraphicStage, shapeCenter, shapeElement } from "./graphic-base";
export { HotspotReferenceSkin } from "./hotspot";
export { PositionObjectReferenceSkin } from "./position-object";
export { SelectPointReferenceSkin } from "./select-point";
export { HottextReferenceSkin } from "./hottext";
export { InlineChoiceReferenceSkin } from "./inline-choice";
export { MatchReferenceSkin } from "./match";
export { MediaReferenceSkin } from "./media";
export { OrderReferenceSkin } from "./order";
export { SliderReferenceSkin } from "./slider";
export { TextEntryReferenceSkin } from "./text-entry";
export { UploadReferenceSkin } from "./upload";

export const referenceSkin: SkinRegistry = {
  associateInteraction: AssociateReferenceSkin,
  choiceInteraction: ChoiceReferenceSkin,
  extendedTextInteraction: ExtendedTextReferenceSkin,
  gapMatchInteraction: GapMatchReferenceSkin,
  graphicAssociateInteraction: GraphicAssociateReferenceSkin,
  graphicGapMatchInteraction: GraphicGapMatchReferenceSkin,
  graphicOrderInteraction: GraphicOrderReferenceSkin,
  hotspotInteraction: HotspotReferenceSkin,
  hottextInteraction: HottextReferenceSkin,
  inlineChoiceInteraction: InlineChoiceReferenceSkin,
  matchInteraction: MatchReferenceSkin,
  mediaInteraction: MediaReferenceSkin,
  orderInteraction: OrderReferenceSkin,
  positionObjectStage: PositionObjectReferenceSkin,
  selectPointInteraction: SelectPointReferenceSkin,
  sliderInteraction: SliderReferenceSkin,
  textEntryInteraction: TextEntryReferenceSkin,
  uploadInteraction: UploadReferenceSkin,
};
