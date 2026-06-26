// EDC Reference Renderer (conform-ed ADR-0019) — the credential analogue of the QTI Reference
// Skin: a faithful, accessible, UNSTYLED semantic-HTML rendering of an EDC, framework-light
// (a pure function → HTML string + view-model, no React), shipped so credentials can be
// exercised/demoed/conformance-tested without a downstream product. Not a product UI; no PDF
// or pixel-parity with the EU Viewer.

import { buildViewModel, type BuildViewModelOptions, type EdcViewModel } from "./view-model";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function row(label: string, value: string | undefined): string {
  return value === undefined ? "" : `    <dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>\n`;
}

export interface RenderResult {
  readonly html: string;
  readonly viewModel: EdcViewModel;
}

/** Render an EDC to semantic, accessible HTML (+ the view-model it derived from). */
export function renderEdc(credential: unknown, options: BuildViewModelOptions = {}): RenderResult {
  const vm = buildViewModel(credential, options);

  const meta =
    row("Issued to", vm.subjectName) +
    row("Issued by", vm.issuerName) +
    row("Issued on", vm.issued) +
    row("Valid from", vm.validFrom) +
    row("Valid until", vm.validUntil);

  const claims =
    vm.claims.length === 0
      ? ""
      : `  <section aria-label="Claims">\n    <h2>Claims</h2>\n    <ul>\n${vm.claims
          .map(
            (c) =>
              `      <li>\n        <h3>${escapeHtml(c.title ?? c.kind)}</h3>\n` +
              (c.description !== undefined ? `        <p>${escapeHtml(c.description)}</p>\n` : "") +
              `      </li>\n`,
          )
          .join("")}    </ul>\n  </section>\n`;

  const images =
    vm.images.length === 0
      ? ""
      : `  <section aria-label="Credential display">\n    <h2>Display</h2>\n${vm.images
          .map(
            (img) =>
              `    <figure>\n      <img src="${escapeHtml(img.src)}" alt="${escapeHtml(
                img.alt ?? `Credential page ${img.page}`,
              )}" />\n      <figcaption>Page ${img.page}</figcaption>\n    </figure>\n`,
          )
          .join("")}  </section>\n`;

  const heading = vm.title !== undefined ? `  <h1>${escapeHtml(vm.title)}</h1>\n` : "";
  const html =
    `<article class="edc-credential" lang="${escapeHtml(vm.lang)}">\n` +
    heading +
    (meta !== "" ? `  <dl>\n${meta}  </dl>\n` : "") +
    claims +
    images +
    `</article>\n`;

  return { html, viewModel: vm };
}
