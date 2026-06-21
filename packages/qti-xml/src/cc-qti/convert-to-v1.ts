/**
 * The **inverse** Common Cartridge QTI bridge: QTI 3.0 `assessmentItem` → CC QTI ASI **1.2.1**
 * (`questestinterop`). `convert-to-v3.ts` lifts a cartridge's 1.2.1 items up to QTI 3 so the engine
 * can deliver them; this lowers authored QTI 3 items back down so a **CC 1.3 producer** can emit
 * `imsqti_xmlv1p2/imscc_xmlv1p3/assessment` resources (legacy-LMS reach). It is lossy by nature —
 * QTI 3 is far richer than the CC profile — so it converts only the three profile-representable
 * interactions (single/multiple **choice**, **text-entry** fill-in-blank, **extended-text** essay)
 * and **reports** every other item as `unsupported` with a reason. The producer decides what to do
 * with an unsupported item (the emergent exporter renders it as visible `webcontent`, never dropped).
 *
 * Mirrors `convert-to-v3.ts` exactly so a CC item survives a forward→inverse round-trip: the choice
 * `cc_profile`, the `respident`/choice identifiers, and the correct-answer `varequal`s all line up.
 */

import { parseXmlDocument, type QtiXmlElementNode, type QtiXmlNode } from "../parse-xml";
import { XmlWriter } from "../xml-writer";
import type { CcQtiInteractionKind } from "./convert-to-v3";

const QUESTESTINTEROP_NAMESPACE = "http://www.imsglobal.org/xsd/ims_qtiasiv1p2";

const CC_PROFILE_BY_KIND = {
  multipleChoice: "cc.multiple_choice.v0p1",
  multipleResponse: "cc.multiple_response.v0p1",
  fib: "cc.fib.v0p1",
  essay: "cc.essay.v0p1",
} as const;

export type QtiV3ToCcV1ItemResult =
  | {
      status: "converted";
      identifier: string;
      title: string;
      ccProfile: string;
      interactionKind: CcQtiInteractionKind;
      /** The CC 1.2.1 `<item>` element XML (no prolog), ready to nest in a `<section>`. */
      xml: string;
    }
  | {
      status: "unsupported";
      identifier: string;
      title: string;
      reason: string;
      /** Plain-text stem (item-body text minus the interaction) for a visible fallback rendering. */
      stemText: string;
    };

export type QtiV3ToCcV1AssessmentResult = {
  identifier: string;
  title: string;
  /** Per-item outcome, in input order — converted items carry CC XML, the rest carry a reason. */
  items: QtiV3ToCcV1ItemResult[];
  /** `<questestinterop>` doc of the converted items only; `null` when none could be converted. */
  assessmentXml: string | null;
  convertedCount: number;
  unsupportedCount: number;
};

// --- node helpers (mirror decompose.ts) ------------------------------------

function elements(node: QtiXmlElementNode, localName?: string): QtiXmlElementNode[] {
  return node.children.filter(
    (child): child is QtiXmlElementNode =>
      child.type === "element" && (localName === undefined || child.localName === localName),
  );
}

function firstElement(node: QtiXmlElementNode, localName: string): QtiXmlElementNode | undefined {
  return elements(node, localName)[0];
}

function attr(node: QtiXmlElementNode, name: string): string | undefined {
  return node.attributes[name];
}

/** Concatenated, whitespace-collapsed text of an element's whole subtree. */
function textOf(node: QtiXmlElementNode): string {
  const parts: string[] = [];
  const walk = (children: QtiXmlNode[]): void => {
    for (const child of children) {
      if (child.type === "text") parts.push(child.value);
      else walk(child.children);
    }
  };
  walk(node.children);
  return parts.join(" ").replace(/\s+/gu, " ").trim();
}

function isInteraction(node: QtiXmlElementNode): boolean {
  return node.localName.endsWith("-interaction");
}

/** Every interaction element anywhere under `node` (item bodies nest them in content). */
function collectInteractions(node: QtiXmlElementNode): QtiXmlElementNode[] {
  const found: QtiXmlElementNode[] = [];
  const walk = (element: QtiXmlElementNode): void => {
    for (const child of elements(element)) {
      if (isInteraction(child)) found.push(child);
      else walk(child);
    }
  };
  walk(node);
  return found;
}

/** Stem text = the item-body text with the interaction subtree removed. */
function stemTextOf(itemBody: QtiXmlElementNode, interaction: QtiXmlElementNode): string {
  const parts: string[] = [];
  const walk = (element: QtiXmlElementNode): void => {
    for (const child of element.children) {
      if (child.type === "text") {
        parts.push(child.value);
      } else if (child !== interaction) {
        walk(child);
      }
    }
  };
  walk(itemBody);
  return parts.join(" ").replace(/\s+/gu, " ").trim();
}

function responseDeclarationFor(
  item: QtiXmlElementNode,
  responseIdentifier: string | undefined,
): QtiXmlElementNode | undefined {
  const declarations = elements(item, "qti-response-declaration");
  if (responseIdentifier === undefined) return declarations[0];
  return declarations.find((declaration) => attr(declaration, "identifier") === responseIdentifier) ?? declarations[0];
}

function correctValues(declaration: QtiXmlElementNode | undefined): string[] {
  if (!declaration) return [];
  const correct = firstElement(declaration, "qti-correct-response");
  if (!correct) return [];
  return elements(correct, "qti-value").map(textOf);
}

type MapEntry = { value: string; caseSensitive: boolean };

function mapEntries(declaration: QtiXmlElementNode | undefined): MapEntry[] {
  if (!declaration) return [];
  const mapping = firstElement(declaration, "qti-mapping");
  if (!mapping) return [];
  return elements(mapping, "qti-map-entry").map((entry) => ({
    value: attr(entry, "map-key") ?? "",
    caseSensitive: attr(entry, "case-sensitive") === "true",
  }));
}

// --- CC 1.2.1 emission ------------------------------------------------------

function writeItemMetadata(writer: XmlWriter, ccProfile: string): void {
  writer.element("itemmetadata", [], () => {
    writer.element("qtimetadata", [], () => {
      writer.element("qtimetadatafield", [], () => {
        writer.element("fieldlabel", [], "cc_profile");
        writer.element("fieldentry", [], ccProfile);
      });
    });
  });
}

function writeScoreOutcomes(writer: XmlWriter): void {
  writer.element("outcomes", [], () => {
    writer.element("decvar", [
      ["varname", "SCORE"],
      ["vartype", "Decimal"],
      ["minvalue", "0"],
      ["maxvalue", "100"],
    ]);
  });
}

function writeChoiceItem(
  writer: XmlWriter,
  input: {
    identifier: string;
    title: string;
    responseId: string;
    multiple: boolean;
    stemText: string;
    choices: Array<{ ident: string; text: string }>;
    correct: string[];
  },
): void {
  const ccProfile = input.multiple ? CC_PROFILE_BY_KIND.multipleResponse : CC_PROFILE_BY_KIND.multipleChoice;
  writer.element(
    "item",
    [
      ["ident", input.identifier],
      ["title", input.title],
    ],
    () => {
      writeItemMetadata(writer, ccProfile);
      writer.element("presentation", [], () => {
        writer.element("material", [], () => {
          writer.element("mattext", [["texttype", "text/plain"]], input.stemText);
        });
        writer.element(
          "response_lid",
          [
            ["ident", input.responseId],
            ["rcardinality", input.multiple ? "Multiple" : "Single"],
          ],
          () => {
            writer.element("render_choice", [], () => {
              for (const choice of input.choices) {
                writer.element("response_label", [["ident", choice.ident]], () => {
                  writer.element("material", [], () => {
                    writer.element("mattext", [["texttype", "text/plain"]], choice.text);
                  });
                });
              }
            });
          },
        );
      });
      writer.element("resprocessing", [], () => {
        writeScoreOutcomes(writer);
        writer.element("respcondition", [["continue", "No"]], () => {
          writer.element("conditionvar", [], () => {
            const writeVarequal = (value: string): void =>
              writer.element("varequal", [["respident", input.responseId]], value);
            if (input.correct.length > 1) {
              writer.element("and", [], () => {
                for (const value of input.correct) writeVarequal(value);
              });
            } else if (input.correct.length === 1) {
              writeVarequal(input.correct[0]!);
            }
          });
          writer.element(
            "setvar",
            [
              ["varname", "SCORE"],
              ["action", "Set"],
            ],
            "100",
          );
        });
      });
    },
  );
}

function writeFibItem(
  writer: XmlWriter,
  input: { identifier: string; title: string; responseId: string; stemText: string; correct: MapEntry[] },
): void {
  writer.element(
    "item",
    [
      ["ident", input.identifier],
      ["title", input.title],
    ],
    () => {
      writeItemMetadata(writer, CC_PROFILE_BY_KIND.fib);
      writer.element("presentation", [], () => {
        writer.element("material", [], () => {
          writer.element("mattext", [["texttype", "text/plain"]], input.stemText);
        });
        writer.element(
          "response_str",
          [
            ["ident", input.responseId],
            ["rcardinality", "Single"],
          ],
          () => {
            writer.element("render_fib", [], () => {
              writer.element("response_label", [["ident", `${input.responseId}_blank`]]);
            });
          },
        );
      });
      writer.element("resprocessing", [], () => {
        writeScoreOutcomes(writer);
        for (const entry of input.correct) {
          writer.element("respcondition", [["continue", "No"]], () => {
            writer.element("conditionvar", [], () => {
              writer.element(
                "varequal",
                [
                  ["respident", input.responseId],
                  ["case", entry.caseSensitive ? "Yes" : "No"],
                ],
                entry.value,
              );
            });
            writer.element(
              "setvar",
              [
                ["varname", "SCORE"],
                ["action", "Set"],
              ],
              "100",
            );
          });
        }
      });
    },
  );
}

function writeEssayItem(
  writer: XmlWriter,
  input: { identifier: string; title: string; responseId: string; stemText: string },
): void {
  writer.element(
    "item",
    [
      ["ident", input.identifier],
      ["title", input.title],
    ],
    () => {
      writeItemMetadata(writer, CC_PROFILE_BY_KIND.essay);
      writer.element("presentation", [], () => {
        writer.element("material", [], () => {
          writer.element("mattext", [["texttype", "text/plain"]], input.stemText);
        });
        writer.element(
          "response_str",
          [
            ["ident", input.responseId],
            ["rcardinality", "Single"],
          ],
          () => {
            writer.element("render_fib", [["prompt", "Box"]], () => {
              writer.element("response_label", [["ident", `${input.responseId}_blank`]]);
            });
          },
        );
      });
    },
  );
}

// --- item conversion --------------------------------------------------------

function parseItemElement(xml: string): QtiXmlElementNode | undefined {
  let root: QtiXmlElementNode;
  try {
    root = parseXmlDocument(xml);
  } catch {
    return undefined;
  }
  if (root.localName === "qti-assessment-item") return root;
  // Tolerate a wrapped document — find the item anywhere under the root.
  const stack: QtiXmlElementNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.localName === "qti-assessment-item") return node;
    stack.push(...elements(node));
  }
  return undefined;
}

/**
 * Convert one QTI 3 `assessmentItem` to a CC 1.2.1 `<item>`. Returns `unsupported` (never throws on
 * shape) for an item that is not a single choice/text-entry/extended-text interaction, so the
 * producer can render it as a visible fallback rather than silently dropping it.
 */
export function convertQtiV3ItemToCcV1(xml: string, fallbackIdentifier = "item"): QtiV3ToCcV1ItemResult {
  const item = parseItemElement(xml);
  if (!item) {
    return {
      status: "unsupported",
      identifier: fallbackIdentifier,
      title: fallbackIdentifier,
      reason: "not a QTI 3 assessment item",
      stemText: "",
    };
  }

  const identifier = attr(item, "identifier") ?? fallbackIdentifier;
  const title = attr(item, "title") ?? identifier;
  const itemBody = firstElement(item, "qti-item-body");
  const interactions = itemBody ? collectInteractions(itemBody) : [];

  if (interactions.length !== 1) {
    const reason =
      interactions.length === 0 ? "item has no interaction" : "item has multiple interactions (not a CC 1.2.1 profile)";
    return { status: "unsupported", identifier, title, reason, stemText: itemBody ? textOf(itemBody) : "" };
  }

  const interaction = interactions[0]!;
  const responseId = attr(interaction, "response-identifier") ?? "RESPONSE";
  const declaration = responseDeclarationFor(item, responseId);
  const stemText = stemTextOf(itemBody!, interaction);
  const writer = new XmlWriter();

  switch (interaction.localName) {
    case "qti-choice-interaction": {
      const cardinality = declaration ? attr(declaration, "cardinality") : undefined;
      const maxChoices = attr(interaction, "max-choices");
      const multiple =
        cardinality === "multiple" || (cardinality === undefined && maxChoices !== undefined && maxChoices !== "1");
      const choices = elements(interaction, "qti-simple-choice").map((choice) => ({
        ident: attr(choice, "identifier") ?? "",
        text: textOf(choice),
      }));
      writeChoiceItem(writer, {
        identifier,
        title,
        responseId,
        multiple,
        stemText,
        choices,
        correct: correctValues(declaration),
      });
      return {
        status: "converted",
        identifier,
        title,
        ccProfile: multiple ? CC_PROFILE_BY_KIND.multipleResponse : CC_PROFILE_BY_KIND.multipleChoice,
        interactionKind: "choice",
        xml: writer.toString().trimEnd(),
      };
    }
    case "qti-text-entry-interaction": {
      const entries = mapEntries(declaration);
      const correct =
        entries.length > 0 ? entries : correctValues(declaration).map((value) => ({ value, caseSensitive: false }));
      writeFibItem(writer, { identifier, title, responseId, stemText, correct });
      return {
        status: "converted",
        identifier,
        title,
        ccProfile: CC_PROFILE_BY_KIND.fib,
        interactionKind: "textEntry",
        xml: writer.toString().trimEnd(),
      };
    }
    case "qti-extended-text-interaction": {
      writeEssayItem(writer, { identifier, title, responseId, stemText });
      return {
        status: "converted",
        identifier,
        title,
        ccProfile: CC_PROFILE_BY_KIND.essay,
        interactionKind: "extendedText",
        xml: writer.toString().trimEnd(),
      };
    }
    default:
      return {
        status: "unsupported",
        identifier,
        title,
        reason: `interaction ${interaction.localName} is not representable in CC 1.2.1`,
        stemText,
      };
  }
}

/**
 * Convert a set of QTI 3 items into one CC 1.2.1 `<questestinterop>` assessment. Each item is
 * converted independently; the assessment carries only the converted items, and `assessmentXml` is
 * `null` when none could be converted (the producer then degrades the whole assessment to webcontent).
 */
export function convertQtiV3AssessmentToCcV1(input: {
  identifier: string;
  title: string;
  items: ReadonlyArray<{ identifier?: string; xml: string }>;
}): QtiV3ToCcV1AssessmentResult {
  const items = input.items.map((entry, index) =>
    convertQtiV3ItemToCcV1(entry.xml, entry.identifier ?? `item-${index + 1}`),
  );
  const converted = items.filter(
    (result): result is Extract<QtiV3ToCcV1ItemResult, { status: "converted" }> => result.status === "converted",
  );

  let assessmentXml: string | null = null;
  if (converted.length > 0) {
    const writer = new XmlWriter();
    writer.line('<?xml version="1.0" encoding="UTF-8"?>');
    writer.element("questestinterop", [["xmlns", QUESTESTINTEROP_NAMESPACE]], () => {
      writer.element(
        "assessment",
        [
          ["ident", input.identifier],
          ["title", input.title],
        ],
        () => {
          writer.element("section", [["ident", "root_section"]], () => {
            for (const result of converted) writer.line(result.xml);
          });
        },
      );
    });
    assessmentXml = writer.toString();
  }

  return {
    identifier: input.identifier,
    title: input.title,
    items,
    assessmentXml,
    convertedCount: converted.length,
    unsupportedCount: items.length - converted.length,
  };
}
