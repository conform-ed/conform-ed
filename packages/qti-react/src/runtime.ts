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
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import type { ZodType } from "zod";

import {
  isAllowedFlowElement,
  isInteractionKind,
  sanitizeAttributes,
  v0ContentModel,
  type ContentModel,
} from "./content-model";
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
  /** Render body fragments (prompt, choice labels) through the core allowlist walk. */
  renderContent: (nodes: readonly BodyNode[] | undefined) => ReactNode;
}

export type InteractionSkin = ComponentType<InteractionRenderProps>;
export type SkinRegistry = Readonly<Record<string, InteractionSkin>>;

export interface QtiRuntimeConfig {
  readonly interactions: readonly InteractionDescriptor[];
  readonly skin: SkinRegistry;
  readonly contentModel?: ContentModel;
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

export function createQtiRuntime(config: QtiRuntimeConfig): QtiRuntime {
  const model = config.contentModel ?? v0ContentModel;
  const descriptorsByKind = new Map(config.interactions.map((descriptor) => [descriptor.kind, descriptor]));

  function renderFlow(node: XmlContentNode, key: number): ReactNode {
    const isMath = node.name === model.mathRoot;

    if (!isMath && !isAllowedFlowElement(model, node.name)) {
      return null; // not allowlisted → dropped (the sanitizer)
    }

    const attributes = sanitizeAttributes(model, node.attributes);
    const children = node.children?.map((child, index) => renderNode(child, index));

    return createElement(node.name, { key, ...attributes }, node.value ?? children);
  }

  function renderNode(node: BodyNode, key: number): ReactNode {
    if (isInteractionKind(model, node.kind) && descriptorsByKind.has(node.kind) && config.skin[node.kind]) {
      return createElement(InteractionHost, { key, node: node as InteractionNode });
    }

    if (node.kind === "xml") {
      return renderFlow(node as XmlContentNode, key);
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

    const renderContent = (nodes: readonly BodyNode[] | undefined): ReactNode =>
      nodes ? nodes.map((child, index) => renderNode(child, index)) : null;

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

  return { ItemRenderer, useAttempt };
}
