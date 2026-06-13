/**
 * The headless runtime (ADR-0001): a factory that assembles a QTI item renderer from an
 * injected set of interaction descriptors plus a skin registry. The kind-union is the
 * injected set — no global registry, no module augmentation. The core owns response
 * state and a11y wiring; skins are controlled components.
 *
 * No Mantine, and no JSX — flow content and skins are composed with `createElement` so
 * the package needs no JSX build step.
 */

import {
  Fragment,
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import type { ZodType } from "zod";

import type { CapabilityReport } from "./capability";
import {
  isAllowedFlowElement,
  sanitizeAttributes,
  sanitizeMathAttributes,
  v0ContentModel,
  type ContentModel,
} from "./content-model";
import { reportItemCapability } from "./item-capability";
import { resolveCatalogSupports, type CatalogView, type PnpView, type ResolvedCatalogSupport } from "./pnp";
import { collectInteractionConstraints } from "./response-validity";
import type {
  CustomOperatorImplementation,
  OutcomeDeclarationView,
  OutcomeValue,
  ResponseNormalization,
  ResponseProcessingView,
  TemplateDeclarationView,
  TemplateProcessingView,
} from "./rp";
import { createAttemptStore, type AttemptSnapshot, type AttemptStore } from "./store";
import type { Cardinality, ResponseDeclarationView, ResponseValue, ScoreResult } from "./types";

export type { CapabilityIssue, CapabilityIssueType, CapabilityReport } from "./capability";

// ---------- Node views (structural; validated upstream by @conform-ed/contracts) ----------

export interface XmlContentNode {
  kind: "xml";
  /** XML namespace URI; foreign vocabularies (SSML) are recognized by it. */
  namespace?: string;
  name: string;
  value?: string;
  attributes?: Record<string, unknown>;
  children?: BodyNode[];
}

export interface InteractionNode {
  kind: string;
  responseIdentifier: string;
  [field: string]: unknown;
}

export type BodyNode = XmlContentNode | InteractionNode | { kind: string; value?: string; children?: BodyNode[] };

/** A feedback element's view: feedbackInline/feedbackBlock in the body, or modalFeedback. */
export interface FeedbackView {
  outcomeIdentifier: string;
  identifier: string;
  showHide?: "show" | "hide";
  content?: readonly BodyNode[];
}

/** An item's reference to a shared AssessmentStimulus document (§7.6). */
export interface AssessmentStimulusRefView {
  readonly identifier: string;
  readonly href: string;
  readonly title?: string;
}

/** Companion materials, structurally as normalized (calculators, rules, protractors, materials). */
export interface CompanionMaterialsView {
  readonly calculators?: readonly Record<string, unknown>[];
  readonly rules?: readonly Record<string, unknown>[];
  readonly protractors?: readonly Record<string, unknown>[];
  readonly digitalMaterials?: readonly {
    readonly fileHref: string;
    readonly label?: string;
    readonly mimeType?: string;
    readonly resourceIcon?: string;
  }[];
  readonly physicalMaterials?: readonly string[];
}

/** The resolved stimulus body, rendered through the same content walk as the item body. */
export interface StimulusContentView {
  readonly content: readonly BodyNode[];
  /** The stimulus document's catalogs (dormant alternative content, §5.29). */
  readonly catalogs?: readonly CatalogView[];
}

export interface AssessmentItemView {
  responseDeclarations: readonly ResponseDeclarationView[];
  outcomeDeclarations?: readonly OutcomeDeclarationView[];
  responseProcessing?: ResponseProcessingView;
  templateDeclarations?: readonly TemplateDeclarationView[];
  templateProcessing?: TemplateProcessingView;
  /** QTI adaptive item: multiple attempts until completionStatus reaches "completed". */
  adaptive?: boolean;
  modalFeedbacks?: readonly FeedbackView[];
  assessmentStimulusRefs?: readonly AssessmentStimulusRefView[];
  /** Every catalog in the item (item-level and nested), pooled for idref resolution. */
  catalogs?: readonly CatalogView[];
  /**
   * Companion materials (§2.13.1): "content props that provide key information to be
   * used when answering an Item, e.g. a calculator, protractor, lookup chart". The
   * runtime exposes them; the delivery platform owns the tools themselves.
   */
  companionMaterials?: CompanionMaterialsView;
  itemBody: { content?: BodyNode[] };
}

// ---------- Descriptor + skin contract ----------

export interface InteractionDescriptor<Kind extends string = string> {
  readonly kind: Kind;
  readonly schema: ZodType;
  readonly scoring: "qti-standard";
  /** The empty/initial response for a fresh attempt at this interaction. */
  initialResponse(node: InteractionNode): ResponseValue;
}

export function defineInteraction<Kind extends string>(
  descriptor: InteractionDescriptor<Kind>,
): InteractionDescriptor<Kind> {
  return descriptor;
}

export type OptionStatus = "idle" | "selected" | "correct" | "incorrect";

/** Whole-interaction status (for interactions without options, e.g. textEntry). */
export type InteractionStatus = "unanswered" | "answered" | "correct" | "incorrect";

/** Prop-getter result a skin spreads onto an option element to inherit selection + a11y. */
export interface OptionProps {
  role: "radio" | "checkbox";
  tabIndex: number;
  "aria-checked": boolean;
  "aria-disabled": boolean;
  "data-status": OptionStatus;
  onClick: () => void;
}

/** Controlled props every interaction skin receives by default (ADR-0001). */
export interface InteractionRenderProps {
  node: InteractionNode;
  responseIdentifier: string;
  value: ResponseValue;
  setValue: (value: ResponseValue) => void;
  /** True after submit — the interaction is read-only. */
  disabled: boolean;
  /** True after submit — show correct/incorrect chrome. */
  showFeedback: boolean;
  /** Whole-interaction status (drives feedback for option-less interactions). */
  status: InteractionStatus;
  getOptionProps: (optionIdentifier: string) => OptionProps;
  /**
   * Render body fragments (prompt, choice labels) through the core allowlist walk.
   * `overrides` lets a skin take over specific node kinds nested anywhere in the
   * fragment (e.g. `hottext`, `gap`) while the core keeps walking everything else.
   */
  renderContent: (nodes: readonly BodyNode[] | undefined, overrides?: NodeOverrides) => ReactNode;
  /** The runtime's Asset Resolver (identity when none configured) for skin-owned media. */
  resolveAsset: (href: string) => string;
  /** Set this interaction's response to true and submit the attempt (endAttemptInteraction). */
  endAttempt: () => void;
  /**
   * Register a submit-time response collector for this interaction (imperative
   * interactions like PCI own their response state). Returns the unregister function.
   */
  registerResponseCollector: (collector: () => ResponseValue | undefined) => () => void;
  /**
   * Render the active catalog supports for a skin-owned node's data-catalog-idref
   * (e.g. a choice label) — the same resolution and presentation the core walk
   * applies to generic flow nodes. Null when nothing is active.
   */
  renderCatalogSupports: (catalogIdref: string | undefined) => ReactNode;
}

/** Per-kind render overrides a skin passes to `renderContent` for nodes it owns. */
export type NodeOverrides = Readonly<Record<string, (node: BodyNode, key: number) => ReactNode>>;

export type InteractionSkin = ComponentType<InteractionRenderProps>;
export type SkinRegistry = Readonly<Record<string, InteractionSkin>>;

export interface QtiRuntimeConfig {
  readonly interactions: readonly InteractionDescriptor[];
  readonly skin: SkinRegistry;
  readonly contentModel?: ContentModel;
  /** Replaces the default Unsupported Placeholder for interaction nodes this runtime cannot render. */
  readonly renderUnsupported?: (node: InteractionNode) => ReactNode;
  /** The Response Normalization hook (ADR-0004): opt-in candidate-input leniency. */
  readonly normalization?: ResponseNormalization;
  /**
   * The Asset Resolver: maps package-relative media references (img/audio/video `src`,
   * `poster`) to real URLs at render time. Identity when omitted.
   */
  readonly assetResolver?: (href: string) => string;
  /**
   * Registered vendor `customOperator` implementations by class. Items using only
   * registered classes pass the capability gate; everything else stays unsupported.
   */
  readonly customOperators?: Readonly<Record<string, CustomOperatorImplementation>>;
  /**
   * Resolve an item's shared-stimulus reference to its normalized body content
   * (synchronous by design, like the session store's resolveItem: load the package's
   * stimuli before mounting; `stimulusContentFromNormalized` reshapes a normalized
   * document). Unresolved refs are capability issues, never silent drops (ADR-0003).
   */
  readonly resolveStimulus?: (ref: AssessmentStimulusRefView) => StimulusContentView | null;
  /**
   * Replaces the default rendering of an active catalog support (the note-role span
   * appended beside the referenced content). The delivery engine owns presentation —
   * tooltips, players, glossary panels — the runtime owns resolution.
   */
  readonly renderCatalogSupport?: (support: ResolvedCatalogSupport, catalogIdref: string) => ReactNode;
}

export interface ItemRendererProps {
  item: AssessmentItemView;
  /**
   * An externally owned attempt store. Without it the renderer creates a fresh
   * per-mount store; passing one enables review/replay modes (rehydrate a stored,
   * already-submitted attempt) and server-side rendering of submitted states.
   */
  store?: AttemptStore | undefined;
  /** Clone seed for template processing; store it to replay the same clone. */
  seed?: number | undefined;
  /**
   * The item-session state to render. `review` is read-only: "the candidate can
   * review the qti-item-body along with the responses they gave, but cannot update
   * or resubmit them". `solution` additionally swaps in the clone's resolved correct
   * responses ("a way of entering the solution state"); the show-solution gate is
   * the consumer's (effective ItemSessionControl). Default: "interact".
   */
  mode?: ItemRenderMode | undefined;
  /**
   * Effective ItemSessionControl show-feedback; consulted only outside `interact`.
   * `false` withholds modal and integrated feedback — visibility is then
   * "determined by the default values of the outcome variables" — and is ignored
   * for adaptive items, per spec.
   */
  showFeedback?: boolean | undefined;
  /**
   * The candidate's AfA PNP. Activates the item's dormant catalog supports (§5.29):
   * "A candidate's profile (or assessment program settings) will indicate whether the
   * candidate should be presented any of the possible supports."
   */
  pnp?: PnpView | undefined;
  /**
   * Supports in effect beyond the PNP's initial activation — program settings and
   * candidate-toggled options (activate-as-option-set). Prohibited supports stay out.
   */
  activeSupports?: readonly string[] | undefined;
  // Rendered inside the same runtime context as the item body, after it. Lets a consumer
  // drop controls (a Submit bar, a score panel) that call `useAttempt()` for this item —
  // the attempt store is per-item and scoped to this subtree.
  children?: ReactNode;
}

export interface ContentRendererProps {
  nodes?: readonly BodyNode[] | undefined;
  /** Values for printedVariable (and showHide-gated feedback) inside the content. */
  outcomes?: Readonly<Record<string, OutcomeValue>> | undefined;
  /** Catalogs referenced by this content (e.g. a test rubric block's catalogInfo). */
  catalogs?: readonly CatalogView[] | undefined;
  pnp?: PnpView | undefined;
  activeSupports?: readonly string[] | undefined;
}

export interface QtiRuntime {
  ItemRenderer: ComponentType<ItemRendererProps>;
  /**
   * Flow content outside an item attempt — test feedback, rubric copy. Same sanitizer
   * and node walk as the item body, over caller-supplied outcome values.
   */
  ContentRenderer: ComponentType<ContentRendererProps>;
  useAttempt: () => AttemptController;
  /**
   * The active supports resolved for a catalog idref — for skins whose own nodes
   * carry data-catalog-idref (e.g. a choice label) and consumers building support
   * UI (glossary panels, toggles). The core walk already decorates generic flow
   * and block nodes; this is the same resolution by hand.
   */
  useCatalogSupports: (catalogIdref: string | undefined) => readonly ResolvedCatalogSupport[];
  /**
   * The Capability Report for an item against this runtime's injected descriptors,
   * skins, and content model. Consumers gate delivery on it (ADR-0003); the
   * ItemRenderer placeholder is only the backstop for content that reaches
   * rendering anyway.
   */
  canDeliver: (item: AssessmentItemView) => CapabilityReport;
}

export interface AttemptController extends AttemptSnapshot {
  submit: () => readonly ScoreResult[];
  reset: () => void;
}

// ---------- Internal context ----------

/** The item-session states the renderer knows (ItemSessionControl review/solution). */
export type ItemRenderMode = "interact" | "review" | "solution";

interface RuntimeContextValue {
  store: AttemptStore;
  declarationsById: ReadonlyMap<string, ResponseDeclarationView>;
  mode: ItemRenderMode;
  /** show-feedback=false outside interact: modal + integrated feedback withheld. */
  suppressFeedback: boolean;
  /** The clone's resolved correct responses — what the solution state displays. */
  solutionResponses: Readonly<Record<string, ResponseValue>>;
  /** Declared outcome defaults — feedback visibility "as at the start of each attempt". */
  defaultOutcomes: Readonly<Record<string, OutcomeValue>>;
  /** Resolved active catalog supports by catalog id (§5.28 idref resolution). */
  catalogSupports: ReadonlyMap<string, readonly ResolvedCatalogSupport[]>;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

function useRuntimeContext(): RuntimeContextValue {
  const context = useContext(RuntimeContext);

  if (!context) {
    throw new Error("QTI runtime components must be rendered inside an <ItemRenderer>.");
  }

  return context;
}

function responseIncludes(value: ResponseValue, optionIdentifier: string): boolean {
  if (value === null) {
    return false;
  }

  return typeof value === "string"
    ? value === optionIdentifier
    : Array.isArray(value) && value.includes(optionIdentifier);
}

function isCorrectOption(declaration: ResponseDeclarationView | undefined, optionIdentifier: string): boolean {
  return Boolean(declaration?.correctResponse?.values.some((entry) => entry.value === optionIdentifier));
}

/**
 * An interaction node is any non-xml node carrying a `responseIdentifier` — including
 * kinds this runtime has never heard of (lagging consumers, foreign extensions). The
 * discriminator must not depend on the injected descriptor set, or unknown interactions
 * would be indistinguishable from text and silently dropped.
 */
function isInteractionNode(node: BodyNode): node is InteractionNode {
  return node.kind !== "xml" && typeof (node as { responseIdentifier?: unknown }).responseIdentifier === "string";
}

const feedbackKinds = new Set(["feedbackInline", "feedbackBlock"]);

function isFeedbackNode(node: BodyNode): boolean {
  return feedbackKinds.has(node.kind);
}

const templateContentKinds = new Set(["templateInline", "templateBlock"]);

/** templateInline/templateBlock: visibility decided by a template variable's value. */
interface TemplateContentView {
  readonly templateIdentifier: string;
  readonly identifier: string;
  readonly showHide?: "show" | "hide";
  readonly content?: readonly BodyNode[];
}

function isTemplateContentNode(node: BodyNode): boolean {
  return templateContentKinds.has(node.kind);
}

/** Same show/hide semantics as feedback, but against the clone's template values. */
function templateVisible(value: OutcomeValue, view: TemplateContentView): boolean {
  const matched = Array.isArray(value) ? value.includes(view.identifier) : value === view.identifier;

  return matched !== (view.showHide === "hide");
}

/** A read-only, already-"submitted" store: backs content rendered outside an attempt. */
function createStaticStore(outcomes: Readonly<Record<string, OutcomeValue>>): AttemptStore {
  const snapshot: AttemptSnapshot = {
    responses: {},
    submitted: true,
    scores: [],
    outcomes,
    templateValues: {},
    attemptCount: 1,
    durationSeconds: null,
    responseViolations: [],
    correctResponses: {},
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    setResponse: () => {},
    registerResponseCollector: () => () => {},
    submit: () => [],
    reset: () => {},
    suspend: () => {},
    resume: () => {},
  };
}

/** QTI showHide semantics: `show` reveals on a matched outcome, `hide` reveals on a miss. */
function feedbackVisible(outcome: OutcomeValue, feedback: FeedbackView, submitted: boolean): boolean {
  if (!submitted) {
    return false;
  }

  const matched = Array.isArray(outcome) ? outcome.includes(feedback.identifier) : outcome === feedback.identifier;

  return matched !== (feedback.showHide === "hide");
}

export function createQtiRuntime(config: QtiRuntimeConfig): QtiRuntime {
  const model = config.contentModel ?? v0ContentModel;
  const descriptorsByKind = new Map(config.interactions.map((descriptor) => [descriptor.kind, descriptor]));
  const resolveAsset = config.assetResolver ?? ((href: string) => href);

  /** SSML 1.1 (§2.13.2): aural annotations whose text renders transparently. */
  const ssmlNamespace = "http://www.w3.org/2001/10/synthesis";

  function renderFlow(node: XmlContentNode, key: number, overrides?: NodeOverrides, inMath = false): ReactNode {
    // SSML wraps visual text for speech synthesis (alias substitutions, prosody);
    // rendering the element as HTML would misread it (ssml:sub is not a subscript).
    // The annotated text passes through; the aural semantics belong to TTS hosts.
    if (node.namespace === ssmlNamespace) {
      return createElement(
        Fragment,
        { key },
        node.value ?? node.children?.map((child, index) => renderNode(child, index, overrides, inMath)),
      );
    }

    const isMath = inMath || node.name === model.mathRoot;

    if (!isMath && !isAllowedFlowElement(model, node.name)) {
      return null; // not allowlisted → dropped (the sanitizer)
    }

    // Inside math the subtree renders structurally: element names pass, attribute
    // hardening still applies (see the content model's mathRoot note).
    const attributes = isMath
      ? sanitizeMathAttributes(node.attributes)
      : sanitizeAttributes(model, node.name, node.attributes);

    for (const name of model.urlAttributes) {
      const value = attributes[name];

      if (value !== undefined) {
        attributes[name] = resolveAsset(value);
      }
    }

    const children = node.children?.map((child, index) => renderNode(child, index, overrides, isMath));

    return createElement(node.name, { key, ...attributes }, node.value ?? children);
  }

  function renderUnsupported(node: InteractionNode, key: number): ReactNode {
    if (config.renderUnsupported) {
      return createElement("span", { key }, config.renderUnsupported(node));
    }

    // The Unsupported Placeholder (ADR-0003): explicit and accessible, never a silent drop.
    return createElement(
      "div",
      { key, role: "note", "data-qti-unsupported": node.kind },
      `This content requires an interaction type (${node.kind}) this runtime does not support.`,
    );
  }

  /** The catalog reference a node carries: data-catalog-idref on generic xml nodes, the structured field on QTI nodes. */
  function catalogIdrefOf(node: BodyNode): string | undefined {
    const value =
      node.kind === "xml"
        ? (node as XmlContentNode).attributes?.["data-catalog-idref"]
        : (node as { dataCatalogIdref?: unknown }).dataCatalogIdref;

    return typeof value === "string" && value !== "" ? value : undefined;
  }

  /** The default support presentation: a note beside the referenced content. */
  function renderSupportDefault(
    support: ResolvedCatalogSupport,
    catalogIdref: string,
    key: number,
    overrides?: NodeOverrides,
  ): ReactNode {
    return createElement(
      "span",
      {
        key: `support-${key}`,
        role: "note",
        "data-qti-catalog-idref": catalogIdref,
        "data-qti-support": support.support,
        ...(support.xmlLang !== undefined ? { lang: support.xmlLang } : {}),
      },
      support.content?.map((child, index) => renderNode(child, index, overrides)),
      // File-backed alternatives default to an accessible link through the Asset
      // Resolver; players and panels are the delivery engine's (renderCatalogSupport).
      support.fileHrefs?.map((file, index) =>
        createElement(
          "a",
          { key: `file-${index}`, href: resolveAsset(file.href), type: file.mimeType, "data-qti-support-file": true },
          support.support,
        ),
      ),
    );
  }

  /**
   * Renders a catalog-referencing node: the authored content as-is, then each active
   * support's resolved alternative content. Dormant content stays dormant — no
   * resolved supports means the original alone.
   */
  function CatalogSupportHost({
    catalogIdref,
    node,
    overrides,
    inMath,
  }: {
    catalogIdref: string;
    node: BodyNode;
    overrides?: NodeOverrides | undefined;
    inMath: boolean;
  }): ReactNode {
    const { catalogSupports } = useRuntimeContext();
    const supports = catalogSupports.get(catalogIdref) ?? [];
    const original = renderNode(node, 0, overrides, inMath, true);

    if (!supports.length) {
      return original;
    }

    return createElement(
      Fragment,
      null,
      original,
      supports.map((support, index) =>
        config.renderCatalogSupport
          ? createElement(Fragment, { key: `support-${index}` }, config.renderCatalogSupport(support, catalogIdref))
          : renderSupportDefault(support, catalogIdref, index, overrides),
      ),
    );
  }

  function renderNode(
    node: BodyNode,
    key: number,
    overrides?: NodeOverrides,
    inMath = false,
    skipCatalog = false,
  ): ReactNode {
    if (!skipCatalog) {
      const catalogIdref = catalogIdrefOf(node);

      if (catalogIdref !== undefined) {
        return createElement(CatalogSupportHost, { key, catalogIdref, node, overrides, inMath });
      }
    }

    const override = overrides?.[node.kind];

    if (override) {
      return createElement(Fragment, { key }, override(node, key));
    }

    if (isInteractionNode(node)) {
      // Dispatch is governed by the injected descriptor + skin sets alone (ADR-0001:
      // the kind-union is the injected set), so consumer extension kinds render
      // without being named in the content model.
      if (descriptorsByKind.has(node.kind) && config.skin[node.kind]) {
        return createElement(InteractionHost, { key, node });
      }

      return renderUnsupported(node, key);
    }

    if (isFeedbackNode(node)) {
      return createElement(FeedbackHost, {
        key,
        feedback: node as unknown as FeedbackView,
        element: node.kind === "feedbackInline" ? "span" : "div",
        overrides,
      });
    }

    if (isTemplateContentNode(node)) {
      return createElement(TemplateContentHost, {
        key,
        view: node as unknown as TemplateContentView,
        element: node.kind === "templateInline" ? "span" : "div",
        overrides,
      });
    }

    if (node.kind === "rubricBlock") {
      const rubric = node as unknown as { view?: readonly string[]; content?: readonly BodyNode[] };

      // Rubric blocks are addressed by view; a delivery engine shows candidates theirs.
      if (!rubric.view?.includes("candidate")) {
        return null;
      }

      return createElement(
        "div",
        { key, "data-qti-rubric-block": true },
        rubric.content?.map((child, index) => renderNode(child, index, overrides)),
      );
    }

    if (node.kind === "printedVariable") {
      const identifier = (node as { identifier?: unknown }).identifier;

      return createElement(PrintedVariableHost, {
        key,
        identifier: typeof identifier === "string" ? identifier : "",
      });
    }

    if (node.kind === "xml") {
      return renderFlow(node as XmlContentNode, key, overrides, inMath);
    }

    const value = (node as { value?: string }).value;

    return typeof value === "string" ? value : null;
  }

  function FeedbackHost({
    feedback,
    element,
    overrides,
  }: {
    feedback: FeedbackView;
    element: "span" | "div";
    overrides?: NodeOverrides | undefined;
  }): ReactNode {
    const { store, suppressFeedback, defaultOutcomes } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    // Withheld feedback shows "the version of the qti-item-body displayed to the
    // candidate at the start of each attempt … with the visibility of any integrated
    // feedback determined by the default values of the outcome variables and not the
    // values … updated by the invocation of response processing".
    const outcome = suppressFeedback
      ? (defaultOutcomes[feedback.outcomeIdentifier] ?? null)
      : (snapshot.outcomes[feedback.outcomeIdentifier] ?? null);

    if (!feedbackVisible(outcome, feedback, suppressFeedback || snapshot.submitted)) {
      return null;
    }

    return createElement(
      element,
      { "data-qti-feedback": feedback.identifier },
      feedback.content?.map((child, index) => renderNode(child, index, overrides)),
    );
  }

  function TemplateContentHost({
    view,
    element,
    overrides,
  }: {
    view: TemplateContentView;
    element: "span" | "div";
    overrides?: NodeOverrides | undefined;
  }): ReactNode {
    const { store } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const value = snapshot.templateValues[view.templateIdentifier] ?? null;

    if (!templateVisible(value, view)) {
      return null;
    }

    return createElement(
      element,
      { "data-qti-template": view.identifier },
      view.content?.map((child, index) => renderNode(child, index, overrides)),
    );
  }

  function PrintedVariableHost({ identifier }: { identifier: string }): ReactNode {
    const { store } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const value = snapshot.templateValues[identifier] ?? snapshot.outcomes[identifier] ?? null;
    const text = value === null ? "" : Array.isArray(value) ? value.join(" ") : String(value);

    return createElement("span", { "data-qti-printed-variable": identifier }, text);
  }

  function ModalFeedbackHost({ feedback }: { feedback: FeedbackView }): ReactNode {
    const { store, suppressFeedback } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const outcome = snapshot.outcomes[feedback.outcomeIdentifier] ?? null;

    // "If it is 'false' then feedback is not shown. This includes both Modal
    // Feedback and Integrated Feedback even if the candidate has access to the
    // review state."
    if (suppressFeedback || !feedbackVisible(outcome, feedback, snapshot.submitted)) {
      return null;
    }

    return createElement(
      "div",
      { role: "status", "data-qti-modal-feedback": feedback.identifier },
      feedback.content?.map((child, index) => renderNode(child, index)),
    );
  }

  function InteractionHost({ node }: { node: InteractionNode }): ReactNode {
    const { store, declarationsById, mode, suppressFeedback, solutionResponses } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

    const responseIdentifier = node.responseIdentifier;
    const declaration = declarationsById.get(responseIdentifier);
    const cardinality: Cardinality = declaration?.cardinality ?? "single";
    // The solution state displays the clone's correct response in place of the
    // candidate's ("a way of entering the solution state").
    const value =
      mode === "solution"
        ? (solutionResponses[responseIdentifier] ?? null)
        : (snapshot.responses[responseIdentifier] ?? null);
    // Review and solution are read-only: "can review the qti-item-body along with
    // the responses they gave, but cannot update or resubmit them".
    const disabled = snapshot.submitted || mode !== "interact";
    // Correctness chrome is feedback: shown after a submitted attempt unless
    // show-feedback withholds it — and always in the solution state (its point).
    const revealed = mode === "solution" || (snapshot.submitted && !suppressFeedback);

    const answered =
      value !== null &&
      !(typeof value === "string" && value.trim() === "") &&
      !(Array.isArray(value) && value.length === 0);

    let status: InteractionStatus = answered ? "answered" : "unanswered";

    if (revealed) {
      const scored = snapshot.scores.find((score) => score.identifier === responseIdentifier);
      status = mode === "solution" || scored?.correct ? "correct" : "incorrect";
    }

    const setValue = (next: ResponseValue): void => {
      if (disabled) {
        return;
      }

      store.setResponse(responseIdentifier, next);
    };

    const getOptionProps = (optionIdentifier: string): OptionProps => {
      const selected = responseIncludes(value, optionIdentifier);

      let status: OptionStatus = selected ? "selected" : "idle";

      if (revealed) {
        if (isCorrectOption(declaration, optionIdentifier)) {
          status = "correct";
        } else if (selected) {
          status = "incorrect";
        } else {
          status = "idle";
        }
      }

      return {
        role: cardinality === "single" ? "radio" : "checkbox",
        tabIndex: 0,
        "aria-checked": selected,
        "aria-disabled": disabled,
        "data-status": status,
        onClick: () => {
          if (disabled) {
            return;
          }

          if (cardinality === "single") {
            setValue(optionIdentifier);
            return;
          }

          const current =
            value === null ? [] : typeof value === "string" ? [value] : Array.isArray(value) ? [...value] : [];
          const next = selected
            ? current.filter((entry) => entry !== optionIdentifier)
            : [...current, optionIdentifier];

          setValue(next);
        },
      };
    };

    const renderContent = (nodes: readonly BodyNode[] | undefined, overrides?: NodeOverrides): ReactNode =>
      nodes ? nodes.map((child, index) => renderNode(child, index, overrides)) : null;

    const { catalogSupports } = useRuntimeContext();
    const renderCatalogSupportsForSkin = (catalogIdref: string | undefined): ReactNode => {
      const supports = catalogIdref !== undefined ? (catalogSupports.get(catalogIdref) ?? []) : [];

      if (!supports.length) {
        return null;
      }

      return supports.map((support, index) =>
        config.renderCatalogSupport
          ? createElement(Fragment, { key: `support-${index}` }, config.renderCatalogSupport(support, catalogIdref!))
          : renderSupportDefault(support, catalogIdref!, index),
      );
    };

    const Skin = config.skin[node.kind];

    if (!Skin) {
      return null;
    }

    return createElement(Skin, {
      node,
      responseIdentifier,
      value,
      setValue,
      renderCatalogSupports: renderCatalogSupportsForSkin,
      disabled,
      showFeedback: revealed,
      status,
      getOptionProps,
      renderContent,
      resolveAsset,
      endAttempt: () => {
        store.setResponse(responseIdentifier, "true");
        store.submit();
      },
      registerResponseCollector: (collector) => store.registerResponseCollector(responseIdentifier, collector),
    });
  }

  function ContentRenderer({ nodes, outcomes, catalogs, pnp, activeSupports }: ContentRendererProps): ReactNode {
    const store = useMemo(() => createStaticStore(outcomes ?? {}), [outcomes]);
    const declarationsById = useMemo(() => new Map<string, ResponseDeclarationView>(), []);
    const catalogSupports = useMemo(
      () => resolveCatalogSupports({ catalogs, pnp, activeSupports }).byCatalogId,
      [catalogs, pnp, activeSupports],
    );

    return createElement(
      RuntimeContext.Provider,
      {
        value: {
          store,
          declarationsById,
          mode: "interact",
          suppressFeedback: false,
          solutionResponses: {},
          defaultOutcomes: {},
          catalogSupports,
        },
      },
      nodes?.map((node, index) => renderNode(node, index)),
    );
  }

  function ItemRenderer({
    item,
    store: externalStore,
    seed,
    mode = "interact",
    showFeedback,
    pnp,
    activeSupports,
    children,
  }: ItemRendererProps): ReactNode {
    const store = useMemo(
      () =>
        externalStore ??
        createAttemptStore(
          item.responseDeclarations,
          {},
          {
            outcomeDeclarations: item.outcomeDeclarations,
            responseProcessing: item.responseProcessing,
            templateDeclarations: item.templateDeclarations,
            templateProcessing: item.templateProcessing,
            adaptive: item.adaptive,
            seed,
            normalization: config.normalization,
            customOperators: config.customOperators,
            constraints: collectInteractionConstraints(item.itemBody.content),
          },
        ),
      [item, externalStore, seed],
    );

    const declarationsById = useMemo(
      () => new Map(item.responseDeclarations.map((declaration) => [declaration.identifier, declaration])),
      [item],
    );

    // "the setting of show-feedback should be ignored for adaptive items when
    // allow-review is 'true'. When in the review state, the final values of the
    // outcome variables should be used."
    const suppressFeedback = mode !== "interact" && showFeedback === false && item.adaptive !== true;

    // Declared outcome defaults, flat-encoded like snapshot outcomes: withheld
    // feedback re-evaluates against these ("as at the start of each attempt").
    const defaultOutcomes = useMemo(() => {
      const defaults: Record<string, OutcomeValue> = {};

      for (const declaration of item.outcomeDeclarations ?? []) {
        const values = declaration.defaultValue?.values;

        if (values !== undefined) {
          defaults[declaration.identifier] =
            declaration.cardinality === "single"
              ? ((values[0]?.value ?? null) as OutcomeValue)
              : (values.map((entry) => entry.value) as never);
        }
      }

      return defaults;
    }, [item]);

    // Shared stimulus content renders before the body through the same sanitized
    // walk; an unresolved ref gets the explicit placeholder (ADR-0003 backstop —
    // canDeliver already reported it).
    const stimulusViews = (item.assessmentStimulusRefs ?? []).map((ref) => ({
      ref,
      view: config.resolveStimulus?.(ref) ?? null,
    }));

    // Catalog ids are document-unique; the item's pool and the resolved stimuli's
    // pool resolve together so idrefs reach across both (§5.28).
    const catalogSupports = resolveCatalogSupports({
      catalogs: [...(item.catalogs ?? []), ...stimulusViews.flatMap(({ view }) => view?.catalogs ?? [])],
      pnp,
      activeSupports,
    }).byCatalogId;

    const stimuli = stimulusViews.map(({ ref, view }, index) =>
      createElement(
        "section",
        { key: `stimulus-${index}`, "data-qti-stimulus": ref.identifier },
        view === null
          ? createElement(
              "div",
              { role: "note", "data-qti-unsupported": "assessmentStimulusRef" },
              `This content requires a shared stimulus (${ref.href}) this runtime cannot resolve.`,
            )
          : view.content.map((node, nodeIndex) => renderNode(node, nodeIndex)),
      ),
    );

    const body = (item.itemBody.content ?? []).map((node, index) => renderNode(node, index));
    const modals = (item.modalFeedbacks ?? []).map((feedback, index) =>
      createElement(ModalFeedbackHost, { key: index, feedback }),
    );

    return createElement(
      RuntimeContext.Provider,
      {
        value: {
          store,
          declarationsById,
          mode,
          suppressFeedback,
          solutionResponses: store.getSnapshot().correctResponses,
          defaultOutcomes,
          catalogSupports,
        },
      },
      stimuli,
      body,
      modals,
      children,
    );
  }

  function useAttempt(): AttemptController {
    const { store } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

    return {
      ...snapshot,
      submit: store.submit,
      reset: store.reset,
    };
  }

  const noSupports: readonly ResolvedCatalogSupport[] = [];

  function useCatalogSupports(catalogIdref: string | undefined): readonly ResolvedCatalogSupport[] {
    const { catalogSupports } = useRuntimeContext();

    return catalogIdref !== undefined ? (catalogSupports.get(catalogIdref) ?? noSupports) : noSupports;
  }

  function canDeliver(item: AssessmentItemView): CapabilityReport {
    // Reduce this runtime's React config to the headless capability inputs: an interaction
    // is supported when it has both a descriptor and a skin; descriptor schemas drive the
    // stricter invalid-interaction check. The walk itself lives in ./item-capability so a
    // server-side caller reaches the same verdict without importing React.
    const supportedInteractions = new Set([...descriptorsByKind.keys()].filter((kind) => Boolean(config.skin[kind])));
    const interactionSchemas = new Map(
      [...descriptorsByKind].map(([kind, descriptor]) => [kind, descriptor.schema] as const),
    );

    return reportItemCapability(item, {
      supportedInteractions,
      interactionSchemas,
      model,
      customOperatorClasses: new Set(Object.keys(config.customOperators ?? {})),
      ...(config.resolveStimulus !== undefined ? { resolveStimulus: config.resolveStimulus } : {}),
    });
  }

  return { ItemRenderer, ContentRenderer, useAttempt, useCatalogSupports, canDeliver };
}
