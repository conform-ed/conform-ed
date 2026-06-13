/**
 * Headless capability gate (ADR-0003): "can a runtime that supports `supportedInteractions`
 * deliver this item, and if not, why" — extracted from the React runtime's `canDeliver`
 * so server-side callers (e.g. an ingest pipeline) can reach the *same* decision without
 * importing React. The React runtime delegates to this, passing the interaction set its
 * descriptors + skins cover; a headless caller passes the set its delivery supports.
 *
 * This module is React-free by construction (content-model + RP collectors only; the view
 * shapes are type-only imports), so it ships through the `@conform-ed/qti-react/headless`
 * entry alongside the normalize → view adapters.
 */

import type { ZodType } from "zod";

import type { CapabilityIssue, CapabilityReport } from "./capability";
import { isAllowedFlowElement, v0ContentModel, type ContentModel } from "./content-model";
import { collectRpIssues, collectTemplateIssues } from "./rp";
import type {
  AssessmentItemView,
  AssessmentStimulusRefView,
  BodyNode,
  InteractionNode,
  StimulusContentView,
  XmlContentNode,
} from "./runtime";

const feedbackKinds = new Set(["feedbackInline", "feedbackBlock"]);
const templateContentKinds = new Set(["templateInline", "templateBlock"]);

/** Body node kinds that render without a descriptor, skin, or content-model entry. */
const intrinsicLeafKinds = new Set(["text", "printedVariable"]);

function isFeedbackNode(node: BodyNode): boolean {
  return feedbackKinds.has(node.kind);
}

function isTemplateContentNode(node: BodyNode): boolean {
  return templateContentKinds.has(node.kind);
}

/**
 * An interaction node is any non-xml node carrying a `responseIdentifier` — including
 * kinds this runtime has never heard of. The discriminator must not depend on the
 * supported set, or unknown interactions would be indistinguishable from text.
 */
function isInteractionNode(node: BodyNode): node is InteractionNode {
  return node.kind !== "xml" && typeof (node as { responseIdentifier?: unknown }).responseIdentifier === "string";
}

export interface ItemCapabilityOptions {
  /** Interaction kinds the target runtime can render (descriptor + skin both present). */
  readonly supportedInteractions: ReadonlySet<string>;
  /** Content model deciding the flow-element allowlist + math root; defaults to v0. */
  readonly model?: ContentModel;
  /** Custom-operator classes the target runtime registers (for RP capability). */
  readonly customOperatorClasses?: ReadonlySet<string>;
  /** Resolver for shared-stimulus refs; unresolved refs are not deliverable. */
  readonly resolveStimulus?: (ref: AssessmentStimulusRefView) => StimulusContentView | null;
  /**
   * Optional per-kind schemas for the stricter `invalid-interaction` check. The React
   * runtime supplies its descriptor schemas; a headless caller that has already validated
   * structure (e.g. against the qti-xml contracts schema) can omit them.
   */
  readonly interactionSchemas?: ReadonlyMap<string, ZodType>;
}

/**
 * Report whether `item` can be delivered by a runtime with the given capabilities, and
 * every reason it cannot. Pure and React-free; the React runtime's `canDeliver` is a thin
 * wrapper over this.
 */
export function reportItemCapability(item: AssessmentItemView, options: ItemCapabilityOptions): CapabilityReport {
  const model = options.model ?? v0ContentModel;
  const customOperatorClasses = options.customOperatorClasses ?? new Set<string>();
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
      if (!options.supportedInteractions.has(node.kind)) {
        report({ type: "unsupported-interaction", name: node.kind, responseIdentifier: node.responseIdentifier });

        return;
      }

      const schema = options.interactionSchemas?.get(node.kind);

      if (schema) {
        const parsed = schema.safeParse(node);

        if (!parsed.success) {
          const detail = parsed.error.issues[0]?.message;

          report({
            type: "invalid-interaction",
            name: node.kind,
            responseIdentifier: node.responseIdentifier,
            ...(detail !== undefined ? { detail } : {}),
          });
        }
      }

      return;
    }

    if (node.kind === "xml") {
      const xmlNode = node as XmlContentNode;

      if (xmlNode.name === model.mathRoot) {
        return;
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

    report({ type: "unsupported-element", name: node.kind });
  }

  for (const node of item.itemBody.content ?? []) {
    walk(node);
  }

  for (const ref of item.assessmentStimulusRefs ?? []) {
    const stimulus = options.resolveStimulus?.(ref) ?? null;

    if (stimulus === null) {
      report({ type: "unsupported-element", name: "assessmentStimulusRef", detail: ref.href });
      continue;
    }

    for (const node of stimulus.content) {
      walk(node);
    }
  }

  for (const feedback of item.modalFeedbacks ?? []) {
    for (const child of feedback.content ?? []) {
      walk(child);
    }
  }

  for (const issue of collectRpIssues(item.responseProcessing, {
    customOperatorClasses,
    outcomeDeclarations: item.outcomeDeclarations ?? [],
  })) {
    report(issue);
  }

  for (const issue of collectTemplateIssues(item.templateProcessing, { customOperatorClasses })) {
    report(issue);
  }

  return { deliverable: issues.length === 0, issues };
}

/**
 * Interaction kinds the bundled reference skin renders — the default "supported set" for
 * callers that deliver with the reference skin. Kept in parity with the reference skin by
 * a test; pass an explicit set to `reportItemCapability` for a custom delivery surface.
 */
export const referenceInteractionKinds: readonly string[] = [
  "associateInteraction",
  "choiceInteraction",
  "drawingInteraction",
  "endAttemptInteraction",
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
];
