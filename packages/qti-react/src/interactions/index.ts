import type { InteractionDescriptor } from "../runtime";

import { associateInteraction } from "./associate";
import { choiceInteraction } from "./choice";
import { extendedTextInteraction } from "./extended-text";
import { gapMatchInteraction } from "./gap-match";
import {
  graphicAssociateInteraction,
  graphicGapMatchInteraction,
  graphicOrderInteraction,
  hotspotInteraction,
  positionObjectStage,
  selectPointInteraction,
} from "./graphic";
import { hottextInteraction } from "./hottext";
import { inlineChoiceInteraction } from "./inline-choice";
import { matchInteraction } from "./match";
import { mediaInteraction } from "./media";
import { orderInteraction } from "./order";
import { sliderInteraction } from "./slider";
import { textEntryInteraction } from "./text-entry";
import { uploadInteraction } from "./upload";

export { associateInteraction } from "./associate";
export { choiceInteraction } from "./choice";
export { extendedTextInteraction } from "./extended-text";
export { gapMatchInteraction } from "./gap-match";
export {
  graphicAssociateInteraction,
  graphicGapMatchInteraction,
  graphicOrderInteraction,
  hotspotInteraction,
  positionObjectStage,
  selectPointInteraction,
} from "./graphic";
export { hottextInteraction } from "./hottext";
export { inlineChoiceInteraction } from "./inline-choice";
export { matchInteraction } from "./match";
export { mediaInteraction } from "./media";
export { orderInteraction } from "./order";
export { sliderInteraction } from "./slider";
export { textEntryInteraction } from "./text-entry";
export { uploadInteraction } from "./upload";

/** The interaction set conform-ed ships; consumers assemble these plus their extensions. */
export const qtiCoreInteractions: readonly InteractionDescriptor[] = [
  associateInteraction,
  choiceInteraction,
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
  selectPointInteraction,
  sliderInteraction,
  textEntryInteraction,
  uploadInteraction,
];
