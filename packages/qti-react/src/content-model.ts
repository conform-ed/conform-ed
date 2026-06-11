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
  "graphicAssociateInteraction",
  "graphicGapMatchInteraction",
  "graphicOrderInteraction",
  "hotspotInteraction",
  "hottextInteraction",
  "inlineChoiceInteraction",
  "matchInteraction",
  "mediaInteraction",
  "orderInteraction",
  "positionObjectStage",
  "selectPointInteraction",
  "sliderInteraction",
  "textEntryInteraction",
  "uploadInteraction",
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
  // media (the first media-milestone growth; src/poster route through the Asset Resolver)
  "img",
  "audio",
  "video",
  "source",
  "figure",
  "figcaption",
]);

/** Element-specific attribute allowlists, additive to the global set. */
const v0ElementAttributes: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["img", new Set(["src", "alt", "width", "height"])],
  ["audio", new Set(["src", "controls", "loop", "muted", "preload"])],
  ["video", new Set(["src", "controls", "loop", "muted", "preload", "poster", "width", "height"])],
  ["source", new Set(["src", "type"])],
]);

/** Attribute names treated as packaged-asset references (rewritten by the Asset Resolver). */
const v0UrlAttributes = new Set<string>(["src", "poster"]);

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
  /** Per-element attribute allowlists, additive to `globalAttributes`. */
  readonly elementAttributes: ReadonlyMap<string, ReadonlySet<string>>;
  /** Attributes whose values are asset references, routed through the Asset Resolver. */
  readonly urlAttributes: ReadonlySet<string>;
}

export const v0ContentModel: ContentModel = {
  interactionKinds: new Set<string>(v0InteractionKinds),
  flowElements: v0FlowElements,
  mathRoot: v0MathRoot,
  globalAttributes: v0GlobalAttributes,
  elementAttributes: v0ElementAttributes,
  urlAttributes: v0UrlAttributes,
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
 * Reduce a raw attribute bag to the safe, allowlisted subset for one element. Used by
 * the body walk so a node that validates against QTI structure still cannot carry
 * script or handlers. The allowlist is the global set plus the element's own entries.
 */
export function sanitizeAttributes(
  model: ContentModel,
  elementName: string,
  attributes: Record<string, unknown> | undefined,
): Record<string, string> {
  const safe: Record<string, string> = {};

  if (!attributes) {
    return safe;
  }

  const elementAllowed = model.elementAttributes.get(elementName);

  for (const [name, value] of Object.entries(attributes)) {
    if (isUnsafeAttribute(name, value)) {
      continue;
    }

    if (!model.globalAttributes.has(name) && !elementAllowed?.has(name)) {
      continue;
    }

    if (typeof value === "string") {
      safe[name] = value;
    }
  }

  return safe;
}
