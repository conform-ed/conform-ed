/**
 * The single source of truth for what may appear inside an item/stimulus body.
 *
 * Both the renderer's allowlist tree-walk and (later) the authoring editor schema
 * derive from this definition. QTI 3 bodies are validated for *structure* by
 * `@conform-ed/contracts`, but their embedded HTML flow content is modelled as a
 * generic node tree — so validation does not sanitize. This allowlist is the
 * sanitizer: the renderer emits React only for elements/attributes named here and
 * drops everything else. It never injects HTML strings.
 *
 * v0 scope: the minimal flow/inline vocabulary plus the language-critical bits
 * (ruby/furigana, MathML). It grows incrementally with the renderer — never "all of
 * HTML5 at once".
 */

/** Interaction node kinds conform-ed ships descriptors and Reference Skins for. */
export const v0InteractionKinds = [
  "associateInteraction",
  "choiceInteraction",
  "extendedTextInteraction",
  "gapMatchInteraction",
  "hottextInteraction",
  "inlineChoiceInteraction",
  "matchInteraction",
  "orderInteraction",
  "textEntryInteraction",
] as const;

export type V0InteractionKind = (typeof v0InteractionKinds)[number];

/** Allowed HTML flow/inline element names for generic `kind: "xml"` body nodes. */
const v0FlowElements = new Set<string>([
  "p",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "br",
  "ul",
  "ol",
  "li",
  // language-critical
  "ruby",
  "rt",
  "rp",
]);

/**
 * The MathML root. Its subtree is rendered structurally (presentation MathML) with the
 * same attribute hardening, but element names inside are not individually allowlisted
 * in v0 — MathML has no scripting surface once event-handler attributes are stripped.
 */
const v0MathRoot = "math";

/** Globally safe attribute names. Everything else (notably `on*`, `style`) is dropped. */
const v0GlobalAttributes = new Set<string>(["id", "class", "lang", "xml:lang", "dir"]);

export interface ContentModel {
  readonly interactionKinds: ReadonlySet<string>;
  readonly flowElements: ReadonlySet<string>;
  readonly mathRoot: string;
  readonly globalAttributes: ReadonlySet<string>;
}

export const v0ContentModel: ContentModel = {
  interactionKinds: new Set<string>(v0InteractionKinds),
  flowElements: v0FlowElements,
  mathRoot: v0MathRoot,
  globalAttributes: v0GlobalAttributes,
};

export function isAllowedFlowElement(model: ContentModel, name: string): boolean {
  return model.flowElements.has(name) || name === model.mathRoot;
}

export function isInteractionKind(model: ContentModel, kind: string): boolean {
  return model.interactionKinds.has(kind);
}

/** True for an attribute name/value pair that must never reach the DOM. */
function isUnsafeAttribute(name: string, value: unknown): boolean {
  const lowerName = name.toLowerCase();

  if (lowerName.startsWith("on")) {
    return true;
  }

  if (typeof value === "string" && /^\s*javascript:/iu.test(value)) {
    return true;
  }

  return false;
}

/**
 * Reduce a raw attribute bag to the safe, allowlisted subset. Used by the body walk so
 * a node that validates against QTI structure still cannot carry script or handlers.
 */
export function sanitizeAttributes(
  model: ContentModel,
  attributes: Record<string, unknown> | undefined,
): Record<string, string> {
  const safe: Record<string, string> = {};

  if (!attributes) {
    return safe;
  }

  for (const [name, value] of Object.entries(attributes)) {
    if (isUnsafeAttribute(name, value)) {
      continue;
    }

    if (!model.globalAttributes.has(name)) {
      continue;
    }

    if (typeof value === "string") {
      safe[name] = value;
    }
  }

  return safe;
}
