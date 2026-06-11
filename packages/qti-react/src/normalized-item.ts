/**
 * Adapter from `@conform-ed/qti-xml`'s normalized assessment-item JSON to the runtime's
 * `AssessmentItemView`. Pure data reshaping (no qti-xml dependency): the normalizer's
 * shapes are already view-compatible except that v3 content fragments emit bare strings
 * for text nodes, which become `{ kind: "text", value }` here. Used by the corpus
 * delivery meter (ADR-0002) and by any consumer ingesting normalized XML.
 */

import type { OutcomeDeclarationView, ResponseProcessingView } from "./rp";
import type { AssessmentItemView, BodyNode } from "./runtime";
import type { Cardinality, ResponseDeclarationView } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function convertContentEntry(entry: unknown): unknown {
  if (typeof entry === "string") {
    return { kind: "text", value: entry };
  }

  return convertValue(entry);
}

function convertValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(convertValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if ((key === "children" || key === "content") && Array.isArray(entry)) {
        return [key, entry.map(convertContentEntry)];
      }

      return [key, convertValue(entry)];
    }),
  );
}

/**
 * Reshape a normalized QTI document (the `normalizedDocument` from qti-xml validation)
 * into an `AssessmentItemView`, or null when it is not an assessment item.
 */
export function assessmentItemViewFromNormalized(document: unknown): AssessmentItemView | null {
  if (!isRecord(document) || !isRecord(document["assessmentItem"])) {
    return null;
  }

  const item = convertValue(document["assessmentItem"]) as Record<string, unknown>;
  const itemBody = isRecord(item["itemBody"]) ? (item["itemBody"] as { content?: BodyNode[] }) : {};

  return {
    responseDeclarations: (item["responseDeclarations"] as ResponseDeclarationView[] | undefined) ?? [],
    outcomeDeclarations: (item["outcomeDeclarations"] as OutcomeDeclarationView[] | undefined) ?? [],
    ...(item["responseProcessing"] !== undefined
      ? { responseProcessing: item["responseProcessing"] as ResponseProcessingView }
      : {}),
    ...(typeof item["adaptive"] === "boolean" ? { adaptive: item["adaptive"] } : {}),
    itemBody: { content: itemBody.content ?? [] },
  } satisfies AssessmentItemView & { responseDeclarations: { cardinality: Cardinality }[] };
}
