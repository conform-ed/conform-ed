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

import { isAllowedFlowElement, sanitizeAttributes, v0ContentModel, type ContentModel } from "./content-model";
import { createAttemptStore, type AttemptSnapshot, type AttemptStore } from "./store";
import type { Cardinality, ResponseDeclarationView, ResponseValue, ScoreResult } from "./types";

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

export interface AssessmentItemView {
  responseDeclarations: readonly ResponseDeclarationView[];
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
}

// ---------- Capability Report (ADR-0003) ----------

export type CapabilityIssueType = "unsupported-interaction" | "invalid-interaction" | "unsupported-element";

export interface CapabilityIssue {
  readonly type: CapabilityIssueType;
  /** The interaction kind or element name at issue. */
  readonly name: string;
  readonly responseIdentifier?: string;
  readonly detail?: string;
}

export interface CapabilityReport {
  readonly deliverable: boolean;
  readonly issues: readonly CapabilityIssue[];
}

export interface ItemRendererProps {
  item: AssessmentItemView;
  // Rendered inside the same runtime context as the item body, after it. Lets a consumer
  // drop controls (a Submit bar, a score panel) that call `useAttempt()` for this item —
  // the attempt store is per-item and scoped to this subtree.
  children?: ReactNode;
}

export interface QtiRuntime {
  ItemRenderer: ComponentType<ItemRendererProps>;
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

export function createQtiRuntime(config: QtiRuntimeConfig): QtiRuntime {
  const model = config.contentModel ?? v0ContentModel;
  const descriptorsByKind = new Map(config.interactions.map((descriptor) => [descriptor.kind, descriptor]));

  function renderFlow(node: XmlContentNode, key: number, overrides?: NodeOverrides): ReactNode {
    const isMath = node.name === model.mathRoot;

    if (!isMath && !isAllowedFlowElement(model, node.name)) {
      return null; // not allowlisted → dropped (the sanitizer)
    }

    const attributes = sanitizeAttributes(model, node.attributes);
    const children = node.children?.map((child, index) => renderNode(child, index, overrides));

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

  function renderNode(node: BodyNode, key: number, overrides?: NodeOverrides): ReactNode {
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

    if (node.kind === "xml") {
      return renderFlow(node as XmlContentNode, key, overrides);
    }

    const value = (node as { value?: string }).value;

    return typeof value === "string" ? value : null;
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
    });
  }

  function ItemRenderer({ item, children }: ItemRendererProps): ReactNode {
    const store = useMemo(() => {
      const initial: Record<string, ResponseValue> = {};

      for (const node of item.itemBody.content ?? []) {
        // initial responses are seeded lazily by skins; declarations drive scoring.
        void node;
      }

      return createAttemptStore(item.responseDeclarations, initial);
    }, [item]);

    const declarationsById = useMemo(
      () => new Map(item.responseDeclarations.map((declaration) => [declaration.identifier, declaration])),
      [item],
    );

    const body = (item.itemBody.content ?? []).map((node, index) => renderNode(node, index));

    return createElement(RuntimeContext.Provider, { value: { store, declarationsById } }, body, children);
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

        if (!isAllowedFlowElement(model, xmlNode.name)) {
          report({ type: "unsupported-element", name: xmlNode.name });
        }

        for (const child of xmlNode.children ?? []) {
          walk(child);
        }
      }
    }

    for (const node of item.itemBody.content ?? []) {
      walk(node);
    }

    return { deliverable: issues.length === 0, issues };
  }

  return { ItemRenderer, useAttempt, canDeliver };
}
