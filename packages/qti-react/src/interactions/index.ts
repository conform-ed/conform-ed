import type { InteractionDescriptor } from "../runtime";

import { associateInteraction } from "./associate";
import { choiceInteraction } from "./choice";
import { extendedTextInteraction } from "./extended-text";
import { gapMatchInteraction } from "./gap-match";
import { hottextInteraction } from "./hottext";
import { inlineChoiceInteraction } from "./inline-choice";
import { matchInteraction } from "./match";
import { orderInteraction } from "./order";
import { textEntryInteraction } from "./text-entry";

export { associateInteraction } from "./associate";
export { choiceInteraction } from "./choice";
export { extendedTextInteraction } from "./extended-text";
export { gapMatchInteraction } from "./gap-match";
export { hottextInteraction } from "./hottext";
export { inlineChoiceInteraction } from "./inline-choice";
export { matchInteraction } from "./match";
export { orderInteraction } from "./order";
export { textEntryInteraction } from "./text-entry";

/** The interaction set conform-ed ships; consumers assemble these plus their extensions. */
export const qtiCoreInteractions: readonly InteractionDescriptor[] = [
  associateInteraction,
  choiceInteraction,
  extendedTextInteraction,
  gapMatchInteraction,
  hottextInteraction,
  inlineChoiceInteraction,
  matchInteraction,
  orderInteraction,
  textEntryInteraction,
];
