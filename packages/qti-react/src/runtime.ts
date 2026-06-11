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

import type { CapabilityIssue, CapabilityReport } from "./capability";
import {
  isAllowedFlowElement,
  sanitizeAttributes,
  sanitizeMathAttributes,
  v0ContentModel,
  type ContentModel,
} from "./content-model";
import { collectRpIssues, collectTemplateIssues } from "./rp";
import type {
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

export interface AssessmentItemView {
  responseDeclarations: readonly ResponseDeclarationView[];
  outcomeDeclarations?: readonly OutcomeDeclarationView[];
  responseProcessing?: ResponseProcessingView;
  templateDeclarations?: readonly TemplateDeclarationView[];
  templateProcessing?: TemplateProcessingView;
  /** QTI adaptive item: multiple attempts until completionStatus reaches "completed". */
  adaptive?: boolean;
  modalFeedbacks?: readonly FeedbackView[];
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
}

export interface ItemRendererProps {
  item: AssessmentItemView;
  /**
   * An externally owned attempt store. Without it the renderer creates a fresh
   * per-mount store; passing one enables review/replay modes (rehydrate a stored,
   * already-submitted attempt) and server-side rendering of submitted states.
   */
  store?: AttemptStore;
  /** Clone seed for template processing; store it to replay the same clone. */
  seed?: number;
  // Rendered inside the same runtime context as the item body, after it. Lets a consumer
  // drop controls (a Submit bar, a score panel) that call `useAttempt()` for this item —
  // the attempt store is per-item and scoped to this subtree.
  children?: ReactNode;
}

export interface ContentRendererProps {
  nodes?: readonly BodyNode[];
  /** Values for printedVariable (and showHide-gated feedback) inside the content. */
  outcomes?: Readonly<Record<string, OutcomeValue>>;
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

interface RuntimeContextValue {
  store: AttemptStore;
  declarationsById: ReadonlyMap<string, ResponseDeclarationView>;
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

  return typeof value === "string" ? value === optionIdentifier : value.includes(optionIdentifier);
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

/** Body node kinds that render without a descriptor, skin, or content-model entry. */
const intrinsicLeafKinds = new Set(["text", "printedVariable"]);

/** A read-only, already-"submitted" store: backs content rendered outside an attempt. */
function createStaticStore(outcomes: Readonly<Record<string, OutcomeValue>>): AttemptStore {
  const snapshot: AttemptSnapshot = {
    responses: {},
    submitted: true,
    scores: [],
    outcomes,
    templateValues: {},
    attemptCount: 1,
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    setResponse: () => {},
    registerResponseCollector: () => () => {},
    submit: () => [],
    reset: () => {},
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

  function renderFlow(node: XmlContentNode, key: number, overrides?: NodeOverrides, inMath = false): ReactNode {
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

  function renderNode(node: BodyNode, key: number, overrides?: NodeOverrides, inMath = false): ReactNode {
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
    overrides?: NodeOverrides;
  }): ReactNode {
    const { store } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const outcome = snapshot.outcomes[feedback.outcomeIdentifier] ?? null;

    if (!feedbackVisible(outcome, feedback, snapshot.submitted)) {
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
    overrides?: NodeOverrides;
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
    const { store } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const outcome = snapshot.outcomes[feedback.outcomeIdentifier] ?? null;

    if (!feedbackVisible(outcome, feedback, snapshot.submitted)) {
      return null;
    }

    return createElement(
      "div",
      { role: "status", "data-qti-modal-feedback": feedback.identifier },
      feedback.content?.map((child, index) => renderNode(child, index)),
    );
  }

  function InteractionHost({ node }: { node: InteractionNode }): ReactNode {
    const { store, declarationsById } = useRuntimeContext();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

    const responseIdentifier = node.responseIdentifier;
    const declaration = declarationsById.get(responseIdentifier);
    const cardinality: Cardinality = declaration?.cardinality ?? "single";
    const value = snapshot.responses[responseIdentifier] ?? null;
    const disabled = snapshot.submitted;

    const answered =
      value !== null &&
      !(typeof value === "string" && value.trim() === "") &&
      !(Array.isArray(value) && value.length === 0);

    let status: InteractionStatus = answered ? "answered" : "unanswered";

    if (disabled) {
      const scored = snapshot.scores.find((score) => score.identifier === responseIdentifier);
      status = scored?.correct ? "correct" : "incorrect";
    }

    const setValue = (next: ResponseValue): void => {
      store.setResponse(responseIdentifier, next);
    };

    const getOptionProps = (optionIdentifier: string): OptionProps => {
      const selected = responseIncludes(value, optionIdentifier);

      let status: OptionStatus = selected ? "selected" : "idle";

      if (disabled) {
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

          const current = value === null ? [] : typeof value === "string" ? [value] : [...value];
          const next = selected
            ? current.filter((entry) => entry !== optionIdentifier)
            : [...current, optionIdentifier];

          setValue(next);
        },
      };
    };

    const renderContent = (nodes: readonly BodyNode[] | undefined, overrides?: NodeOverrides): ReactNode =>
      nodes ? nodes.map((child, index) => renderNode(child, index, overrides)) : null;

    const Skin = config.skin[node.kind];

    if (!Skin) {
      return null;
    }

    return createElement(Skin, {
      node,
      responseIdentifier,
      value,
      setValue,
      disabled,
      showFeedback: disabled,
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

  function ContentRenderer({ nodes, outcomes }: ContentRendererProps): ReactNode {
    const store = useMemo(() => createStaticStore(outcomes ?? {}), [outcomes]);
    const declarationsById = useMemo(() => new Map<string, ResponseDeclarationView>(), []);

    return createElement(
      RuntimeContext.Provider,
      { value: { store, declarationsById } },
      nodes?.map((node, index) => renderNode(node, index)),
    );
  }

  function ItemRenderer({ item, store: externalStore, seed, children }: ItemRendererProps): ReactNode {
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
          },
        ),
      [item, externalStore, seed],
    );

    const declarationsById = useMemo(
      () => new Map(item.responseDeclarations.map((declaration) => [declaration.identifier, declaration])),
      [item],
    );

    const body = (item.itemBody.content ?? []).map((node, index) => renderNode(node, index));
    const modals = (item.modalFeedbacks ?? []).map((feedback, index) =>
      createElement(ModalFeedbackHost, { key: index, feedback }),
    );

    return createElement(RuntimeContext.Provider, { value: { store, declarationsById } }, body, modals, children);
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

  function canDeliver(item: AssessmentItemView): CapabilityReport {
    const issues: CapabilityIssue[] = [];
    const seen = new Set<string>();

    function report(issue: CapabilityIssue): void {
      const dedupeKey = `${issue.type}:${issue.name}:${issue.responseIdentifier ?? ""}`;

      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        issues.push(issue);
      }
    }

    function walk(node: BodyNode): void {
      if (isFeedbackNode(node) || isTemplateContentNode(node) || node.kind === "rubricBlock") {
        for (const child of (node as unknown as { content?: readonly BodyNode[] }).content ?? []) {
          walk(child);
        }

        return;
      }

      if (isInteractionNode(node)) {
        const descriptor = descriptorsByKind.get(node.kind);

        if (!descriptor || !config.skin[node.kind]) {
          report({
            type: "unsupported-interaction",
            name: node.kind,
            responseIdentifier: node.responseIdentifier,
          });

          return;
        }

        const parsed = descriptor.schema.safeParse(node);

        if (!parsed.success) {
          report({
            type: "invalid-interaction",
            name: node.kind,
            responseIdentifier: node.responseIdentifier,
            detail: parsed.error.issues[0]?.message,
          });
        }

        // Interaction-internal content (prompt, choice bodies) is structurally
        // validated by the descriptor schema; its flow elements are walked when the
        // descriptor surfaces them. Generic field-sniffing is deliberately avoided.
        return;
      }

      if (node.kind === "xml") {
        const xmlNode = node as XmlContentNode;

        if (xmlNode.name === model.mathRoot) {
          return; // MathML renders structurally; its subtree is not flow content
        }

        if (!isAllowedFlowElement(model, xmlNode.name)) {
          report({ type: "unsupported-element", name: xmlNode.name });
        }

        for (const child of xmlNode.children ?? []) {
          walk(child);
        }

        return;
      }

      if (intrinsicLeafKinds.has(node.kind)) {
        return;
      }

      // Any other kind (include, multi-stage groups, future vocabulary) has no
      // rendering path: report it rather than let the renderer drop it (ADR-0003).
      report({ type: "unsupported-element", name: node.kind });
    }

    for (const node of item.itemBody.content ?? []) {
      walk(node);
    }

    for (const feedback of item.modalFeedbacks ?? []) {
      for (const child of feedback.content ?? []) {
        walk(child);
      }
    }

    for (const issue of collectRpIssues(item.responseProcessing)) {
      report(issue);
    }

    for (const issue of collectTemplateIssues(item.templateProcessing)) {
      report(issue);
    }

    return { deliverable: issues.length === 0, issues };
  }

  return { ItemRenderer, ContentRenderer, useAttempt, canDeliver };
}
