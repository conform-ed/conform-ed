// @ts-check
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";
import { createStarlightTypeDocPlugin } from "starlight-typedoc";

const [qtiReactTypeDoc, qtiReactTypeDocSidebar] = createStarlightTypeDocPlugin();
const [qtiXmlTypeDoc, qtiXmlTypeDocSidebar] = createStarlightTypeDocPlugin();

const ogImage = "https://conform-ed.github.io/og-meme.png";

export default defineConfig({
  site: "https://conform-ed.github.io",
  integrations: [
    starlight({
      title: "conform-ed",
      description: "Open-source tooling to build and verify conformance to digital-education standards.",
      logo: {
        light: "./src/assets/conformed-lockup-h.svg",
        dark: "./src/assets/conformed-lockup-h-dark.svg",
        replacesTitle: true,
      },
      favicon: "/favicon.svg",
      customCss: ["@fontsource/jetbrains-mono/400.css", "@fontsource/jetbrains-mono/600.css", "./src/styles/brand.css"],
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/conform-ed/conform-ed" }],
      head: [
        { tag: "meta", attrs: { property: "og:image", content: ogImage } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
        { tag: "meta", attrs: { name: "twitter:image", content: ogImage } },
        { tag: "link", attrs: { rel: "icon", href: "/favicon.ico", sizes: "any" } },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: "conform-ed",
          description:
            "conform-ed is open-source tooling to build and verify conformance to digital-education standards (xAPI, QTI, LTI 1.3, Common Cartridge, OneRoster, CASE, CLR, Open Badges, Caliper, and more). It provides typed Zod contracts, a headless QTI delivery runtime, and conformance runner images for engineers building or verifying ed-tech interoperability.",
        }),
        qtiReactTypeDoc({
          entryPoints: ["../../packages/qti-react/src/index.ts", "../../packages/qti-react/src/headless.ts"],
          tsconfig: "../../packages/qti-react/tsconfig.json",
          output: "api/qti-react",
          sidebar: { label: "qti-react" },
        }),
        qtiXmlTypeDoc({
          entryPoints: ["../../packages/qti-xml/src/index.ts"],
          tsconfig: "../../packages/qti-xml/tsconfig.json",
          output: "api/qti-xml",
          sidebar: { label: "qti-xml" },
        }),
      ],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "What is conform-ed?", slug: "start/overview" },
            { label: "Getting started", slug: "start/getting-started" },
            { label: "Use these docs with your AI assistant", slug: "start/ai-assistants" },
          ],
        },
        { label: "Standards & contracts", items: [{ autogenerate: { directory: "contracts" } }] },
        { label: "QTI delivery runtime", items: [{ autogenerate: { directory: "qti" } }] },
        { label: "Common Cartridge", items: [{ autogenerate: { directory: "common-cartridge" } }] },
        { label: "Conformance runners", items: [{ autogenerate: { directory: "runners" } }] },
        { label: "CLI", items: [{ autogenerate: { directory: "cli" } }] },
        { label: "Coverage map", items: [{ autogenerate: { directory: "coverage" } }] },
        { label: "API reference", items: [qtiReactTypeDocSidebar, qtiXmlTypeDocSidebar] },
        { label: "Design decisions", items: [{ autogenerate: { directory: "decisions" } }] },
        { label: "Project", items: [{ autogenerate: { directory: "project" } }] },
      ],
    }),
    react(),
  ],
});
