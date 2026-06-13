/**
 * Catalog-aware rendering: "Content inside CatalogInfo is considered 'dormant' and is
 * not included for delivery to candidates by default. A candidate's profile (or
 * assessment program settings) will indicate whether the candidate should be presented
 * any of the possible supports" (§5.29). The runtime renders the referenced content
 * as authored and appends each active support's resolved alternative content beside
 * it, marked with the catalog idref and support name; consumers can take over per
 * support via renderCatalogSupport.
 */

import { describe, expect, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { qtiCoreInteractions } from "../src/interactions";
import { referenceSkin } from "../src/reference-skin";
import { createQtiRuntime, type AssessmentItemView } from "../src/runtime";

const item: AssessmentItemView = {
  responseDeclarations: [],
  outcomeDeclarations: [],
  itemBody: {
    content: [
      {
        kind: "xml",
        name: "p",
        children: [
          { kind: "text", value: "Indicate which statements are " },
          {
            kind: "xml",
            name: "span",
            attributes: { "data-catalog-idref": "catalog1" },
            children: [{ kind: "text", value: "accurate." }],
          },
        ],
      },
    ],
  },
  catalogs: [
    {
      id: "catalog1",
      cards: [
        {
          support: "keyword-translation",
          cardEntries: [
            { xmlLang: "es", htmlContent: { content: [{ kind: "text", value: "preciso" }] } },
            { xmlLang: "de", htmlContent: { content: [{ kind: "text", value: "genau" }] } },
          ],
        },
        {
          support: "spoken",
          cardEntries: [{ default: true, fileHrefs: [{ href: "audio/accurate.mp3", mimeType: "audio/mpeg" }] }],
        },
      ],
    },
  ],
};

function runtime(extra?: Parameters<typeof createQtiRuntime>[0]["renderCatalogSupport"]) {
  return createQtiRuntime({
    interactions: qtiCoreInteractions,
    skin: referenceSkin,
    assetResolver: (href) => `/assets/${href}`,
    ...(extra ? { renderCatalogSupport: extra } : {}),
  });
}

describe("catalog-aware rendering", () => {
  test("an active support renders its resolved content beside the referenced node", () => {
    const { ItemRenderer } = runtime();
    const html = renderToStaticMarkup(
      createElement(ItemRenderer, { item, pnp: { keywordTranslation: { xmlLang: "es" } } }),
    );

    expect(html).toContain("accurate.");
    expect(html).toContain('data-qti-catalog-idref="catalog1"');
    expect(html).toContain('data-qti-support="keyword-translation"');
    expect(html).toContain('lang="es"');
    expect(html).toContain("preciso");
    expect(html).not.toContain("genau");
  });

  test("dormant content stays dormant without a PNP", () => {
    const { ItemRenderer } = runtime();
    const html = renderToStaticMarkup(createElement(ItemRenderer, { item }));

    expect(html).toContain("accurate.");
    expect(html).not.toContain("preciso");
    expect(html).not.toContain("data-qti-support");
  });

  test("prohibited supports never render, even when program settings name them", () => {
    const { ItemRenderer } = runtime();
    const html = renderToStaticMarkup(
      createElement(ItemRenderer, {
        item,
        pnp: { keywordTranslation: { xmlLang: "es" }, prohibitSet: { features: ["keyword-translation"] } },
        activeSupports: ["keyword-translation"],
      }),
    );

    expect(html).not.toContain("preciso");
  });

  test("activeSupports turns on optional supports the PNP only offers", () => {
    const { ItemRenderer } = runtime();
    const pnp = {
      keywordTranslation: { xmlLang: "es" },
      activateAsOptionSet: { features: ["keyword-translation"] },
    };

    const off = renderToStaticMarkup(createElement(ItemRenderer, { item, pnp }));
    expect(off).not.toContain("preciso");

    const on = renderToStaticMarkup(
      createElement(ItemRenderer, { item, pnp, activeSupports: ["keyword-translation"] }),
    );
    expect(on).toContain("preciso");
  });

  test("file-only supports render an accessible link through the asset resolver", () => {
    const { ItemRenderer } = runtime();
    const html = renderToStaticMarkup(createElement(ItemRenderer, { item, pnp: { spoken: {} } }));

    expect(html).toContain('href="/assets/audio/accurate.mp3"');
    expect(html).toContain('type="audio/mpeg"');
    expect(html).toContain('data-qti-support="spoken"');
  });

  test("renderCatalogSupport takes over support rendering", () => {
    const { ItemRenderer } = runtime((support, idref) =>
      createElement("button", { "data-glossary": `${idref}:${support.support}` }, "translate"),
    );
    const html = renderToStaticMarkup(
      createElement(ItemRenderer, { item, pnp: { keywordTranslation: { xmlLang: "es" } } }),
    );

    expect(html).toContain('data-glossary="catalog1:keyword-translation"');
    expect(html).not.toContain("preciso");
  });

  test("ContentRenderer resolves supports for content outside an item", () => {
    const { ContentRenderer } = runtime();
    const html = renderToStaticMarkup(
      createElement(ContentRenderer, {
        nodes: [
          {
            kind: "xml",
            name: "p",
            attributes: { "data-catalog-idref": "rb_cat" },
            children: [{ kind: "text", value: "Choose the best option." }],
          },
        ],
        catalogs: [
          {
            id: "rb_cat",
            cards: [
              {
                support: "keyword-translation",
                cardEntries: [
                  { xmlLang: "es", htmlContent: { content: [{ kind: "text", value: "Elija la mejor." }] } },
                ],
              },
            ],
          },
        ],
        pnp: { keywordTranslation: { xmlLang: "es" } },
      }),
    );

    expect(html).toContain("Choose the best option.");
    expect(html).toContain("Elija la mejor.");
  });
});

describe("skin-owned catalog idrefs (reference skin)", () => {
  test("a choice carrying data-catalog-idref renders its active support beside its label", () => {
    const { ItemRenderer } = runtime();
    const choiceItem: AssessmentItemView = {
      responseDeclarations: [{ identifier: "RESPONSE", cardinality: "single", baseType: "identifier" }],
      outcomeDeclarations: [],
      itemBody: {
        content: [
          {
            kind: "choiceInteraction",
            responseIdentifier: "RESPONSE",
            maxChoices: 1,
            simpleChoices: [
              {
                kind: "simpleChoice",
                identifier: "A",
                dataCatalogIdref: "choice_cat",
                content: [{ kind: "text", value: "accurate" }],
              },
              { kind: "simpleChoice", identifier: "B", content: [{ kind: "text", value: "other" }] },
            ],
          } as never,
        ],
      },
      catalogs: [
        {
          id: "choice_cat",
          cards: [
            {
              support: "keyword-translation",
              cardEntries: [{ xmlLang: "es", htmlContent: { content: [{ kind: "text", value: "preciso" }] } }],
            },
          ],
        },
      ],
    };

    const off = renderToStaticMarkup(createElement(ItemRenderer, { item: choiceItem }));
    expect(off).not.toContain("preciso");

    const on = renderToStaticMarkup(
      createElement(ItemRenderer, { item: choiceItem, pnp: { keywordTranslation: { xmlLang: "es" } } }),
    );
    expect(on).toContain("accurate");
    expect(on).toContain("preciso");
    expect(on).toContain('data-qti-catalog-idref="choice_cat"');
  });
});
