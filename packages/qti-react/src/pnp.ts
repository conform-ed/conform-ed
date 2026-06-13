/**
 * AfA PNP (QTI 3.0 profile) views and catalog support resolution.
 *
 * The catalog holds "support-specific dormant content that can be made active … based
 * on the candidate's PNP information (or an assessment program's settings)" (§5.28).
 * This module owns the two halves of that sentence: which supports are active for a
 * candidate (activation), and which card content realises an active support
 * (matching). Rendering is the runtime's job; time-limit adjustments are the test
 * controller's.
 *
 * Views are structural mirrors of the contracts AfA PNP and catalog schemas — the
 * package depends on contracts only in tests, like the rest of qti-react.
 */

import type { BodyNode } from "./runtime";

// ---------- PNP views ----------

export interface PnpReplaceAccessModeView {
  readonly replaceAccessModes?: readonly string[];
}

export interface PnpLanguageModeView extends PnpReplaceAccessModeView {
  readonly xmlLang: string;
}

/** additional-testing-time: "Only one of the available options can be selected." */
export interface PnpAdditionalTestingTimeView extends PnpReplaceAccessModeView {
  readonly timeMultiplier?: number;
  readonly fixedMinutes?: number;
  readonly unlimited?: boolean;
}

export interface PnpFeatureSetView {
  readonly features?: readonly string[];
}

/**
 * The candidate's preferences, shaped like the normalized access-for-all-pnp
 * document. Feature preference objects carry the fields card-entry discriminators
 * match against (xmlLang, readingType, …); unknown fields are preserved.
 */
export interface PnpView {
  readonly [feature: string]: unknown;
  readonly languageOfInterface?: readonly PnpLanguageModeView[];
  readonly keywordTranslation?: PnpLanguageModeView;
  readonly itemTranslation?: PnpLanguageModeView;
  readonly signLanguage?: PnpLanguageModeView;
  readonly additionalTestingTime?: PnpAdditionalTestingTimeView;
  readonly activateAtInitializationSet?: PnpFeatureSetView;
  readonly activateAsOptionSet?: PnpFeatureSetView;
  readonly prohibitSet?: PnpFeatureSetView;
}

// ---------- Catalog views ----------

export interface CatalogFileHrefView {
  readonly href: string;
  readonly mimeType: string;
}

export interface CatalogContentView {
  readonly xmlLang?: string;
  readonly dataAttributes?: Readonly<Record<string, string>>;
  readonly content?: readonly BodyNode[];
}

export interface CatalogCardEntryView {
  readonly xmlLang?: string;
  readonly default?: boolean;
  readonly dataAttributes?: Readonly<Record<string, string>>;
  readonly htmlContent?: CatalogContentView;
  readonly fileHrefs?: readonly CatalogFileHrefView[];
}

export interface CatalogCardView {
  readonly support: string;
  readonly xmlLang?: string;
  readonly htmlContent?: CatalogContentView;
  readonly fileHrefs?: readonly CatalogFileHrefView[];
  readonly cardEntries?: readonly CatalogCardEntryView[];
}

export interface CatalogView {
  readonly id: string;
  readonly cards: readonly CatalogCardView[];
}

// ---------- Activation ----------

/**
 * PNP feature names (the FeatureSet vocabulary) to their preference fields on the
 * normalized PNP document. Presence of the field states the preference.
 */
const pnpFeatureFields: Readonly<Record<string, string>> = {
  "linguistic-guidance": "linguisticGuidance",
  "keyword-emphasis": "keywordEmphasis",
  "keyword-translation": "keywordTranslation",
  "simplified-language-portions": "simplifiedLanguagePortions",
  "simplified-graphics": "simplifiedGraphics",
  "item-translation": "itemTranslation",
  "sign-language": "signLanguage",
  encouragement: "encouragement",
  "additional-testing-time": "additionalTestingTime",
  "line-reader": "lineReader",
  "invert-display-polarity": "invertDisplayPolarity",
  magnification: "magnification",
  spoken: "spoken",
  tactile: "tactile",
  braille: "braille",
  "answer-masking": "answerMasking",
  "keyboard-directions": "keyboardDirections",
  "additional-directions": "additionalDirections",
  "long-description": "longDescription",
  captions: "captions",
  transcript: "transcript",
  "alternative-text": "alternativeText",
  "audio-description": "audioDescription",
  "high-contrast": "highContrast",
  "input-requirements": "inputRequirements",
  "language-of-interface": "languageOfInterface",
  "layout-single-column": "layoutSingleColumn",
  "text-appearance": "textAppearance",
  "calculator-on-screen": "calculatorOnScreen",
  "dictionary-on-screen": "dictionaryOnScreen",
  "glossary-on-screen": "glossaryOnScreen",
  "thesaurus-on-screen": "thesaurusOnScreen",
  "homophone-checker-on-screen": "homophoneCheckerOnScreen",
  "note-taking-on-screen": "noteTakingOnScreen",
  "visual-organizer-on-screen": "visualOrganizerOnScreen",
  "outliner-on-screen": "outlinerOnScreen",
  "peer-interaction-on-screen": "peerInteractionOnScreen",
  "spell-checker-on-screen": "spellCheckerOnScreen",
};

export interface PnpActivation {
  /** Supports in effect from the start of the session. */
  readonly active: ReadonlySet<string>;
  /** Supports the candidate may turn on during the session (activate-as-option-set). */
  readonly optional: ReadonlySet<string>;
  /** Supports that must not be offered (prohibit-set) — wins over everything. */
  readonly prohibited: ReadonlySet<string>;
}

/**
 * Resolve the activation policy: prohibit-set wins; activate-at-initialization-set is
 * active; activate-as-option-set is offered but off. A preference stated outside any
 * set (e.g. a bare keyword-translation) is honored from the start — the PNP records
 * the need, and without an activation policy there is nothing to defer to (designed
 * policy, see the ADR).
 */
export function resolvePnpActivation(pnp: PnpView | undefined): PnpActivation {
  const prohibited = new Set(pnp?.prohibitSet?.features ?? []);
  const active = new Set<string>();
  const optional = new Set<string>();

  if (!pnp) {
    return { active, optional, prohibited };
  }

  const optedIn = new Set(pnp.activateAsOptionSet?.features ?? []);

  for (const feature of pnp.activateAtInitializationSet?.features ?? []) {
    active.add(feature);
  }

  for (const [feature, field] of Object.entries(pnpFeatureFields)) {
    if (pnp[field] === undefined || active.has(feature) || optedIn.has(feature)) {
      continue;
    }
    active.add(feature);
  }

  for (const feature of optedIn) {
    if (!active.has(feature)) {
      optional.add(feature);
    }
  }

  for (const feature of prohibited) {
    active.delete(feature);
    optional.delete(feature);
  }

  return { active, optional, prohibited };
}

// ---------- Matching ----------

/** BCP 47, pragmatically: case-insensitive exact match or equal primary subtags. */
function languagesMatch(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();

  return a === b || a.split("-")[0] === b.split("-")[0];
}

function camelCase(name: string): string {
  return name.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

/**
 * The PNP preference object stated for a feature — what card entries discriminate
 * against, and what results reporting reads detail (language, time values) from.
 */
export function pnpFeaturePreference(pnp: PnpView | undefined, feature: string): Record<string, unknown> | undefined {
  const field = pnpFeatureFields[feature];
  if (!pnp || !field) {
    return undefined;
  }

  const value = pnp[field];
  const first = Array.isArray(value) ? value[0] : value;

  return typeof first === "object" && first !== null ? (first as Record<string, unknown>) : undefined;
}

/**
 * An entry matches when every discriminator it declares (xml:lang, data-*) agrees
 * with the candidate's preference for the card's support. Entries declaring nothing
 * match unconditionally.
 */
function entryMatches(entry: CatalogCardEntryView, preference: Record<string, unknown> | undefined): boolean {
  if (entry.xmlLang !== undefined) {
    const preferred = preference?.["xmlLang"];
    if (typeof preferred !== "string" || !languagesMatch(entry.xmlLang, preferred)) {
      return false;
    }
  }

  for (const [name, value] of Object.entries(entry.dataAttributes ?? {})) {
    const preferred = preference?.[camelCase(name)];
    // Preference fields are scalars (strings, numbers, booleans) after normalization.
    const comparable =
      typeof preferred === "string" || typeof preferred === "number" || typeof preferred === "boolean"
        ? `${preferred}`
        : undefined;
    if (comparable === undefined || comparable !== value) {
      return false;
    }
  }

  return true;
}

/** A support's resolved alternative content for one catalog. */
export interface ResolvedCatalogSupport {
  readonly support: string;
  readonly xmlLang?: string;
  readonly content?: readonly BodyNode[];
  readonly fileHrefs?: readonly CatalogFileHrefView[];
}

export interface CatalogResolution {
  readonly activation: PnpActivation;
  readonly byCatalogId: ReadonlyMap<string, readonly ResolvedCatalogSupport[]>;
}

function resolveCard(card: CatalogCardView, pnp: PnpView | undefined): ResolvedCatalogSupport | undefined {
  if (!card.cardEntries) {
    // Direct content is unconditional once the support is active.
    const cardLang = card.xmlLang ?? card.htmlContent?.xmlLang;

    return {
      support: card.support,
      ...(cardLang !== undefined ? { xmlLang: cardLang } : {}),
      ...(card.htmlContent?.content ? { content: card.htmlContent.content } : {}),
      ...(card.fileHrefs ? { fileHrefs: card.fileHrefs } : {}),
    };
  }

  const preference = pnpFeaturePreference(pnp, card.support);
  // "If the CardEntry attribute values do not identify the proper content for a
  // candidate, use the content designated as default." (§5.27.2)
  const entry =
    card.cardEntries.find((candidate) => entryMatches(candidate, preference)) ??
    card.cardEntries.find((candidate) => candidate.default === true);

  if (!entry) {
    return undefined;
  }

  const xmlLang = entry.xmlLang ?? entry.htmlContent?.xmlLang ?? card.xmlLang;

  return {
    support: card.support,
    ...(xmlLang !== undefined ? { xmlLang } : {}),
    ...(entry.htmlContent?.content ? { content: entry.htmlContent.content } : {}),
    ...(entry.fileHrefs ? { fileHrefs: entry.fileHrefs } : {}),
  };
}

/**
 * Resolve every catalog's active alternative content for a candidate. `activeSupports`
 * is the delivery-engine channel — program settings and candidate-toggled options
 * ("or an assessment program's settings", §5.28); prohibited supports stay out even
 * when named there.
 */
export function resolveCatalogSupports(options: {
  readonly catalogs?: readonly CatalogView[] | undefined;
  readonly pnp?: PnpView | undefined;
  readonly activeSupports?: readonly string[] | undefined;
}): CatalogResolution {
  const activation = resolvePnpActivation(options.pnp);
  const effective = new Set(activation.active);

  for (const support of options.activeSupports ?? []) {
    if (!activation.prohibited.has(support)) {
      effective.add(support);
    }
  }

  const byCatalogId = new Map<string, readonly ResolvedCatalogSupport[]>();

  for (const catalog of options.catalogs ?? []) {
    const resolved: ResolvedCatalogSupport[] = [];

    for (const card of catalog.cards) {
      if (!effective.has(card.support)) {
        continue;
      }

      const support = resolveCard(card, options.pnp);
      if (support) {
        resolved.push(support);
      }
    }

    byCatalogId.set(catalog.id, resolved);
  }

  return { activation, byCatalogId };
}
