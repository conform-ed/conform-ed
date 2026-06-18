# Docs site: Astro Starlight, monorepo source deployed to a dedicated org-pages repo

Status: accepted (2026-06-18)

conform-ed is moving out of `emergent-english` into its own `conform-ed` GitHub org, and
wants a public documentation site for external engineers — people who consume the libraries
(`@conform-ed/contracts`, `qti-react`, `qti-xml`, `common-cartridge`, `pci-math-entry`) and the
conformance runner images — served at the **bare root** `https://conform-ed.github.io`. The site
must be static (GitHub Pages), themeable to the brand kit (ink/paper/teal, JetBrains Mono, the
animated `[✓]` hero), able to render the React delivery runtime for live demos, and expose
LLM-oriented documentation. This ADR records the platform and hosting shape; the content
information-architecture (organise by surface, with a by-standard index) and the API-reference
strategy (curated guides plus generated reference for code-shaped packages) are downstream of it.

## Decision

- **Generator: Astro Starlight.** Starlight gives docs structure (sidebar, search, dark mode) on
  top of Astro, which gives a custom-built landing page for the animated hero and the brand. It is
  the only candidate that renders the **React** `qti-react` runtime natively (Astro React islands),
  so live interaction demos are possible. Search is offline **Pagefind** (no Algolia dependency).
- **Source lives in the monorepo** at `apps/docs`, co-located with the packages it documents, so a
  single PR changes code and docs together and CI can typecheck doc examples against the real
  packages.
- **Hosting: build in the monorepo, deploy the static output to a dedicated
  `conform-ed/conform-ed.github.io` repo** (which holds built output only) via a least-privilege
  **deploy key**. On `github.io`, only a repo literally named `<org>.github.io` serves the org
  **bare root**; a project-pages site from the tooling repo would sit at
  `https://conform-ed.github.io/conform-ed/`. The two-repo split is the price of the bare-root URL
  while keeping the source co-located with the code.
- **API reference: hybrid.** Hand-written, example-driven guides are the primary surface (reusing
  the 17 `packages/contracts/*-zod-templates.md` files and the `CONTEXT.md` glossary). Generated
  symbol reference (`starlight-typedoc`) is added only for the code-shaped packages — `qti-react`,
  `qti-xml`, `cli` — where it pays off. Zod-schema contracts stay curated (TypeDoc renders runtime
  schemas poorly).
- **LLM-oriented docs are auto-generated, not hand-maintained.** A Starlight `llms.txt` plugin
  emits `/llms.txt` (curated link index) and `/llms-full.txt` (concatenated docs) from the same
  content at build time, so they cannot drift from the human docs. A human-facing
  "use these docs with your AI assistant" page explains the URLs and how to feed them to common
  assistants/IDEs.

## Considered and rejected

- **VitePress.** Lighter and ubiquitous for TS tooling, but its Vue host cannot render the React
  `qti-react` runtime natively (live demos would be awkward), and its landing page is less flexible
  for the branded hero.
- **Docusaurus.** Its headline feature is built-in doc versioning, which we do not need yet; it is
  heavier, more templated (harder to make the brand sing), and leans on Algolia for search.
- **Project pages on the monorepo (`/conform-ed/` path).** Dead simple — one repo,
  `actions/deploy-pages`, no cross-repo token — but the URL carries the `/conform-ed/` path and
  fails the explicit bare-root requirement.
- **A self-contained `conform-ed.github.io` repo holding the docs source.** Avoids the deploy key,
  but decouples docs from code: docs drift from the monorepo and examples can no longer be
  typechecked against the actual package source in the same PR.
- **Hand-maintained `llms.txt`.** Drifts from the human docs; auto-generation from Starlight content
  removes the maintenance burden and the drift.

## Consequences

- Two repos to operate: `conform-ed/conform-ed` (source + build workflow) and
  `conform-ed/conform-ed.github.io` (built output, Pages enabled at root). A deploy key (write to the
  pages repo, private half as a repo secret on the monorepo) wires the cross-repo deploy — not an
  org secret, so it works without `admin:org`.
- The org avatar is a **manual GitHub UI upload** (no API); the org-profile README lives in a
  `conform-ed/.github` repo. Pages config, Actions secrets, and branch protection are set up fresh
  under the new org (none transfer with a fresh-push move).
- Adding `@astrojs/react` pulls React into the docs build so `qti-react` demos can mount; this is
  isolated to `apps/docs` and does not affect the published packages.
